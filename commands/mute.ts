import t from "../utils/i18n";
import { getMatchControls } from "../match/controls";
import type { Command } from "./types";
import { canModerate, resolvePlayerId } from "./moderation";

const muteCommand: Command = {
  name: "mute",
  execute({ room, playerId, args }) {
    if (!canModerate(room, playerId)) {
      room.sendAnnouncement(t("mod.noPermission"), playerId, 0xff4444, "bold", 2);
      return;
    }

    const query = args.join(" ").trim();
    if (!query) {
      room.sendAnnouncement(t("mute.usage"), playerId, 0xffcc00, "bold", 1);
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
      room.sendAnnouncement(t("mute.self"), playerId, 0xffcc00, "bold", 1);
      return;
    }

    const actor = room.getPlayer(playerId);
    const target = room.getPlayer(targetId);
    if (target?.isAdmin && !actor?.isAdmin) {
      room.sendAnnouncement(t("mod.targetProtected"), playerId, 0xff4444, "bold", 2);
      return;
    }

    const muted = getMatchControls().toggleMute(targetId);
    if (muted == null) {
      return;
    }

    const name = target?.name ?? String(targetId);
    room.sendAnnouncement(
      muted ? t("mute.enabled", { name }) : t("mute.disabled", { name }),
      playerId,
      muted ? 0xffcc00 : 0x44ff44,
      "bold",
      1
    );

    room.sendAnnouncement(
      muted ? t("mute.enabledTarget") : t("mute.disabledTarget"),
      targetId,
      muted ? 0xffcc00 : 0x44ff44,
      "bold",
      1
    );
  },
};

export default muteCommand;
