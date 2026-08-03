import type { Room } from "../commands/types";
import { TEAM } from "./constants";

export interface TeamKit {
  angle: number;
  textColor: number;
  colors: number[];
}

const WHITE = 0xffffff;
const BLACK = 0x111111;
const RED = 0xff1e1e;
const BLUE = 0x1a6bff;

interface KitStyle {
  angle: number;
  buildColors: (teamColor: number, baseColor: number) => number[];
}

export const KIT_STYLES: KitStyle[] = [
  {
    angle: 90,
    buildColors: (teamColor, baseColor) => [teamColor, baseColor],
  },
  {
    angle: 135,
    buildColors: (teamColor, baseColor) => [baseColor, teamColor, baseColor],
  },
  {
    angle: 180,
    buildColors: (teamColor, baseColor) => [baseColor, teamColor, baseColor],
  },
];

export function buildKit(
  style: KitStyle,
  teamColor: number,
  baseColor: number
): TeamKit {
  return {
    angle: style.angle,
    textColor: baseColor === WHITE ? BLACK : WHITE,
    colors: style.buildColors(teamColor, baseColor),
  };
}

function pickRandomStyle(): KitStyle {
  return KIT_STYLES[Math.floor(Math.random() * KIT_STYLES.length)]!;
}

export function pickRandomMatchKits(): { red: TeamKit; blue: TeamKit } {
  const redBase = Math.random() < 0.5 ? WHITE : BLACK;
  const blueBase = redBase === WHITE ? BLACK : WHITE;
  return {
    red: buildKit(pickRandomStyle(), RED, redBase),
    blue: buildKit(pickRandomStyle(), BLUE, blueBase),
  };
}

export function applyTeamKit(room: Room, teamId: number, kit: TeamKit): void {
  room.setTeamColors(teamId, kit.angle, kit.textColor, ...kit.colors);
}

export function applyRandomMatchKits(room: Room): void {
  const { red, blue } = pickRandomMatchKits();
  applyTeamKit(room, TEAM.RED, red);
  applyTeamKit(room, TEAM.BLUE, blue);
}
