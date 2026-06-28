import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "../index";

export async function getUserProfile(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      mobile: true,
      employeeId: true,
      joiningDate: true,
      notificationPrefs: true,
      lastLoginAt: true,
      createdAt: true,
      projectAccess: {
        include: { project: { select: { id: true, name: true } } },
      },
    },
  });
}

export async function updateUserProfile(
  userId: string,
  data: {
    name?: string;
    mobile?: string;
    notificationPrefs?: Prisma.InputJsonValue;
  }
) {
  return prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      mobile: true,
      employeeId: true,
      notificationPrefs: true,
    },
  });
}

export async function changeUserPassword(
  userId: string,
  currentPassword: string,
  newPassword: string
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw new Error("Current password is incorrect");

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });
}
