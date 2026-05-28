export interface TicketInput {
  formFieldCode: string;
  value: string | null;
}

export interface CreateTicketPayload {
  status: "draft" | "in_progress";
  workflowId: string;
  authorTeamId: string;
  title?: string;
  inputs: TicketInput[];
}

export interface TicketResponse {
  id: string;
  ticketNumber: number | null;
  title: string;
  status: string;
  [key: string]: unknown;
}

export class KickflowApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(`kickflow API error (${statusCode}): ${message}`);
    this.name = "KickflowApiError";
  }
}
