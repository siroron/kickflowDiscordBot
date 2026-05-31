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

discordClient.on(Events.Error, (err) => {
  logger.error("Discord client error:", err);
});

discordClient.on(Events.ShardError, (err, shardId) => {
  logger.error(`Shard ${shardId} error:`, err);
});

discordClient.on(Events.ShardDisconnect, (event, shardId) => {
  logger.warn(`Shard ${shardId} disconnected (code=${event.code})`);
});

discordClient.on(Events.ShardReconnecting, (shardId) => {
  logger.info(`Shard ${shardId} reconnecting...`);
});

discordClient.on(Events.ShardResume, (shardId, replayedEvents) => {
  logger.info(`Shard ${shardId} resumed (replayed ${replayedEvents} events)`);
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection:", reason);
});

discordClient.login(config.discordBotToken).catch((err) => {
  logger.error("Failed to login to Discord:", err);
  process.exit(1);
});
