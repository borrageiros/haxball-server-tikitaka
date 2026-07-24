import config from "../utils/config";
import t from "../utils/i18n";
import type { Command } from "./types";

const adminCommand: Command = {
  name: "admin",
  execute({ room, playerId, args }) {
    const password = args.join(" ").trim();

    if (!password) {
      room.sendAnnouncement(t("admin.usage"), playerId, 0xffcc00, "bold", 1);
      return;
    }

    if (password !== config.adminPassword) {
      room.sendAnnouncement(t("admin.wrongPassword"), playerId, 0xff4444, "bold", 2);
      return;
    }

    room.setPlayerAdmin(playerId, true);
    room.sendAnnouncement(t("admin.success"), playerId, 0x44ff44, "bold", 1);
  },
};

export default adminCommand;
