export default function AdminLoading() {
  return (
    <div className="animate-pulse p-4 md:p-6">
      <div className="mb-6 h-8 w-48 rounded bg-gray-200" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-gray-200" />
        ))}
      </div>
      <div className="mt-6 h-64 rounded-xl bg-gray-200" />
    </div>
  );
}
