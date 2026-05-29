export function formatApiError(error: unknown, fallback: string): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "formErrors" in error) {
    const flat = error as { formErrors?: string[]; fieldErrors?: Record<string, string[]> };
    const msgs = [...(flat.formErrors ?? []), ...Object.values(flat.fieldErrors ?? {}).flat()];
    if (msgs.length) return msgs.join(". ");
  }
  return fallback;
}
