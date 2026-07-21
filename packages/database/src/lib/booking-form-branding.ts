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
  const existingContent = (existing?.content ?? {}) as Partial<BookingFormTemplateContent>;
  const templateContent = (input.template?.fieldMapping ?? {}) as Partial<BookingFormTemplateContent>;
  // The active project template is the shared source of truth for both the
  // customer form and printable render. Keep snapshot-only values as fallback,
  // but let the active template (including newly submitted logos) win.
  const rawContent = { ...existingContent, ...templateContent };
  const content = mergeTemplateContent(rawContent, input.projectName);

  return {
    logoUrl:
      input.template?.logoUrl ??
      (existing?.logoUrl as string | null | undefined) ??
      input.projectLogoUrl ??
      null,
    companyName:
      input.template?.companyName ??
      (existing?.companyName as string | undefined) ??
      "Goyal & Co.",
    tagline:
      input.template?.tagline ??
      (existing?.tagline as string | undefined) ??
      "creating landmarks since 1971",
    formTitle:
      input.template?.formTitle ??
      (existing?.formTitle as string | undefined) ??
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
      input.template?.primaryColor ??
      (existing?.primaryColor as string | null | undefined) ??
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
