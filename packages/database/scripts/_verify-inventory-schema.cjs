const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function assertColumns(table, required) {
  const cols = await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    table
  );
  const names = new Set(cols.map((c) => c.column_name));
  const missing = required.filter((c) => !names.has(c));
  if (missing.length) {
    throw new Error(`${table} missing columns: ${missing.join(", ")}`);
  }
  return [...names].sort();
}

async function main() {
  await assertColumns("Unit", ["superArea", "carpetArea", "status", "bhkType", "unitNumber"]);
  await assertColumns("FloorPlanType", ["superArea", "carpetArea"]);

  // Mirrors inventory-structure / units API selects that previously 500'd
  await prisma.unit.findMany({
    take: 5,
    select: {
      id: true,
      unitNumber: true,
      carpetArea: true,
      superArea: true,
      status: true,
      bhkType: true,
      facing: true,
      basePrice: true,
      priceOverride: true,
      floorPlanTypeId: true,
      floor: {
        select: {
          id: true,
          number: true,
          label: true,
          tower: { select: { id: true, name: true, code: true, projectId: true } },
        },
      },
      floorPlanType: {
        select: { id: true, name: true, bhkType: true, superArea: true, carpetArea: true },
      },
    },
  });

  console.log("OK: Unit.superArea present");
  console.log("OK: FloorPlanType.superArea present");
  console.log("OK: inventory-style Prisma selects succeed");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("VERIFY FAIL:", e.message || e);
    await prisma.$disconnect();
    process.exit(1);
  });
