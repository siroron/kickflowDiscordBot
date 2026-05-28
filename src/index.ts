import { Events } from "discord.js";
import { config } from "./config.js";
import { createClient } from "./discord/client.js";
import { handleMessage } from "./discord/handlers.js";
import logger from "./utils/logger.js";

const discordClient = createClient();

discordClient.once(Events.ClientReady, (c) => {
  logger.info(`Logged in as ${c.user.tag}`);
});

discordClient.on(Events.MessageCreate, (message) => {
  handleMessage(message).catch((err) => {
    logger.error("Unhandled error in message handler:", err);
  });
});

discordClient.login(config.discordBotToken).catch((err) => {
  logger.error("Failed to login to Discord:", err);
  process.exit(1);
});
