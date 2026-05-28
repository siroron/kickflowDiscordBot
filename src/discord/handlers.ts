import { Message } from "discord.js";
import { config } from "../config";
import { parseMd } from "../parser/mdParser";
import { validate } from "../mapping/validator";
import { buildPayload } from "../kickflow/ticketBuilder";
import { KickflowClient } from "../kickflow/apiClient";
import { KickflowApiError } from "../kickflow/types";
import logger from "../utils/logger";

const client = new KickflowClient(config.kickflowApiBaseUrl, config.kickflowAccessToken);

export async function handleMessage(message: Message): Promise<void> {
  if (message.author.bot) return;
  if (config.allowedChannelId && message.channelId !== config.allowedChannelId) return;

  const mdAttachment = message.attachments.find((a) => a.name?.endsWith(".md"));
  if (!mdAttachment) return;

  logger.info(`Received .md attachment from ${message.author.tag} in channel ${message.channelId}`);

  try {
    // Download md content
    const res = await fetch(mdAttachment.url);
    if (!res.ok) {
      await message.reply("❌ ファイルのダウンロードに失敗しました。再度お試しください。");
      return;
    }
    const mdContent = await res.text();

    // Parse
    const parsed = parseMd(mdContent);

    // Validate
    const validation = validate(parsed);

    if (validation.warnings.length > 0) {
      logger.warn("Validation warnings:", validation.warnings);
    }

    if (!validation.valid) {
      const errorLines = validation.errors.map((e) => `- ${e}`).join("\n");
      await message.reply(
        `❌ 申請を作成できませんでした。\n${errorLines}\n修正して再度 .md を添付してください。`
      );
      return;
    }

    // Build payload
    const payload = buildPayload(
      parsed,
      config.kickflowWorkflowId,
      config.kickflowAuthorTeamId,
      config.ticketDefaultStatus
    );

    // Create ticket
    const ticket = await client.createTicket(payload);

    const ticketRef = ticket.ticketNumber != null ? `#${ticket.ticketNumber}` : ticket.id;
    await message.reply(
      `✅ チケットを作成しました！\nチケット: ${ticketRef}\nステータス: ${ticket.status}`
    );
    logger.info(`Ticket created: ${ticketRef}`);
  } catch (err) {
    if (err instanceof KickflowApiError) {
      if (err.statusCode === 401 || err.statusCode === 403) {
        await message.reply("❌ kickflow への認証に失敗しました。管理者にトークンを確認してください。");
      } else {
        logger.error("kickflow API error:", err.message);
        await message.reply(`❌ kickflow API エラー (${err.statusCode})。管理者に連絡してください。`);
      }
    } else if (err instanceof Error && err.message.includes("is not registered")) {
      await message.reply(`❌ 申請を作成できませんでした。\n- ${err.message}\n修正して再度 .md を添付してください。`);
    } else {
      logger.error("Unexpected error:", err);
      await message.reply("❌ 予期しないエラーが発生しました。管理者に連絡してください。");
    }
  }
}
