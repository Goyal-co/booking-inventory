import type { PostCRMProvider, TitanCRMProvider } from "./types";
import { mockTitanCRM } from "./titan/mock";
import { httpTitanCRM } from "./titan/http";
import { mockPostCRM } from "./post-crm/mock";

export * from "./types";
export type {
  GoyalCrmLead,
  GoyalCrmLeadListParams,
  GoyalCrmLeadListResult,
  CreateEoiLeadInput,
  BookEoiLeadInput,
  UpdateGoyalLeadInput,
  MarkSiteVisitInput,
} from "./goyal-crm/types";
export {
  GoyalCrmError,
  getGoyalCrmCapabilities,
  compactEoiPayload,
  listGoyalLeads,
  listGoyalLeadsViaEoiKey,
  listGoyalLeadsStaff,
  getGoyalLead,
  createGoyalEoiLead,
  createGoyalEoiLeadViaWebhook,
  createEoiLeadBestEffort,
  normalizeWebhookLead,
  enrichLeadIdFromEoiList,
  enrichLeadIdFromStaffList,
  resolveGoyalLeadId,
  bookGoyalLead,
  updateGoyalLead,
  markGoyalSiteVisit,
  listMyGoyalLeads,
} from "./goyal-crm/client";

export function getTitanCRMProvider(): TitanCRMProvider {
  const provider = process.env.TITAN_CRM_PROVIDER ?? "mock";
  if (provider === "http") return httpTitanCRM;
  return mockTitanCRM;
}

export function getPostCRMProvider(): PostCRMProvider {
  const provider = process.env.POST_CRM_PROVIDER ?? "mock";
  if (provider === "mock") return mockPostCRM;
  return mockPostCRM;
}
