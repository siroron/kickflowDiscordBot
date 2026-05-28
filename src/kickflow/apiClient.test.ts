import { describe, expect, it, vi } from "vitest";
import { KickflowApiError, KickflowClient } from "./apiClient.js";
import type { CreateTicketPayload } from "./types.js";

const payload: CreateTicketPayload = {
  status: "draft",
  workflowId: "wf-1",
  authorTeamId: "team-1",
  title: "t",
  inputs: [{ formFieldCode: "event_name", value: "〇〇大会" }],
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("KickflowClient.createTicket", () => {
  it("POSTs to /tickets with bearer auth and JSON body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(201, { id: "ticket-1", ticketNumber: "T-100" }),
    );
    const client = new KickflowClient("https://api.example.com/v1", "secret", fetchMock);

    const result = await client.createTicket(payload);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.example.com/v1/tickets");
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer secret");
    expect((init?.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init?.body as string)).toEqual(payload);
    expect(result).toEqual({ id: "ticket-1", ticketNumber: "T-100" });
  });

  it("throws KickflowApiError with status and server message on non-2xx", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(422, { message: "workflowId is invalid" }));
    const client = new KickflowClient("https://api.example.com/v1", "secret", fetchMock);

    await expect(client.createTicket(payload)).rejects.toMatchObject({
      name: "KickflowApiError",
      status: 422,
      message: "workflowId is invalid",
    });
  });

  it("falls back to status text when the error body has no message", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("not json", { status: 401, statusText: "Unauthorized" }),
    );
    const client = new KickflowClient("https://api.example.com/v1", "secret", fetchMock);

    await expect(client.createTicket(payload)).rejects.toMatchObject({
      status: 401,
      message: "Unauthorized",
    });
  });

  it("surfaces KickflowApiError as an instance check", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(400, { message: "bad" }));
    const client = new KickflowClient("https://api.example.com/v1", "secret", fetchMock);

    try {
      await client.createTicket(payload);
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(KickflowApiError);
    }
  });
});
