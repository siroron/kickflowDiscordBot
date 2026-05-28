import { Message } from "discord.js";
import { config } from "../config.js";
import { KickflowApiError, KickflowClient } from "../kickflow/apiClient.js";
import { buildCreateTicketPayload } from "../kickflow/ticketBuilder.js";
import { loadFieldMap, resolveInputs } from "../mapping/fieldMap.js";
import { loadFormSchema } from "../mapping/schema.js";
import { validateForm } from "../mapping/validator.js";
import { parseMarkdownForm } from "../parser/mdParser.js";
import type { ParsedForm } from "../parser/types.js";
import logger from "../utils/logger.js";

const schema = loadFormSchema("./config/form-schema.json");
const fieldMap = loadFieldMap("./config/field-map.json");
const client = new KickflowClient(config.kickflowApiBaseUrl, config.kickflowAccessToken);

function buildTitle(parsed: ParsedForm): string {
  const titleType = parsed.titleType ?? "行事許可願";
  const eventName = parsed.fields["行事名"];
  return eventName ? `${titleType}: ${eventName}` : titleType;
}

export async function handleMessage(message: Message): Promise<void> {
  if (message.author.bot) return;
  if (config.allowedChannelId && message.channelId !== config.allowedChannelId) return;

  const mdAttachment = message.attachments.find((a) => a.name?.endsWith(".md"));
  if (!mdAttachment) return;

  logger.info(`Received .md attachment from ${message.author.tag} in channel ${message.channelId}`);

  try {
    const res = await fetch(mdAttachment.url);
    if (!res.ok) {
      await message.reply("❌ ファイルのダウンロードに失敗しました。再度お試しください。");
      return;
    }
    const mdContent = await res.text();
    const parsed = parseMarkdownForm(mdContent);

    const validation = validateForm(parsed, schema);
    if (!validation.ok) {
      const lines = validation.errors.map((e) => `- ${e.message}`).join("\n");
      await message.reply(
        `❌ 申請を作成できませんでした。\n${lines}\n修正して再度 .md を添付してください。`,
      );
      return;
    }

    const resolved = resolveInputs(parsed, schema, fieldMap);
    if (!resolved.ok) {
      const lines = resolved.errors.map((e) => `- ${e.message}`).join("\n");
      await message.reply(
        `❌ 申請を作成できませんでした。\n${lines}\n修正して再度 .md を添付してください。`,
      );
      return;
    }

    const payload = buildCreateTicketPayload({
      workflowId: config.kickflowWorkflowId,
      authorTeamId: config.kickflowAuthorTeamId,
      status: config.ticketDefaultStatus,
      title: buildTitle(parsed),
      inputs: resolved.inputs,
    });

    const ticket = await client.createTicket(payload);
    const ticketRef = ticket.ticketNumber != null ? `#${ticket.ticketNumber}` : ticket.id;
    await message.reply(`✅ チケットを作成しました！\nチケット: ${ticketRef}`);
    logger.info(`Ticket created: ${ticketRef}`);
  } catch (err) {
    if (err instanceof KickflowApiError) {
      if (err.status === 401 || err.status === 403) {
        await message.reply("❌ kickflow への認証に失敗しました。トークンを確認してください。");
      } else {
        logger.error("kickflow API error:", err.message);
        await message.reply(`❌ kickflow API エラー (${err.status})。管理者に連絡してください。`);
      }
    } else {
      logger.error("Unexpected error:", err);
      await message.reply("❌ 予期しないエラーが発生しました。管理者に連絡してください。");
    }
  }
}
