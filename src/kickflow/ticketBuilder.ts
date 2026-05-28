import { ParsedForm } from "../parser/types";
import { CreateTicketPayload, TicketInput } from "./types";
import { getSchema } from "../mapping/validator";
import { resolveId } from "../mapping/fieldMap";

export function buildPayload(
  parsed: ParsedForm,
  workflowId: string,
  authorTeamId: string,
  status: "draft" | "in_progress"
): CreateTicketPayload {
  const schema = getSchema();
  const inputs: TicketInput[] = [];

  for (const field of schema.fields) {
    const displayValue = parsed.fields[field.label] ?? null;

    let value: string | null = displayValue;

    if (displayValue !== null && (field.type === "master" || field.type === "select")) {
      value = resolveId(field.code, displayValue);
    }

    inputs.push({
      formFieldCode: field.code,
      value,
    });
  }

  return {
    status,
    workflowId,
    authorTeamId,
    inputs,
  };
}
