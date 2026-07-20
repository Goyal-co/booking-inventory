"use client";

import { useRef, useState } from "react";
import { Button, Input, Label } from "@booking/ui";
import { normalizeMediaUrl } from "@booking/validators";
import { uploadLogoFile } from "@/lib/upload-logo-client";
import { toast } from "sonner";

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
  const preview = normalizeMediaUrl(value);

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
            <img src={preview} alt="" className="max-h-full max-w-full object-contain" />
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
              "Use either: upload an image file, or paste a public URL / Google Drive share link."}
          </p>
        </div>
      </div>
    </div>
  );
}
