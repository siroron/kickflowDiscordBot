export type TicketStatus = "draft" | "in_progress";

export interface TicketInput {
  formFieldCode: string;
  value?: string | string[] | null;
  generalMasterItemId?: string | null;
}

export interface SlipFieldInput {
  slipFieldCode: string;
  value?: string | string[] | null;
  generalMasterItemId?: string | null;
  userId?: string | null;
  teamId?: string | null;
  ticketId?: string | null;
  files?: string[] | null;
}

export interface SlipItem {
  slipSectionId?: string | null;
  slipSectionCode?: string | null;
  inputs: SlipFieldInput[];
}

export interface CreateTicketPayload {
  status: TicketStatus;
  workflowId: string;
  authorTeamId: string;
  title?: string;
  inputs: TicketInput[];
  slipItems?: SlipItem[];
}

export interface TicketResponse {
  id: string;
  ticketNumber?: string | null;
  url?: string;
}
