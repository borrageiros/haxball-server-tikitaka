import type { MapKey, TeamId } from "./constants";
import { TEAM } from "./constants";
import config from "../utils/config";

export function desiredTeamSize(connectedCount: number): number {
  return Math.min(config.maxTeamSize, Math.floor(connectedCount / 2));
}

export function desiredFieldCount(
  connectedCount: number,
  instantFill: boolean
): number {
  if (instantFill) {
    return Math.min(connectedCount, config.maxTeamSize * 2);
  }
  return desiredTeamSize(connectedCount) * 2;
}

export function desiredMapKey(
  eligiblePlayerCount: number,
  currentMap: MapKey
): MapKey {
  if (eligiblePlayerCount >= config.mapSwitchToBigPlayers) {
    return "big";
  }
  if (eligiblePlayerCount <= config.mapSwitchToSmallMaxPlayers) {
    return "small";
  }
  return currentMap;
}

export function pickTeamForPlayer(
  redCount: number,
  blueCount: number
): TeamId {
  if (redCount < blueCount) {
    return TEAM.RED;
  }
  if (blueCount < redCount) {
    return TEAM.BLUE;
  }
  return Math.random() < 0.5 ? TEAM.RED : TEAM.BLUE;
}

export function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = items[i];
    items[i] = items[j]!;
    items[j] = tmp!;
  }
  return items;
}
