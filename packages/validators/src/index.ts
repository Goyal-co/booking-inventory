import { z } from "zod";
import {
  blockCustomerSchema,
  costSheetCalculateSchema,
  digitalFormStepSchema,
  walkInLeadSchema,
  leadAssignSchema,
  attachCustomerToBlockSchema,
} from "@goyal/ecosystem-contracts";

export {
  blockCustomerSchema,
  costSheetCalculateSchema,
  digitalFormStepSchema,
  walkInLeadSchema,
  leadAssignSchema,
  attachCustomerToBlockSchema,
};

export {
  BOOKING_FORM_TEMPLATE_PRESETS,
  mergeTemplateContent,
  type BookingFormTemplateContent,
  type BookingFormTemplateVariant,
} from "./booking-form-presets";

export {
  PRINT_BLOCK_IDS,
  defaultPrintLayout,
  mergePrintLayout,
  type PrintBlockId,
  type PrintLayout,
  type PrintLayoutBlock,
} from "./print-layout";

export { normalizeMediaUrl } from "./media-url";


export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const createBlockSchema = z.object({
  unitId: z.string().cuid(),
  projectId: z.string().cuid().optional(),
  customerName: z.string().min(2).max(100).optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().min(10).max(15).optional(),
  saleablePricePerSqft: z.number().positive().optional(),
  leadId: z.string().optional(),
});

export const releaseBlockSchema = z.object({
  blockId: z.string().cuid(),
});

export const createBookingSchema = z.object({
  blockId: z.string().cuid(),
  customerName: z.string().min(2).max(100),
  customerPhone: z.string().min(10).max(15),
});

export const unitFiltersSchema = z.object({
  projectId: z.string().cuid(),
  search: z.string().optional(),
  tower: z.string().optional(),
  bhk: z.string().optional(),
  status: z.enum(["AVAILABLE", "BLOCKED", "BOOKED", "SOLD", "HOLD"]).optional(),
  floor: z.string().optional(),
  facing: z.string().optional(),
  priceBand: z.string().optional(),
  customTag: z.string().optional(),
  carpetArea: z.string().optional(),
  superArea: z.string().optional(),
});

export const createProjectSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  launchDate: z.string().datetime().optional(),
  blockDurationMs: z.number().int().min(60000).max(604800000).default(900000),
  maxBlocksPerUser: z.number().int().min(1).max(10).default(3),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#2563EB"),
});

const assetUrlSchema = z
  .string()
  .min(1)
  .refine((v) => v.startsWith("/") || z.string().url().safeParse(v).success, {
    message: "Must be a valid URL or path starting with /",
  });

export const floorPlanTypeSchema = z.object({
  name: z.string().min(2),
  bhkType: z.string().min(2),
  carpetArea: z.number().int().positive(),
  superArea: z.number().int().positive(),
  balconyArea: z.number().int().positive().optional(),
  sizeType: z.enum(["SBA", "CARPET"]).default("SBA"),
  imageUrl: assetUrlSchema.optional().or(z.literal("")),
  pdfUrl: assetUrlSchema.optional().or(z.literal("")),
  amenities: z.array(z.string()).default([]),
});

export const updateFloorPlanSchema = floorPlanTypeSchema.partial();

export const costSheetLineItemSchema = z.object({
  label: z.string().min(1),
  amount: z.number(),
});

export const costSheetTemplateSchema = z.object({
  name: z.string().min(2),
  lineItems: z.array(costSheetLineItemSchema).min(1),
  floorPlanTypeId: z.string().cuid().optional(),
});

export const towerSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).max(5),
  sortOrder: z.number().int().default(0),
});

export const unitStackRowSchema = z.object({
  stackNumber: z.number().int().min(1).max(99),
  floorPlanTypeId: z.string().cuid(),
  costSheetTemplateId: z.string().cuid(),
  sizeType: z.enum(["SBA", "CARPET"]).default("SBA"),
  activeFromFloor: z.number().int().min(1),
  activeToFloor: z.number().int().min(1),
});

export const unitStackGenerateSchema = z
  .object({
    towerId: z.string().cuid(),
    fromFloor: z.number().int().min(1),
    toFloor: z.number().int().min(1),
    stacks: z.array(unitStackRowSchema).min(1),
    saveTemplate: z.boolean().default(false),
  })
  .refine((d) => d.fromFloor <= d.toFloor, { message: "fromFloor must be <= toFloor" })
  .refine(
    (d) =>
      d.stacks.every(
        (s) =>
          s.activeFromFloor >= d.fromFloor &&
          s.activeToFloor <= d.toFloor &&
          s.activeFromFloor <= s.activeToFloor
      ),
    { message: "Stack active floors must be within the building floor range" }
  );

/** @deprecated Use unitStackGenerateSchema */
export const bulkFloorSchema = z.object({
  towerId: z.string().cuid(),
  fromFloor: z.number().int().min(0),
  toFloor: z.number().int().min(1),
  unitsPerFloor: z.number().int().min(1).max(20),
  floorPlanTypeId: z.string().cuid(),
  costSheetTemplateId: z.string().cuid(),
});

export const bulkAssignSchema = z.object({
  projectId: z.string().cuid(),
  unitIds: z.array(z.string().cuid()).min(1),
  floorPlanTypeId: z.string().cuid().optional(),
  costSheetTemplateId: z.string().cuid().optional(),
  status: z.enum(["AVAILABLE", "BLOCKED", "BOOKED", "SOLD", "HOLD"]).optional(),
});

export const createUnitSchema = z.object({
  towerId: z.string().cuid(),
  floorNumber: z.number().int().min(0),
  unitNumber: z.string().min(1).max(20),
  floorPlanTypeId: z.string().cuid(),
  costSheetTemplateId: z.string().cuid(),
  facing: z.string().max(50).optional(),
  remarks: z.string().max(500).optional(),
  priceOverride: z.number().positive().optional(),
});

export const updateUnitSchema = createUnitSchema
  .partial()
  .omit({ towerId: true, floorNumber: true })
  .extend({
    status: z.enum(["AVAILABLE", "BLOCKED", "BOOKED", "SOLD", "HOLD"]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export const deleteUnitSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const massBlockSchema = z.object({
  projectId: z.string().cuid(),
  unitIds: z.array(z.string().cuid()).min(1),
  action: z.enum(["block", "unblock", "hold", "release_hold"]),
  durationMs: z.number().int().optional(),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(6),
  role: z.enum(["SUPER_ADMIN", "PROJECT_ADMIN", "SALES_MANAGER", "SALES_EXEC", "RECEPTION"]),
  projectIds: z.array(z.string().cuid()).default([]),
});

export const createAdminUserSchema = z
  .object({
    email: z.string().email(),
    name: z.string().min(2),
    password: z.string().min(8),
    role: z.enum(["SUPER_ADMIN", "PROJECT_ADMIN"]),
    projectIds: z.array(z.string().cuid()).default([]),
  })
  .refine((data) => data.role !== "PROJECT_ADMIN" || data.projectIds.length > 0, {
    message: "Project Admin must be assigned at least one project",
    path: ["projectIds"],
  });

export const importUserRowSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(6),
  role: z.enum(["SALES_MANAGER", "SALES_EXEC"]),
  projectIds: z.array(z.string().cuid()).default([]),
});

export const updateUserSchema = createUserSchema.partial().omit({ password: true }).extend({
  password: z.string().min(6).optional(),
  isActive: z.boolean().optional(),
});

export const filterConfigSchema = z.object({
  dimension: z.enum([
    "TOWER",
    "BHK",
    "STATUS",
    "FLOOR",
    "FACING",
    "PRICE_BAND",
    "CUSTOM_TAG",
    "CARPET_AREA",
    "SUPER_BUILT_UP",
  ]),
  label: z.string().min(1),
  options: z.array(z.object({ value: z.string(), label: z.string() })),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export const projectLifecycleStatusSchema = z.enum(["UPCOMING", "LAUNCH_DAY", "ONGOING"]);

export const updateProjectLifecycleSchema = z
  .object({
    lifecycleStatus: projectLifecycleStatusSchema.optional(),
    blockDurationMs: z.number().int().min(60000).max(604800000).optional(),
    blockDurationDays: z.number().int().min(1).max(7).optional(),
    maxBlocksPerUser: z.number().int().min(1).max(10).optional(),
    statusAutoManage: z.boolean().optional(),
    launchDate: z.string().datetime().optional().nullable(),
    isPublished: z.boolean().optional(),
    name: z.string().min(2).max(100).optional(),
    slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/).optional(),
    description: z.string().optional(),
    requiresBookingApproval: z.boolean().optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    { message: "At least one field is required" }
  );

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateBlockInput = z.infer<typeof createBlockSchema>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type UnitFiltersInput = z.infer<typeof unitFiltersSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type BulkFloorInput = z.infer<typeof bulkFloorSchema>;
export type UnitStackGenerateInput = z.infer<typeof unitStackGenerateSchema>;

export const userFiltersSchema = z.object({
  search: z.string().optional(),
  role: z.enum(["SUPER_ADMIN", "PROJECT_ADMIN", "SALES_MANAGER", "SALES_EXEC", "RECEPTION"]).optional(),
  isActive: z.enum(["true", "false"]).optional(),
  projectId: z.string().cuid().optional(),
});

export const bookingFiltersSchema = z.object({
  projectId: z.string().optional(),
  status: z.enum(["PENDING", "CONFIRMED", "REJECTED", "CANCELLED", "all"]).optional(),
  search: z.string().optional(),
  tower: z.string().optional(),
  bhk: z.string().optional(),
  userId: z.string().cuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export const auditFiltersSchema = z.object({
  action: z.string().optional(),
  entityType: z.string().optional(),
  userId: z.string().cuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export const projectListFiltersSchema = z.object({
  search: z.string().optional(),
  lifecycleStatus: z.enum(["UPCOMING", "LAUNCH_DAY", "ONGOING"]).optional(),
  isPublished: z.enum(["true", "false"]).optional(),
});

export const dashboardRangeSchema = z.enum(["7d", "30d", "90d"]).default("30d");
export type BulkAssignInput = z.infer<typeof bulkAssignSchema>;
export type CreateUnitInput = z.infer<typeof createUnitSchema>;
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;
export type MassBlockInput = z.infer<typeof massBlockSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateProjectLifecycleInput = z.infer<typeof updateProjectLifecycleSchema>;

export const cancelBookingSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const approveBookingSchema = z.object({
  action: z.literal("approve"),
});

export const rejectBookingSchema = z.object({
  action: z.literal("reject"),
  comment: z.string().min(1).max(500),
});

export const patchBookingSchema = z.discriminatedUnion("action", [
  approveBookingSchema,
  rejectBookingSchema,
]);

export const createAnnouncementSchema = z.object({
  title: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(5000),
  type: z.string().max(50).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  audience: z.enum(["ALL_SALES", "PROJECT_SALES"]).optional(),
  projectId: z.string().cuid().nullable().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  publishNow: z.boolean().optional(),
});

export const updateAnnouncementSchema = createAnnouncementSchema.partial();

export const publishAnnouncementSchema = z.object({
  action: z.literal("publish"),
});

/** @deprecated Use blockCustomerSchema from @goyal/ecosystem-contracts */
export const blockWithCustomerSchema = blockCustomerSchema;

export const costSheetPreviewSchema = costSheetCalculateSchema.omit({ unitId: true });

export const paymentScheduleTemplateSchema = z.object({
  stageName: z.string().min(1),
  stageType: z.enum(["FIXED", "PERCENTAGE", "FORMULA"]),
  percentage: z.number().min(0).max(100).optional().nullable(),
  fixedAmount: z.number().positive().optional().nullable(),
  formulaKey: z.string().optional().nullable(),
  sortOrder: z.number().int().optional(),
});

export const otherChargeTemplateSchema = z.object({
  name: z.string().min(1),
  calcMode: z.enum(["FIXED", "RATE_PER_AREA"]),
  amount: z.number().positive().optional().nullable(),
  rate: z.number().positive().optional().nullable(),
  areaField: z.enum(["saleable", "carpet", "balcony"]).optional().nullable(),
  months: z.number().int().positive().optional().nullable(),
  sortOrder: z.number().int().optional(),
});

export const constructionReportSchema = z.object({
  title: z.string().min(1),
  fileUrl: z.string().min(1),
});

export const pricingDefaultsSchema = z.object({
  defaultSaleablePricePerSqft: z.number().positive().optional().nullable(),
  gstPercent: z.number().min(0).max(100).optional().nullable(),
  brochureUrl: z.string().url().optional().or(z.literal("")).nullable(),
});

export const unitMasterRowSchema = z.object({
  tower: z.string().min(1),
  unitNo: z.string().min(1),
  floor: z.number().int(),
  configuration: z.string().optional().default(""),
  saleableAreaSqft: z.number().positive(),
  saleableAreaSqm: z.number().positive().optional().nullable(),
  carpetAreaSqft: z.number().positive().optional().nullable(),
  carpetAreaSqm: z.number().positive().optional().nullable(),
  balconyAreaSqft: z.number().positive().optional().nullable(),
  balconyAreaSqm: z.number().positive().optional().nullable(),
});

const optionalUrlOrPath = z
  .union([z.string().url(), z.string().startsWith("/"), z.literal(""), z.null()])
  .optional();

const optionalText = z.string().max(300).optional().nullable().or(z.literal(""));

export const bookingFormTemplateSchema = z.object({
  name: z.string().max(120).optional().nullable().or(z.literal("")),
  logoUrl: optionalUrlOrPath,
  companyName: z.string().max(120).optional().nullable().or(z.literal("")),
  tagline: z.string().max(200).optional().nullable().or(z.literal("")),
  formTitle: z.string().max(120).optional().nullable().or(z.literal("")),
  formSubtitle: optionalText,
  footerText: optionalText,
  supportEmail: z.union([z.string().email(), z.literal(""), z.null()]).optional(),
  primaryColor: z.union([
    z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    z.literal(""),
    z.null(),
  ]).optional(),
  pdfUrl: optionalUrlOrPath,
  fieldMapping: z
    .object({
      templateVariant: z.enum(["example1", "example2"]).optional(),
      projectDisplayName: z.string().max(120).optional(),
      projectNameLine2: z.string().max(120).optional(),
      landArea: z.string().max(120).optional(),
      projectPhase: z.string().max(120).optional(),
      sanctionBy: z.string().max(120).optional(),
      planSanctionNo: z.string().max(200).optional(),
      reraWebsite: z.string().max(200).optional(),
      reraNumber: z.string().max(120).optional(),
      landSurveyDetails: z.string().max(1000).optional(),
      promoterName: z.string().max(200).optional(),
      promoterAddress: z.string().max(400).optional(),
      landOwnerNames: z.string().max(2000).optional(),
      landOwnerAddress: z.string().max(2000).optional(),
      collectionAccountName: z.string().max(300).optional(),
      payableAt: z.string().max(120).optional(),
      heroImageUrl: z.string().max(500).optional(),
      projectLogoUrl: z.string().max(500).optional(),
      secondaryLogoUrl: z.string().max(500).optional(),
      secondaryCompanyName: z.string().max(120).optional(),
      supportPhone: z.string().max(120).optional(),
      officeAddress: z.string().max(400).optional(),
      officeEmail: z.string().max(120).optional(),
      accentTeal: z.string().max(20).optional(),
      accentYellow: z.string().max(20).optional(),
      accentNavy: z.string().max(20).optional(),
      showCoverPhotos: z.boolean().optional(),
      showApplicationNo: z.boolean().optional(),
      showLandArea: z.boolean().optional(),
      showLandOwners: z.boolean().optional(),
      showConsentPage: z.boolean().optional(),
      kycChecklist: z.string().max(2000).optional(),
      agentDeclarationText: z.string().max(3000).optional(),
      groupDisplayName: z.string().max(200).optional(),
      jurisdiction: z.string().max(200).optional(),
      declarationText: z.string().max(8000).optional(),
      termsText: z.string().max(20000).optional(),
      consentTo: z.string().max(300).optional(),
      consentSubject: z.string().max(500).optional(),
      consentIntroText: z.string().max(2000).optional(),
      consentBodyText: z.string().max(5000).optional(),
      consentDeclarationBox: z.string().max(8000).optional(),
    })
    .passthrough()
    .optional()
    .nullable(),
});
