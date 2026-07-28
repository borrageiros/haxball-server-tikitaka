import path from "path";
import dotenv from "dotenv";

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
  roomPassword: string | undefined;
  maxPlayers: number;
  maxTeamSize: number;
  fillMode: FillMode;
  afkTimeoutMs: number;
  showInRoomList: boolean;
  noPlayer: boolean;
  hostName: string;
  hostAvatar: string;
  smallMapFile: string;
  bigMapFile: string;
  mapsDir: string;
  language: string;
  localesDir: string;
  geo: GeoConfig;
  tokenUrl: string;
  token: string;
}

const config: Config = {
  roomName: process.env.ROOM_NAME || "Tikitaka",
  adminPassword: process.env.ADMIN_PASSWORD || "admin",
  roomPassword: (process.env.ROOM_PASSWORD || "").trim() || undefined,
  maxPlayers: toNumber(process.env.MAX_PLAYERS, 16),
  maxTeamSize: Math.max(1, toNumber(process.env.MAX_TEAM_SIZE, 6)),
  fillMode: toFillMode(process.env.FILL_MODE),
  afkTimeoutMs: Math.max(1, toNumber(process.env.AFK_TIMEOUT_MS, 10000)),
  showInRoomList: toBool(process.env.SHOW_IN_ROOM_LIST, true),
  noPlayer: toBool(process.env.NO_PLAYER, true),
  hostName: process.env.HOST_NAME || "Tikitaka",
  hostAvatar: process.env.HOST_AVATAR || "⚽",
  smallMapFile: process.env.SMALL_MAP_FILE || "small-map.json",
  bigMapFile: process.env.BIG_MAP_FILE || "big-map.json",
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
};

export default config;
