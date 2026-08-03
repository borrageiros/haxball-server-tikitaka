export interface QueueEntry {
  id: number;
  name: string;
  afk: boolean;
  admin: boolean;
  auth: string | null;
}

export interface PriorityListEntry {
  auth: string;
  name: string | null;
}

export interface BanEntry {
  auth: string;
  name: string;
}

export interface QueueStatus {
  position: number | null;
  onField: boolean;
  afk: boolean;
}
