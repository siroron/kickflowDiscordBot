import { readFileSync } from "node:fs";
import { Message } from "discord.js";
import { config } from "../config.js";
import { KickflowApiError, KickflowClient } from "../kickflow/apiClient.js";
import { buildCreateTicketPayload } from "../kickflow/ticketBuilder.js";
import type { SlipFieldInput, SlipItem, TicketInput } from "../kickflow/types.js";
import { loadFieldMap, resolveInputs, type FieldMap } from "../mapping/fieldMap.js";
import { loadFormSchema, type FormSchema } from "../mapping/schema.js";
import { validateForm } from "../mapping/validator.js";
import { parseMarkdownForm } from "../parser/mdParser.js";
import logger from "../utils/logger.js";

interface WorkflowDef {
  workflowId: string;
  schemaPath: string;
  fieldMapPath: string;
}

type WorkflowsConfig = Record<string, WorkflowDef>;

interface WorkflowField {
  code: string;
  fieldType: string;
}

interface SlipSection {
  slipFields: WorkflowField[];
}

interface WorkflowRuntime {
  def: WorkflowDef;
  schema: FormSchema;
  fieldMap: FieldMap;
  allFields: WorkflowField[];
  slipSections: SlipSection[];
}

const workflowsConfig: WorkflowsConfig = JSON.parse(
  readFileSync("./config/workflows.json", "utf-8"),
) as WorkflowsConfig;
const client = new KickflowClient(config.kickflowApiBaseUrl, config.kickflowAccessToken);
const runtimeCache = new Map<string, Promise<WorkflowRuntime>>();

async function fetchSectionInfo(
  workflowId: string,
): Promise<{ allFields: WorkflowField[]; slipSections: SlipSection[] }> {
  const res = await fetch(`${config.kickflowApiBaseUrl}/workflows/${workflowId}`, {
    headers: { Authorization: `Bearer ${config.kickflowAccessToken}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch workflow ${workflowId}: ${res.status}`);
  const data = (await res.json()) as {
    sectionList: {
      sectionType: string;
      formFields?: WorkflowField[];
      slipFields?: WorkflowField[];
    }[];
  };
  const allFields = data.sectionList
    .filter((s) => s.sectionType === "form")
    .flatMap((s) => s.formFields ?? []);
  const slipSections: SlipSection[] = data.sectionList
    .filter((s) => s.sectionType === "slip")
    .map((s) => ({ slipFields: s.slipFields ?? [] }));
  return { allFields, slipSections };
}

function getRuntime(titleType: string): Promise<WorkflowRuntime> | undefined {
  const def = workflowsConfig[titleType];
  if (!def) return undefined;
  let cached = runtimeCache.get(titleType);
  if (cached) return cached;
  cached = (async () => {
    const schema = loadFormSchema(def.schemaPath);
    const fieldMap = loadFieldMap(def.fieldMapPath);
    const { allFields, slipSections } = await fetchSectionInfo(def.workflowId);
    return { def, schema, fieldMap, allFields, slipSections };
  })().catch((err) => {
    runtimeCache.delete(titleType);
    throw err;
  });
  runtimeCache.set(titleType, cached);
  return cached;
}

function buildEmptySlipInput(f: WorkflowField): SlipFieldInput {
  const base = { slipFieldCode: f.code };
  if (f.fieldType === "master") return { ...base, generalMasterItemId: null };
  if (f.fieldType === "checkbox") return { ...base, value: [] };
  if (f.fieldType === "file") return { ...base, files: null };
  if (f.fieldType === "ticket") return { ...base, ticketId: null };
  if (f.fieldType === "user") return { ...base, userId: null };
  if (f.fieldType === "team") return { ...base, teamId: null };
  return { ...base, value: null };
}

function buildDummySlipItems(slipSections: SlipSection[]): SlipItem[] {
  return slipSections.map((section) => ({
    inputs: section.slipFields.map(buildEmptySlipInput),
  }));
}

function padInputs(inputs: TicketInput[], allFields: WorkflowField[]): TicketInput[] {
  const sent = new Set(inputs.map((i) => i.formFieldCode));
  const padded: TicketInput[] = [...inputs];
  for (const f of allFields) {
    if (sent.has(f.code)) continue;
    if (f.fieldType === "master") {
      padded.push({ formFieldCode: f.code, generalMasterItemId: null });
    } else if (f.fieldType === "checkbox") {
      padded.push({ formFieldCode: f.code, value: [] });
    } else {
      padded.push({ formFieldCode: f.code, value: null });
    }
  }
  return padded;
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

    const titleType = parsed.titleType;
    if (!titleType) {
      await message.reply(
        "❌ md の1行目に `# <ワークフロー名>` を書いてください（例: `# 行事許可願`）。",
      );
      return;
    }

    const runtimePromise = getRuntime(titleType);
    if (!runtimePromise) {
      const known = Object.keys(workflowsConfig).join(" / ");
      await message.reply(
        `❌ 「${titleType}」は登録されていないワークフローです。\n登録済み: ${known}`,
      );
      return;
    }

    const runtime = await runtimePromise;

    const validation = validateForm(parsed, runtime.schema);
    if (!validation.ok) {
      const lines = validation.errors.map((e) => `- ${e.message}`).join("\n");
      await message.reply(
        `❌ 申請を作成できませんでした。\n${lines}\n修正して再度 .md を添付してください。`,
      );
      return;
    }

    const resolved = resolveInputs(parsed, runtime.schema, runtime.fieldMap);
    if (!resolved.ok) {
      const lines = resolved.errors.map((e) => `- ${e.message}`).join("\n");
      await message.reply(
        `❌ 申請を作成できませんでした。\n${lines}\n修正して再度 .md を添付してください。`,
      );
      return;
    }

    const payload = buildCreateTicketPayload({
      workflowId: runtime.def.workflowId,
      authorTeamId: config.kickflowAuthorTeamId,
      status: config.ticketDefaultStatus,
      inputs: resolved.inputs,
    });

    payload.inputs = padInputs(payload.inputs, runtime.allFields);
    if (runtime.slipSections.length > 0) {
      payload.slipItems = buildDummySlipItems(runtime.slipSections);
    }

    logger.info(
      `Sending payload to kickflow [${titleType}]:`,
      JSON.stringify(payload, null, 2),
    );

    const ticket = await client.createTicket(payload);
    const ticketRef = ticket.ticketNumber != null ? `#${ticket.ticketNumber}` : ticket.id;
    await message.reply(
      `✅ チケットを作成しました（${titleType}）！\nチケット: ${ticketRef}`,
    );
    logger.info(`Ticket created: ${ticketRef}`);
  } catch (err) {
    if (err instanceof KickflowApiError) {
      if (err.status === 401 || err.status === 403) {
        await message.reply("❌ kickflow への認証に失敗しました。トークンを確認してください。");
      } else {
        logger.error("kickflow API error:", err.message);
        logger.error("kickflow response body:", JSON.stringify(err.body, null, 2));
        await message.reply(`❌ kickflow API エラー (${err.status})。管理者に連絡してください。`);
      }
    } else {
      logger.error("Unexpected error:", err);
      await message.reply("❌ 予期しないエラーが発生しました。管理者に連絡してください。");
    }
  }
}
