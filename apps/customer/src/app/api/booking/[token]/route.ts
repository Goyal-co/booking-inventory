import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getDigitalFormByToken, saveDigitalFormStep, prisma } from "@booking/database";
import { digitalFormStepSchema, mergeTemplateContent } from "@booking/validators";
import type { BookingFormTemplateContent } from "@booking/validators";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const form = await getDigitalFormByToken(token);
  if (!form?.block) {
    return NextResponse.json({ error: "Invalid or expired booking link" }, { status: 404 });
  }

  const block = form.block;
  const project = block.unit.floor.tower.project;
  const template = await prisma.bookingFormTemplate.findFirst({
    where: { projectId: project.id, isActive: true },
    orderBy: { version: "desc" },
  });
  const mapping =
    template?.fieldMapping && typeof template.fieldMapping === "object"
      ? (template.fieldMapping as Partial<BookingFormTemplateContent>)
      : {};
  const content = mergeTemplateContent(mapping, project.name);

  return NextResponse.json({
    status: form.status,
    page1Snapshot: form.page1Snapshot,
    formData: form.formData,
    projectName: project.name,
    unitNumber: block.unit.unitNumber,
    documents: form.documents,
    branding: {
      logoUrl: template?.logoUrl ?? project.logoUrl ?? null,
      companyName: template?.companyName ?? "Goyal & Co.",
      tagline: template?.tagline ?? "creating landmarks since 1971",
      formTitle:
        template?.formTitle ?? "APPLICATION FOR ALLOTMENT OF A RESIDENTIAL UNIT IN",
      formSubtitle: template?.formSubtitle ?? null,
      footerText: template?.footerText ?? null,
      supportEmail: template?.supportEmail ?? content.officeEmail,
      primaryColor: template?.primaryColor ?? content.accentTeal,
      projectName: project.name,
      unitNumber: block.unit.unitNumber,
      content,
    },
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await req.json();
  const parsed = digitalFormStepSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const form = await saveDigitalFormStep(token, parsed.data.step, parsed.data.data);
  if (!form) return NextResponse.json({ error: "Cannot update form" }, { status: 400 });
  return NextResponse.json({ ok: true, formData: form.formData });
}
