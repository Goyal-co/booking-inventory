import { prisma, UnitStatus, Prisma, BookingStatus } from "../index";

export interface UnitWithRelations {
  id: string;
  unitNumber: string;
  status: UnitStatus;
  carpetArea: number | null;
  bhkType: string | null;
  facing: string | null;
  basePrice: Prisma.Decimal | null;
  priceOverride: Prisma.Decimal | null;
  customTags: string[];
  floor: {
    number: number;
    tower: { id: string; name: string; code: string };
  };
  floorPlanType: {
    id: string;
    name: string;
    imageUrl: string | null;
    pdfUrl: string | null;
    amenities: string[];
    superArea: number | null;
    carpetArea: number;
  } | null;
  costSheetTemplate: {
    id: string;
    name: string;
    lineItems: unknown;
    totalPrice: Prisma.Decimal;
  } | null;
  blocks: Array<{
    id: string;
    userId: string;
    expiresAt: Date;
    user: { id: string; name: string };
  }>;
  bookings: Array<{ id: string; status: string }>;
}

const unitInclude = {
  floor: { include: { tower: true } },
  floorPlanType: true,
  costSheetTemplate: true,
  blocks: {
    where: { expiresAt: { gt: new Date() } },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" as const },
    take: 1,
  },
  bookings: {
    where: { status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] } },
    select: { id: true, status: true },
    take: 1,
  },
};

export function serializeUnit(unit: UnitWithRelations, hideHold = true) {
  const activeBlock = unit.blocks[0];
  const activeBooking = unit.bookings[0];
  const pendingApproval = activeBooking?.status === BookingStatus.PENDING;
  const price = unit.priceOverride ?? unit.costSheetTemplate?.totalPrice ?? unit.basePrice;

  return {
    id: unit.id,
    unitNumber: unit.unitNumber,
    towerName: unit.floor.tower.name,
    towerCode: unit.floor.tower.code,
    towerId: unit.floor.tower.id,
    floorNumber: unit.floor.number,
    carpetArea: unit.carpetArea,
    superArea: unit.floorPlanType?.superArea ?? null,
    bhkType: unit.bhkType,
    facing: unit.facing,
    price: price ? Number(price) : null,
    status: unit.status,
    pendingApproval,
    customTags: unit.customTags,
    block: activeBlock
      ? {
          id: activeBlock.id,
          userId: activeBlock.userId,
          userName: activeBlock.user.name,
          expiresAt: activeBlock.expiresAt.toISOString(),
        }
      : null,
    floorPlanImageUrl: unit.floorPlanType?.imageUrl,
    floorPlan: unit.floorPlanType
      ? {
          id: unit.floorPlanType.id,
          name: unit.floorPlanType.name,
          imageUrl: unit.floorPlanType.imageUrl,
          pdfUrl: unit.floorPlanType.pdfUrl,
          amenities: unit.floorPlanType.amenities,
          bhkType: unit.bhkType,
          carpetArea: unit.carpetArea,
        }
      : null,
    costSheet: unit.costSheetTemplate
      ? {
          name: unit.costSheetTemplate.name,
          lineItems: unit.costSheetTemplate.lineItems as Array<{ label: string; amount: number }>,
          totalPrice: Number(unit.costSheetTemplate.totalPrice),
        }
      : null,
  };
}

export async function getUnits(filters: {
  projectId: string;
  search?: string;
  tower?: string;
  bhk?: string;
  status?: UnitStatus;
  floor?: string;
  facing?: string;
  priceBand?: string;
  customTag?: string;
  carpetArea?: string;
  superArea?: string;
  hideHold?: boolean;
}) {
  const where: Prisma.UnitWhereInput = {
    floor: {
      tower: {
        projectId: filters.projectId,
        ...(filters.tower ? { code: filters.tower } : {}),
      },
      ...(filters.floor ? { number: parseInt(filters.floor, 10) } : {}),
    },
    ...(filters.bhk ? { bhkType: filters.bhk } : {}),
    ...(filters.facing ? { facing: filters.facing } : {}),
    ...(filters.customTag ? { customTags: { has: filters.customTag } } : {}),
    ...(filters.status
      ? { status: filters.status }
      : filters.hideHold !== false
        ? { status: { not: UnitStatus.HOLD } }
        : {}),
  };

  if (filters.search) {
    where.OR = [
      { unitNumber: { contains: filters.search, mode: "insensitive" } },
      { bhkType: { contains: filters.search, mode: "insensitive" } },
      { floor: { tower: { name: { contains: filters.search, mode: "insensitive" } } } },
    ];
  }

  if (filters.priceBand) {
    const [minStr, maxStr] = filters.priceBand.split("-");
    const min = Number(minStr);
    const max = maxStr ? Number(maxStr) : undefined;
    if (!Number.isNaN(min)) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          OR: [
            {
              priceOverride: {
                ...(max !== undefined && !Number.isNaN(max) ? { gte: min, lte: max } : { gte: min }),
              },
            },
            {
              priceOverride: null,
              basePrice: {
                ...(max !== undefined && !Number.isNaN(max) ? { gte: min, lte: max } : { gte: min }),
              },
            },
          ],
        },
      ];
    }
  }

  if (filters.carpetArea) {
    const area = parseInt(filters.carpetArea, 10);
    if (!Number.isNaN(area)) {
      where.carpetArea = area;
    }
  }

  if (filters.superArea) {
    const area = parseInt(filters.superArea, 10);
    if (!Number.isNaN(area)) {
      where.floorPlanType = { superArea: area };
    }
  }

  const units = await prisma.unit.findMany({
    where,
    include: unitInclude,
    orderBy: [{ floor: { tower: { sortOrder: "asc" } } }, { floor: { number: "asc" } }, { unitNumber: "asc" }],
  });

  return units.map((u) => serializeUnit(u as UnitWithRelations, filters.hideHold));
}

export async function getUnitById(unitId: string) {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: unitInclude,
  });
  if (!unit) return null;
  return serializeUnit(unit as UnitWithRelations, false);
}

export async function getProjectIdFromUnit(unitId: string) {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    select: { floor: { select: { tower: { select: { projectId: true } } } } },
  });
  return unit?.floor.tower.projectId ?? null;
}
