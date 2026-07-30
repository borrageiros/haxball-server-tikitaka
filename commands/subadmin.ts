import config from "../utils/config";
import t from "../utils/i18n";
import { getMatchControls } from "../match/controls";
import type { Command } from "./types";

const subadminCommand: Command = {
  name: "subadmin",
  execute({ room, playerId, args }) {
    const password = args.join(" ").trim();

    if (!password) {
      room.sendAnnouncement(t("subadmin.usage"), playerId, 0xffcc00, "bold", 1);
      return;
    }

    if (password !== config.subAdminPassword) {
      room.sendAnnouncement(
        t("subadmin.wrongPassword"),
        playerId,
        0xff4444,
        "bold",
        2
      );
      return;
    }

    if (!getMatchControls().grantSubAdmin(playerId)) {
      return;
    }

    room.sendAnnouncement(t("subadmin.success"), playerId, 0x44ff44, "bold", 1);
  },
};

export default subadminCommand;
