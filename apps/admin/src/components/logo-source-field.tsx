"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Input, Label } from "@booking/ui";
import { normalizeMediaUrl } from "@booking/validators";
import { uploadLogoFile } from "@/lib/upload-logo-client";
import { toast } from "sonner";

async function fetchDisplayUrl(raw: string): Promise<string> {
  const normalized = normalizeMediaUrl(raw);
  if (!normalized) return "";
  // Drive/Dropbox/public https — use directly with no-referrer on img
  if (
    /drive\.google\.com|dropbox\.com/i.test(normalized) ||
    (normalized.startsWith("http") && !normalized.includes("blob.vercel-storage.com") && !normalized.includes("/api/files/"))
  ) {
    return normalized;
  }
  try {
    const res = await fetch(`/api/media/logo-url?url=${encodeURIComponent(normalized)}`);
    const data = await res.json().catch(() => ({}));
    if (res.ok && typeof data.displayUrl === "string" && data.displayUrl) {
      return data.displayUrl;
    }
  } catch {
    /* fall through */
  }
  // Relative local path — resolve against current origin for preview
  if (normalized.startsWith("/")) {
    return `${window.location.origin}${normalized}`;
  }
  return normalized;
}

export function LogoSourceField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!value.trim()) {
      setPreview("");
      return;
    }
    fetchDisplayUrl(value).then((url) => {
      if (!cancelled) setPreview(url);
    });
    return () => {
      cancelled = true;
    };
  }, [value]);

  const onUpload = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadLogoFile(file);
      onChange(url);
      toast.success("Logo uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onUrlBlur = () => {
    const normalized = normalizeMediaUrl(value);
    if (normalized && normalized !== value) onChange(normalized);
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-slate-50">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt=""
              referrerPolicy="no-referrer"
              className="max-h-full max-w-full object-contain"
              onError={() => setPreview("")}
            />
          ) : (
            <span className="text-[10px] text-slate-400">No logo</span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onUrlBlur}
            placeholder="Paste image URL or Google Drive link…"
          />
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
              className="hidden"
              onChange={(e) => onUpload(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? "Uploading…" : "Upload file"}
            </Button>
            {value ? (
              <Button type="button" variant="outline" size="sm" onClick={() => onChange("")}>
                Clear
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-slate-500">
            {hint ||
              "Upload a file (recommended) or paste a public URL / Google Drive share link. Re-upload if an old logo no longer shows."}
          </p>
        </div>
      </div>
    </div>
  );
}
