export async function uploadFloorPlanFile(file: File, kind: "image" | "pdf"): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("kind", kind);
  const res = await fetch("/api/uploads/floor-plan", { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Upload failed");
  }
  return data.url as string;
}
