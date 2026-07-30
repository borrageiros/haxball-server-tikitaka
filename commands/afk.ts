import t from "../utils/i18n";
import { getMatchControls } from "../match/controls";
import type { Command } from "./types";

const afkCommand: Command = {
  name: "afk",
  execute({ room, playerId }) {
    const nextAfk = getMatchControls().toggleAfk(playerId);

    if (nextAfk == null) {
      return;
    }

    room.sendAnnouncement(
      nextAfk ? t("afk.enabled") : t("afk.disabled"),
      playerId,
      nextAfk ? 0xffcc00 : 0x44ff44,
      "bold",
      1
    );
  },
};

export default afkCommand;
