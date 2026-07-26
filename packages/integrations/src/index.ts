import type { PostCRMProvider, TitanCRMProvider } from "./types";
import { mockTitanCRM } from "./titan/mock";
import { httpTitanCRM } from "./titan/http";
import { mockPostCRM } from "./post-crm/mock";

export * from "./types";
export * from "./goyal-crm/types";
export {
  GoyalCrmError,
  listGoyalLeads,
  getGoyalLead,
  createGoyalEoiLead,
  createGoyalEoiLeadViaWebhook,
  bookGoyalLead,
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
