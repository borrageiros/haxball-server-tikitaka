import t from "../utils/i18n";
import { getMatchControls } from "../match/controls";
import type { Command, Room } from "./types";
import { canModerate } from "./moderation";

function sendBanList(room: Room, playerId: number): void {
  const entries = getMatchControls().getBanList();
  if (entries.length === 0) {
    room.sendAnnouncement(t("unban.listEmpty"), playerId, 0xffcc00, "bold", 1);
    return;
  }
  const names = entries
    .map((entry) =>
      t("unban.listEntry", { name: entry.name, auth: entry.auth.slice(0, 6) })
    )
    .join(", ");
  room.sendAnnouncement(
    t("unban.list", { names }),
    playerId,
    0x44aaff,
    "bold",
    1
  );
}

const unbanCommand: Command = {
  name: "unban",
  execute({ room, playerId, args }) {
    if (!canModerate(room, playerId)) {
      room.sendAnnouncement(t("mod.noPermission"), playerId, 0xff4444, "bold", 2);
      return;
    }

    const query = args.join(" ").trim();
    if (!query) {
      room.sendAnnouncement(t("unban.usage"), playerId, 0xffcc00, "bold", 1);
      sendBanList(room, playerId);
      return;
    }

    if (query.toLowerCase() === "list") {
      sendBanList(room, playerId);
      return;
    }

    const result = getMatchControls().unbanPlayer(query);
    if (result === "ambiguous") {
      room.sendAnnouncement(t("mod.ambiguous"), playerId, 0xffcc00, "bold", 1);
      return;
    }
    if (result == null) {
      room.sendAnnouncement(t("unban.notFound"), playerId, 0xff4444, "bold", 1);
      return;
    }

    room.sendAnnouncement(
      t("unban.success", { name: result.name }),
      playerId,
      0x44ff44,
      "bold",
      1
    );
  },
};

export default unbanCommand;
