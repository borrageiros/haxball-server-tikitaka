import readline from "readline";
import config from "./config";
import t from "./i18n";

export default function askToken(): Promise<string> {
  if (config.token) {
    return Promise.resolve(config.token);
  }

  if (!process.stdin.isTTY) {
    console.error(t("token.required"));
    console.error(t("token.getHere", { url: config.tokenUrl }));
    return Promise.resolve("");
  }

  console.log(t("token.getHere", { url: config.tokenUrl }));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(t("token.paste"), (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}
