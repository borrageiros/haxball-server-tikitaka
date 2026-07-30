import t from "../utils/i18n";
import type { Command } from "./types";
import { canModerate, resolvePlayerId } from "./moderation";

const kickCommand: Command = {
  name: "kick",
  execute({ room, playerId, args }) {
    if (!canModerate(room, playerId)) {
      room.sendAnnouncement(t("mod.noPermission"), playerId, 0xff4444, "bold", 2);
      return;
    }

    const query = args.join(" ").trim();
    if (!query) {
      room.sendAnnouncement(t("kick.usage"), playerId, 0xffcc00, "bold", 1);
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
      room.sendAnnouncement(t("kick.self"), playerId, 0xffcc00, "bold", 1);
      return;
    }

    const actor = room.getPlayer(playerId);
    const target = room.getPlayer(targetId);
    if (target?.isAdmin && !actor?.isAdmin) {
      room.sendAnnouncement(t("mod.targetProtected"), playerId, 0xff4444, "bold", 2);
      return;
    }

    const name = target?.name ?? String(targetId);
    room.kickPlayer(targetId, t("kick.reason", { name }), false);
    room.sendAnnouncement(
      t("kick.success", { name }),
      playerId,
      0x44ff44,
      "bold",
      1
    );
  },
};

export default kickCommand;
