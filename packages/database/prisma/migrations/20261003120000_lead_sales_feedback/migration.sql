-- Sales feedback on assigned leads

ALTER TABLE "LeadRegistry" ADD COLUMN IF NOT EXISTS "salesFeedback" TEXT;
ALTER TABLE "LeadRegistry" ADD COLUMN IF NOT EXISTS "salesFeedbackAt" TIMESTAMP(3);
