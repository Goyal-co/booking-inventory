import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { prisma } from "../src/index";
import {
  extractProjectExcelFromBuffer,
  syncProjectExcelFromBuffer,
} from "../src/services/cost-excel-sync";

const EXCEL_PATH = resolve(__dirname, "../../../Riviera Uno.xlsx");
const PROJECT_NAME_HINT = /riviera|uno/i;

async function main() {
  const projects = await prisma.project.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  console.log("Projects:", projects.map((p) => `${p.name} (${p.id})`).join(", "));

  let project =
    projects.find((p) => PROJECT_NAME_HINT.test(p.name)) ?? projects[0];

  if (!project) {
    throw new Error("No project found in database");
  }

  console.log(`Using project: ${project.name} (${project.id})`);
  console.log(`Reading: ${EXCEL_PATH}`);

  const buffer = readFileSync(EXCEL_PATH);

  const extract = await extractProjectExcelFromBuffer({
    projectId: project.id,
    buffer,
    fileName: "Riviera Uno.xlsx",
  });

  console.log("\n--- Extract preview ---");
  console.log(`Sheet: ${extract.sheetName}, header row: ${extract.headerRowIndex}`);
  console.log(`Rows parsed: ${extract.preview?.rowCount ?? 0}`);
  console.log(`Mapping required: ${extract.mappingRequired ?? false}`);
  console.log(`Columns mapped: ${extract.columnMapping?.mappedCount ?? 0}`);
  if (extract.warnings?.length) {
    console.log("Warnings:", extract.warnings.join("; "));
  }

  if (extract.mappingRequired) {
    console.error("\nCannot sync — map Wing + Villa No columns first.");
    console.log("Column map:", JSON.stringify(extract.columnMapping?.columnMap, null, 2));
    process.exit(1);
  }

  console.log("\n--- Syncing inventory + pricing ---");
  const sync = await syncProjectExcelFromBuffer({
    projectId: project.id,
    buffer,
    fileName: "Riviera Uno.xlsx",
    replaceInventory: true,
    headerRowIndex: extract.headerRowIndex,
    columnMapOverride: extract.columnMapping?.columnMap,
  });

  console.log("\n--- Sync result ---");
  console.log(`Imported pricing rows: ${sync.imported}`);
  console.log(`Skipped: ${sync.skipped}`);
  if (sync.inventory) {
    console.log(
      `Inventory: deleted ${sync.inventory.deletedUnits} units / ${sync.inventory.deletedTowers} towers`
    );
    console.log(
      `Created ${sync.inventory.createdUnits} units in ${sync.inventory.towersCreated} towers`
    );
    console.log(`Master rows linked: ${sync.inventory.masterRowsLinked}`);
  }
  if (sync.errors?.length) {
    console.log(`Errors (first 5):`, sync.errors.slice(0, 5));
  }
  if (sync.warnings?.length) {
    console.log(`Warnings (first 5):`, sync.warnings.slice(0, 5));
  }

  const unitCount = await prisma.unit.count({
    where: { floor: { tower: { projectId: project.id } } },
  });
  const masterCount = await prisma.unitMasterRow.count({
    where: { projectId: project.id },
  });
  console.log(`\nFinal: ${unitCount} inventory units, ${masterCount} master rows`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
