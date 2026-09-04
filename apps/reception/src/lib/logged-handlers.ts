/**
 * Lifecycle-wrapped API handlers for reception.
 * Routes should import from here instead of ./api-handlers.
 */
import { withLoggedHandler } from "@booking/logger";
import * as H from "./api-handlers";

export const GET_leadsSearch = withLoggedHandler("reception.leads.search", H.GET_leadsSearch);
export const POST_walkInLead = withLoggedHandler("reception.leads.walkin", H.POST_walkInLead);
export const POST_assignLead = withLoggedHandler("reception.leads.assign", H.POST_assignLead);
export const POST_leadSiteVisitOtpSend = withLoggedHandler(
  "reception.leads.otp.send",
  H.POST_leadSiteVisitOtpSend,
);
export const POST_leadSiteVisitOtpVerify = withLoggedHandler(
  "reception.leads.otp.verify",
  H.POST_leadSiteVisitOtpVerify,
);
export const POST_materializeTitanLead = withLoggedHandler(
  "reception.leads.fromTitan",
  H.POST_materializeTitanLead,
);
export const POST_materializeEoiLead = withLoggedHandler(
  "reception.leads.fromEoi",
  H.POST_materializeEoiLead,
);
export const GET_me = withLoggedHandler("reception.me", H.GET_me);
export const GET_availableSalespersons = withLoggedHandler(
  "reception.salespersons.available",
  H.GET_availableSalespersons,
);
export const GET_visitsToday = withLoggedHandler("reception.visits.today", H.GET_visitsToday);
export const GET_eoiCapabilities = withLoggedHandler(
  "reception.eoi.capabilities",
  H.GET_eoiCapabilities,
);
export const GET_eoiLeads = withLoggedHandler("reception.eoi.leads.list", H.GET_eoiLeads);
export const POST_eoiLead = withLoggedHandler("reception.eoi.leads.create", H.POST_eoiLead);
export const GET_eoiLead = withLoggedHandler("reception.eoi.leads.get", H.GET_eoiLead);
export const GET_eoiMyLeads = withLoggedHandler("reception.eoi.myLeads", H.GET_eoiMyLeads);
export const POST_eoiBook = withLoggedHandler("reception.eoi.book", H.POST_eoiBook);
export const POST_eoiSiteVisitOtpSend = withLoggedHandler(
  "reception.eoi.otp.send",
  H.POST_eoiSiteVisitOtpSend,
);
export const POST_eoiAssign = withLoggedHandler("reception.eoi.assign", H.POST_eoiAssign);
export const POST_eoiSiteVisit = withLoggedHandler("reception.eoi.siteVisit", H.POST_eoiSiteVisit);
