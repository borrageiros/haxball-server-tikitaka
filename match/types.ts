export interface QueueEntry {
  id: number;
  name: string;
  afk: boolean;
  admin: boolean;
}

export interface QueueStatus {
  position: number | null;
  onField: boolean;
  afk: boolean;
}
