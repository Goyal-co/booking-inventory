import { z } from "zod";

export const blockCustomerSchema = z.object({
  unitId: z.string().cuid(),
  customerName: z.string().min(2).max(100),
  customerEmail: z.string().email(),
  customerPhone: z.string().min(10).max(15),
  saleablePricePerSqft: z.number().positive().optional(),
  leadId: z.string().optional(),
});

export const costSheetCalculateSchema = z.object({
  unitId: z.string().cuid(),
  saleablePricePerSqft: z.number().positive(),
});

export const digitalFormStepSchema = z.object({
  step: z.enum([
    "cover",
    "apartment",
    "applicant",
    "jointApplicant",
    "geographic",
    "occupation",
    "communication",
    "sourceOfFund",
    "authority",
    "sourceOfEnquiry",
    "realEstateAgents",
    "earnestDeposit",
    "terms",
    "consent",
  ]),
  data: z.record(z.unknown()),
});

export const walkInLeadSchema = z.object({
  customerName: z.string().min(2),
  customerPhone: z.string().min(10),
  customerEmail: z.string().email().optional(),
  projectId: z.string().cuid().optional(),
});

export const leadAssignSchema = z.object({
  salesUserId: z.string().cuid(),
  notes: z.string().optional(),
});

export const integrationEventSchema = z.object({
  type: z.enum([
    "lead.created",
    "lead.site_visit",
    "unit.blocked",
    "booking.submitted",
    "booking.confirmed",
    "payment.due",
    "payment.received",
  ]),
  entityId: z.string(),
  payload: z.record(z.unknown()),
  timestamp: z.string().datetime().optional(),
});

export const titanBookingPayloadSchema = z.object({
  leadId: z.string(),
  fatherSpouseName: z.string().optional(),
  dateOfBirth: z.string().optional(),
  maritalStatus: z.string().optional(),
  nationality: z.string().optional(),
  communicationAddress: z.string().optional(),
  permanentAddress: z.string().optional(),
  occupation: z.string().optional(),
  organizationName: z.string().optional(),
  designation: z.string().optional(),
  sourceOfFund: z.string().optional(),
  sourceOfEnquiry: z.string().optional(),
});

export type BlockCustomerInput = z.infer<typeof blockCustomerSchema>;
export type CostSheetCalculateInput = z.infer<typeof costSheetCalculateSchema>;
export type IntegrationEvent = z.infer<typeof integrationEventSchema>;
export type TitanBookingPayload = z.infer<typeof titanBookingPayloadSchema>;

function stepData(formData: Record<string, unknown>, step: string): Record<string, unknown> {
  const raw = formData[step];
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
}

/** Maps nested digital form steps to flat Titan CRM payload fields */
export function mapDigitalFormToTitanPayload(formData: Record<string, unknown>) {
  const applicant = stepData(formData, "applicant");
  const occupation = stepData(formData, "occupation");
  const communication = stepData(formData, "communication");
  const sourceOfFund = stepData(formData, "sourceOfFund");
  const sourceOfEnquiry = stepData(formData, "sourceOfEnquiry");

  return titanBookingPayloadSchema.partial().parse({
    fatherSpouseName:
      (applicant.fatherSpouseName as string) ?? (formData.fatherSpouseName as string),
    dateOfBirth: (applicant.dateOfBirth as string) ?? (formData.dateOfBirth as string),
    maritalStatus: (applicant.maritalStatus as string) ?? (formData.maritalStatus as string),
    nationality: (applicant.nationality as string) ?? (formData.nationality as string),
    communicationAddress:
      (communication.address as string) ?? (formData.communicationAddress as string),
    permanentAddress:
      (communication.permanentAddress as string) ?? (formData.permanentAddress as string),
    occupation: (occupation.occupation as string) ?? (formData.occupation as string),
    organizationName:
      (occupation.organizationName as string) ?? (formData.organizationName as string),
    designation: (occupation.designation as string) ?? (formData.designation as string),
    sourceOfFund: (sourceOfFund.source as string) ?? (formData.sourceOfFund as string),
    sourceOfEnquiry:
      (sourceOfEnquiry.source as string) ?? (formData.sourceOfEnquiry as string),
  });
}

export const attachCustomerToBlockSchema = blockCustomerSchema.omit({ unitId: true });
