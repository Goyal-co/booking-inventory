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
    const phone = query.phone?.replace(/\D/g, "") ?? "";
    const leadId = query.leadId?.trim().toUpperCase() ?? "";

    // Demo: Titan lead with no partner — reception asks CP to register first
    if (phone.endsWith("8888888888") || leadId === "TITAN-NOPARTNER") {
      return {
        found: true,
        leadId: "TITAN-NOPARTNER",
        customerName: "Titan Guest",
        phone: phone || "8888888888",
        partners: [],
        needsPartnerRegistration: true,
        tags: ["Leads"],
      };
    }

    // Demo: same customer submitted by 2 channel partners (timestamps)
    if (phone.endsWith("9876500001") || leadId === "TITAN-MULTI-CP") {
      return {
        found: true,
        leadId: "TITAN-MULTI-CP",
        customerName: "Multi Partner Guest",
        phone: phone || "9876500001",
        partners: [
          {
            cpId: "CP-ABC",
            partnerName: "ABC Realtors",
            submittedAt: "2026-07-20T10:15:00.000Z",
            tag: "EOI",
          },
          {
            cpId: "CP-XYZ",
            partnerName: "XYZ Homes",
            submittedAt: "2026-07-22T14:40:00.000Z",
            tag: "Leads",
          },
        ],
        needsPartnerRegistration: false,
        tags: ["Leads", "EOI"],
      };
    }

    // Demo: Titan lead with exactly one partner (no local LeadRegistry yet)
    if (phone.endsWith("9876500003") || leadId === "TITAN-SINGLE-REMOTE") {
      return {
        found: true,
        leadId: "TITAN-SINGLE-REMOTE",
        customerName: "Remote Single Partner",
        phone: phone || "9876500003",
        partners: [
          {
            cpId: "CP-REMOTE",
            partnerName: "Remote Partners LLP",
            submittedAt: "2026-07-18T09:00:00.000Z",
            tag: "Leads",
          },
        ],
        needsPartnerRegistration: false,
        tags: ["Leads"],
      };
    }

    return null;
  },
};
