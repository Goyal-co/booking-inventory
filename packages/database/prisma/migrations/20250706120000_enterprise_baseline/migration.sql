-- Baseline migration marker for enterprise platform schema.
-- For fresh databases: run `pnpm db:migrate:deploy` after `prisma migrate resolve`.
-- For existing dev DBs already on db:push: run `prisma migrate resolve --applied 20250706120000_enterprise_baseline`

SELECT 1;
