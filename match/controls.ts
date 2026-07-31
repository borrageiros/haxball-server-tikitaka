import type { QueueStatus } from "./types";

export interface MatchControls {
  toggleAfk: (playerId: number) => boolean | null;
  getQueueStatus: (playerId: number) => QueueStatus | null;
  grantSubAdmin: (playerId: number) => boolean;
  isSubAdmin: (playerId: number) => boolean;
  toggleMute: (playerId: number) => boolean | null;
  isMuted: (playerId: number) => boolean;
  togglePriority: (actorId: number, targetId: number) => boolean | null;
  getPriorityList: (actorId: number) => number[];
  clearPriorityList: (actorId: number) => number;
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
}

export function getMatchControls(): MatchControls {
  return matchControls;
}
