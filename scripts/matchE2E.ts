import createHaxball from "node-haxball";

const API = createHaxball();
const { Utils, Room, ConnectionState } = API;

const ROOM_ID = process.argv[2] || "fn37EnzHMn0";
const JOIN_GAP_MS = Number(process.env.JOIN_GAP_MS || 2800);
const RUN_ID = Date.now().toString(36).slice(-4);

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
    stadium: (room.stadium?.name as string) ?? null,
    score: gameActive ? `${room.redScore ?? 0}-${room.blueScore ?? 0}` : null,
    gameActive,
  };
}

function expectBalance(id: string, expectedSize: number): void {
  const snap = snapshot();
  const ok =
    snap.red.length === expectedSize &&
    snap.blue.length === expectedSize &&
    (expectedSize === 0 ? !snap.gameActive : snap.gameActive);
  record(
    id,
    ok,
    `red=${snap.red.length}[${snap.red}] blue=${snap.blue.length}[${snap.blue}] spec=${snap.spec.length}[${snap.spec}] game=${snap.gameActive} stadium=${snap.stadium} score=${snap.score}`
  );
}

function expectStadium(id: string, kind: "small" | "big"): void {
  const name = (snapshot().stadium ?? "").toLowerCase();
  const ok = kind === "big" ? name.includes("5") : name.includes("3");
  record(id, ok, `stadium="${snapshot().stadium}" expected ${kind}`);
}

function expectAnnouncement(id: string, fragment: string, sinceIndex: number): void {
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

async function joinBot(index: number, retries = 6): Promise<Bot> {
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
            password: null,
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
                const key = `${msg}`;
                if (!seenAnnouncements.has(key)) {
                  seenAnnouncements.add(key);
                  announcements.push(msg);
                  log(`ANN: ${msg}`);
                } else {
                  announcements.push(msg);
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
  log(`LEFT ${name} (roomPlayers=${snapshot().names.length} tracked=${bots.length})`);
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
  log(`Room=${ROOM_ID} run=${RUN_ID} joinGap=${JOIN_GAP_MS}ms`);

  console.log(`
========== PLAN DE CASOS ==========
A) Entradas progresivas 1..11
B) Salida en 5vs5 con espectador
C) Bajar a 3vs3
D) LIFO 2vs2 -> 1vs1
E) 4vs4 + gol -> mapa grande + marcador
F) 3vs3 + gol -> mapa pequeño + marcador
G) Cambio manual de equipo
===================================
`);

  log("--- A: joins ---");
  await joinBot(1);
  if (snapshot().names.length > 1) {
    throw new Error(
      `Room is not empty at start (players=${snapshot().names.join(",")}). Restart the room and retry.`
    );
  }
  expectBalance("A1_1_player_spect_no_game", 0);

  await joinBot(2);
  expectBalance("A2_2_players_1v1", 1);

  await joinBot(3);
  expectBalance("A3_3_players_still_1v1", 1);
  record(
    "A3b_third_spectator",
    snapshot().spec.includes(botName(3)),
    `spec=${snapshot().spec}`
  );

  await joinBot(4);
  expectBalance("A4_4_players_2v2", 2);

  await joinBot(5);
  expectBalance("A5_5_players_still_2v2", 2);

  await joinBot(6);
  expectBalance("A6_6_players_3v3", 3);
  expectStadium("A6b_small_map", "small");

  await joinBot(7);
  expectBalance("A7_7_players_still_3v3", 3);

  const annAt8 = announcements.length;
  await joinBot(8);
  expectBalance("A8_8_players_4v4", 4);
  expectAnnouncement("A8b_map_pending_or_changed", "mapa", annAt8);

  await joinBot(9);
  expectBalance("A9_9_players_still_4v4", 4);
  record(
    "A9b_ninth_spectator",
    snapshot().spec.includes(botName(9)),
    `spec=${snapshot().spec}`
  );

  await joinBot(10);
  expectBalance("A10_10_players_5v5", 5);

  await joinBot(11);
  expectBalance("A11_11_players_still_5v5", 5);
  record(
    "A11b_eleventh_spectator",
    snapshot().spec.includes(botName(11)),
    `spec=${snapshot().spec}`
  );

  log("--- B: leave from 5v5 fills from oldest spectator ---");
  const before = snapshot();
  const oldestSpec =
    before.spec.find((n) => n.startsWith(`T${RUN_ID}_`)) ?? before.spec[0];
  const victim = before.red[0] ?? before.blue[0];
  if (!victim || !oldestSpec) {
    record("B1_precondition", false, `victim=${victim} oldestSpec=${oldestSpec}`);
  } else {
    await leaveBot(victim);
    expectBalance("B1_still_5v5_after_field_leave", 5);
    const after = snapshot();
    record(
      "B1b_oldest_spec_entered",
      after.red.includes(oldestSpec) || after.blue.includes(oldestSpec),
      `oldestSpec=${oldestSpec} red=${after.red} blue=${after.blue} spec=${after.spec}`
    );
  }

  log("--- C: shrink to 3v3 ---");
  const hadBigMap = (snapshot().stadium ?? "").toLowerCase().includes("5");
  const annC = announcements.length;
  while (snapshot().names.filter((n) => n.startsWith(`T${RUN_ID}_`)).length > 6) {
    const tracked = bots[bots.length - 1];
    if (!tracked) break;
    await leaveBot(tracked.name);
  }
  expectBalance("C1_6_players_3v3", 3);
  record(
    "C1c_connected_count",
    snapshot().names.length === 6,
    `connected=${snapshot().names.length} names=${snapshot().names}`
  );
  if (hadBigMap) {
    expectAnnouncement("C1b_small_map_signal", "mapa", annC);
  } else {
    record(
      "C1b_small_map_signal",
      true,
      "skipped: map was still small (no prior goal to switch big)"
    );
  }

  log("--- D: LIFO 2v2 -> 1v1 ---");
  while (snapshot().names.filter((n) => n.startsWith(`T${RUN_ID}_`)).length > 4) {
    const tracked = bots[bots.length - 1];
    if (!tracked) break;
    await leaveBot(tracked.name);
  }
  expectBalance("D1_4_players_2v2", 2);
  record(
    "D1b_connected_count",
    snapshot().names.length === 4,
    `connected=${snapshot().names.length}`
  );
  const dSnap = snapshot();
  const dVictim = dSnap.red[0] ?? dSnap.blue[0];
  if (dVictim) {
    await leaveBot(dVictim);
    expectBalance("D2_3_connected_back_to_1v1", 1);
    record(
      "D2b_connected_count",
      snapshot().names.length === 3,
      `connected=${snapshot().names.length} red=${snapshot().red} blue=${snapshot().blue} spec=${snapshot().spec}`
    );
  }

  log("--- E: rebuild 8, wait goal for big map + score ---");
  let nextIndex = 20;
  while (bots.length < 8) {
    await joinBot(nextIndex++);
  }
  expectBalance("E1_8_players_4v4", 4);

  const scoreBeforeGoal = snapshot().score;
  const stadiumBefore = snapshot().stadium;
  const annE = announcements.length;
  log(`Waiting goal for map swap. stadium=${stadiumBefore} score=${scoreBeforeGoal}`);

  const scored = await waitForScoreChange(scoreBeforeGoal, 180000);
  const goalOk = Boolean(scored && scored !== scoreBeforeGoal);
  record("E2_goal_scored", goalOk, `before=${scoreBeforeGoal} after=${scored}`);

  if (goalOk) {
    await waitUntil("big map after goal", () => {
      const n = (snapshot().stadium ?? "").toLowerCase();
      return n.includes("5");
    }, 8000);
    await sleep(1000);
    expectStadium("E3_big_map_after_goal", "big");
    expectAnnouncement("E3b_score_preserved_msg", "Marcador", annE);
    const afterScore = snapshot().score;
    record(
      "E3c_score_kept_nonzero_or_same_as_goal",
      afterScore === scored || (afterScore != null && afterScore !== "0-0"),
      `goalScore=${scored} now=${afterScore}`
    );
  }

  log("--- F: shrink to 3v3, wait goal for small map + score ---");
  while (bots.length > 6) {
    await leaveBot(bots[bots.length - 1]!.name);
  }
  expectBalance("F1_6_players_3v3", 3);
  const scoreBeforeSmall = snapshot().score;
  const annF = announcements.length;
  const scoredSmall = await waitForScoreChange(scoreBeforeSmall, 180000);
  const smallGoalOk = Boolean(scoredSmall && scoredSmall !== scoreBeforeSmall);
  record("F2_goal_for_small", smallGoalOk, `before=${scoreBeforeSmall} after=${scoredSmall}`);
  if (smallGoalOk) {
    await waitUntil("small map after goal", () => {
      const n = (snapshot().stadium ?? "").toLowerCase();
      return n.includes("3");
    }, 8000);
    await sleep(1000);
    expectStadium("F3_small_map_after_goal", "small");
    expectAnnouncement("F3b_score_preserved_msg", "Marcador", annF);
    const afterScore = snapshot().score;
    record(
      "F3c_score_kept",
      afterScore === scoredSmall || (afterScore != null && afterScore !== "0-0"),
      `goalScore=${scoredSmall} now=${afterScore}`
    );
  }

  log("--- G: manual team change ---");
  const bot = bots.find((b) => snapshot().red.includes(b.name) || snapshot().blue.includes(b.name));
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
      "G1_team_change_ineffective_vs_balancer",
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
