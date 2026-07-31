import createHaxball from "node-haxball";

const API = createHaxball();
const { Utils, Room, ConnectionState } = API;

function parseRoomId(raw: string): string {
  const value = (raw || "").trim();
  const fromQuery = value.match(/[?&]c=([^&]+)/i);
  if (fromQuery?.[1]) {
    return decodeURIComponent(fromQuery[1]);
  }
  const fromPath = value.match(/haxball\.com\/play\/([^/?#]+)/i);
  if (fromPath?.[1]) {
    return decodeURIComponent(fromPath[1]);
  }
  return value.replace(/^https?:\/\//i, "").split("/").pop() || value;
}

const ROOM_ID = parseRoomId(process.argv[2] || "");
const ROOM_PASSWORD = (process.env.ROOM_PASSWORD || "").trim() || null;
const JOIN_GAP_MS = Number(process.env.JOIN_GAP_MS || 2800);
const GOAL_TIMEOUT_MS = Number(process.env.GOAL_TIMEOUT_MS || 180000);
const RUN_ID = Date.now().toString(36).slice(-4);

if (!ROOM_ID) {
  console.error("Usage: node scripts/matchE2E.ts <roomId|roomLink>");
  process.exit(2);
}

function botName(index: number): string {
  return `T${RUN_ID}_${String(index).padStart(2, "0")}`;
}

type Bot = {
  name: string;
  room: any;
  leave: () => void;
};

type CheckResult = {
  id: string;
  ok: boolean;
  detail: string;
};

const results: CheckResult[] = [];
const bots: Bot[] = [];
const announcements: string[] = [];
const seenAnnouncements = new Set<string>();
let nextBotIndex = 1;

function log(msg: string): void {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

function record(id: string, ok: boolean, detail: string): void {
  results.push({ id, ok, detail });
  log(`${ok ? "PASS" : "FAIL"} ${id}: ${detail}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function observer(): any {
  return bots.find((b) => b.room)?.room ?? null;
}

function snapshot() {
  const room = observer();
  if (!room) {
    return {
      names: [] as string[],
      teams: {} as Record<string, number>,
      red: [] as string[],
      blue: [] as string[],
      spec: [] as string[],
      field: [] as string[],
      stadium: null as string | null,
      score: null as string | null,
      gameActive: false,
    };
  }

  const teams: Record<string, number> = {};
  const red: string[] = [];
  const blue: string[] = [];
  const spec: string[] = [];

  for (const player of room.players as any[]) {
    const teamId = player.team.id;
    teams[player.name] = teamId;
    if (teamId === 1) red.push(player.name);
    else if (teamId === 2) blue.push(player.name);
    else spec.push(player.name);
  }

  const gameActive = room.gameState != null;
  return {
    names: (room.players as any[]).map((p) => p.name),
    teams,
    red,
    blue,
    spec,
    field: [...red, ...blue],
    stadium: (room.stadium?.name as string) ?? null,
    score: gameActive ? `${room.redScore ?? 0}-${room.blueScore ?? 0}` : null,
    gameActive,
  };
}

function stadiumKind(name: string | null): "small" | "big" | "unknown" {
  const lower = (name ?? "").toLowerCase();
  if (lower.includes("5")) return "big";
  if (lower.includes("3")) return "small";
  return "unknown";
}

function expectField(id: string, expectedOnField: number): void {
  const snap = snapshot();
  const onField = snap.field.length;
  const balanced = Math.abs(snap.red.length - snap.blue.length) <= 1;
  const ok =
    onField === expectedOnField &&
    balanced &&
    (expectedOnField === 0 ? !snap.gameActive : snap.gameActive);
  record(
    id,
    ok,
    `field=${onField} red=${snap.red.length}[${snap.red}] blue=${snap.blue.length}[${snap.blue}] spec=${snap.spec.length}[${snap.spec}] game=${snap.gameActive} stadium=${snap.stadium} score=${snap.score}`
  );
}

function expectStadium(id: string, kind: "small" | "big"): void {
  const stadium = snapshot().stadium;
  record(id, stadiumKind(stadium) === kind, `stadium="${stadium}" expected ${kind}`);
}

function expectAnnouncement(
  id: string,
  fragment: string,
  sinceIndex: number
): void {
  const hit = announcements
    .slice(sinceIndex)
    .find((a) => a.toLowerCase().includes(fragment.toLowerCase()));
  record(
    id,
    Boolean(hit),
    hit
      ? `found "${hit}"`
      : `missing "${fragment}" | recent=${announcements.slice(-6).join(" || ")}`
  );
}

function attachAutoPlay(room: any): void {
  room.onGameTick = () => {
    try {
      room.extrapolate?.();
      const cp = room.currentPlayer;
      const playerDisc = cp?.disc?.ext ?? cp?.disc;
      if (!playerDisc) return;
      const gameState = room.gameStateExt || room.gameState;
      const ball = gameState?.physicsState?.discs?.[0];
      const x = ball?.pos?.x;
      const y = ball?.pos?.y;
      if (x == null || y == null) return;
      const deltaX = x - playerDisc.pos.x;
      const deltaY = y - playerDisc.pos.y;
      const dirX = Math.abs(deltaX) < 0.5 ? 0 : Math.sign(deltaX);
      const dirY = Math.abs(deltaY) < 0.5 ? 0 : Math.sign(deltaY);
      const radius = (playerDisc.radius ?? 15) + (ball.radius ?? 10) + 8;
      const kick = deltaX * deltaX + deltaY * deltaY < radius * radius;
      room.setKeyState(Utils.keyState(dirX, dirY, kick));
    } catch {
      /* ignore tick errors */
    }
  };
}

async function joinBot(index = nextBotIndex++, retries = 6): Promise<Bot> {
  const name = botName(index);

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const [authKey, authObj] = await Utils.generateAuth();

      const bot = await new Promise<Bot>((resolve, reject) => {
        let settled = false;
        const timeout = setTimeout(() => {
          if (!settled) {
            settled = true;
            reject(new Error(`Timeout joining ${name}`));
          }
        }, 30000);

        Room.join(
          {
            id: ROOM_ID,
            password: ROOM_PASSWORD,
            authObj,
          },
          {
            storage: {
              player_name: name,
              avatar: String(index % 10),
              player_auth_key: authKey,
              geo: { lat: 40.4, lon: -3.7, flag: "es" },
              crappy_router: true,
            },
            plugins: [],
            onOpen: (room: any) => {
              if (settled) return;
              settled = true;
              clearTimeout(timeout);

              room.onAnnouncement = (msg: string) => {
                announcements.push(msg);
                if (!seenAnnouncements.has(msg)) {
                  seenAnnouncements.add(msg);
                  log(`ANN: ${msg}`);
                }
              };

              attachAutoPlay(room);

              const created: Bot = {
                name,
                room,
                leave: () => room.leave(),
              };
              bots.push(created);
              log(`JOINED ${name} (players=${room.players.length})`);
              resolve(created);
            },
            onClose: (msg: any) => {
              log(`CLOSE ${name}: ${msg?.toString?.() ?? msg}`);
              const idx = bots.findIndex((b) => b.name === name);
              if (idx >= 0) bots.splice(idx, 1);
              if (!settled) {
                settled = true;
                clearTimeout(timeout);
                reject(new Error(`Closed before open: ${name} ${msg}`));
              }
            },
            onConnInfo: (state: number, extra: any) => {
              if (state === ConnectionState.ConnectionFailed) {
                log(`CONN FAIL ${name}: ${JSON.stringify(extra)}`);
              }
            },
          }
        );
      });

      await sleep(JOIN_GAP_MS);
      return bot;
    } catch (err) {
      log(`join attempt ${attempt}/${retries} failed for ${name}: ${err}`);
      if (attempt === retries) throw err;
      await sleep(2000 * attempt);
    }
  }

  throw new Error(`Failed to join ${name}`);
}

async function leaveBot(name: string): Promise<void> {
  const idx = bots.findIndex((b) => b.name === name);
  if (idx < 0) return;
  const bot = bots[idx]!;
  try {
    bot.leave();
  } catch (err) {
    log(`leave error ${name}: ${err}`);
  }

  const start = Date.now();
  while (Date.now() - start < 5000) {
    if (!bots.some((b) => b.name === name)) {
      break;
    }
    await sleep(200);
  }

  const still = bots.findIndex((b) => b.name === name);
  if (still >= 0) {
    bots.splice(still, 1);
  }

  await sleep(800);
  log(
    `LEFT ${name} (roomPlayers=${snapshot().names.length} tracked=${bots.length})`
  );
}

async function leaveNewest(count: number): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    const bot = bots[bots.length - 1];
    if (!bot) break;
    await leaveBot(bot.name);
  }
}

async function ensureBotCount(count: number): Promise<void> {
  while (bots.length > count) {
    await leaveNewest(1);
  }
  while (bots.length < count) {
    await joinBot();
  }
  const ready = await waitForField(count);
  if (!ready) {
    throw new Error(
      `Timeout ensuring ${count} on field; snap=${JSON.stringify(snapshot())}`
    );
  }
}

async function cleanupBots(): Promise<void> {
  for (const b of [...bots]) {
    await leaveBot(b.name);
  }
}

async function waitUntil(
  label: string,
  predicate: () => boolean,
  timeoutMs: number
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return true;
    await sleep(400);
  }
  log(`TIMEOUT waiting for ${label}`);
  return false;
}

async function waitForField(expectedOnField: number, timeoutMs = 15000): Promise<boolean> {
  return waitUntil(
    `field=${expectedOnField}`,
    () => {
      const snap = snapshot();
      const balanced = Math.abs(snap.red.length - snap.blue.length) <= 1;
      if (expectedOnField === 0) {
        return snap.field.length === 0 && !snap.gameActive;
      }
      return (
        snap.field.length === expectedOnField &&
        balanced &&
        snap.gameActive
      );
    },
    timeoutMs
  );
}

async function waitForScoreChange(
  previous: string | null,
  timeoutMs: number
): Promise<string | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const score = snapshot().score;
    if (score && score !== previous) return score;
    await sleep(400);
  }
  return snapshot().score;
}

async function waitForGoalAndStadium(
  kind: "small" | "big",
  timeoutMs = GOAL_TIMEOUT_MS
): Promise<{ scored: string | null; switched: boolean }> {
  const scoreBefore = snapshot().score;
  const scored = await waitForScoreChange(scoreBefore, timeoutMs);
  const goalOk = Boolean(scored && scored !== scoreBefore);
  if (!goalOk) {
    return { scored, switched: false };
  }
  const switched = await waitUntil(
    `${kind} map after goal`,
    () => stadiumKind(snapshot().stadium) === kind,
    10000
  );
  await sleep(1000);
  return { scored, switched };
}

function printResults(): void {
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log("\n========== RESULTS ==========");
  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"} | ${r.id} | ${r.detail}`);
  }
  console.log(`\nTotal=${results.length} PASS=${passed} FAIL=${failed}`);
}

async function run(): Promise<void> {
  log(
    `Room=${ROOM_ID} run=${RUN_ID} joinGap=${JOIN_GAP_MS}ms goalTimeout=${GOAL_TIMEOUT_MS}ms`
  );

  console.log(`
========== PLAN DE CASOS ==========
A) Joins instant 1..8 + aviso mapa grande
B) Gol con 8 -> mapa grande (marcador a 0)
C) Pending cancelado: 8 -> leave a 6 antes del gol -> sigue small
D) Pending recuperado: 6 -> rejoin a 8 -> gol -> big
E) Histeresis: big con 8 -> leave a 7 -> sigue big
F) Shrink a 6 en big -> gol -> small
G) Cambio manual de equipo no aplica
===================================
`);

  log("--- A: progressive joins (instant) ---");
  await joinBot();
  if (snapshot().names.length > 1) {
    throw new Error(
      `Room is not empty at start (players=${snapshot().names.join(",")}). Restart the room and retry.`
    );
  }
  await waitForField(1);
  expectField("A1_1_player_starts", 1);
  expectStadium("A1b_small_map", "small");

  await joinBot();
  await waitForField(2);
  expectField("A2_2_players_1v1", 2);

  await joinBot();
  await waitForField(3);
  expectField("A3_3_players_2v1", 3);

  await joinBot();
  await waitForField(4);
  expectField("A4_4_players_2v2", 4);

  await joinBot();
  await waitForField(5);
  expectField("A5_5_players_3v2", 5);

  await joinBot();
  await waitForField(6);
  expectField("A6_6_players_3v3", 6);
  expectStadium("A6b_still_small", "small");

  await joinBot();
  await waitForField(7);
  expectField("A7_7_players_4v3_hysteresis_small", 7);
  expectStadium("A7b_still_small", "small");

  const annAt8 = announcements.length;
  await joinBot();
  await waitForField(8);
  expectField("A8_8_players_4v4", 8);
  expectAnnouncement("A8b_map_pending", "mapa", annAt8);

  log("--- B: goal switches to big and resets score ---");
  const beforeBig = snapshot().score;
  const { scored: scoredBig, switched: switchedBig } =
    await waitForGoalAndStadium("big");
  record(
    "B1_goal_scored",
    Boolean(scoredBig && scoredBig !== beforeBig),
    `before=${beforeBig} after=${scoredBig}`
  );
  record(
    "B2_big_map_after_goal",
    switchedBig,
    `stadium=${snapshot().stadium}`
  );
  if (switchedBig) {
    await waitUntil(
      "rematch after big map",
      () => snapshot().gameActive && snapshot().score === "0-0",
      12000
    );
    const after = snapshot().score;
    record(
      "B3_score_reset_after_map_change",
      after === "0-0",
      `score=${after} game=${snapshot().gameActive}`
    );
  }

  log("--- C: disconnect while pending big cancels switch ---");
  await ensureBotCount(6);
  await waitForField(6);
  expectField("C1_back_to_6", 6);
  if (stadiumKind(snapshot().stadium) === "big") {
    const beforeSmall = snapshot().score;
    const { scored, switched } = await waitForGoalAndStadium("small");
    record(
      "C2_goal_to_leave_big",
      Boolean(scored && scored !== beforeSmall),
      `before=${beforeSmall} after=${scored}`
    );
    record("C3_small_after_shrink", switched, `stadium=${snapshot().stadium}`);
  } else {
    record(
      "C2_already_small_after_shrink",
      true,
      `stadium=${snapshot().stadium}`
    );
  }

  const annBeforePending = announcements.length;
  await ensureBotCount(8);
  await waitForField(8);
  expectField("C4_8_again_pending_big", 8);
  expectStadium("C4b_still_small_before_goal", "small");
  expectAnnouncement("C4c_pending_again", "mapa", annBeforePending);

  await leaveNewest(2);
  await waitForField(6);
  expectField("C5_leave_to_6_while_pending", 6);
  expectStadium("C5b_still_small", "small");

  const scoreBeforeCancel = snapshot().score;
  const scoredCancel = await waitForScoreChange(
    scoreBeforeCancel,
    GOAL_TIMEOUT_MS
  );
  const cancelGoalOk = Boolean(
    scoredCancel && scoredCancel !== scoreBeforeCancel
  );
  record(
    "C6_goal_after_pending_cancelled",
    cancelGoalOk,
    `before=${scoreBeforeCancel} after=${scoredCancel}`
  );
  await sleep(2500);
  expectStadium("C7_stays_small_after_goal", "small");
  record(
    "C7b_did_not_switch_to_big",
    stadiumKind(snapshot().stadium) === "small",
    `stadium=${snapshot().stadium}`
  );

  log("--- D: reconnect enough players recovers pending big ---");
  const annRecover = announcements.length;
  await ensureBotCount(8);
  await waitForField(8);
  expectField("D1_8_players_again", 8);
  expectAnnouncement("D1b_pending_recovered", "mapa", annRecover);

  const beforeRecover = snapshot().score;
  const { scored: scoredRecover, switched: switchedRecover } =
    await waitForGoalAndStadium("big");
  record(
    "D2_goal_after_reconnect",
    Boolean(scoredRecover && scoredRecover !== beforeRecover),
    `before=${beforeRecover} after=${scoredRecover}`
  );
  record(
    "D3_big_map_recovered",
    switchedRecover,
    `stadium=${snapshot().stadium}`
  );

  log("--- E: hysteresis keeps big at 7 ---");
  if (stadiumKind(snapshot().stadium) !== "big") {
    record(
      "E0_precondition_big",
      false,
      `stadium=${snapshot().stadium} (skip hysteresis)`
    );
  } else {
    await leaveNewest(1);
    await waitForField(7);
    expectField("E1_7_players_on_big", 7);
    await sleep(1500);
    expectStadium("E2_hysteresis_keeps_big", "big");
  }

  log("--- F: shrink to 6 on big -> goal -> small ---");
  await ensureBotCount(6);
  await waitForField(6);
  expectField("F1_6_players", 6);
  if (stadiumKind(snapshot().stadium) === "big") {
    const beforeSmall = snapshot().score;
    const { scored, switched } = await waitForGoalAndStadium("small");
    record(
      "F2_goal_for_small",
      Boolean(scored && scored !== beforeSmall),
      `before=${beforeSmall} after=${scored}`
    );
    record("F3_small_map_after_goal", switched, `stadium=${snapshot().stadium}`);
  } else {
    record(
      "F2_already_small",
      true,
      `stadium=${snapshot().stadium}`
    );
  }

  log("--- G: manual team change ---");
  const bot = bots.find(
    (b) => snapshot().red.includes(b.name) || snapshot().blue.includes(b.name)
  );
  if (bot) {
    const beforeTeam = bot.room.currentPlayer?.team?.id;
    try {
      bot.room.changeTeam(beforeTeam === 1 ? 2 : 1);
    } catch {
      /* ignore */
    }
    await sleep(1000);
    const assigned = snapshot().teams[bot.name];
    const afterTeam = bot.room.currentPlayer?.team?.id;
    record(
      "G1_team_change_ineffective",
      assigned === beforeTeam || afterTeam === beforeTeam,
      `before=${beforeTeam} after=${afterTeam} assigned=${assigned}`
    );
  } else {
    record("G1_team_change", false, "no field bot available");
  }
}

async function main(): Promise<void> {
  try {
    await run();
  } catch (err) {
    console.error(err);
    record("Z_aborted", false, String(err));
  } finally {
    log("--- cleanup ---");
    await cleanupBots();
    printResults();
  }
  process.exit(results.some((r) => !r.ok) ? 1 : 0);
}

main();
