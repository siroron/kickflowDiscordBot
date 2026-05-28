import * as fs from "fs";
import * as path from "path";

type FieldMapData = Record<string, Record<string, string>>;

let fieldMapCache: FieldMapData | null = null;

export function loadFieldMap(): FieldMapData {
  if (fieldMapCache) return fieldMapCache;

  const mapPath = path.resolve(process.cwd(), "config", "field-map.json");
  if (!fs.existsSync(mapPath)) {
    throw new Error(`field-map.json not found at ${mapPath}. Copy field-map.json.example to field-map.json and fill in the IDs.`);
  }
  const raw = fs.readFileSync(mapPath, "utf-8");
  fieldMapCache = JSON.parse(raw) as FieldMapData;
  return fieldMapCache;
}

export function resolveId(fieldCode: string, displayName: string): string {
  const map = loadFieldMap();
  const fieldEntries = map[fieldCode];
  if (!fieldEntries) {
    throw new Error(`No mapping found for field code: ${fieldCode}`);
  }
  const id = fieldEntries[displayName];
  if (!id) {
    const available = Object.keys(fieldEntries).join(", ");
    throw new Error(`"${displayName}" is not registered for field "${fieldCode}". Available: ${available}`);
  }
  return id;
}
