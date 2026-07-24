import createHaxball from "node-haxball";
import config from "./utils/config";
import askToken from "./utils/askToken";
import setupCommands from "./commands";
import setupMatch from "./match/setupMatch";
import t from "./utils/i18n";

const { Utils, Room, OperationType } = createHaxball();

type RoomStorage = NonNullable<Parameters<typeof Room.create>[1]["storage"]>;

async function main(): Promise<void> {
  const token = await askToken();

  if (!token) {
    console.error(t("token.required"));
    process.exit(1);
  }

  Room.create(
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
        setupCommands(room, OperationType);
        setupMatch(room, Utils, OperationType);
        room.onAfterRoomLink = (roomLink) => {
          console.log(t("room.link", { link: roomLink }));
        };
      },
      onClose: (msg) => {
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
