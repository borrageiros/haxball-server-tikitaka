import t from "../utils/i18n";
import { getMatchControls } from "../match/controls";
import type { Command } from "./types";
import { canModerate, resolvePlayerId } from "./moderation";

const priorityCommand: Command = {
  name: "priority",
  execute({ room, playerId, args }) {
    if (!canModerate(room, playerId)) {
      room.sendAnnouncement(
        t("command.unknown", { command: "!priority" }),
        playerId,
        0xffcc00,
        "bold",
        1
      );
      return;
    }

    const query = args.join(" ").trim();
    if (!query) {
      room.sendAnnouncement(t("priority.usage"), playerId, 0xffcc00, "bold", 1);
      return;
    }

    const targetId = resolvePlayerId(room, query);
    if (targetId === "ambiguous") {
      room.sendAnnouncement(t("mod.ambiguous"), playerId, 0xffcc00, "bold", 1);
      return;
    }
    if (targetId == null) {
      room.sendAnnouncement(t("mod.notFound"), playerId, 0xff4444, "bold", 1);
      return;
    }

    if (targetId === playerId) {
      room.sendAnnouncement(t("priority.self"), playerId, 0xffcc00, "bold", 1);
      return;
    }

    const enabled = getMatchControls().togglePriority(playerId, targetId);
    if (enabled == null) {
      room.sendAnnouncement(t("mod.notFound"), playerId, 0xff4444, "bold", 1);
      return;
    }

    const name = room.getPlayer(targetId)?.name ?? String(targetId);
    room.sendAnnouncement(
      enabled
        ? t("priority.enabled", { name })
        : t("priority.disabled", { name }),
      playerId,
      enabled ? 0x44ff44 : 0xffcc00,
      "bold",
      1
    );
  },
};

export default priorityCommand;
