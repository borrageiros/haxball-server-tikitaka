import t from "../utils/i18n";
import type { Command } from "./types";

const helpCommand: Command = {
  name: "help",
  execute({ room, playerId }) {
    const message = [
      t("help.header"),
      t("help.afk"),
      t("help.queue"),
      t("help.help"),
      t("help.admin"),
    ].join("\n");

    room.sendAnnouncement(message, playerId, 0x44aaff, "bold", 1);
  },
};

export default helpCommand;
