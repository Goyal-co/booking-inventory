import {
  PrismaClient,
  UserRole,
  UnitStatus,
  FilterDimension,
  ProjectLifecycleStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function getOrCreateFloorPlan(
  projectId: string,
  data: {
    name: string;
    bhkType: string;
    carpetArea: number;
    superArea: number;
    amenities: string[];
  }
) {
  const existing = await prisma.floorPlanType.findFirst({
    where: { projectId, name: data.name },
  });
  if (existing) return existing;

  return prisma.floorPlanType.create({
    data: { ...data, projectId },
  });
}

async function getOrCreateCostSheet(
  projectId: string,
  floorPlanTypeId: string,
  data: {
    name: string;
    lineItems: Array<{ label: string; amount: number }>;
    totalPrice: number;
  }
) {
  const existing = await prisma.costSheetTemplate.findFirst({
    where: { projectId, name: data.name },
  });
  if (existing) return existing;

  return prisma.costSheetTemplate.create({
    data: { ...data, floorPlanTypeId, projectId },
  });
}

async function seedProjectInventory(
  projectId: string,
  towers: Array<{ name: string; code: string; sortOrder: number }>,
  floorsPerTower: number,
  unitsPerFloor: number
) {
  const plan2BHK = await getOrCreateFloorPlan(projectId, {
    name: "Classic 2BHK",
    bhkType: "2 BHK",
    carpetArea: 950,
    superArea: 1200,
    amenities: ["Balcony", "Cross Ventilation"],
  });

  const plan3BHK = await getOrCreateFloorPlan(projectId, {
    name: "Premium 3BHK",
    bhkType: "3 BHK",
    carpetArea: 1250,
    superArea: 1550,
    amenities: ["Corner Unit", "Garden Facing"],
  });

  const costSheet2BHK = await getOrCreateCostSheet(projectId, plan2BHK.id, {
    name: "2BHK Standard Pricing",
    lineItems: [
      { label: "Base Price", amount: 8500000 },
      { label: "Floor Rise", amount: 200000 },
      { label: "PLC", amount: 150000 },
      { label: "Parking", amount: 300000 },
      { label: "GST (5%)", amount: 457500 },
    ],
    totalPrice: 9607500,
  });

  const costSheet3BHK = await getOrCreateCostSheet(projectId, plan3BHK.id, {
    name: "3BHK Premium Pricing",
    lineItems: [
      { label: "Base Price", amount: 12000000 },
      { label: "Floor Rise", amount: 350000 },
      { label: "PLC", amount: 250000 },
      { label: "Parking", amount: 400000 },
      { label: "GST (5%)", amount: 650000 },
    ],
    totalPrice: 13650000,
  });

  let unitsCreated = 0;

  for (const towerData of towers) {
    const tower = await prisma.tower.upsert({
      where: { projectId_code: { projectId, code: towerData.code } },
      update: { name: towerData.name, sortOrder: towerData.sortOrder },
      create: { ...towerData, projectId },
    });

    for (let floorNum = 1; floorNum <= floorsPerTower; floorNum++) {
      const floor = await prisma.floor.upsert({
        where: { towerId_number: { towerId: tower.id, number: floorNum } },
        update: { label: `Floor ${floorNum}` },
        create: { number: floorNum, label: `Floor ${floorNum}`, towerId: tower.id },
      });

      for (let unitIdx = 1; unitIdx <= unitsPerFloor; unitIdx++) {
        const is3BHK = unitIdx > 2;
        const plan = is3BHK ? plan3BHK : plan2BHK;
        const costSheet = is3BHK ? costSheet3BHK : costSheet2BHK;
        const unitNumber = `${tower.code}-${floorNum}${String(unitIdx).padStart(2, "0")}`;

        const existing = await prisma.unit.findUnique({
          where: { floorId_unitNumber: { floorId: floor.id, unitNumber } },
        });

        if (!existing) {
          await prisma.unit.create({
            data: {
              unitNumber,
              status: UnitStatus.AVAILABLE,
              carpetArea: plan.carpetArea,
              bhkType: plan.bhkType,
              facing: unitIdx % 2 === 0 ? "East" : "West",
              basePrice: costSheet.totalPrice,
              floorId: floor.id,
              floorPlanTypeId: plan.id,
              costSheetTemplateId: costSheet.id,
            },
          });
          unitsCreated++;
        }
      }
    }
  }

  await prisma.filterConfig.createMany({
    data: [
      {
        projectId,
        dimension: FilterDimension.TOWER,
        label: "Tower",
        options: towers.map((t) => ({ value: t.code, label: t.name })),
        sortOrder: 1,
      },
      {
        projectId,
        dimension: FilterDimension.BHK,
        label: "Unit Type",
        options: [
          { value: "2 BHK", label: "2 BHK" },
          { value: "3 BHK", label: "3 BHK" },
        ],
        sortOrder: 2,
      },
      {
        projectId,
        dimension: FilterDimension.CARPET_AREA,
        label: "Carpet Area",
        options: [
          { value: "950", label: "950 sqft carpet" },
          { value: "1250", label: "1250 sqft carpet" },
        ],
        sortOrder: 3,
      },
      {
        projectId,
        dimension: FilterDimension.SUPER_BUILT_UP,
        label: "Super Built-up Area",
        options: [
          { value: "1200", label: "1200 sqft super built-up" },
          { value: "1550", label: "1550 sqft super built-up" },
        ],
        sortOrder: 4,
      },
      {
        projectId,
        dimension: FilterDimension.STATUS,
        label: "Status",
        options: [
          { value: "AVAILABLE", label: "Available" },
          { value: "BLOCKED", label: "Blocked" },
          { value: "BOOKED", label: "Booked" },
        ],
        sortOrder: 5,
      },
    ],
    skipDuplicates: true,
  });

  return unitsCreated;
}

async function main() {
  if (process.env.SEED_DEMO !== "true") {
    console.log(
      "Demo seed skipped. For local dev demo data: SEED_DEMO=true pnpm db:seed\n" +
        "For production first deploy: set SUPER_ADMIN_* env vars and run pnpm db:bootstrap"
    );
    return;
  }

  const org = await prisma.organization.upsert({
    where: { slug: "demo-realty" },
    update: { name: "Goyal Hariyana Sales" },
    create: {
      name: "Goyal Hariyana Sales",
      slug: "demo-realty",
    },
  });

  const passwordHash = await bcrypt.hash("password123", 12);

  const superAdmin = await prisma.user.upsert({
    where: { email: "admin@demo.com" },
    update: { passwordHash, name: "Admin User", employeeId: "GH-1001" },
    create: {
      email: "admin@demo.com",
      name: "Admin User",
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      organizationId: org.id,
      employeeId: "GH-1001",
      joiningDate: new Date("2024-06-18"),
    },
  });

  const salesUser = await prisma.user.upsert({
    where: { email: "rahul@demo.com" },
    update: { passwordHash, name: "Pratham S", employeeId: "GH-1023", mobile: "+91 98765 43210" },
    create: {
      email: "rahul@demo.com",
      name: "Pratham S",
      passwordHash,
      role: UserRole.SALES_EXEC,
      organizationId: org.id,
      employeeId: "GH-1023",
      mobile: "+91 98765 43210",
      joiningDate: new Date("2026-01-02"),
      notificationPrefs: {
        bookingApproved: true,
        unitRelease: true,
        dailySummary: true,
        bookingRejected: true,
        systemAnnouncements: true,
      },
    },
  });

  const salesUser2 = await prisma.user.upsert({
    where: { email: "priya@demo.com" },
    update: { passwordHash },
    create: {
      email: "priya@demo.com",
      name: "Priya Patel",
      passwordHash,
      role: UserRole.SALES_EXEC,
      organizationId: org.id,
    },
  });

  const projectAdmin = await prisma.user.upsert({
    where: { email: "projectadmin@demo.com" },
    update: { passwordHash },
    create: {
      email: "projectadmin@demo.com",
      name: "Skyline Project Admin",
      passwordHash,
      role: UserRole.PROJECT_ADMIN,
      organizationId: org.id,
    },
  });

  const futureLaunch = new Date();
  futureLaunch.setDate(futureLaunch.getDate() + 14);

  const skyline = await prisma.project.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: "skyline-heights" } },
    update: {
      isPublished: true,
      lifecycleStatus: ProjectLifecycleStatus.LAUNCH_DAY,
      blockDurationMs: 900_000,
      launchDate: new Date(),
      requiresBookingApproval: true,
    },
    create: {
      name: "Skyline Heights",
      slug: "skyline-heights",
      description: "Premium residential launch",
      launchDate: new Date(),
      lifecycleStatus: ProjectLifecycleStatus.LAUNCH_DAY,
      blockDurationMs: 900_000,
      maxBlocksPerUser: 3,
      primaryColor: "#2563EB",
      isPublished: true,
      requiresBookingApproval: true,
      organizationId: org.id,
    },
  });

  const greenValley = await prisma.project.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: "green-valley" } },
    update: {
      isPublished: true,
      lifecycleStatus: ProjectLifecycleStatus.UPCOMING,
      launchDate: futureLaunch,
    },
    create: {
      name: "Green Valley",
      slug: "green-valley",
      description: "Upcoming township launch",
      launchDate: futureLaunch,
      lifecycleStatus: ProjectLifecycleStatus.UPCOMING,
      blockDurationMs: 900_000,
      maxBlocksPerUser: 3,
      primaryColor: "#059669",
      isPublished: true,
      organizationId: org.id,
    },
  });

  const metroResidences = await prisma.project.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: "metro-residences" } },
    update: {
      isPublished: true,
      lifecycleStatus: ProjectLifecycleStatus.ONGOING,
      blockDurationMs: 259_200_000,
      ongoingBlockDurationDays: 3,
    },
    create: {
      name: "Metro Residences",
      slug: "metro-residences",
      description: "Ongoing sales with extended blocks",
      launchDate: new Date(Date.now() - 30 * 86_400_000),
      lifecycleStatus: ProjectLifecycleStatus.ONGOING,
      blockDurationMs: 259_200_000,
      ongoingBlockDurationDays: 3,
      maxBlocksPerUser: 3,
      primaryColor: "#7C3AED",
      isPublished: true,
      organizationId: org.id,
    },
  });

  const allProjects = [skyline, greenValley, metroResidences];

  await prisma.userProjectAccess.createMany({
    data: [
      ...allProjects.map((p) => ({ userId: superAdmin.id, projectId: p.id })),
      { userId: projectAdmin.id, projectId: skyline.id },
      { userId: salesUser.id, projectId: skyline.id },
      { userId: salesUser.id, projectId: greenValley.id },
      { userId: salesUser.id, projectId: metroResidences.id },
      { userId: salesUser2.id, projectId: skyline.id },
      { userId: salesUser2.id, projectId: metroResidences.id },
    ],
    skipDuplicates: true,
  });

  const skylineUnits = await seedProjectInventory(
    skyline.id,
    [
      { name: "Tower A", code: "A", sortOrder: 1 },
      { name: "Tower B", code: "B", sortOrder: 2 },
    ],
    5,
    4
  );

  const greenValleyUnits = await seedProjectInventory(
    greenValley.id,
    [{ name: "Tower 1", code: "1", sortOrder: 1 }],
    3,
    4
  );

  const metroUnits = await seedProjectInventory(
    metroResidences.id,
    [{ name: "Block A", code: "A", sortOrder: 1 }],
    3,
    4
  );

  const totalUnits = await prisma.unit.count({
    where: { floor: { tower: { projectId: { in: allProjects.map((p) => p.id) } } } },
  });

  const { NotificationType } = await import("@prisma/client");
  await prisma.notification.deleteMany({ where: { userId: salesUser.id } });
  await prisma.notification.createMany({
    data: [
      {
        userId: salesUser.id,
        type: NotificationType.ANNOUNCEMENT,
        title: "New pricing for Orchid South Park",
        message:
          "From: Vice President Sales — New pricing effective from 1 July 2026. Please stop sharing old cost sheets.",
      },
      {
        userId: salesUser.id,
        type: NotificationType.BOOKING_APPROVED,
        title: "Booking approved — A-1-01",
        message: "Your booking for Pratham has been approved.",
      },
      {
        userId: salesUser.id,
        type: NotificationType.BOOKING_REJECTED,
        title: "Booking rejected — A-2-03",
        message: "Reason: Cheque image missing.",
      },
      {
        userId: salesUser.id,
        type: NotificationType.UNIT_RELEASED,
        title: "Unit A-3-06 available",
        message: "Unit A-3-06 is available again.",
      },
      {
        userId: salesUser.id,
        type: NotificationType.ADMIN_MESSAGE,
        title: "Monthly review meeting",
        message: "Monthly review meeting tomorrow at 11:00 AM. Attendance mandatory.",
      },
    ],
  });

  console.log("Seed completed successfully:");
  console.log("  Admin: admin@demo.com / password123");
  console.log("  Sales: rahul@demo.com / password123 (3 projects)");
  console.log("  Sales: priya@demo.com / password123 (2 projects)");
  console.log(`  Projects: Skyline Heights (LAUNCH_DAY), Green Valley (UPCOMING), Metro Residences (ONGOING)`);
  console.log(`  Total units: ${totalUnits} (${skylineUnits + greenValleyUnits + metroUnits} newly created)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
