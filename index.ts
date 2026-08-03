import createHaxball from "node-haxball";
import config from "./utils/config";
import askToken from "./utils/askToken";
import setupCommands from "./commands";
import setupMatch from "./match/setupMatch";
import { startDiscordBot } from "./discord";
import t from "./utils/i18n";

const { Utils, Room, OperationType } = createHaxball();

type RoomStorage = NonNullable<Parameters<typeof Room.create>[1]["storage"]>;
type ActiveRoom = { leave: () => void };

let activeRoom: ActiveRoom | null = null;
let roomSession: { cancel: () => void } | null = null;
let shuttingDown = false;

function shutdown(): void {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log(t("room.reloading"));

  try {
    activeRoom?.leave();
  } catch {
  }

  try {
    roomSession?.cancel();
  } catch {
  }

  setTimeout(() => {
    process.exit(0);
  }, 500);
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

async function main(): Promise<void> {
  startDiscordBot();

  const token = await askToken();

  if (!token) {
    console.error(t("token.required"));
    process.exit(1);
  }

  roomSession = Room.create(
    {
      name: config.roomName,
      password: config.roomPassword,
      maxPlayerCount: config.maxPlayers,
      showInRoomList: config.showInRoomList,
      noPlayer: config.noPlayer,
      geo: config.geo,
      token,
    },
    {
      storage: {
        player_name: config.hostName,
        avatar: config.hostAvatar,
        geo: config.geo,
      } satisfies Partial<RoomStorage> as RoomStorage,
      onOpen: (room) => {
        activeRoom = room;
        setupCommands(room, OperationType);
        setupMatch(room, Utils, OperationType);
        room.onAfterRoomLink = (roomLink) => {
          console.log(t("room.link", { link: roomLink }));
        };
      },
      onClose: (msg) => {
        if (shuttingDown) {
          return;
        }
        console.error(t("room.closed", { reason: msg?.toString?.() ?? msg }));
        process.exit(1);
      },
    }
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
