import { describe, expect, it } from "vitest";
import { parseMarkdownForm } from "./mdParser.js";

describe("parseMarkdownForm", () => {
  it("parses title heading and key/value lines", () => {
    const md = [
      "# 行事許可願",
      "",
      "クラブ名: サッカー部",
      "行事の種類: 試合",
      "行事名: 〇〇大会",
      "行事内容: 〇〇高校との練習試合。会場は△△グラウンド。",
    ].join("\n");

    expect(parseMarkdownForm(md)).toEqual({
      titleType: "行事許可願",
      fields: {
        クラブ名: "サッカー部",
        行事の種類: "試合",
        行事名: "〇〇大会",
        行事内容: "〇〇高校との練習試合。会場は△△グラウンド。",
      },
    });
  });

  it("accepts full-width colon", () => {
    const md = "クラブ名： サッカー部";
    expect(parseMarkdownForm(md).fields).toEqual({ クラブ名: "サッカー部" });
  });

  it("joins continuation lines until next key", () => {
    const md = [
      "行事内容: 一行目の本文。",
      "続きの二行目。",
      "三行目もまとめる。",
      "行事名: 〇〇大会",
    ].join("\n");

    expect(parseMarkdownForm(md).fields).toEqual({
      行事内容: "一行目の本文。\n続きの二行目。\n三行目もまとめる。",
      行事名: "〇〇大会",
    });
  });

  it("ignores blank lines without breaking continuation", () => {
    const md = ["行事内容: 一行目。", "", "二行目。"].join("\n");
    expect(parseMarkdownForm(md).fields).toEqual({
      行事内容: "一行目。\n二行目。",
    });
  });

  it("treats trailing # headings as comments and only first heading as title", () => {
    const md = [
      "# 行事許可願",
      "## メモ",
      "クラブ名: サッカー部",
      "# 追記",
      "行事名: 〇〇大会",
    ].join("\n");

    const result = parseMarkdownForm(md);
    expect(result.titleType).toBe("行事許可願");
    expect(result.fields).toEqual({
      クラブ名: "サッカー部",
      行事名: "〇〇大会",
    });
  });

  it("trims whitespace around keys and values", () => {
    const md = "  クラブ名  :   サッカー部   ";
    expect(parseMarkdownForm(md).fields).toEqual({ クラブ名: "サッカー部" });
  });

  it("allows empty values", () => {
    const md = "備考:";
    expect(parseMarkdownForm(md).fields).toEqual({ 備考: "" });
  });

  it("omits titleType when no heading is present", () => {
    const md = "クラブ名: サッカー部";
    const result = parseMarkdownForm(md);
    expect(result.titleType).toBeUndefined();
    expect(result.fields).toEqual({ クラブ名: "サッカー部" });
  });

  it("handles CRLF line endings", () => {
    const md = "# 行事許可願\r\nクラブ名: サッカー部\r\n";
    expect(parseMarkdownForm(md)).toEqual({
      titleType: "行事許可願",
      fields: { クラブ名: "サッカー部" },
    });
  });

  it("splits on the first colon so values may contain colons", () => {
    const md = "参考URL: https://example.com/path";
    expect(parseMarkdownForm(md).fields).toEqual({
      参考URL: "https://example.com/path",
    });
  });
});
