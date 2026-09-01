import { prisma } from "../src/index";
import { calculateCostSheet } from "../src/services/cost-sheet-engine";
import { resolveUnitPricingMaster } from "../src/services/cost-excel-live";

async function main() {
  const mappings = await prisma.projectCostExcelMapping.findMany({
    include: { project: { select: { id: true, name: true } } },
  });

  console.log("Excel mappings:", mappings.length);
  for (const m of mappings) {
    console.log(`\nProject: ${m.project.name} (${m.projectId})`);
    console.log(`  Mode: ${m.pricingMode}, Sheet: ${m.sheetName}, URL: ${m.excelSourceUrl?.slice(0, 60)}...`);

    const masterCount = await prisma.unitMasterRow.count({ where: { projectId: m.projectId } });
    console.log(`  UnitMasterRows: ${masterCount}`);

    const units = await prisma.unit.findMany({
      where: { floor: { tower: { projectId: m.projectId } } },
      take: 5,
      select: {
        id: true,
        unitNumber: true,
        floor: { select: { tower: { select: { name: true } } } },
      },
      orderBy: { unitNumber: "asc" },
    });

    for (const u of units.slice(0, 3)) {
      const tower = u.floor.tower.name;
      const master = await resolveUnitPricingMaster(m.projectId, tower, u.unitNumber);
      const ctxPrice = master?.baseRatePerSqft ?? 0;
      const sheet = ctxPrice > 0 ? await calculateCostSheet(u.id, Number(ctxPrice)) : null;
      console.log(`  Unit ${tower}/${u.unitNumber}: master=${master ? master.source : "none"} baseRate=${master?.baseRatePerSqft ?? "—"} gross=${sheet?.grossApartmentValue ?? "—"} pricing=${sheet?.pricingSource ?? "—"}`);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
