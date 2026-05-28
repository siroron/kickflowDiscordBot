import { readFileSync } from "node:fs";

export type FieldType = "text" | "text_long" | "select" | "master";

export interface FormFieldDef {
  label: string;
  code: string;
  type: FieldType;
  required: boolean;
}

export interface FormSchema {
  fields: FormFieldDef[];
}

export function loadFormSchema(path: string): FormSchema {
  const raw = readFileSync(path, "utf-8");
  const data = JSON.parse(raw) as FormSchema;
  if (!Array.isArray(data.fields)) {
    throw new Error(`form-schema.json: "fields" must be an array (${path})`);
  }
  return data;
}
