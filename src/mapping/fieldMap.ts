import { readFileSync } from "node:fs";
import type { ParsedForm } from "../parser/types.js";
import type { FormSchema } from "./schema.js";

export type FieldMap = Record<string, Record<string, string>>;

export function loadFieldMap(path: string): FieldMap {
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw) as FieldMap;
}

export interface ResolvedInput {
  formFieldCode: string;
  value: string | null;
}

export interface ResolveError {
  kind: "unknown_choice";
  label: string;
  code: string;
  rawValue: string;
  message: string;
}

export interface ResolveResult {
  ok: boolean;
  inputs: ResolvedInput[];
  errors: ResolveError[];
}

export function resolveInputs(
  parsed: ParsedForm,
  schema: FormSchema,
  fieldMap: FieldMap,
): ResolveResult {
  const inputs: ResolvedInput[] = [];
  const errors: ResolveError[] = [];

  for (const field of schema.fields) {
    const raw = parsed.fields[field.label];
    const trimmed = raw?.trim() ?? "";

    if (trimmed === "") {
      inputs.push({ formFieldCode: field.code, value: null });
      continue;
    }

    if (field.type === "master" || field.type === "select") {
      const choices = fieldMap[field.code];
      const resolved = choices?.[trimmed];
      if (resolved === undefined) {
        errors.push({
          kind: "unknown_choice",
          label: field.label,
          code: field.code,
          rawValue: trimmed,
          message: `「${field.label}」の "${trimmed}" は登録されていません`,
        });
        continue;
      }
      inputs.push({ formFieldCode: field.code, value: resolved });
    } else {
      inputs.push({ formFieldCode: field.code, value: raw ?? null });
    }
  }

  return { ok: errors.length === 0, inputs, errors };
}
