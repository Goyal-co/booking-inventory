import { FilterDimension, prisma } from "../index";

export type ProjectFilterOption = { value: string; label: string };

export type ProjectFilterConfig = {
  dimension: FilterDimension;
  label: string;
  options: ProjectFilterOption[];
};

const STATUS_OPTIONS: ProjectFilterOption[] = [
  { value: "AVAILABLE", label: "Available" },
  { value: "BLOCKED", label: "Blocked" },
  { value: "BOOKED", label: "Booked" },
  { value: "SOLD", label: "Sold" },
  { value: "HOLD", label: "Hold" },
];

function uniqueOptions(options: ProjectFilterOption[]): ProjectFilterOption[] {
  const seen = new Set<string>();
  return options.filter((o) => {
    if (!o.value || seen.has(o.value)) return false;
    seen.add(o.value);
    return true;
  });
}

async function buildDefaultFilters(projectId: string): Promise<ProjectFilterConfig[]> {
  const [towers, floorPlans, facings, floors, bhkTypes] = await Promise.all([
    prisma.tower.findMany({
      where: { projectId },
      orderBy: { sortOrder: "asc" },
      select: { code: true, name: true },
    }),
    prisma.floorPlanType.findMany({
      where: { projectId },
      orderBy: { name: "asc" },
      select: { carpetArea: true, superArea: true, bhkType: true, name: true },
    }),
    prisma.unit.findMany({
      where: { floor: { tower: { projectId } }, facing: { not: null } },
      select: { facing: true },
      distinct: ["facing"],
    }),
    prisma.floor.findMany({
      where: { tower: { projectId } },
      select: { number: true },
      distinct: ["number"],
      orderBy: { number: "asc" },
    }),
    prisma.unit.findMany({
      where: { floor: { tower: { projectId } }, bhkType: { not: null } },
      select: { bhkType: true },
      distinct: ["bhkType"],
    }),
  ]);

  const carpetAreas = uniqueOptions(
    floorPlans
      .filter((p) => p.carpetArea != null)
      .map((p) => ({
        value: String(p.carpetArea),
        label: `${p.carpetArea} sqft carpet${p.name ? ` · ${p.name}` : ""}`,
      }))
  );

  const superAreas = uniqueOptions(
    floorPlans
      .filter((p) => p.superArea != null)
      .map((p) => ({
        value: String(p.superArea),
        label: `${p.superArea} sqft super built-up${p.name ? ` · ${p.name}` : ""}`,
      }))
  );

  const bhkFromPlans = floorPlans
    .filter((p) => p.bhkType)
    .map((p) => ({ value: p.bhkType, label: p.bhkType }));

  const bhkOptions = uniqueOptions([
    ...bhkFromPlans,
    ...bhkTypes.map((u) => ({ value: u.bhkType!, label: u.bhkType! })),
  ]);

  const defaults: ProjectFilterConfig[] = [];

  if (towers.length > 0) {
    defaults.push({
      dimension: FilterDimension.TOWER,
      label: "Tower",
      options: towers.map((t) => ({ value: t.code, label: t.name })),
    });
  }

  if (bhkOptions.length > 0) {
    defaults.push({
      dimension: FilterDimension.BHK,
      label: "Unit Type",
      options: bhkOptions,
    });
  }

  if (carpetAreas.length > 0) {
    defaults.push({
      dimension: FilterDimension.CARPET_AREA,
      label: "Carpet Area",
      options: carpetAreas,
    });
  }

  if (superAreas.length > 0) {
    defaults.push({
      dimension: FilterDimension.SUPER_BUILT_UP,
      label: "Super Built-up Area",
      options: superAreas,
    });
  }

  defaults.push({
    dimension: FilterDimension.STATUS,
    label: "Status",
    options: STATUS_OPTIONS,
  });

  if (floors.length > 0) {
    defaults.push({
      dimension: FilterDimension.FLOOR,
      label: "Floor",
      options: floors.map((f) => ({
        value: String(f.number),
        label: `Floor ${f.number}`,
      })),
    });
  }

  const facingOptions = uniqueOptions(
    facings
      .filter((f) => f.facing)
      .map((f) => ({ value: f.facing!, label: f.facing! }))
  );
  if (facingOptions.length > 0) {
    defaults.push({
      dimension: FilterDimension.FACING,
      label: "Facing",
      options: facingOptions,
    });
  }

  return defaults;
}

/** DB configs override defaults per dimension; missing dimensions use auto-generated options. */
export async function getProjectFilters(projectId: string): Promise<ProjectFilterConfig[]> {
  const [stored, defaults] = await Promise.all([
    prisma.filterConfig.findMany({
      where: { projectId, isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    buildDefaultFilters(projectId),
  ]);

  const byDimension = new Map<FilterDimension, ProjectFilterConfig>();

  for (const d of defaults) {
    byDimension.set(d.dimension, d);
  }

  for (const row of stored) {
    const options = row.options as ProjectFilterOption[];
    if (options.length > 0) {
      byDimension.set(row.dimension, {
        dimension: row.dimension,
        label: row.label,
        options,
      });
    }
  }

  const order: FilterDimension[] = [
    FilterDimension.TOWER,
    FilterDimension.BHK,
    FilterDimension.CARPET_AREA,
    FilterDimension.SUPER_BUILT_UP,
    FilterDimension.STATUS,
    FilterDimension.FLOOR,
    FilterDimension.FACING,
    FilterDimension.PRICE_BAND,
    FilterDimension.CUSTOM_TAG,
  ];

  const ordered: ProjectFilterConfig[] = [];
  for (const dim of order) {
    const config = byDimension.get(dim);
    if (config && config.options.length > 0) ordered.push(config);
  }

  for (const [dim, config] of byDimension) {
    if (!order.includes(dim) && config.options.length > 0) ordered.push(config);
  }

  return ordered;
}
