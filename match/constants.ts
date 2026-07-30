export const TEAM = {
  SPECTATORS: 0,
  RED: 1,
  BLUE: 2,
} as const;

export type TeamId = (typeof TEAM)[keyof typeof TEAM];

export const TEAM_CHAT_COLOR: Record<TeamId, number> = {
  [TEAM.SPECTATORS]: 0xffffff,
  [TEAM.RED]: 0xe56e56,
  [TEAM.BLUE]: 0x5689e5,
};

export const DEFAULT_MAP_SWITCH_TO_BIG_PLAYERS = 8;
export const DEFAULT_MAP_SWITCH_TO_SMALL_MAX_PLAYERS = 6;
export const MATCH_COUNTDOWN_SECONDS = 3;
export const AFK_MOVE_EPSILON = 0.05;

export type MapKey = "small" | "big";
