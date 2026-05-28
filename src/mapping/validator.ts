import * as fs from "fs";
import * as path from "path";
import { ParsedForm } from "../parser/types";

interface FieldSchema {
  label: string;
  code: string;
  type: "master" | "select" | "text" | "text_long";
  required: boolean;
}

interface FormSchema {
  fields: FieldSchema[];
}

let schemaCache: FormSchema | null = null;

function loadSchema(): FormSchema {
  if (schemaCache) return schemaCache;
  const schemaPath = path.resolve(process.cwd(), "config", "form-schema.json");
  const raw = fs.readFileSync(schemaPath, "utf-8");
  schemaCache = JSON.parse(raw) as FormSchema;
  return schemaCache;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validate(parsed: ParsedForm): ValidationResult {
  const schema = loadSchema();
  const errors: string[] = [];
  const warnings: string[] = [];

  const knownLabels = new Set(schema.fields.map((f) => f.label));

  // Unknown key check
  for (const key of Object.keys(parsed.fields)) {
    if (!knownLabels.has(key)) {
      warnings.push(`未知のキー "${key}" は無視されます`);
    }
  }

  // Required check
  for (const field of schema.fields) {
    if (field.required) {
      const val = parsed.fields[field.label];
      if (!val || val.trim() === "") {
        errors.push(`「${field.label}」が未入力です（必須）`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function getSchema(): FormSchema {
  return loadSchema();
}
