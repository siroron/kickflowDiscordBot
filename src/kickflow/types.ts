export type TicketStatus = "draft" | "in_progress";

export interface TicketInput {
  formFieldCode: string;
  value: string | null;
}

export interface CreateTicketPayload {
  status: TicketStatus;
  workflowId: string;
  authorTeamId: string;
  title: string;
  inputs: TicketInput[];
}

export interface TicketResponse {
  id: string;
  ticketNumber?: string | null;
  url?: string;
}
