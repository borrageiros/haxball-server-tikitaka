import type createHaxball from "node-haxball";

type HaxballAPI = ReturnType<typeof createHaxball>;

export type Room = InstanceType<HaxballAPI["Room"]>;
export type OperationTypeEnum = HaxballAPI["OperationType"];

export interface CommandContext {
  room: Room;
  playerId: number;
  args: string[];
}

export interface Command {
  name: string;
  execute: (ctx: CommandContext) => void;
}

export interface ChatCustomData {
  isCommand: boolean;
  data?: string[];
}
