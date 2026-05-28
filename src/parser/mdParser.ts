import { ParsedForm } from "./types";

export function parseMd(content: string): ParsedForm {
  const lines = content.split(/\r?\n/);
  const result: ParsedForm = { fields: {} };

  let currentKey: string | null = null;
  let currentValueLines: string[] = [];

  const flushCurrent = () => {
    if (currentKey !== null) {
      result.fields[currentKey] = currentValueLines.join("\n").trim();
      currentKey = null;
      currentValueLines = [];
    }
  };

  for (const line of lines) {
    // Skip empty lines and comment lines
    if (line.trim() === "" || line.trim().startsWith("#")) {
      // Capture title from heading
      const headingMatch = line.match(/^#\s+(.+)/);
      if (headingMatch && !result.titleType) {
        result.titleType = headingMatch[1].trim();
      }
      if (currentKey !== null && line.trim() === "") {
        currentValueLines.push("");
      }
      continue;
    }

    // Match "key: value" or "key：value" (full-width colon)
    const keyValueMatch = line.match(/^([^:：]+)[：:](.*)$/);
    if (keyValueMatch) {
      flushCurrent();
      currentKey = keyValueMatch[1].trim();
      const val = keyValueMatch[2].trim();
      currentValueLines = val ? [val] : [];
    } else if (currentKey !== null) {
      // Continuation of multi-line value
      currentValueLines.push(line.trim());
    }
  }

  flushCurrent();

  return result;
}
