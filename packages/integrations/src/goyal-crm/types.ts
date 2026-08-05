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
};

export type MarkSiteVisitInput = {
  siteVisit?: boolean;
  siteVisitDate?: string;
  siteVisitDone?: boolean;
  siteVisitDoneDate?: string;
  notes?: string;
};
