import { describe, expect, it } from "vitest";
import type { ResolvedInput } from "../mapping/fieldMap.js";
import { buildCreateTicketPayload } from "./ticketBuilder.js";

describe("buildCreateTicketPayload", () => {
  const inputs: ResolvedInput[] = [
    { formFieldCode: "club_name", kind: "master", value: "club-soccer-id" },
    { formFieldCode: "event_type", kind: "value", value: "event-match-id" },
    { formFieldCode: "event_name", kind: "value", value: "〇〇大会" },
    { formFieldCode: "event_detail", kind: "value", value: "本文" },
    { formFieldCode: "remarks", kind: "value", value: null },
  ];

  it("assembles the kickflow create-ticket payload (master → generalMasterItemId)", () => {
    const payload = buildCreateTicketPayload({
      workflowId: "wf-1",
      authorTeamId: "team-1",
      status: "draft",
      title: "情報学部自治会に関する行事許可願",
      inputs,
    });

    expect(payload).toEqual({
      status: "draft",
      workflowId: "wf-1",
      authorTeamId: "team-1",
      title: "情報学部自治会に関する行事許可願",
      inputs: [
        { formFieldCode: "club_name", generalMasterItemId: "club-soccer-id" },
        { formFieldCode: "event_type", value: "event-match-id" },
        { formFieldCode: "event_name", value: "〇〇大会" },
        { formFieldCode: "event_detail", value: "本文" },
        { formFieldCode: "remarks", value: null },
      ],
    });
  });

  it("preserves the given status (draft vs in_progress)", () => {
    const payload = buildCreateTicketPayload({
      workflowId: "wf-1",
      authorTeamId: "team-1",
      status: "in_progress",
      title: "t",
      inputs: [],
    });
    expect(payload.status).toBe("in_progress");
  });

  it("omits title when not provided (for workflows with titleInputMode != input)", () => {
    const payload = buildCreateTicketPayload({
      workflowId: "wf-1",
      authorTeamId: "team-1",
      status: "draft",
      inputs: [],
    });
    expect("title" in payload).toBe(false);
  });
});
