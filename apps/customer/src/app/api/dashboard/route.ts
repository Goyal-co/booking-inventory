import { NextResponse } from "next/server";
import { prisma } from "@booking/database";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  const block = await prisma.block.findFirst({
    where: { bookingToken: token },
    select: { customerId: true },
  });
  if (!block?.customerId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const customer = await prisma.customer.findUnique({
    where: { id: block.customerId },
    include: {
      bookings: {
        include: {
          unit: { include: { floor: { include: { tower: { include: { project: true } } } } } },
          payments: { orderBy: { dueDate: "asc" } },
          digitalForm: { select: { status: true, submittedAt: true } },
        },
      },
    },
  });

  const projectIds = customer?.bookings.map((b) => b.unit.floor.tower.projectId) ?? [];
  const constructionReports = await prisma.constructionReport.findMany({
    where: { projectId: { in: projectIds } },
    orderBy: { publishedAt: "desc" },
    take: 10,
  });

  return NextResponse.json({ customer, constructionReports });
}
