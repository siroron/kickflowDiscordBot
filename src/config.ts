import dotenv from "dotenv";
dotenv.config();

interface Config {
  discordBotToken: string;
  kickflowAccessToken: string;
  kickflowApiBaseUrl: string;
  kickflowWorkflowId: string;
  kickflowAuthorTeamId: string;
  allowedChannelId?: string;
  ticketDefaultStatus: "draft" | "in_progress";
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function loadConfig(): Config {
  const status = process.env.TICKET_DEFAULT_STATUS ?? "draft";
  if (status !== "draft" && status !== "in_progress") {
    throw new Error(`TICKET_DEFAULT_STATUS must be "draft" or "in_progress", got: ${status}`);
  }

  return {
    discordBotToken: requireEnv("DISCORD_BOT_TOKEN"),
    kickflowAccessToken: requireEnv("KICKFLOW_ACCESS_TOKEN"),
    kickflowApiBaseUrl: process.env.KICKFLOW_API_BASE_URL ?? "https://api.kickflow.com/v1",
    kickflowWorkflowId: requireEnv("KICKFLOW_WORKFLOW_ID"),
    kickflowAuthorTeamId: requireEnv("KICKFLOW_AUTHOR_TEAM_ID"),
    allowedChannelId: process.env.ALLOWED_CHANNEL_ID || undefined,
    ticketDefaultStatus: status,
  };
}

export const config = loadConfig();
