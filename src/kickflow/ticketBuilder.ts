import type { ResolvedInput } from "../mapping/fieldMap.js";
import type { CreateTicketPayload, TicketStatus } from "./types.js";

export interface BuildTicketParams {
  workflowId: string;
  authorTeamId: string;
  status: TicketStatus;
  title?: string;
  inputs: ResolvedInput[];
}

export function buildCreateTicketPayload(params: BuildTicketParams): CreateTicketPayload {
  const payload: CreateTicketPayload = {
    status: params.status,
    workflowId: params.workflowId,
    authorTeamId: params.authorTeamId,
    inputs: params.inputs.map((i) =>
      i.kind === "master"
        ? { formFieldCode: i.formFieldCode, generalMasterItemId: i.value }
        : { formFieldCode: i.formFieldCode, value: i.value },
    ),
  };
  if (params.title !== undefined) payload.title = params.title;
  return payload;
}
