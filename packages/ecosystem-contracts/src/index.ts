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
  /** Channel partner the visitor is with today (when multiple CPs registered the same phone). */
  visitingPartnerCpId: z.string().min(1).max(120).optional(),
  visitingPartnerName: z.string().min(1).max(200).optional(),
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

/** Maps nested digital form steps to flat Titan CRM payload fields (Rudra Step 4). */
export function mapDigitalFormToTitanPayload(formData: Record<string, unknown>) {
  const applicant = stepData(formData, "applicant");
  const occupation = stepData(formData, "occupation");
  const communication = stepData(formData, "communication");
  const geographic = stepData(formData, "geographic");
  const sourceOfFund = stepData(formData, "sourceOfFund");
  const sourceOfEnquiry = stepData(formData, "sourceOfEnquiry");

  const str = (...vals: unknown[]) => {
    for (const v of vals) {
      if (typeof v === "string" && v.trim()) return v.trim();
      if (Array.isArray(v) && v.length) {
        const joined = v.map(String).filter(Boolean).join(", ");
        if (joined) return joined;
      }
    }
    return undefined;
  };

  return titanBookingPayloadSchema.partial().parse({
    fatherSpouseName: str(applicant.fatherSpouseName, formData.fatherSpouseName),
    dateOfBirth: str(applicant.dateOfBirth, formData.dateOfBirth),
    maritalStatus: str(applicant.maritalStatus, formData.maritalStatus),
    nationality: str(applicant.nationality, formData.nationality),
    // Customer form uses geographic.*; keep communication.* as legacy fallback
    communicationAddress: str(
      geographic.communicationAddress,
      communication.address,
      communication.communicationAddress,
      formData.communicationAddress
    ),
    permanentAddress: str(
      geographic.permanentAddress,
      communication.permanentAddress,
      formData.permanentAddress
    ),
    // Customer form: occupationType; legacy: occupation
    occupation: str(
      occupation.occupationType,
      occupation.occupation,
      formData.occupation
    ),
    organizationName: str(occupation.organizationName, formData.organizationName),
    designation: str(occupation.designation, formData.designation),
    // Customer form: fundingType; legacy: source
    sourceOfFund: str(
      sourceOfFund.fundingType,
      sourceOfFund.source,
      typeof formData.sourceOfFund === "string" ? formData.sourceOfFund : undefined
    ),
    // Customer form: sources[]; legacy: source
    sourceOfEnquiry: str(
      sourceOfEnquiry.sources,
      sourceOfEnquiry.source,
      sourceOfEnquiry.sourceDetails,
      typeof formData.sourceOfEnquiry === "string" ? formData.sourceOfEnquiry : undefined
    ),
  });
}

export const attachCustomerToBlockSchema = blockCustomerSchema.omit({ unitId: true });
