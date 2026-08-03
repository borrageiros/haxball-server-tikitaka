import path from "path";
import dotenv from "dotenv";
import {
  DEFAULT_BIG_MAP_SCORE_LIMIT,
  DEFAULT_BIG_MAP_TIME_LIMIT,
  DEFAULT_MAP_SWITCH_TO_BIG_PLAYERS,
  DEFAULT_MAP_SWITCH_TO_SMALL_MAX_PLAYERS,
  DEFAULT_SMALL_MAP_SCORE_LIMIT,
  DEFAULT_SMALL_MAP_TIME_LIMIT,
} from "../match/constants";

const rootDir = process.cwd();

dotenv.config({
  path: path.join(rootDir, ".env.example"),
  quiet: true,
});
dotenv.config({
  path: path.join(rootDir, ".env"),
  override: true,
  quiet: true,
});

function toBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function toNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toMatchLimit(value: string | undefined, fallback: number): number {
  return Math.max(0, Math.min(99, Math.floor(toNumber(value, fallback))));
}

export type FillMode = "pairs" | "instant";

function toFillMode(value: string | undefined): FillMode {
  return (value || "").trim().toLowerCase() === "pairs" ? "pairs" : "instant";
}

export interface GeoConfig {
  lat: number;
  lon: number;
  flag: string;
}

export interface Config {
  roomName: string;
  adminPassword: string;
  subAdminPassword: string;
  roomPassword: string | undefined;
  maxPlayers: number;
  maxTeamSize: number;
  mapSwitchToBigPlayers: number;
  mapSwitchToSmallMaxPlayers: number;
  fillMode: FillMode;
  afkTimeoutMs: number;
  showInRoomList: boolean;
  noPlayer: boolean;
  hostName: string;
  hostAvatar: string;
  smallMapFile: string;
  bigMapFile: string;
  smallMapTimeLimit: number;
  bigMapTimeLimit: number;
  smallMapScoreLimit: number;
  bigMapScoreLimit: number;
  mapsDir: string;
  language: string;
  localesDir: string;
  geo: GeoConfig;
  tokenUrl: string;
  token: string;
  discordBotToken: string;
  discordChatChannelId: string;
  discordLogsChannelId: string;
}

const config: Config = {
  roomName: process.env.ROOM_NAME || "Tikitaka",
  adminPassword: process.env.ADMIN_PASSWORD || "admin",
  subAdminPassword: process.env.SUBADMIN_PASSWORD || "subadmin",
  roomPassword: (process.env.ROOM_PASSWORD || "").trim() || undefined,
  maxPlayers: toNumber(process.env.MAX_PLAYERS, 16),
  maxTeamSize: Math.max(1, toNumber(process.env.MAX_TEAM_SIZE, 6)),
  mapSwitchToBigPlayers: Math.max(
    1,
    toNumber(process.env.MAP_SWITCH_TO_BIG_PLAYERS, DEFAULT_MAP_SWITCH_TO_BIG_PLAYERS)
  ),
  mapSwitchToSmallMaxPlayers: Math.max(
    0,
    toNumber(
      process.env.MAP_SWITCH_TO_SMALL_MAX_PLAYERS,
      DEFAULT_MAP_SWITCH_TO_SMALL_MAX_PLAYERS
    )
  ),
  fillMode: toFillMode(process.env.FILL_MODE),
  afkTimeoutMs: Math.max(1, toNumber(process.env.AFK_TIMEOUT_MS, 10000)),
  showInRoomList: toBool(process.env.SHOW_IN_ROOM_LIST, true),
  noPlayer: toBool(process.env.NO_PLAYER, true),
  hostName: process.env.HOST_NAME || "Tikitaka",
  hostAvatar: process.env.HOST_AVATAR || "⚽",
  smallMapFile: process.env.SMALL_MAP_FILE || "small-map.json",
  bigMapFile: process.env.BIG_MAP_FILE || "big-map.json",
  smallMapTimeLimit: toMatchLimit(
    process.env.SMALL_MAP_TIME_LIMIT,
    DEFAULT_SMALL_MAP_TIME_LIMIT
  ),
  bigMapTimeLimit: toMatchLimit(
    process.env.BIG_MAP_TIME_LIMIT,
    DEFAULT_BIG_MAP_TIME_LIMIT
  ),
  smallMapScoreLimit: toMatchLimit(
    process.env.SMALL_MAP_SCORE_LIMIT,
    DEFAULT_SMALL_MAP_SCORE_LIMIT
  ),
  bigMapScoreLimit: toMatchLimit(
    process.env.BIG_MAP_SCORE_LIMIT,
    DEFAULT_BIG_MAP_SCORE_LIMIT
  ),
  mapsDir: path.join(rootDir, "maps"),
  language: (process.env.LANGUAGE || "es").trim().toLowerCase() || "es",
  localesDir: path.join(rootDir, "locales"),
  geo: {
    lat: toNumber(process.env.GEO_LAT, 40.4168),
    lon: toNumber(process.env.GEO_LON, -3.7038),
    flag: process.env.GEO_FLAG || "es",
  },
  tokenUrl: process.env.TOKEN_URL || "https://www.haxball.com/headlesstoken",
  token: (process.env.TOKEN || process.env.HAXBALL_TOKEN || "").trim(),
  discordBotToken: (process.env.DISCORD_BOT_TOKEN || "").trim(),
  discordChatChannelId: (process.env.DISCORD_CHAT_CHANNEL_ID || "").trim(),
  discordLogsChannelId: (process.env.DISCORD_LOGS_CHANNEL_ID || "").trim(),
};

export default config;
