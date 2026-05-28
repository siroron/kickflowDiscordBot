import type { ResolvedInput } from "../mapping/fieldMap.js";
import type { CreateTicketPayload, TicketStatus } from "./types.js";

export interface BuildTicketParams {
  workflowId: string;
  authorTeamId: string;
  status: TicketStatus;
  title: string;
  inputs: ResolvedInput[];
}

export function buildCreateTicketPayload(params: BuildTicketParams): CreateTicketPayload {
  return {
    status: params.status,
    workflowId: params.workflowId,
    authorTeamId: params.authorTeamId,
    title: params.title,
    inputs: params.inputs.map((i) => ({
      formFieldCode: i.formFieldCode,
      value: i.value,
    })),
  };
}
