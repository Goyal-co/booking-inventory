/** Mirror of @booking/validators normalizeMediaUrl — keep pdf package dependency-free. */
export function normalizeMediaUrl(input: string | null | undefined): string {
  const raw = String(input ?? "").trim();
  if (!raw) return "";

  if (/drive\.google\.com\/uc\?/i.test(raw) && /[?&]id=/i.test(raw)) {
    try {
      const u = new URL(raw);
      const id = u.searchParams.get("id");
      if (id) return `https://drive.google.com/uc?export=view&id=${id}`;
    } catch {
      return raw;
    }
  }

  const fileMatch = raw.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
  if (fileMatch?.[1]) {
    return `https://drive.google.com/uc?export=view&id=${fileMatch[1]}`;
  }

  try {
    if (/drive\.google\.com/i.test(raw)) {
      const u = new URL(raw);
      const id = u.searchParams.get("id");
      if (id) return `https://drive.google.com/uc?export=view&id=${id}`;
    }
  } catch {
    /* keep */
  }

  if (/dropbox\.com\//i.test(raw)) {
    try {
      const u = new URL(raw);
      u.searchParams.set("raw", "1");
      u.searchParams.delete("dl");
      return u.toString();
    } catch {
      return raw.replace(/[?&]dl=0/, "").concat(raw.includes("?") ? "&raw=1" : "?raw=1");
    }
  }

  return raw;
}
