import type { ParsedForm } from "./types.js";

const KEY_LINE_RE = /^([^:：]+?)\s*[:：]\s*(.*)$/;
const HEADING_RE = /^#+\s*(.*)$/;

export function parseMarkdownForm(input: string): ParsedForm {
  const lines = input.replace(/\r\n/g, "\n").split("\n");

  let titleType: string | undefined;
  const fields: Record<string, string> = {};
  let currentKey: string | undefined;

  for (const raw of lines) {
    const line = raw.trim();

    if (line === "") continue;

    if (line.startsWith("#")) {
      const m = HEADING_RE.exec(line);
      if (m && titleType === undefined) {
        const heading = (m[1] ?? "").trim();
        if (heading !== "") titleType = heading;
      }
      currentKey = undefined;
      continue;
    }

    const kv = KEY_LINE_RE.exec(line);
    if (kv) {
      const key = (kv[1] ?? "").trim();
      const value = (kv[2] ?? "").trim();
      fields[key] = value;
      currentKey = key;
      continue;
    }

    if (currentKey !== undefined) {
      const prev = fields[currentKey] ?? "";
      fields[currentKey] = prev === "" ? line : `${prev}\n${line}`;
    }
  }

  return titleType !== undefined ? { titleType, fields } : { fields };
}
