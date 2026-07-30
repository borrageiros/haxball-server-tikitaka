import type { QueueStatus } from "./types";

export interface MatchControls {
  toggleAfk: (playerId: number) => boolean | null;
  getQueueStatus: (playerId: number) => QueueStatus | null;
  grantSubAdmin: (playerId: number) => boolean;
  isSubAdmin: (playerId: number) => boolean;
  toggleMute: (playerId: number) => boolean | null;
  isMuted: (playerId: number) => boolean;
}

const matchControls: MatchControls = {
  toggleAfk: () => null,
  getQueueStatus: () => null,
  grantSubAdmin: () => false,
  isSubAdmin: () => false,
  toggleMute: () => null,
  isMuted: () => false,
};

export function bindMatchControls(controls: MatchControls): void {
  matchControls.toggleAfk = controls.toggleAfk;
  matchControls.getQueueStatus = controls.getQueueStatus;
  matchControls.grantSubAdmin = controls.grantSubAdmin;
  matchControls.isSubAdmin = controls.isSubAdmin;
  matchControls.toggleMute = controls.toggleMute;
  matchControls.isMuted = controls.isMuted;
}

export function getMatchControls(): MatchControls {
  return matchControls;
}
