import t from "../utils/i18n";
import { getMatchControls } from "../match/controls";
import type { Command } from "./types";

const queueCommand: Command = {
  name: "queue",
  execute({ room, playerId }) {
    const status = getMatchControls().getQueueStatus(playerId);

    if (!status) {
      return;
    }

    if (status.afk) {
      room.sendAnnouncement(t("queue.afk"), playerId, 0xffcc00, "bold", 1);
      return;
    }

    if (status.onField) {
      room.sendAnnouncement(t("queue.onField"), playerId, 0x44ff44, "bold", 1);
      return;
    }

    if (status.position != null) {
      room.sendAnnouncement(
        t("queue.position", { position: String(status.position) }),
        playerId,
        0xffcc00,
        "bold",
        1
      );
    }
  },
};

export default queueCommand;
