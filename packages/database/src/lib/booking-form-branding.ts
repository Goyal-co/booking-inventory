import { mergeTemplateContent, type BookingFormTemplateContent } from "@booking/validators";

/**
 * Resolve print/customer branding so every project template's fieldMapping
 * is fully merged (T&Cs, consent, accents, etc.) before rendering.
 */
export function resolveFormBranding(input: {
  projectName: string;
  unitNumber?: string | null;
  projectLogoUrl?: string | null;
  projectPrimaryColor?: string | null;
  template?: {
    logoUrl?: string | null;
    companyName?: string | null;
    tagline?: string | null;
    formTitle?: string | null;
    formSubtitle?: string | null;
    footerText?: string | null;
    supportEmail?: string | null;
    primaryColor?: string | null;
    fieldMapping?: unknown;
    version?: number | null;
  } | null;
  existingBranding?: Record<string, unknown> | null;
}) {
  const existing = input.existingBranding ?? null;
  const rawContent = (existing?.content ??
    input.template?.fieldMapping ??
    {}) as Partial<BookingFormTemplateContent>;
  const content = mergeTemplateContent(rawContent, input.projectName);

  return {
    logoUrl:
      (existing?.logoUrl as string | null | undefined) ??
      input.template?.logoUrl ??
      input.projectLogoUrl ??
      null,
    companyName:
      (existing?.companyName as string | undefined) ??
      input.template?.companyName ??
      "Goyal & Co.",
    tagline:
      (existing?.tagline as string | undefined) ??
      input.template?.tagline ??
      "creating landmarks since 1971",
    formTitle:
      (existing?.formTitle as string | undefined) ??
      input.template?.formTitle ??
      "APPLICATION FOR ALLOTMENT OF A RESIDENTIAL UNIT IN",
    formSubtitle:
      (existing?.formSubtitle as string | null | undefined) ??
      input.template?.formSubtitle ??
      null,
    footerText:
      (existing?.footerText as string | null | undefined) ??
      input.template?.footerText ??
      null,
    supportEmail:
      (existing?.supportEmail as string | null | undefined) ??
      input.template?.supportEmail ??
      content.officeEmail ??
      null,
    primaryColor:
      (existing?.primaryColor as string | null | undefined) ??
      input.template?.primaryColor ??
      input.projectPrimaryColor ??
      content.accentTeal,
    projectName: input.projectName,
    unitNumber: input.unitNumber ?? (existing?.unitNumber as string | undefined) ?? null,
    content,
    templateVersion:
      (existing?.templateVersion as number | null | undefined) ??
      input.template?.version ??
      null,
  };
}
