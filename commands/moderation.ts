import { getMatchControls } from "../match/controls";
import type { Room } from "./types";

export function canModerate(room: Room, playerId: number): boolean {
  if (room.getPlayer(playerId)?.isAdmin) {
    return true;
  }
  return getMatchControls().isSubAdmin(playerId);
}

export function resolvePlayerId(
  room: Room,
  query: string
): number | null | "ambiguous" {
  const trimmed = query.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d+$/.test(trimmed)) {
    const id = Number(trimmed);
    return room.getPlayer(id) ? id : null;
  }

  const lower = trimmed.toLowerCase();
  const exact = room.players.filter(
    (player) => player.name.toLowerCase() === lower
  );
  if (exact.length === 1) {
    return exact[0]!.id;
  }
  if (exact.length > 1) {
    return "ambiguous";
  }

  const partial = room.players.filter((player) =>
    player.name.toLowerCase().includes(lower)
  );
  if (partial.length === 1) {
    return partial[0]!.id;
  }
  if (partial.length > 1) {
    return "ambiguous";
  }

  return null;
}
