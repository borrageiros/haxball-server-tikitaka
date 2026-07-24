import fs from "fs";
import path from "path";
import config from "./config";
import t from "./i18n";
import type createHaxball from "node-haxball";

type HaxballAPI = ReturnType<typeof createHaxball>;
type HaxballUtils = HaxballAPI["Utils"];
export type Stadium = NonNullable<ReturnType<HaxballUtils["parseStadium"]>>;

export default function loadStadium(
  utils: HaxballUtils,
  mapFile: string = config.smallMapFile
): Stadium {
  const mapPath = path.join(config.mapsDir, mapFile);
  const mapContent = fs.readFileSync(mapPath, "utf8");
  const stadium = utils.parseStadium(mapContent);
  if (!stadium) {
    throw new Error(t("stadium.parseFailed", { path: mapPath }));
  }
  return stadium;
}
