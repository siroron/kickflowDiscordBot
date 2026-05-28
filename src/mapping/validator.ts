import type { ParsedForm } from "../parser/types.js";
import type { FormSchema } from "./schema.js";

export type ValidationErrorKind = "missing_required" | "unknown_key";

export interface ValidationError {
  kind: ValidationErrorKind;
  label: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationError[];
}

export function validateForm(parsed: ParsedForm, schema: FormSchema): ValidationResult {
  const errors: ValidationError[] = [];
  const knownLabels = new Set(schema.fields.map((f) => f.label));

  for (const field of schema.fields) {
    if (!field.required) continue;
    const value = parsed.fields[field.label];
    if (value === undefined || value.trim() === "") {
      errors.push({
        kind: "missing_required",
        label: field.label,
        message: `「${field.label}」が未入力です（必須）`,
      });
    }
  }

  for (const label of Object.keys(parsed.fields)) {
    if (!knownLabels.has(label)) {
      errors.push({
        kind: "unknown_key",
        label,
        message: `「${label}」は想定外のキーです`,
      });
    }
  }

  return { ok: errors.length === 0, errors };
}
