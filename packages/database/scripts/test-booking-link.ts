import {
  attachCustomerToBlock,
  createBlock,
  getDigitalFormByToken,
  prisma,
} from "../src/index";
import { getCustomerBookingUrl } from "../src/lib/production-env";

async function main() {
  process.env.CUSTOMER_URL = process.env.CUSTOMER_URL || "http://localhost:3003";

  const sales = await prisma.user.findFirst({
    where: { role: { in: ["SALES_EXEC", "SALES_MANAGER"] }, isActive: true },
    select: { id: true, organizationId: true, name: true },
  });
  if (!sales) throw new Error("No sales user");

  let block = await prisma.block.findFirst({
    where: { userId: sales.id, expiresAt: { gt: new Date() } },
    select: { id: true, bookingToken: true },
  });

  if (!block) {
    const unit = await prisma.unit.findFirst({
      where: {
        status: "AVAILABLE",
        floor: { tower: { project: { userAccess: { some: { userId: sales.id } } } } },
      },
      select: { id: true },
    });
    if (!unit) throw new Error("No available unit for sales user");
    const created = await createBlock(unit.id, sales.id);
    block = { id: created.block.id, bookingToken: null };
    console.log("Created block", block.id);
  }

  console.log("Using block", block.id, "token", block.bookingToken?.slice(0, 8));

  const result = await attachCustomerToBlock({
    blockId: block.id,
    userId: sales.id,
    organizationId: sales.organizationId,
    customerName: "Test Customer",
    customerEmail: "test.customer@example.com",
    customerPhone: "9876543210",
  });

  const url = getCustomerBookingUrl(result.bookingToken);
  console.log("customerUrl", url);

  const form = await getDigitalFormByToken(result.bookingToken);
  console.log("getDigitalFormByToken", form ? "OK" : "NULL", form?.block?.id);

  // Also test lookup by block.bookingToken directly
  const blockRow = await prisma.block.findUnique({
    where: { bookingToken: result.bookingToken },
    include: { digitalForm: true },
  });
  console.log("block.digitalForm", blockRow?.digitalForm?.id ?? "missing");
}

main()
  .catch((e) => {
    console.error("FAILED", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
