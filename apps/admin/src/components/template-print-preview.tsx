"use client";

import { useEffect, useMemo, useState } from "react";
import { buildSamplePrintForm, digitalFormToPrintHtml, normalizeMediaUrl } from "@booking/pdf";
import type { BookingFormTemplateContent } from "@booking/validators";
import { Button } from "@booking/ui";

type BrandForm = {
  logoUrl: string;
  companyName: string;
  tagline: string;
  formTitle: string;
  supportEmail: string;
  primaryColor: string;
};

async function resolveLogoForPreview(raw: string | null | undefined): Promise<string> {
  const normalized = normalizeMediaUrl(raw);
  if (!normalized) return "";
  if (normalized.startsWith("/")) {
    return `${window.location.origin}${normalized}`;
  }
  if (
    normalized.includes("blob.vercel-storage.com") ||
    normalized.includes("/api/files/")
  ) {
    try {
      const res = await fetch(`/api/media/logo-url?url=${encodeURIComponent(normalized)}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && typeof data.displayUrl === "string") return data.displayUrl;
    } catch {
      /* fall through */
    }
  }
  return normalized;
}

export function TemplatePrintPreview({
  brand,
  content,
  projectName,
}: {
  brand: BrandForm;
  content: BookingFormTemplateContent;
  projectName?: string;
}) {
  const [html, setHtml] = useState("");
  const [scale, setScale] = useState(0.72);

  const sample = useMemo(
    () => buildSamplePrintForm(content.projectDisplayName || projectName || "Sample Project"),
    [content.projectDisplayName, projectName]
  );

  useEffect(() => {
    let cancelled = false;
    const t = window.setTimeout(() => {
      void (async () => {
        const contentRecord = { ...(content as unknown as Record<string, unknown>) };
        const [companyLogo, projectLogo, secondaryLogo] = await Promise.all([
          resolveLogoForPreview(brand.logoUrl),
          resolveLogoForPreview(
            String(content.projectLogoUrl || content.heroImageUrl || "")
          ),
          resolveLogoForPreview(String(content.secondaryLogoUrl || "")),
        ]);
        if (cancelled) return;

        if (projectLogo) {
          contentRecord.projectLogoUrl = projectLogo;
          contentRecord.heroImageUrl = projectLogo;
        }
        if (secondaryLogo) contentRecord.secondaryLogoUrl = secondaryLogo;

        const next = digitalFormToPrintHtml(sample, {
          preview: true,
          customerName: "Rahul Sharma",
          customerPhone: "9876543210",
          customerEmail: "rahul.sharma@example.com",
          branding: {
            logoUrl: companyLogo || null,
            companyName: brand.companyName,
            tagline: brand.tagline,
            formTitle: brand.formTitle,
            supportEmail: brand.supportEmail,
            primaryColor: content.accentTeal || brand.primaryColor,
            projectName: content.projectDisplayName || projectName,
            unitNumber: "1204",
            content: contentRecord,
          },
        });
        setHtml(next);
      })();
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [brand, content, projectName, sample]);

  const openFullscreen = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="flex h-full min-h-[640px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2">
        <div>
          <p className="text-sm font-semibold text-navy-600">Live printable preview</p>
          <p className="text-xs text-slate-500">Sample filled data · same render as download</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-slate-600">
            Zoom
            <input
              type="range"
              min={40}
              max={100}
              value={Math.round(scale * 100)}
              onChange={(e) => setScale(Number(e.target.value) / 100)}
            />
          </label>
          <Button type="button" variant="outline" size="sm" onClick={openFullscreen}>
            Open / Print
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <div
          className="mx-auto origin-top bg-white shadow-lg"
          style={{
            width: 794,
            transform: `scale(${scale})`,
            transformOrigin: "top center",
            marginBottom: `${(1 - scale) * -900}px`,
          }}
        >
          <iframe
            title="Booking form printable preview"
            srcDoc={html}
            className="w-[794px] border-0 bg-white"
            style={{ height: 1123 * 7 }}
            sandbox="allow-same-origin allow-modals"
          />
        </div>
      </div>
    </div>
  );
}
