import type { ChatCustomData, Command, OperationTypeEnum, Room } from "./types";
import adminCommand from "./admin";
import t from "../utils/i18n";

const commandList: Command[] = [adminCommand];

const commands = new Map(
  commandList.map((command) => [command.name.toLowerCase(), command])
);

export default function setupCommands(
  room: Room,
  OperationType: OperationTypeEnum
): void {
  const onBeforeOperationReceived = (
    type: Parameters<NonNullable<Room["onBeforeOperationReceived"]>>[0],
    msg: Parameters<NonNullable<Room["onBeforeOperationReceived"]>>[1]
  ) => {
    if (type !== OperationType.SendChat) {
      return;
    }

    const text = (msg as unknown as { text: string }).text;
    if (!text.startsWith("!")) {
      return { isCommand: false } satisfies ChatCustomData;
    }

    return {
      isCommand: true,
      data: text.trimEnd().split(/\s+/),
    } satisfies ChatCustomData;
  };

  room.onBeforeOperationReceived =
    onBeforeOperationReceived as unknown as Room["onBeforeOperationReceived"];

  room.onOperationReceived = (type, msg, _globalFrameNo, _clientFrameNo, customData) => {
    if (type !== OperationType.SendChat) {
      return true;
    }

    const data = customData as ChatCustomData | undefined;
    if (!data?.isCommand || !data.data?.length) {
      return true;
    }

    const [rawName, ...args] = data.data;
    const name = rawName.slice(1).toLowerCase();
    const command = commands.get(name);
    const playerId = (msg as unknown as { byId: number }).byId;

    if (!command) {
      room.sendAnnouncement(
        t("command.unknown", { command: rawName }),
        playerId,
        0xffcc00,
        "bold",
        1
      );
      return true;
    }

    command.execute({ room, playerId, args });
    return true;
  };

  room.onAfterOperationReceived = (type, _msg, _globalFrameNo, _clientFrameNo, customData) => {
    if (type !== OperationType.SendChat) {
      return true;
    }

    return !(customData as ChatCustomData | undefined)?.isCommand;
  };
}
