import t from "../utils/i18n";
import type { Command } from "./types";
import { canModerate } from "./moderation";

const helpCommand: Command = {
  name: "help",
  execute({ room, playerId }) {
    const lines = [
      t("help.header"),
      t("help.afk"),
      t("help.queue"),
      t("help.help"),
      t("help.admin"),
    ];

    if (canModerate(room, playerId)) {
      lines.push(
        t("help.modHeader"),
        t("help.kick"),
        t("help.ban"),
        t("help.unban"),
        t("help.mute"),
        t("help.priority")
      );
    }

    room.sendAnnouncement(lines.join("\n"), playerId, 0x44aaff, "bold", 1);
  },
};

export default helpCommand;
