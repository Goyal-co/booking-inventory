export default function SalesAppLoading() {
  return (
    <div className="animate-pulse p-4 md:p-6">
      <div className="mb-6 h-8 w-40 rounded bg-gray-200" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 rounded-xl bg-gray-200" />
        ))}
      </div>
    </div>
  );
}
