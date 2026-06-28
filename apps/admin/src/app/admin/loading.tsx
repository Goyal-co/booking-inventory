import { StatCardSkeleton, KpiGrid } from "@booking/ui";

export default function AdminLoading() {
  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 h-8 w-48 animate-pulse rounded bg-gray-200" />
      <KpiGrid>
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </KpiGrid>
      <div className="mt-6 h-64 animate-pulse rounded-xl bg-gray-200" />
    </div>
  );
}
