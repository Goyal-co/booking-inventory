import { createHash, randomInt } from "crypto";

export type CustomerOtpPurpose = "SITE_VISIT" | "DIRECT_BOOKING" | "BOOKING_FORM";

type OtpEntry = { hash: string; expiresAt: number };
type VerifiedEntry = { expiresAt: number };

const globalOtp = globalThis as typeof globalThis & {
  bookingCustomerOtpStore?: Map<string, OtpEntry>;
  bookingCustomerOtpVerified?: Map<string, VerifiedEntry>;
};

const otpStore = globalOtp.bookingCustomerOtpStore ?? new Map<string, OtpEntry>();
const verifiedStore = globalOtp.bookingCustomerOtpVerified ?? new Map<string, VerifiedEntry>();
globalOtp.bookingCustomerOtpStore = otpStore;
globalOtp.bookingCustomerOtpVerified = verifiedStore;

const OTP_TTL_MS = 10 * 60 * 1000;
const VERIFIED_TTL_MS = 15 * 60 * 1000;

function keyFor(purpose: CustomerOtpPurpose, subjectId: string) {
  return `${purpose}:${subjectId}`;
}

function hashOtp(key: string, otp: string) {
  return createHash("sha256").update(`${key}:${otp}`).digest("hex");
}

function pruneVerified(key: string) {
  const entry = verifiedStore.get(key);
  if (entry && Date.now() > entry.expiresAt) {
    verifiedStore.delete(key);
  }
}

/** Generate a 6-digit OTP for a subject (lead id, booking token, etc.). */
export function generateCustomerOtp(purpose: CustomerOtpPurpose, subjectId: string) {
  const key = keyFor(purpose, subjectId);
  const otp = String(randomInt(100000, 999999));
  otpStore.set(key, {
    hash: hashOtp(key, otp),
    expiresAt: Date.now() + OTP_TTL_MS,
  });
  verifiedStore.delete(key);
  return otp;
}

export function verifyCustomerOtp(purpose: CustomerOtpPurpose, subjectId: string, otp: string) {
  const key = keyFor(purpose, subjectId);
  const entry = otpStore.get(key);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(key);
    return false;
  }
  const valid = entry.hash === hashOtp(key, String(otp).trim());
  if (valid) {
    otpStore.delete(key);
    verifiedStore.set(key, { expiresAt: Date.now() + VERIFIED_TTL_MS });
  }
  return valid;
}

export function markCustomerOtpVerified(purpose: CustomerOtpPurpose, subjectId: string) {
  verifiedStore.set(keyFor(purpose, subjectId), {
    expiresAt: Date.now() + VERIFIED_TTL_MS,
  });
}

export function isCustomerOtpVerified(purpose: CustomerOtpPurpose, subjectId: string) {
  const key = keyFor(purpose, subjectId);
  pruneVerified(key);
  return verifiedStore.has(key);
}

/** Consume a verified OTP session (one-shot for assign/book). */
export function consumeCustomerOtpVerified(purpose: CustomerOtpPurpose, subjectId: string) {
  const key = keyFor(purpose, subjectId);
  pruneVerified(key);
  if (!verifiedStore.has(key)) return false;
  verifiedStore.delete(key);
  return true;
}
