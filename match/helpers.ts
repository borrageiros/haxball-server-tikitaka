import type { MapKey, TeamId } from "./constants";
import { BIG_MAP_MIN_TEAM_SIZE, MAX_TEAM_SIZE, TEAM } from "./constants";

export function desiredTeamSize(connectedCount: number): number {
  return Math.min(MAX_TEAM_SIZE, Math.floor(connectedCount / 2));
}

export function desiredMapKey(teamSize: number): MapKey {
  return teamSize >= BIG_MAP_MIN_TEAM_SIZE ? "big" : "small";
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
