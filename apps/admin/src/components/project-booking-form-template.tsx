"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@booking/ui";
import {
  BOOKING_FORM_TEMPLATE_PRESETS,
  mergeTemplateContent,
  type BookingFormTemplateContent,
  type BookingFormTemplateVariant,
} from "@booking/validators";
import { toast } from "sonner";

type BrandForm = {
  logoUrl: string;
  companyName: string;
  tagline: string;
  formTitle: string;
  supportEmail: string;
  primaryColor: string;
};

const EMPTY_BRAND: BrandForm = {
  logoUrl: "",
  companyName: "Goyal & Co.",
  tagline: "creating landmarks since 1971",
  formTitle: "APPLICATION FOR ALLOTMENT OF A RESIDENTIAL UNIT IN",
  supportEmail: "info.bng@goyalco.com",
  primaryColor: "#2BB8C8",
};

export function ProjectBookingFormTemplatePanel({ projectId }: { projectId: string }) {
  const [brand, setBrand] = useState<BrandForm>(EMPTY_BRAND);
  const [content, setContent] = useState<BookingFormTemplateContent>(
    BOOKING_FORM_TEMPLATE_PRESETS.example1
  );
  const [projectName, setProjectName] = useState("");
  const [version, setVersion] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const patch = <K extends keyof BookingFormTemplateContent>(
    key: K,
    value: BookingFormTemplateContent[K]
  ) => setContent((prev) => ({ ...prev, [key]: value }));

  const [library, setLibrary] = useState<Array<{ id: string; name: string }>>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [res, libRes] = await Promise.all([
      fetch(`/api/projects/${projectId}/booking-form-template`),
      fetch("/api/templates"),
    ]);
    const data = await res.json().catch(() => ({}));
    const libData = await libRes.json().catch(() => ({}));
    setLibrary((libData.templates ?? []).map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })));
    const t = data.template ?? {};
    const p = data.project ?? {};
    setProjectName(p.name ?? "");
    setVersion(typeof t.version === "number" ? t.version : null);
    setBrand({
      logoUrl: t.logoUrl || p.logoUrl || "",
      companyName: t.companyName || "Goyal & Co.",
      tagline: t.tagline || "creating landmarks since 1971",
      formTitle: t.formTitle || "APPLICATION FOR ALLOTMENT OF A RESIDENTIAL UNIT IN",
      supportEmail: t.supportEmail || "info.bng@goyalco.com",
      primaryColor: t.primaryColor || "#2BB8C8",
    });
    setContent(
      mergeTemplateContent(
        (t.fieldMapping ?? {}) as Partial<BookingFormTemplateContent>,
        p.name ?? ""
      )
    );
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const applyPreset = (variant: BookingFormTemplateVariant) => {
    const preset = {
      ...BOOKING_FORM_TEMPLATE_PRESETS[variant],
      projectDisplayName:
        projectName || BOOKING_FORM_TEMPLATE_PRESETS[variant].projectDisplayName,
    };
    setContent(preset);
    setBrand((b) => ({
      ...b,
      companyName: variant === "example2" ? "Goyal & Co." : "Goyal & Co. | Hariyana Group",
      supportEmail: preset.officeEmail,
      primaryColor: preset.accentTeal,
      formTitle: "APPLICATION FOR ALLOTMENT OF A RESIDENTIAL UNIT IN",
    }));
    toast.message(
      variant === "example1"
        ? "Loaded Template Example 1 layout (photos cover)"
        : "Loaded Template Example 2 layout (minimal cover + consent)"
    );
  };

  const save = async () => {
    setSaving(true);
    const res = await fetch(`/api/projects/${projectId}/booking-form-template`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${projectName || "Project"} booking form`,
        ...brand,
        primaryColor: content.accentTeal || brand.primaryColor,
        fieldMapping: content,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(typeof data.error === "string" ? data.error : "Failed to save template");
      return;
    }
    const data = await res.json();
    setVersion(data.template?.version ?? null);
    toast.success("Project booking form template saved");
    load();
  };

  if (loading) return <p className="text-sm text-gray-500">Loading template…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-navy-600">
            Booking Form Template{projectName ? ` — ${projectName}` : ""}
          </h2>
          <p className="text-sm text-gray-500">
            Editable for any project. Start from Template Example 1 or 2, then customize logos,
            promoter, land owners, RERA, collection account, T&amp;C, and consent page.
            {version != null ? ` Active: v${version}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => applyPreset("example1")}>
            Use Example 1
          </Button>
          <Button variant="outline" size="sm" onClick={() => applyPreset("example2")}>
            Use Example 2
          </Button>
          {library.length > 0 ? (
            <select
              className="rounded-lg border px-2 py-1.5 text-sm"
              defaultValue=""
              onChange={async (e) => {
                const orgTemplateId = e.target.value;
                e.target.value = "";
                if (!orgTemplateId) return;
                const res = await fetch(
                  `/api/projects/${projectId}/booking-form-template/assign`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ orgTemplateId }),
                  }
                );
                if (!res.ok) {
                  toast.error("Failed to load library template");
                  return;
                }
                toast.success("Library template applied to this project");
                load();
              }}
            >
              <option value="">Load from library…</option>
              {library.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          ) : null}
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save Template"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Layout variant</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <label className="flex cursor-pointer gap-3 rounded-lg border p-3">
            <input
              type="radio"
              checked={content.templateVariant === "example1"}
              onChange={() => applyPreset("example1")}
            />
            <span>
              <span className="font-semibold text-navy-600">Template Example 1</span>
              <span className="mt-1 block text-xs text-gray-500">
                Yellow photo strip cover, application no, full KYC, optional consent
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer gap-3 rounded-lg border p-3">
            <input
              type="radio"
              checked={content.templateVariant === "example2"}
              onChange={() => applyPreset("example2")}
            />
            <span>
              <span className="font-semibold text-navy-600">Template Example 2</span>
              <span className="mt-1 block text-xs text-gray-500">
                Minimal cover + dual logos, land owners, consent &amp; declaration page
              </span>
            </span>
          </label>
          <div className="sm:col-span-2 grid gap-3 sm:grid-cols-3">
            {(
              [
                ["showCoverPhotos", "Cover photo boxes"],
                ["showApplicationNo", "Application No. field"],
                ["showLandArea", "Show land area"],
                ["showLandOwners", "Show land owners"],
                ["showConsentPage", "Consent / Acknowledged page"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(content[key])}
                  onChange={(e) => patch(key, e.target.checked)}
                />
                {label}
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cover & logos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Cover title</Label>
              <Input className="mt-1" value={brand.formTitle} onChange={(e) => setBrand({ ...brand, formTitle: e.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Project name (line 1)</Label>
                <Input className="mt-1" value={content.projectDisplayName} onChange={(e) => patch("projectDisplayName", e.target.value)} />
              </div>
              <div>
                <Label>Project name (line 2)</Label>
                <Input className="mt-1" value={content.projectNameLine2} onChange={(e) => patch("projectNameLine2", e.target.value)} placeholder="e.g. SOUTH PARK" />
              </div>
            </div>
            <div>
              <Label>Company logo URL</Label>
              <Input className="mt-1" value={brand.logoUrl} onChange={(e) => setBrand({ ...brand, logoUrl: e.target.value })} />
            </div>
            <div>
              <Label>Project logo / hero URL</Label>
              <Input className="mt-1" value={content.projectLogoUrl || content.heroImageUrl} onChange={(e) => { patch("projectLogoUrl", e.target.value); patch("heroImageUrl", e.target.value); }} />
            </div>
            <div>
              <Label>Secondary logo URL (e.g. Hariyana)</Label>
              <Input className="mt-1" value={content.secondaryLogoUrl} onChange={(e) => patch("secondaryLogoUrl", e.target.value)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Company name</Label>
                <Input className="mt-1" value={brand.companyName} onChange={(e) => setBrand({ ...brand, companyName: e.target.value })} />
              </div>
              <div>
                <Label>Secondary company</Label>
                <Input className="mt-1" value={content.secondaryCompanyName} onChange={(e) => patch("secondaryCompanyName", e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Tagline</Label>
              <Input className="mt-1" value={brand.tagline} onChange={(e) => setBrand({ ...brand, tagline: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Teal</Label>
                <Input className="mt-1" type="color" value={content.accentTeal} onChange={(e) => patch("accentTeal", e.target.value)} />
              </div>
              <div>
                <Label>Yellow</Label>
                <Input className="mt-1" type="color" value={content.accentYellow} onChange={(e) => patch("accentYellow", e.target.value)} />
              </div>
              <div>
                <Label>Navy</Label>
                <Input className="mt-1" type="color" value={content.accentNavy} onChange={(e) => patch("accentNavy", e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Project / RERA details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(
              [
                ["landArea", "Land Area"],
                ["projectPhase", "Project Phase"],
                ["sanctionBy", "Sanction of Plan by"],
                ["planSanctionNo", "Plan Sanction / LP No."],
                ["reraWebsite", "RERA Website"],
                ["reraNumber", "RERA #"],
                ["landSurveyDetails", "Land survey / bearing details"],
                ["jurisdiction", "Jurisdiction"],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <Label>{label}</Label>
                <Input className="mt-1" value={content[key]} onChange={(e) => patch(key, e.target.value)} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Promoter, land owners & account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Promoter Name</Label>
              <Input className="mt-1" value={content.promoterName} onChange={(e) => patch("promoterName", e.target.value)} />
            </div>
            <div>
              <Label>Promoter Address</Label>
              <textarea className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" rows={2} value={content.promoterAddress} onChange={(e) => patch("promoterAddress", e.target.value)} />
            </div>
            <div>
              <Label>Land Owner Names</Label>
              <textarea className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" rows={3} value={content.landOwnerNames} onChange={(e) => patch("landOwnerNames", e.target.value)} />
            </div>
            <div>
              <Label>Land Owner Address</Label>
              <textarea className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" rows={2} value={content.landOwnerAddress} onChange={(e) => patch("landOwnerAddress", e.target.value)} />
            </div>
            <div>
              <Label>RERA Collection Account</Label>
              <Input className="mt-1" value={content.collectionAccountName} onChange={(e) => patch("collectionAccountName", e.target.value)} />
            </div>
            <div>
              <Label>Payable At</Label>
              <Input className="mt-1" value={content.payableAt} onChange={(e) => patch("payableAt", e.target.value)} />
            </div>
            <div>
              <Label>Group display name (agent declaration)</Label>
              <Input className="mt-1" value={content.groupDisplayName} onChange={(e) => patch("groupDisplayName", e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Office, KYC & agent copy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Office Address</Label>
              <Input className="mt-1" value={content.officeAddress} onChange={(e) => patch("officeAddress", e.target.value)} />
            </div>
            <div>
              <Label>Office / CRM Email</Label>
              <Input className="mt-1" value={content.officeEmail} onChange={(e) => { patch("officeEmail", e.target.value); setBrand({ ...brand, supportEmail: e.target.value }); }} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input className="mt-1" value={content.supportPhone} onChange={(e) => patch("supportPhone", e.target.value)} />
            </div>
            <div>
              <Label>KYC checklist (one per line)</Label>
              <textarea className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" rows={5} value={content.kycChecklist} onChange={(e) => patch("kycChecklist", e.target.value)} />
            </div>
            <div>
              <Label>Real estate agent declaration</Label>
              <textarea className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" rows={4} value={content.agentDeclarationText} onChange={(e) => patch("agentDeclarationText", e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Terms & Conditions</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              className="w-full rounded-lg border px-3 py-2 text-sm"
              rows={12}
              value={content.termsText}
              onChange={(e) => patch("termsText", e.target.value)}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Consent / Acknowledged & Agreed page</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 lg:grid-cols-2">
            <div>
              <Label>To (promoter / company)</Label>
              <Input className="mt-1" value={content.consentTo} onChange={(e) => patch("consentTo", e.target.value)} />
            </div>
            <div>
              <Label>Subject</Label>
              <Input className="mt-1" value={content.consentSubject} onChange={(e) => patch("consentSubject", e.target.value)} />
            </div>
            <div className="lg:col-span-2">
              <Label>Intro (use {"{{projectName}}"} and {"{{landSurveyDetails}}"})</Label>
              <textarea className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" rows={3} value={content.consentIntroText} onChange={(e) => patch("consentIntroText", e.target.value)} />
            </div>
            <div className="lg:col-span-2">
              <Label>Consent body</Label>
              <textarea className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" rows={5} value={content.consentBodyText} onChange={(e) => patch("consentBodyText", e.target.value)} />
            </div>
            <div className="lg:col-span-2">
              <Label>Declaration box</Label>
              <textarea className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" rows={6} value={content.consentDeclarationBox || content.declarationText} onChange={(e) => patch("consentDeclarationBox", e.target.value)} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
