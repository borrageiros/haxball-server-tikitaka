import { ActivityType, Client, TextChannel } from "discord.js";
import config from "../utils/config";
import t from "../utils/i18n";

let client: Client | null = null;
let ready = false;
let lastCount = 0;
let chatChannel: TextChannel | null = null;
let logsChannel: TextChannel | null = null;

function applyPresence(): void {
  if (!client || !ready) {
    return;
  }
  client.user?.setActivity({
    name: `${lastCount}/${config.maxPlayers}`,
    type: ActivityType.Playing,
  });
}

async function resolveTextChannel(
  channelId: string,
  invalidKey: string,
  errorKey: string
): Promise<TextChannel | null> {
  if (!client || !channelId) {
    return null;
  }

  try {
    const channel = await client.channels.fetch(channelId);
    if (channel?.isTextBased() && !channel.isDMBased()) {
      return channel as TextChannel;
    }
    console.error(t(invalidKey));
    return null;
  } catch (error) {
    console.error(t(errorKey, { error: String(error) }));
    return null;
  }
}

async function resolveChannels(): Promise<void> {
  chatChannel = await resolveTextChannel(
    config.discordChatChannelId,
    "discord.chatChannelInvalid",
    "discord.chatChannelError"
  );
  logsChannel = await resolveTextChannel(
    config.discordLogsChannelId,
    "discord.logsChannelInvalid",
    "discord.logsChannelError"
  );
}

function sendToChannel(
  channel: TextChannel | null,
  content: string,
  errorKey: string
): void {
  if (!channel) {
    return;
  }

  channel
    .send({ content: content.slice(0, 2000), allowedMentions: { parse: [] } })
    .catch((error) => {
      console.error(t(errorKey, { error: String(error) }));
    });
}

export function setDiscordPlayerCount(count: number): void {
  lastCount = count;
  applyPresence();
}

export function sendDiscordChatMessage(name: string, text: string): void {
  sendToChannel(chatChannel, `**${name}**: ${text}`, "discord.chatSendError");
}

export function sendDiscordLog(message: string): void {
  sendToChannel(logsChannel, message, "discord.logsSendError");
}

export function startDiscordBot(): void {
  if (!config.discordBotToken) {
    return;
  }

  client = new Client({ intents: [] });

  client.once("clientReady", (readyClient) => {
    ready = true;
    console.log(t("discord.ready", { tag: readyClient.user.tag }));
    applyPresence();
    void resolveChannels();
  });

  client.login(config.discordBotToken).catch((error) => {
    console.error(t("discord.error", { error: String(error) }));
    client = null;
  });
}
