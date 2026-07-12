import type { TitanCRMProvider } from "../types";

export const mockTitanCRM: TitanCRMProvider = {
  async syncLead(data) {
    console.log("[TitanCRM Mock] syncLead", data);
    return { crmId: `TITAN-LEAD-${Date.now()}` };
  },
  async syncEOI(data) {
    console.log("[TitanCRM Mock] syncEOI", data);
    return { crmId: `TITAN-EOI-${Date.now()}` };
  },
  async syncSiteVisit(data) {
    console.log("[TitanCRM Mock] syncSiteVisit", data);
  },
  async syncBlock(data) {
    console.log("[TitanCRM Mock] syncBlock", data);
    return { crmId: `TITAN-BLOCK-${Date.now()}` };
  },
  async syncBooking(data) {
    console.log("[TitanCRM Mock] syncBooking", data);
    return { crmId: `TITAN-BOOKING-${Date.now()}` };
  },
  async searchLead(query) {
    console.log("[TitanCRM Mock] searchLead", query);
    return null;
  },
};
