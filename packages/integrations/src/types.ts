export interface TitanLeadPayload {
  leadId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  source?: string;
  projectName?: string;
  intentType?: string;
}

export interface TitanBookingPayload {
  bookingId: string;
  leadId?: string;
  fatherSpouseName?: string;
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
}

export interface TitanCRMProvider {
  syncLead(data: TitanLeadPayload): Promise<{ crmId: string }>;
  syncEOI(data: Record<string, unknown>): Promise<{ crmId: string }>;
  syncSiteVisit(data: { leadId: string; salesUserId: string; notes?: string }): Promise<void>;
  syncBlock(data: { blockId: string; leadId?: string; projectName: string; unitNumber: string }): Promise<{ crmId: string }>;
  syncBooking(data: TitanBookingPayload): Promise<{ crmId: string }>;
  searchLead(query: { leadId?: string; phone?: string }): Promise<Record<string, unknown> | null>;
}

export interface PostBookingPayload {
  bookingId: string;
  customerName: string;
  unitNumber: string;
  projectName: string;
  totalPrice: number;
}

export interface PostCRMProvider {
  syncBooking(data: PostBookingPayload): Promise<{ postCrmId: string }>;
  syncPaymentSchedule(data: Record<string, unknown>): Promise<void>;
  getPaymentStatus(postCrmId: string): Promise<Array<{ stageName: string; amountDue: number; amountPaid: number }>>;
}
