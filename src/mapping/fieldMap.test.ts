import { describe, expect, it } from "vitest";
import type { ParsedForm } from "../parser/types.js";
import type { FormSchema } from "./schema.js";
import { resolveInputs, type FieldMap } from "./fieldMap.js";

const schema: FormSchema = {
  fields: [
    { label: "クラブ名", code: "club_name", type: "master", required: true },
    { label: "行事の種類", code: "event_type", type: "select", required: true },
    { label: "行事名", code: "event_name", type: "text", required: true },
    { label: "行事内容", code: "event_detail", type: "text_long", required: true },
    { label: "備考", code: "remarks", type: "text_long", required: false },
  ],
};

const fieldMap: FieldMap = {
  club_name: {
    サッカー部: "club-soccer-id",
    野球部: "club-baseball-id",
  },
  event_type: {
    試合: "event-match-id",
    練習: "event-practice-id",
  },
};

function form(fields: Record<string, string>): ParsedForm {
  return { fields };
}

describe("resolveInputs", () => {
  it("converts master / select labels to IDs and passes text values through", () => {
    const result = resolveInputs(
      form({
        クラブ名: "サッカー部",
        行事の種類: "試合",
        行事名: "〇〇大会",
        行事内容: "本文",
      }),
      schema,
      fieldMap,
    );

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.inputs).toEqual([
      { formFieldCode: "club_name", kind: "master", value: "club-soccer-id" },
      { formFieldCode: "event_type", kind: "value", value: "event-match-id" },
      { formFieldCode: "event_name", kind: "value", value: "〇〇大会" },
      { formFieldCode: "event_detail", kind: "value", value: "本文" },
      { formFieldCode: "remarks", kind: "value", value: null },
    ]);
  });

  it("emits null for missing or empty values (covers auto-calc fields requirement)", () => {
    const result = resolveInputs(form({}), schema, fieldMap);
    expect(result.ok).toBe(true);
    expect(result.inputs).toEqual([
      { formFieldCode: "club_name", kind: "master", value: null },
      { formFieldCode: "event_type", kind: "value", value: null },
      { formFieldCode: "event_name", kind: "value", value: null },
      { formFieldCode: "event_detail", kind: "value", value: null },
      { formFieldCode: "remarks", kind: "value", value: null },
    ]);
  });

  it("flags unknown choices for master / select fields", () => {
    const result = resolveInputs(
      form({
        クラブ名: "テニス部",
        行事の種類: "試合",
        行事名: "〇〇大会",
        行事内容: "本文",
      }),
      schema,
      fieldMap,
    );

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      {
        kind: "unknown_choice",
        label: "クラブ名",
        code: "club_name",
        rawValue: "テニス部",
        message: '「クラブ名」の "テニス部" は登録されていません',
      },
    ]);
    expect(result.inputs.find((i) => i.formFieldCode === "club_name")).toBeUndefined();
    expect(result.inputs.find((i) => i.formFieldCode === "event_type")).toEqual({
      formFieldCode: "event_type",
      kind: "value",
      value: "event-match-id",
    });
  });

  it("trims surrounding whitespace before lookup", () => {
    const result = resolveInputs(
      form({
        クラブ名: "  サッカー部  ",
        行事の種類: "試合",
        行事名: "〇〇大会",
        行事内容: "本文",
      }),
      schema,
      fieldMap,
    );
    expect(result.ok).toBe(true);
    expect(result.inputs[0]).toEqual({ formFieldCode: "club_name", kind: "master", value: "club-soccer-id" });
  });

  it("ignores parsed keys that are not in the schema", () => {
    const result = resolveInputs(
      form({
        クラブ名: "サッカー部",
        行事の種類: "試合",
        行事名: "〇〇大会",
        行事内容: "本文",
        謎フィールド: "値",
      }),
      schema,
      fieldMap,
    );
    expect(result.ok).toBe(true);
    expect(result.inputs.some((i) => i.formFieldCode === "謎フィールド")).toBe(false);
  });

  it("collects multiple unknown choices", () => {
    const result = resolveInputs(
      form({
        クラブ名: "テニス部",
        行事の種類: "ミーティング",
        行事名: "〇〇大会",
        行事内容: "本文",
      }),
      schema,
      fieldMap,
    );
    expect(result.errors.map((e) => e.label)).toEqual(["クラブ名", "行事の種類"]);
  });
});
