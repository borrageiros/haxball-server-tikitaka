import type { BanEntry, PriorityListEntry, QueueStatus } from "./types";

export interface MatchControls {
  toggleAfk: (playerId: number) => boolean | null;
  getQueueStatus: (playerId: number) => QueueStatus | null;
  grantSubAdmin: (playerId: number) => boolean;
  isSubAdmin: (playerId: number) => boolean;
  toggleMute: (playerId: number) => boolean | null;
  isMuted: (playerId: number) => boolean;
  togglePriority: (
    actorId: number,
    targetId: number
  ) => boolean | "noAuth" | null;
  getPriorityList: (actorId: number) => PriorityListEntry[];
  clearPriorityList: (actorId: number) => number;
  banPlayer: (targetId: number) => boolean | "noAuth" | null;
  unbanPlayer: (query: string) => BanEntry | "ambiguous" | null;
  getBanList: () => BanEntry[];
}

const matchControls: MatchControls = {
  toggleAfk: () => null,
  getQueueStatus: () => null,
  grantSubAdmin: () => false,
  isSubAdmin: () => false,
  toggleMute: () => null,
  isMuted: () => false,
  togglePriority: () => null,
  getPriorityList: () => [],
  clearPriorityList: () => 0,
  banPlayer: () => null,
  unbanPlayer: () => null,
  getBanList: () => [],
};

export function bindMatchControls(controls: MatchControls): void {
  matchControls.toggleAfk = controls.toggleAfk;
  matchControls.getQueueStatus = controls.getQueueStatus;
  matchControls.grantSubAdmin = controls.grantSubAdmin;
  matchControls.isSubAdmin = controls.isSubAdmin;
  matchControls.toggleMute = controls.toggleMute;
  matchControls.isMuted = controls.isMuted;
  matchControls.togglePriority = controls.togglePriority;
  matchControls.getPriorityList = controls.getPriorityList;
  matchControls.clearPriorityList = controls.clearPriorityList;
  matchControls.banPlayer = controls.banPlayer;
  matchControls.unbanPlayer = controls.unbanPlayer;
  matchControls.getBanList = controls.getBanList;
}

export function getMatchControls(): MatchControls {
  return matchControls;
}
