import type { CreateTicketPayload, TicketResponse } from "./types.js";

export class KickflowApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "KickflowApiError";
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class KickflowClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async createTicket(payload: CreateTicketPayload): Promise<TicketResponse> {
    const res = await this.fetchImpl(`${this.baseUrl}/tickets`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => undefined);
      const message =
        (body as { message?: string } | undefined)?.message ?? res.statusText ?? "request failed";
      throw new KickflowApiError(res.status, message, body);
    }

    return (await res.json()) as TicketResponse;
  }
}
