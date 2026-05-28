import { CreateTicketPayload, KickflowApiError, TicketResponse } from "./types";
import logger from "../utils/logger";

export class KickflowClient {
  constructor(private baseUrl: string, private token: string) {}

  async createTicket(payload: CreateTicketPayload): Promise<TicketResponse> {
    const attempt = async (): Promise<TicketResponse> => {
      const res = await fetch(`${this.baseUrl}/tickets`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        throw new KickflowApiError(res.status, err.message ?? res.statusText);
      }

      return res.json() as Promise<TicketResponse>;
    };

    // Retry up to 2 times with exponential backoff for network errors
    let lastError: unknown;
    for (let i = 0; i <= 2; i++) {
      try {
        return await attempt();
      } catch (err) {
        lastError = err;
        if (err instanceof KickflowApiError) {
          // Don't retry on API errors (4xx/5xx)
          throw err;
        }
        if (i < 2) {
          const delay = Math.pow(2, i + 1) * 1000;
          logger.warn(`Network error, retrying in ${delay}ms...`);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }
    throw lastError;
  }
}
