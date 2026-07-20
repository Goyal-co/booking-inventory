"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@booking/ui";
import {
  BOOKING_FORM_TEMPLATE_PRESETS,
  mergeTemplateContent,
  type BookingFormTemplateContent,
  type BookingFormTemplateVariant,
} from "@booking/validators";
import { toast, Toaster } from "sonner";

type LibraryRow = {
  id: string;
  name: string;
  description: string | null;
  companyName: string | null;
  updatedAt: string;
  fieldMapping: Partial<BookingFormTemplateContent> | null;
};

export default function AdminTemplatesPage() {
  const [templates, setTemplates] = useState<LibraryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [companyName, setCompanyName] = useState("Goyal & Co.");
  const [logoUrl, setLogoUrl] = useState("");
  const [formTitle, setFormTitle] = useState("APPLICATION FOR ALLOTMENT OF A RESIDENTIAL UNIT IN");
  const [tagline, setTagline] = useState("creating landmarks since 1971");
  const [supportEmail, setSupportEmail] = useState("info.bng@goyalco.com");
  const [content, setContent] = useState<BookingFormTemplateContent>(
    BOOKING_FORM_TEMPLATE_PRESETS.example2
  );
  const [saving, setSaving] = useState(false);
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [assignProjectId, setAssignProjectId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [tRes, pRes] = await Promise.all([
      fetch("/api/templates"),
      fetch("/api/projects"),
    ]);
    const tData = await tRes.json().catch(() => ({}));
    const pData = await pRes.json().catch(() => ({}));
    setTemplates(tData.templates ?? []);
    setProjects((pData.projects ?? []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const applyPreset = (variant: BookingFormTemplateVariant) => {
    setContent(BOOKING_FORM_TEMPLATE_PRESETS[variant]);
    setName(variant === "example1" ? "Template Example 1" : "Template Example 2");
    setDescription(
      variant === "example1"
        ? "Photo cover + full KYC (Orchid Life style)"
        : "Minimal cover + land owners + consent (Orchid South Park style)"
    );
    setCompanyName(variant === "example2" ? "Goyal & Co." : "Goyal & Co. | Hariyana Group");
    setSupportEmail(BOOKING_FORM_TEMPLATE_PRESETS[variant].officeEmail);
  };

  const startNew = () => {
    setEditingId(null);
    setName("");
    setDescription("");
    applyPreset("example1");
    setName("");
  };

  const openEdit = async (id: string) => {
    const res = await fetch(`/api/templates/${id}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.template) {
      toast.error("Failed to load template");
      return;
    }
    const t = data.template;
    setEditingId(t.id);
    setName(t.name ?? "");
    setDescription(t.description ?? "");
    setCompanyName(t.companyName ?? "Goyal & Co.");
    setLogoUrl(t.logoUrl ?? "");
    setFormTitle(t.formTitle ?? "APPLICATION FOR ALLOTMENT OF A RESIDENTIAL UNIT IN");
    setTagline(t.tagline ?? "creating landmarks since 1971");
    setSupportEmail(t.supportEmail ?? "");
    setContent(mergeTemplateContent(t.fieldMapping ?? {}, ""));
  };

  const save = async () => {
    if (!name.trim()) {
      toast.error("Template name is required");
      return;
    }
    setSaving(true);
    const payload = {
      name,
      description,
      logoUrl,
      companyName,
      tagline,
      formTitle,
      supportEmail,
      primaryColor: content.accentTeal,
      fieldMapping: content,
    };
    const res = await fetch(editingId ? `/api/templates/${editingId}` : "/api/templates", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(typeof data.error === "string" ? data.error : "Save failed");
      return;
    }
    toast.success(editingId ? "Template updated" : "Template created");
    const data = await res.json();
    setEditingId(data.template?.id ?? editingId);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this library template?")) return;
    const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Delete failed");
      return;
    }
    toast.success("Deleted");
    if (editingId === id) startNew();
    load();
  };

  const assignToProject = async () => {
    if (!editingId || !assignProjectId) {
      toast.error("Save/select a template and choose a project");
      return;
    }
    const res = await fetch(`/api/projects/${assignProjectId}/booking-form-template/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgTemplateId: editingId }),
    });
    if (!res.ok) {
      toast.error("Assign failed");
      return;
    }
    toast.success("Template assigned to project — customer form will use it");
  };

  const patch = <K extends keyof BookingFormTemplateContent>(
    key: K,
    value: BookingFormTemplateContent[K]
  ) => setContent((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-6 p-6">
      <Toaster richColors />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-navy-600">Booking Form Templates</h1>
          <p className="text-sm text-gray-600">
            Create and edit reusable templates (Example 1 / Example 2 / custom), then assign them to
            any project.
          </p>
        </div>
        <Button onClick={startNew}>New Template</Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Library</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <p className="text-sm text-gray-500">Loading…</p>
            ) : templates.length === 0 ? (
              <p className="text-sm text-gray-500">No templates yet. Create one from Example 1 or 2.</p>
            ) : (
              templates.map((t) => (
                <div
                  key={t.id}
                  className={`rounded-lg border p-3 ${editingId === t.id ? "border-brand-500 bg-brand-50" : ""}`}
                >
                  <button type="button" className="w-full text-left" onClick={() => openEdit(t.id)}>
                    <p className="font-medium text-navy-600">{t.name}</p>
                    <p className="text-xs text-gray-500">{t.description || t.companyName || "—"}</p>
                  </button>
                  <button
                    type="button"
                    className="mt-2 text-xs text-rose-600"
                    onClick={() => remove(t.id)}
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {editingId ? "Edit template" : "Create template"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => applyPreset("example1")}>
                  Start from Example 1
                </Button>
                <Button variant="outline" size="sm" onClick={() => applyPreset("example2")}>
                  Start from Example 2
                </Button>
                <Button size="sm" onClick={save} disabled={saving}>
                  {saving ? "Saving…" : "Save Template"}
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Template name</Label>
                  <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input className="mt-1" value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <div>
                  <Label>Company name</Label>
                  <Input className="mt-1" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                </div>
                <div>
                  <Label>Logo URL</Label>
                  <Input className="mt-1" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Form title</Label>
                  <Input className="mt-1" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
                </div>
                <div>
                  <Label>Tagline</Label>
                  <Input className="mt-1" value={tagline} onChange={(e) => setTagline(e.target.value)} />
                </div>
                <div>
                  <Label>Support email</Label>
                  <Input className="mt-1" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} />
                </div>
                <div>
                  <Label>Project display name</Label>
                  <Input className="mt-1" value={content.projectDisplayName} onChange={(e) => patch("projectDisplayName", e.target.value)} />
                </div>
                <div>
                  <Label>Project name line 2</Label>
                  <Input className="mt-1" value={content.projectNameLine2} onChange={(e) => patch("projectNameLine2", e.target.value)} />
                </div>
                <div>
                  <Label>Promoter</Label>
                  <Input className="mt-1" value={content.promoterName} onChange={(e) => patch("promoterName", e.target.value)} />
                </div>
                <div>
                  <Label>Collection account</Label>
                  <Input className="mt-1" value={content.collectionAccountName} onChange={(e) => patch("collectionAccountName", e.target.value)} />
                </div>
                <div>
                  <Label>RERA #</Label>
                  <Input className="mt-1" value={content.reraNumber} onChange={(e) => patch("reraNumber", e.target.value)} />
                </div>
                <div>
                  <Label>Office email</Label>
                  <Input className="mt-1" value={content.officeEmail} onChange={(e) => patch("officeEmail", e.target.value)} />
                </div>
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                {(
                  [
                    ["showCoverPhotos", "Cover photos"],
                    ["showLandOwners", "Land owners"],
                    ["showConsentPage", "Consent page"],
                    ["showApplicationNo", "Application No"],
                    ["showLandArea", "Land area"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(content[key])}
                      onChange={(e) => patch(key, e.target.checked)}
                    />
                    {label}
                  </label>
                ))}
              </div>
              <div>
                <Label>Terms &amp; Conditions</Label>
                <textarea
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  rows={10}
                  value={content.termsText}
                  onChange={(e) => patch("termsText", e.target.value)}
                />
              </div>
              <div>
                <Label>Declaration (under Terms)</Label>
                <textarea
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  rows={4}
                  value={content.declarationText}
                  onChange={(e) => patch("declarationText", e.target.value)}
                />
              </div>
              <div>
                <Label>Land owner names</Label>
                <textarea
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  rows={3}
                  value={content.landOwnerNames}
                  onChange={(e) => patch("landOwnerNames", e.target.value)}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Consent — To</Label>
                  <Input className="mt-1" value={content.consentTo} onChange={(e) => patch("consentTo", e.target.value)} />
                </div>
                <div>
                  <Label>Consent — Subject</Label>
                  <Input className="mt-1" value={content.consentSubject} onChange={(e) => patch("consentSubject", e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Consent intro</Label>
                <textarea
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  rows={3}
                  value={content.consentIntroText}
                  onChange={(e) => patch("consentIntroText", e.target.value)}
                />
              </div>
              <div>
                <Label>Consent body</Label>
                <textarea
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  rows={5}
                  value={content.consentBodyText}
                  onChange={(e) => patch("consentBodyText", e.target.value)}
                />
              </div>
              <div>
                <Label>Consent declaration box</Label>
                <textarea
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  rows={4}
                  value={content.consentDeclarationBox}
                  onChange={(e) => patch("consentDeclarationBox", e.target.value)}
                />
              </div>
              <p className="text-xs text-gray-500">
                After assigning to a project, open the project booking-form editor for the full field
                set (RERA, KYC list, logos, colours, etc.). Each project keeps its own active template
                version used by the customer form and printable document.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Assign to project</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-3">
              <div className="min-w-[220px] flex-1">
                <Label>Project</Label>
                <select
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  value={assignProjectId}
                  onChange={(e) => setAssignProjectId(e.target.value)}
                >
                  <option value="">Select project…</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button variant="outline" onClick={assignToProject} disabled={!editingId}>
                Assign active template
              </Button>
              {assignProjectId ? (
                <Link href={`/admin/projects/${assignProjectId}/booking-form-template`}>
                  <Button variant="outline">Open project editor</Button>
                </Link>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
