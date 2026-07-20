/**
 * Normalize image URLs so Google Drive / Dropbox share links work in <img src>.
 * Uploaded paths (/uploads/...) and normal https URLs pass through unchanged.
 */
export function normalizeMediaUrl(input: string | null | undefined): string {
  const raw = String(input ?? "").trim();
  if (!raw) return "";

  // Already a direct Drive view/download link
  if (/drive\.google\.com\/uc\?/i.test(raw) && /[?&]id=/i.test(raw)) {
    try {
      const u = new URL(raw);
      const id = u.searchParams.get("id");
      if (id) return `https://drive.google.com/uc?export=view&id=${id}`;
    } catch {
      return raw;
    }
  }

  // https://drive.google.com/file/d/FILE_ID/view?...
  const fileMatch = raw.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
  if (fileMatch?.[1]) {
    return `https://drive.google.com/uc?export=view&id=${fileMatch[1]}`;
  }

  // https://drive.google.com/open?id=FILE_ID
  try {
    if (/drive\.google\.com/i.test(raw)) {
      const u = new URL(raw);
      const id = u.searchParams.get("id");
      if (id) return `https://drive.google.com/uc?export=view&id=${id}`;
    }
  } catch {
    /* keep raw */
  }

  // Dropbox share → direct
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
