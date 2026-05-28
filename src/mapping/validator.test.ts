import { describe, expect, it } from "vitest";
import type { ParsedForm } from "../parser/types.js";
import type { FormSchema } from "./schema.js";
import { validateForm } from "./validator.js";

const schema: FormSchema = {
  fields: [
    { label: "クラブ名", code: "club_name", type: "master", required: true },
    { label: "行事の種類", code: "event_type", type: "select", required: true },
    { label: "行事名", code: "event_name", type: "text", required: true },
    { label: "行事内容", code: "event_detail", type: "text_long", required: true },
    { label: "備考", code: "remarks", type: "text_long", required: false },
  ],
};

function form(fields: Record<string, string>): ParsedForm {
  return { fields };
}

describe("validateForm", () => {
  it("returns ok when all required fields are filled", () => {
    const result = validateForm(
      form({
        クラブ名: "サッカー部",
        行事の種類: "試合",
        行事名: "〇〇大会",
        行事内容: "〇〇高校との練習試合。",
      }),
      schema,
    );
    expect(result).toEqual({ ok: true, errors: [] });
  });

  it("flags missing required fields", () => {
    const result = validateForm(
      form({
        クラブ名: "サッカー部",
        行事の種類: "試合",
      }),
      schema,
    );
    expect(result.ok).toBe(false);
    const kinds = result.errors.map((e) => ({ kind: e.kind, label: e.label }));
    expect(kinds).toEqual([
      { kind: "missing_required", label: "行事名" },
      { kind: "missing_required", label: "行事内容" },
    ]);
  });

  it("treats empty / whitespace-only values as missing", () => {
    const result = validateForm(
      form({
        クラブ名: "",
        行事の種類: "   ",
        行事名: "〇〇大会",
        行事内容: "本文",
      }),
      schema,
    );
    expect(result.ok).toBe(false);
    expect(result.errors.map((e) => e.label)).toEqual(["クラブ名", "行事の種類"]);
    expect(result.errors.every((e) => e.kind === "missing_required")).toBe(true);
  });

  it("allows optional fields to be absent", () => {
    const result = validateForm(
      form({
        クラブ名: "サッカー部",
        行事の種類: "試合",
        行事名: "〇〇大会",
        行事内容: "本文",
      }),
      schema,
    );
    expect(result.ok).toBe(true);
  });

  it("flags unknown keys", () => {
    const result = validateForm(
      form({
        クラブ名: "サッカー部",
        行事の種類: "試合",
        行事名: "〇〇大会",
        行事内容: "本文",
        謎フィールド: "値",
      }),
      schema,
    );
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      { kind: "unknown_key", label: "謎フィールド", message: "「謎フィールド」は想定外のキーです" },
    ]);
  });

  it("reports missing required and unknown keys together", () => {
    const result = validateForm(
      form({
        クラブ名: "サッカー部",
        謎: "値",
      }),
      schema,
    );
    const kinds = result.errors.map((e) => e.kind).sort();
    expect(kinds).toEqual(["missing_required", "missing_required", "missing_required", "unknown_key"]);
  });

  it("produces user-facing Japanese messages", () => {
    const result = validateForm(form({}), schema);
    expect(result.errors[0]?.message).toBe("「クラブ名」が未入力です（必須）");
  });
});
