-- Structured visiting / booking CP on site visits and bookings

ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "visitingCpId" TEXT;
ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "visitingCpName" TEXT;
ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "projectName" TEXT;
ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "eoiCpLeadId" TEXT;
ALTER TABLE "SiteVisit" ADD COLUMN IF NOT EXISTS "publicLeadId" TEXT;

CREATE INDEX IF NOT EXISTS "SiteVisit_visitingCpId_idx" ON "SiteVisit"("visitingCpId");
CREATE INDEX IF NOT EXISTS "SiteVisit_publicLeadId_idx" ON "SiteVisit"("publicLeadId");

ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "bookedWithCpId" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "bookedWithCpName" TEXT;

CREATE INDEX IF NOT EXISTS "Booking_bookedWithCpId_idx" ON "Booking"("bookedWithCpId");
