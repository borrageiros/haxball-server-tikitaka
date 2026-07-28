import type createHaxball from "node-haxball";
import config from "../utils/config";
import loadStadium from "../utils/loadStadium";
import t from "../utils/i18n";
import type { Room } from "../commands/types";
import type { Stadium } from "../utils/loadStadium";
import {
  AFK_MOVE_EPSILON,
  MATCH_COUNTDOWN_SECONDS,
  TEAM,
  type MapKey,
  type TeamId,
} from "./constants";
import {
  desiredFieldCount,
  desiredMapKey,
  pickTeamForPlayer,
  shuffleInPlace,
} from "./helpers";

type HaxballAPI = ReturnType<typeof createHaxball>;
type HaxballUtils = HaxballAPI["Utils"];
type OperationTypeEnum = HaxballAPI["OperationType"];

export default function setupMatch(
  room: Room,
  utils: HaxballUtils,
  OperationType: OperationTypeEnum
): void {
  const stadiums: Record<MapKey, Stadium> = {
    small: loadStadium(utils, config.smallMapFile),
    big: loadStadium(utils, config.bigMapFile),
  };

  const instantFill = config.fillMode === "instant";
  const minFieldPlayers = instantFill ? 1 : 2;

  const connectionQueue: number[] = [];
  const fieldHistory: number[] = [];
  const lastActiveAt = new Map<number, number>();
  const lastPos = new Map<number, { x: number; y: number }>();
  const afkWarnedSec = new Map<number, number>();

  let currentMap: MapKey = "small";
  let pendingMap: MapKey | null = null;
  let mapChangeAnnounced = false;
  let readyForMapChange = false;
  let internalAction = false;
  let countdownTimer: ReturnType<typeof setTimeout> | null = null;

  room.setCurrentStadium(stadiums.small);
  room.fakeSetTeamsLock(true, 0);

  const previousOnOperationReceived = room.onOperationReceived;

  room.onOperationReceived = (type, msg, globalFrameNo, clientFrameNo, customData) => {
    const byId = (msg as { byId?: number }).byId;
    const hostOnly =
      type === OperationType.SetPlayerTeam ||
      type === OperationType.StartGame ||
      type === OperationType.StopGame ||
      type === OperationType.PauseResumeGame ||
      type === OperationType.SetTeamsLock ||
      type === OperationType.SetStadium ||
      type === OperationType.SetGamePlayLimit;

    if (hostOnly && byId !== 0) {
      return false;
    }

    if (previousOnOperationReceived) {
      return previousOnOperationReceived(
        type,
        msg,
        globalFrameNo,
        clientFrameNo,
        customData
      );
    }

    return true;
  };

  function playerName(playerId: number): string {
    return room.getPlayer(playerId)?.name ?? String(playerId);
  }

  function currentDesiredFieldCount(): number {
    return desiredFieldCount(connectionQueue.length, instantFill);
  }

  function isOnField(playerId: number): boolean {
    return fieldHistory.includes(playerId);
  }

  function clearAfkTracking(playerId: number): void {
    lastActiveAt.delete(playerId);
    lastPos.delete(playerId);
    afkWarnedSec.delete(playerId);
  }

  function initAfkTracking(playerId: number): void {
    lastActiveAt.set(playerId, Date.now());
    lastPos.delete(playerId);
    afkWarnedSec.delete(playerId);
  }

  function touchAfk(playerId: number): void {
    if (!isOnField(playerId)) {
      return;
    }
    lastActiveAt.set(playerId, Date.now());
    afkWarnedSec.delete(playerId);
  }

  function resetAfkForField(): void {
    const now = Date.now();
    for (const playerId of fieldHistory) {
      lastActiveAt.set(playerId, now);
      lastPos.delete(playerId);
      afkWarnedSec.delete(playerId);
    }
  }

  function countTeams(): { red: number; blue: number } {
    let red = 0;
    let blue = 0;
    for (const playerId of fieldHistory) {
      const player = room.getPlayer(playerId);
      if (!player) {
        continue;
      }
      if (player.team.id === TEAM.RED) {
        red += 1;
      } else if (player.team.id === TEAM.BLUE) {
        blue += 1;
      }
    }
    return { red, blue };
  }

  function moveToTeam(playerId: number, teamId: TeamId): void {
    const player = room.getPlayer(playerId);
    if (!player || player.team.id === teamId) {
      return;
    }
    room.setPlayerTeam(playerId, teamId);
  }

  function assignPlayers(playerIds: number[]): void {
    const { red, blue } = countTeams();
    let redCount = red;
    let blueCount = blue;

    for (const playerId of playerIds) {
      const teamId = pickTeamForPlayer(redCount, blueCount);
      moveToTeam(playerId, teamId);
      initAfkTracking(playerId);
      if (teamId === TEAM.RED) {
        redCount += 1;
      } else {
        blueCount += 1;
      }
    }
  }

  function balanceTeams(): void {
    const redIds: number[] = [];
    const blueIds: number[] = [];
    const unassigned: number[] = [];

    for (const playerId of fieldHistory) {
      const player = room.getPlayer(playerId);
      if (!player) {
        continue;
      }
      if (player.team.id === TEAM.RED) {
        redIds.push(playerId);
      } else if (player.team.id === TEAM.BLUE) {
        blueIds.push(playerId);
      } else {
        unassigned.push(playerId);
      }
    }

    for (const playerId of unassigned) {
      if (redIds.length <= blueIds.length) {
        redIds.push(playerId);
        moveToTeam(playerId, TEAM.RED);
      } else {
        blueIds.push(playerId);
        moveToTeam(playerId, TEAM.BLUE);
      }
    }

    while (redIds.length - blueIds.length > 1) {
      const playerId = redIds.pop();
      if (playerId == null) {
        break;
      }
      blueIds.push(playerId);
      moveToTeam(playerId, TEAM.BLUE);
    }

    while (blueIds.length - redIds.length > 1) {
      const playerId = blueIds.pop();
      if (playerId == null) {
        break;
      }
      redIds.push(playerId);
      moveToTeam(playerId, TEAM.RED);
    }
  }

  function reshuffleFieldTeams(): void {
    const players = shuffleInPlace([...fieldHistory]);
    players.forEach((playerId, index) => {
      moveToTeam(playerId, index % 2 === 0 ? TEAM.RED : TEAM.BLUE);
    });
  }

  function announce(message: string, color = 0xffffff): void {
    room.sendAnnouncement(message, null, color, "bold", 1);
  }

  function announceTo(
    playerId: number,
    message: string,
    color: number,
    sound = 2
  ): void {
    setTimeout(() => {
      if (!room.getPlayer(playerId)) {
        return;
      }
      room.sendAnnouncement(message, playerId, color, "bold", sound);
    }, 0);
  }

  function waitingMessage(): string {
    return instantFill ? t("match.teamsFull") : t("match.waitingForPlayers");
  }

  function removeFromField(playerId: number): boolean {
    const fieldIndex = fieldHistory.indexOf(playerId);
    if (fieldIndex < 0) {
      return false;
    }
    fieldHistory.splice(fieldIndex, 1);
    clearAfkTracking(playerId);
    moveToTeam(playerId, TEAM.SPECTATORS);
    announceTo(playerId, waitingMessage(), 0xffcc00);
    return true;
  }

  function notifyWaitingPlayer(playerId: number): void {
    if (isOnField(playerId)) {
      return;
    }
    announceTo(playerId, waitingMessage(), 0xffcc00);
  }

  function mapLabel(mapKey: MapKey): string {
    return mapKey === "big" ? t("match.mapBig") : t("match.mapSmall");
  }

  function clearCountdown(): void {
    if (countdownTimer != null) {
      clearTimeout(countdownTimer);
      countdownTimer = null;
    }
  }

  function canStartMatch(): boolean {
    return (
      currentDesiredFieldCount() >= minFieldPlayers &&
      room.gameState == null &&
      !internalAction
    );
  }

  function beginMatch(): void {
    if (!canStartMatch()) {
      return;
    }
    announce(t("match.kickoff"), 0x44ff44);
    room.startGame();
  }

  function tickCountdown(secondsLeft: number): void {
    countdownTimer = null;

    if (!canStartMatch()) {
      return;
    }

    if (secondsLeft > 0) {
      announce(
        t("match.countdown", { seconds: String(secondsLeft) }),
        0xffcc00
      );
      countdownTimer = setTimeout(() => {
        tickCountdown(secondsLeft - 1);
      }, 1000);
      return;
    }

    beginMatch();
  }

  function scheduleStart(): void {
    if (countdownTimer != null || !canStartMatch()) {
      return;
    }
    tickCountdown(MATCH_COUNTDOWN_SECONDS);
  }

  function applyStadium(mapKey: MapKey): void {
    if (currentMap === mapKey) {
      pendingMap = null;
      mapChangeAnnounced = false;
      readyForMapChange = false;
      return;
    }

    const wasRunning = room.gameState != null;
    const shouldRestart =
      wasRunning || currentDesiredFieldCount() >= minFieldPlayers;

    clearCountdown();
    internalAction = true;
    pendingMap = null;
    mapChangeAnnounced = false;
    readyForMapChange = false;

    if (wasRunning) {
      room.stopGame();
    }

    room.setCurrentStadium(stadiums[mapKey]);
    currentMap = mapKey;

    announce(t("match.mapChanged", { map: mapLabel(mapKey) }), 0x44aaff);
    internalAction = false;

    if (shouldRestart) {
      scheduleStart();
    }
  }

  function syncPendingMap(): void {
    const teamSize = Math.floor(currentDesiredFieldCount() / 2);
    const target = desiredMapKey(teamSize);

    if (target === currentMap) {
      pendingMap = null;
      mapChangeAnnounced = false;
      readyForMapChange = false;
      return;
    }

    pendingMap = target;

    if (!room.gameState) {
      applyStadium(target);
      return;
    }

    if (!mapChangeAnnounced) {
      mapChangeAnnounced = true;
      announce(t("match.mapPending", { map: mapLabel(target) }), 0xffcc00);
    }
  }

  function tryApplyPendingMap(): boolean {
    if (!pendingMap || pendingMap === currentMap) {
      pendingMap = null;
      mapChangeAnnounced = false;
      readyForMapChange = false;
      return false;
    }

    applyStadium(pendingMap);
    return true;
  }

  function ensureGameState(): void {
    const gameActive = room.gameState != null;

    if (currentDesiredFieldCount() < minFieldPlayers) {
      clearCountdown();
      if (gameActive && !internalAction) {
        internalAction = true;
        room.stopGame();
        internalAction = false;
      }
      return;
    }

    if (!gameActive) {
      scheduleStart();
    }
  }

  function handleAfk(playerId: number): void {
    if (!isOnField(playerId) || !room.getPlayer(playerId)) {
      return;
    }

    const name = playerName(playerId);
    const message = t("match.kickedAfk", { name });
    announce(message, 0xff4444);
    room.kickPlayer(playerId, message, false);
  }

  function syncRoster(): void {
    const desiredCount = currentDesiredFieldCount();

    while (fieldHistory.length > desiredCount) {
      const playerId = fieldHistory[fieldHistory.length - 1];
      if (playerId == null) {
        break;
      }
      const name = playerName(playerId);
      removeFromField(playerId);
      announce(t("match.movedToSpectators", { name }), 0xffaa44);
    }

    const newcomers: number[] = [];
    const waiting = connectionQueue.filter((playerId) => !isOnField(playerId));

    while (fieldHistory.length < desiredCount && waiting.length > 0) {
      const playerId = waiting.shift();
      if (playerId == null) {
        break;
      }
      fieldHistory.push(playerId);
      newcomers.push(playerId);
    }

    if (newcomers.length > 0) {
      assignPlayers(newcomers);
    }

    for (const playerId of connectionQueue) {
      if (!isOnField(playerId)) {
        moveToTeam(playerId, TEAM.SPECTATORS);
      }
    }

    balanceTeams();

    if (newcomers.length === 1) {
      announce(
        t("match.playerEntered", { name: playerName(newcomers[0]!) }),
        0x44ff44
      );
    } else if (newcomers.length > 1) {
      const { red, blue } = countTeams();
      announce(
        t("match.playersEntered", {
          count: String(newcomers.length),
          red: String(red),
          blue: String(blue),
        }),
        0x44ff44
      );
    }

    syncPendingMap();
    ensureGameState();
  }

  room.onPlayerJoin = (player) => {
    connectionQueue.push(player.id);
    moveToTeam(player.id, TEAM.SPECTATORS);
    announce(t("match.playerJoined", { name: player.name }), 0xffffff);
    syncRoster();
    notifyWaitingPlayer(player.id);
  };

  room.onPlayerLeave = (player) => {
    const index = connectionQueue.indexOf(player.id);
    if (index >= 0) {
      connectionQueue.splice(index, 1);
    }

    const fieldIndex = fieldHistory.indexOf(player.id);
    if (fieldIndex >= 0) {
      fieldHistory.splice(fieldIndex, 1);
    }

    clearAfkTracking(player.id);
    syncRoster();
  };

  room.onPlayerInputChange = (playerId) => {
    touchAfk(playerId);
  };

  room.onPlayerChat = (playerId) => {
    touchAfk(playerId);
  };

  room.onPlayerChatIndicatorChange = (playerId, typing) => {
    if (typing) {
      touchAfk(playerId);
    }
  };

  room.onGameStart = () => {
    resetAfkForField();
  };

  room.onPositionsReset = () => {
    resetAfkForField();
    if (!readyForMapChange || !pendingMap || internalAction) {
      return;
    }
    tryApplyPendingMap();
  };

  room.onGameTick = () => {
    const gameState = room.gameState;
    if (!gameState) {
      return;
    }

    if (gameState.paused) {
      resetAfkForField();
      return;
    }

    const now = Date.now();
    const epsilonSq = AFK_MOVE_EPSILON * AFK_MOVE_EPSILON;
    const warningAtMs = config.afkTimeoutMs / 2;

    for (const playerId of [...fieldHistory]) {
      const disc = room.getPlayerDisc(playerId);
      const pos = disc?.pos;
      if (!pos) {
        continue;
      }

      const prev = lastPos.get(playerId);
      if (!prev) {
        lastPos.set(playerId, { x: pos.x, y: pos.y });
        lastActiveAt.set(playerId, now);
        afkWarnedSec.delete(playerId);
        continue;
      }

      const dx = pos.x - prev.x;
      const dy = pos.y - prev.y;
      if (dx * dx + dy * dy > epsilonSq) {
        lastPos.set(playerId, { x: pos.x, y: pos.y });
        lastActiveAt.set(playerId, now);
        afkWarnedSec.delete(playerId);
        continue;
      }

      const activeAt = lastActiveAt.get(playerId) ?? now;
      const idleMs = now - activeAt;

      if (idleMs >= config.afkTimeoutMs) {
        handleAfk(playerId);
        continue;
      }

      if (idleMs < warningAtMs) {
        afkWarnedSec.delete(playerId);
        continue;
      }

      const remainingSec = Math.max(
        1,
        Math.ceil((config.afkTimeoutMs - idleMs) / 1000)
      );
      if (afkWarnedSec.get(playerId) === remainingSec) {
        continue;
      }
      afkWarnedSec.set(playerId, remainingSec);
      announceTo(
        playerId,
        t("match.afkWarning", { seconds: String(remainingSec) }),
        0xffaa00,
        1
      );
    }
  };

  room.onTeamGoal = () => {
    if (pendingMap) {
      readyForMapChange = true;
    }
  };

  room.onGameEnd = () => {
    if (internalAction) {
      return;
    }

    reshuffleFieldTeams();
    announce(t("match.teamsReshuffled"), 0x44aaff);
  };

  room.onGameStop = () => {
    if (internalAction) {
      return;
    }

    if (pendingMap && pendingMap !== currentMap) {
      tryApplyPendingMap();
      return;
    }

    ensureGameState();
  };
}
