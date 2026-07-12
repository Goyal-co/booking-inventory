import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  prisma,
  searchLeads,
  registerWalkInLead,
  assignLeadToSales,
} from "@booking/database";
import { walkInLeadSchema, leadAssignSchema } from "@booking/validators";

async function getReceptionUser() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "RECEPTION") return null;
  return session.user;
}

export async function GET_leadsSearch(req: NextRequest) {
  const user = await getReceptionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const leads = await searchLeads(user.organizationId, q);

  const { getTitanCRMProvider } = await import("@booking/integrations");
  let titanResult = null;
  if (q.trim()) {
    try {
      titanResult = await getTitanCRMProvider().searchLead({
        leadId: q.startsWith("TITAN") ? q : undefined,
        phone: /^\d+$/.test(q) ? q : undefined,
      });
    } catch {
      /* optional */
    }
  }

  return NextResponse.json({ leads, titanResult });
}

export async function POST_walkInLead(req: NextRequest) {
  const user = await getReceptionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const parsed = walkInLeadSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const lead = await registerWalkInLead({
    organizationId: user.organizationId,
    registeredById: user.id,
    ...parsed.data,
  });
  return NextResponse.json({ lead }, { status: 201 });
}

export async function POST_assignLead(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getReceptionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const parsed = leadAssignSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const lead = await assignLeadToSales(id, parsed.data.salesUserId, parsed.data.notes);
  return NextResponse.json({ lead });
}

export async function GET_availableSalespersons() {
  const user = await getReceptionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sales = await prisma.user.findMany({
    where: {
      organizationId: user.organizationId,
      isActive: true,
      role: { in: ["SALES_EXEC", "SALES_MANAGER"] },
    },
    select: { id: true, name: true, email: true, role: true },
  });
  return NextResponse.json({ sales });
}

export async function GET_visitsToday() {
  const user = await getReceptionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const visits = await prisma.siteVisit.findMany({
    where: { checkedInAt: { gte: start } },
    include: {
      lead: { select: { leadId: true, customerName: true, customerPhone: true } },
      salesUser: { select: { name: true } },
    },
    orderBy: { checkedInAt: "desc" },
  });
  return NextResponse.json({ visits });
}
