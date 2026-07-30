import type { ChatCustomData, Command, OperationTypeEnum, Room } from "./types";
import adminCommand from "./admin";
import afkCommand from "./afk";
import helpCommand from "./help";
import kickCommand from "./kick";
import muteCommand from "./mute";
import queueCommand from "./queue";
import subadminCommand from "./subadmin";
import { getMatchControls } from "../match/controls";
import { TEAM, TEAM_CHAT_COLOR, type TeamId } from "../match/constants";
import t from "../utils/i18n";

const commandList: Command[] = [
  helpCommand,
  afkCommand,
  queueCommand,
  adminCommand,
  subadminCommand,
  kickCommand,
  muteCommand,
];

const commands = new Map(
  commandList.map((command) => [command.name.toLowerCase(), command])
);

function chatColorForTeam(teamId: number): number {
  if (teamId === TEAM.RED || teamId === TEAM.BLUE || teamId === TEAM.SPECTATORS) {
    return TEAM_CHAT_COLOR[teamId as TeamId];
  }
  return TEAM_CHAT_COLOR[TEAM.SPECTATORS];
}

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
    const playerId = (msg as unknown as { byId: number }).byId;
    const text = (msg as unknown as { text: string }).text;

    if (data?.isCommand && data.data?.length) {
      const [rawName, ...args] = data.data;
      const name = rawName.slice(1).toLowerCase();
      const command = commands.get(name);

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
    }

    if (getMatchControls().isMuted(playerId)) {
      room.sendAnnouncement(t("mute.blocked"), playerId, 0xffcc00, "bold", 1);
      return true;
    }

    const player = room.getPlayer(playerId);
    const name = player?.name ?? String(playerId);
    const teamId = player?.team.id ?? TEAM.SPECTATORS;

    room.sendAnnouncement(
      `${name}: ${text}`,
      null,
      chatColorForTeam(teamId),
      "normal",
      1
    );
    return true;
  };

  room.onAfterOperationReceived = (type) => {
    if (type !== OperationType.SendChat) {
      return true;
    }

    return false;
  };
}
