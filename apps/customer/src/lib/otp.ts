import { createHash, randomInt } from "crypto";

const otpState = globalThis as typeof globalThis & {
  bookingOtpStore?: Map<string, { hash: string; expiresAt: number }>;
  bookingVerifiedTokens?: Set<string>;
};

const otpStore = otpState.bookingOtpStore ?? new Map<string, { hash: string; expiresAt: number }>();
const verifiedTokens = otpState.bookingVerifiedTokens ?? new Set<string>();

otpState.bookingOtpStore = otpStore;
otpState.bookingVerifiedTokens = verifiedTokens;

const OTP_TTL_MS = 10 * 60 * 1000;

function hashOtp(token: string, otp: string) {
  return createHash("sha256").update(`${token}:${otp}`).digest("hex");
}

export function generateOtp(token: string) {
  const otp = String(randomInt(100000, 999999));
  otpStore.set(token, {
    hash: hashOtp(token, otp),
    expiresAt: Date.now() + OTP_TTL_MS,
  });
  return otp;
}

export function verifyOtp(token: string, otp: string) {
  const entry = otpStore.get(token);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(token);
    return false;
  }
  const valid = entry.hash === hashOtp(token, otp);
  if (valid) otpStore.delete(token);
  return valid;
}

export function markTokenVerified(token: string) {
  verifiedTokens.add(token);
}

export function isTokenVerified(token: string) {
  return verifiedTokens.has(token);
}
