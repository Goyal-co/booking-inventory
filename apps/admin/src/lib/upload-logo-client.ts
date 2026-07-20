export async function uploadLogoFile(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/uploads/logo", { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Upload failed");
  }
  return data.url as string;
}
