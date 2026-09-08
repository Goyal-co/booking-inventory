export type GoyalCrmLead = {
  id: string;
  leadCode?: string;
  source?: string;
  fullName?: string;
  phone?: string;
  email?: string | null;
  projectName?: string | null;
  projectId?: string | null;
  city?: string | null;
  booked?: boolean;
  bookedDate?: string | null;
  siteVisit?: boolean;
  siteVisitDate?: string | null;
  siteVisitDone?: boolean;
  siteVisitDoneDate?: string | null;
  called?: boolean;
  assignedToId?: string | null;
  leadQuality?: string | null;
  dateOfBirth?: string | null;
  maritalStatus?: string | null;
  nationality?: string | null;
  communicationAddress?: string | null;
  permanentAddress?: string | null;
  occupation?: string | null;
  organizationName?: string | null;
  designation?: string | null;
  sourceOfFund?: string | null;
  sourceOfEnquiry?: string | null;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

export type GoyalCrmLeadListParams = {
  page?: number;
  limit?: number;
  /** true = GET /eoi/all-leads (full dump; prefer paginated list in UI) */
  all?: boolean;
  source?: string;
  search?: string;
  phone?: string;
  fullName?: string;
  email?: string;
  city?: string;
  projectName?: string;
  assignedToId?: string;
  booked?: boolean | string;
  called?: boolean | string;
  siteVisit?: boolean | string;
  leadQuality?: string;
  dateFrom?: string;
  dateTo?: string;
  updatedFrom?: string;
  updatedTo?: string;
};

export type GoyalCrmLeadListResult = {
  leads: GoyalCrmLead[];
  page: number;
  limit: number;
  total: number | null;
  raw: unknown;
};

export type CreateEoiLeadInput = {
  fullName: string;
  phone: string;
  email?: string;
  projectId?: string;
  projectName?: string;
  assignedToId?: string;
  city?: string;
  dateOfBirth?: string;
  maritalStatus?: string;
  nationality?: string;
  communicationAddress?: string;
  permanentAddress?: string;
  occupation?: string;
  organizationName?: string;
  designation?: string;
  sourceOfFund?: string;
  sourceOfEnquiry?: string;
  /** Partner Portal public lead id (EOI-… / LEAD-…) */
  leadId?: string;
  notes?: string;
  /** Extended history for CRM (also embedded in notes when CRM ignores unknown fields). */
  channelPartnerId?: string;
  channelPartnerName?: string;
  channelPartnerMobile?: string;
  intentType?: string;
  fosName?: string;
  projectHistory?: Array<Record<string, unknown>>;
  siteVisitHistory?: Array<Record<string, unknown>>;
  bookingHistory?: Array<Record<string, unknown>>;
};

export type BookEoiLeadInput = {
  booked: boolean;
  bookedDate?: string;
  dateOfBirth?: string;
  maritalStatus?: string;
  nationality?: string;
  communicationAddress?: string;
  permanentAddress?: string;
  occupation?: string;
  organizationName?: string;
  designation?: string;
  sourceOfFund?: string;
  sourceOfEnquiry?: string;
  /** CP with whom customer booked / came today */
  channelPartnerId?: string;
  channelPartnerName?: string;
  channelPartnerMobile?: string;
  notes?: string;
  leadId?: string;
  projectId?: string;
  projectName?: string;
  unitNumber?: string;
  towerName?: string;
  floorNumber?: number | string;
  carpetArea?: number;
  superBuiltUpArea?: number;
  saleableArea?: number;
  totalPrice?: number;
  salespersonId?: string;
  salespersonName?: string;
  bookingId?: string;
  projectHistory?: Array<Record<string, unknown>>;
  siteVisitHistory?: Array<Record<string, unknown>>;
  bookingHistory?: Array<Record<string, unknown>>;
};

export type UpdateGoyalLeadInput = {
  siteVisit?: boolean;
  siteVisitDate?: string;
  siteVisitDone?: boolean;
  siteVisitDoneDate?: string;
  called?: boolean;
  booked?: boolean;
  bookedDate?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  city?: string;
  projectName?: string;
  dateOfBirth?: string;
  maritalStatus?: string;
  nationality?: string;
  communicationAddress?: string;
  permanentAddress?: string;
  occupation?: string;
  organizationName?: string;
  designation?: string;
  sourceOfFund?: string;
  sourceOfEnquiry?: string;
  notes?: string;
  leadId?: string;
  channelPartnerId?: string;
  channelPartnerName?: string;
};

export type MarkSiteVisitInput = {
  siteVisit?: boolean;
  siteVisitDate?: string;
  siteVisitDone?: boolean;
  siteVisitDoneDate?: string;
  notes?: string;
  /** Channel partner who brought the customer (sent in notes / optional CRM fields). */
  visitingCpId?: string;
  visitingCpName?: string;
  visitingCpMobile?: string;
  salespersonName?: string;
  salespersonId?: string;
  leadId?: string;
  projectId?: string;
  projectName?: string;
  projectHistory?: Array<Record<string, unknown>>;
  siteVisitHistory?: Array<Record<string, unknown>>;
};
