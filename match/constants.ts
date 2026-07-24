export const TEAM = {
  SPECTATORS: 0,
  RED: 1,
  BLUE: 2,
} as const;

export type TeamId = (typeof TEAM)[keyof typeof TEAM];

export const MAX_TEAM_SIZE = 5;
export const BIG_MAP_MIN_TEAM_SIZE = 4;
export const MATCH_COUNTDOWN_SECONDS = 3;

export type MapKey = "small" | "big";
