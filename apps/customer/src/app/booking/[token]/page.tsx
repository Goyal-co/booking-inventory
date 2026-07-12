"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Button, CostSheetEngineView, type CostSheetEngineData } from "@booking/ui";
import { mergeTemplateContent, type BookingFormTemplateContent } from "@booking/validators";
import { toast, Toaster } from "sonner";
import {
  CheckboxRow,
  DetailsBanner,
  FieldTick,
  FORM_TEAL,
  FORM_YELLOW,
  PaperFormShell,
  ReadOnlyLine,
  SectionTitle,
  TealCallout,
  UnderlineField,
  YellowHighlight,
} from "@/components/booking-form/paper-form";

const ALL_STEPS = [
  { id: "cover", label: "Cover", optional: false },
  { id: "apartment", label: "Apartment", optional: false, viewOnly: true },
  { id: "project", label: "Project", optional: false, viewOnly: true },
  { id: "applicant", label: "First Applicant", optional: false },
  { id: "jointApplicant", label: "Joint Applicant", optional: true },
  { id: "geographic", label: "Address", optional: false },
  { id: "occupation", label: "Occupation", optional: false },
  { id: "communication", label: "Communication", optional: false },
  { id: "sourceOfFund", label: "Source of Fund", optional: false },
  { id: "authority", label: "Authority", optional: true },
  { id: "sourceOfEnquiry", label: "Source of Enquiry", optional: false },
  { id: "realEstateAgents", label: "Real Estate Agents", optional: true },
  { id: "earnestDeposit", label: "Earnest Deposit", optional: false },
  { id: "terms", label: "Terms & Declaration", optional: false },
  { id: "consent", label: "Consent", optional: true },
] as const;

type StepDef = (typeof ALL_STEPS)[number];
type StepId = StepDef["id"];

type Branding = {
  logoUrl: string | null;
  companyName: string;
  tagline: string | null;
  formTitle: string;
  supportEmail: string | null;
  projectName: string;
  unitNumber: string | null;
  content: BookingFormTemplateContent;
};

const ENQUIRY_OPTIONS = [
  "Newspaper Ad",
  "Magazines",
  "Hoarding",
  "Site Walkin",
  "Office Walkin",
  "Exhibition/Road shows",
  "Website",
  "Online Portals",
  "Social Media",
  "T.V.",
  "Radio",
  "Reference",
  "Presales",
  "Real Estate Agent",
];

function isFilled(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === "string" && value.trim().length > 0;
}

function amountInWords(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "";
  return `Rupees ${Math.round(n).toLocaleString("en-IN")} only`;
}

function CharBoxes({ value }: { value: string }) {
  const chars = (value || "————").split("");
  return (
    <span className="inline-flex flex-wrap items-center gap-0.5">
      {chars.map((ch, i) => (
        <span
          key={`${ch}-${i}`}
          className="inline-flex h-7 min-w-[1.4rem] items-center justify-center border border-navy-600 bg-white px-1 font-mono text-sm font-bold text-navy-700"
          style={{ backgroundColor: FORM_YELLOW }}
        >
          {ch === " " ? "\u00A0" : ch}
        </span>
      ))}
    </span>
  );
}

function fillConsentIntro(
  template: string,
  fields: {
    name: string;
    relative: string;
    age: string;
    address: string;
    projectName: string;
    landSurveyDetails: string;
  }
) {
  let text = template || "";
  text = text.replace(/\{\{projectName\}\}/g, fields.projectName);
  text = text.replace(/\{\{landSurveyDetails\}\}/g, fields.landSurveyDetails || "________");
  // Fill sequential blanks: name, relative, age, address
  const blanks = [fields.name, fields.relative, fields.age, fields.address];
  for (const value of blanks) {
    if (!value) continue;
    text = text.replace(/_{3,}/, value);
  }
  return text;
}

export default function BookingFormPage() {
  const params = useParams();
  const token = params.token as string;
  const [page1, setPage1] = useState<CostSheetEngineData | null>(null);
  const [formData, setFormData] = useState<Record<string, Record<string, string | string[]>>>({});
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState("DRAFT");
  const [loading, setLoading] = useState(true);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [docsUploaded, setDocsUploaded] = useState<string[]>([]);
  const [branding, setBranding] = useState<Branding>({
    logoUrl: null,
    companyName: "Goyal & Co. | Hariyana Group",
    tagline: "creating landmarks since 1971",
    formTitle: "APPLICATION FOR ALLOTMENT OF A RESIDENTIAL UNIT",
    supportEmail: "info.bng@goyalco.com",
    projectName: "",
    unitNumber: null,
    content: mergeTemplateContent(null, ""),
  });

  const content = branding.content;
  const teal = content.accentTeal || FORM_TEAL;

  const STEPS = useMemo(
    () => ALL_STEPS.filter((s) => s.id !== "consent" || content.showConsentPage),
    [content.showConsentPage]
  );

  const parseJsonSafe = async (res: Response) => {
    const text = await res.text();
    if (!text) return {};
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return {};
    }
  };

  useEffect(() => {
    fetch(`/api/booking/${token}`)
      .then(async (r) => ({ ok: r.ok, data: await parseJsonSafe(r) }))
      .then((d) => {
        if (!d.ok || d.data.error) {
          const error =
            typeof d.data.error === "string" ? d.data.error : "Invalid or expired booking link";
          setLinkError(error);
          toast.error(error);
          return;
        }
        setLinkError(null);
        setPage1(d.data.page1Snapshot as CostSheetEngineData);
        setStatus(String(d.data.status ?? "DRAFT"));
        if (d.data.formData) {
          setFormData(d.data.formData as Record<string, Record<string, string | string[]>>);
        }
        const b = (d.data.branding ?? {}) as Record<string, unknown>;
        const projectName = String(d.data.projectName ?? b.projectName ?? "");
        const merged = mergeTemplateContent(
          (b.content as Partial<BookingFormTemplateContent>) ?? {},
          projectName
        );
        setBranding({
          logoUrl: (b.logoUrl as string | null) ?? null,
          companyName: String(b.companyName || "Goyal & Co. | Hariyana Group"),
          tagline: (b.tagline as string | null) ?? "creating landmarks since 1971",
          formTitle: String(
            b.formTitle || "APPLICATION FOR ALLOTMENT OF A RESIDENTIAL UNIT"
          ),
          supportEmail: (b.supportEmail as string | null) ?? merged.officeEmail,
          projectName,
          unitNumber: (d.data.unitNumber as string | null) ?? null,
          content: merged,
        });
        const docs = Array.isArray(d.data.documents)
          ? (d.data.documents as Array<{ type?: string }>).map((x) => String(x.type ?? ""))
          : [];
        setDocsUploaded(docs.filter(Boolean));
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (step >= STEPS.length) setStep(Math.max(0, STEPS.length - 1));
  }, [STEPS.length, step]);

  const current = STEPS[step] ?? STEPS[0];
  const fields = formData[current.id] ?? {};

  const setField = (key: string, value: string | string[]) => {
    setFormData((prev) => ({
      ...prev,
      [current.id]: { ...(prev[current.id] ?? {}), [key]: value },
    }));
  };

  const getStr = (key: string) => String(fields[key] ?? "");
  const getStepStr = (stepId: StepId, key: string) =>
    String((formData[stepId] ?? {})[key] ?? "");

  const isViewOnly = (s: StepDef) => "viewOnly" in s && Boolean(s.viewOnly);

  const stepDone = useMemo(() => {
    return STEPS.map((s) => {
      const values = formData[s.id] ?? {};
      if (isViewOnly(s)) return true;
      if (s.optional) return formData[s.id] != null;
      if (s.id === "applicant") {
        return ["firstName", "surname", "fatherHusbandName", "dateOfBirth"].every((k) =>
          isFilled(values[k])
        );
      }
      if (s.id === "geographic") {
        return isFilled(values.communicationAddress);
      }
      if (s.id === "terms") {
        return values.accepted === "yes";
      }
      if (s.id === "consent") {
        return values.accepted === "yes";
      }
      if (s.id === "sourceOfEnquiry") {
        return isFilled(values.sources) || isFilled(values.sourceDetails);
      }
      return Object.values(values).some(isFilled);
    });
  }, [formData, STEPS]);

  const saveStep = async () => {
    if (linkError) return false;
    if (isViewOnly(current)) return true;
    const res = await fetch(`/api/booking/${token}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: current.id, data: fields }),
    });
    if (res.ok) {
      if (!(current.id in formData)) {
        setFormData((prev) => ({ ...prev, [current.id]: fields }));
      }
      toast.success(
        current.optional && !Object.values(fields).some(isFilled)
          ? "Skipped optional section"
          : "Saved"
      );
      return true;
    }
    const data = await parseJsonSafe(res);
    toast.error(typeof data.error === "string" ? data.error : "Failed to save");
    return false;
  };

  const goNext = async () => {
    const saved = await saveStep();
    if (saved && step < STEPS.length - 1) setStep((s) => s + 1);
  };

  const submit = async () => {
    if (!otpVerified) {
      toast.error("Please verify OTP before submitting");
      return;
    }
    const termsData = formData.terms ?? (current.id === "terms" ? fields : {});
    if (String(termsData.accepted ?? "") !== "yes") {
      toast.error("Please accept the declaration to submit");
      setStep(STEPS.findIndex((s) => s.id === "terms"));
      return;
    }
    if (content.showConsentPage) {
      const consentData = formData.consent ?? (current.id === "consent" ? fields : {});
      if (String(consentData.accepted ?? "") !== "yes") {
        toast.error("Please accept the consent declaration to submit");
        setStep(STEPS.findIndex((s) => s.id === "consent"));
        return;
      }
    }
    const saved = await saveStep();
    if (!saved) return;
    const res = await fetch(`/api/booking/${token}/submit`, { method: "POST" });
    const d = await parseJsonSafe(res);
    if (res.ok) {
      setStatus("SUBMITTED");
      toast.success("Booking form submitted");
    } else toast.error(typeof d.error === "string" ? d.error : "Submit failed");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#EEF2F5] text-navy-600">
        Loading booking form…
      </div>
    );
  }

  const projectLabel =
    content.projectDisplayName || branding.projectName || "PROJECT";
  const unitNo = branding.unitNumber || page1?.unitNumber || page1?.apartmentNo || "";
  const kycItems = (content.kycChecklist || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const agentDeclaration = (content.agentDeclarationText || "").replace(
    /Goyal & Co\s*\|\s*Hariyana Group/gi,
    content.groupDisplayName || "Goyal & Co | Hariyana Group"
  );
  const termsRendered = (content.termsText || "")
    .replace(/ORCHID LIFE/gi, projectLabel)
    .replace(/ORCHID SOUTH PARK/gi, projectLabel)
    .replace(
      /G H A ORCHID LIFE RERA COLLECTION ACCOUNT/gi,
      content.collectionAccountName ||
        `G H A ${projectLabel.toUpperCase()} RERA COLLECTION ACCOUNT`
    )
    .replace(
      /Goyal Hariyana Constructions Rera Collection Ac for Orchid South Park/gi,
      content.collectionAccountName ||
        `G H A ${projectLabel.toUpperCase()} RERA COLLECTION ACCOUNT`
    );

  const consentIntroRendered = fillConsentIntro(content.consentIntroText, {
    name: getStr("name") || getStepStr("applicant", "firstName"),
    relative: getStr("relative") || getStepStr("applicant", "fatherHusbandName"),
    age: getStr("age"),
    address:
      getStr("address") ||
      getStepStr("geographic", "communicationAddress") ||
      getStepStr("geographic", "permanentAddress"),
    projectName: projectLabel,
    landSurveyDetails: content.landSurveyDetails,
  });

  return (
    <div className="min-h-screen bg-[#EEF2F5] py-6 sm:py-10">
      <Toaster richColors />
      <div className="mx-auto max-w-4xl px-3 sm:px-6">
        {linkError ? (
          <PaperFormShell accentTeal={teal}>
            <div className="p-8">
              <p className="font-semibold text-rose-700">This booking link is not active.</p>
              <p className="mt-2 text-sm text-rose-600">{linkError}</p>
            </div>
          </PaperFormShell>
        ) : status === "SUBMITTED" ? (
          <PaperFormShell accentTeal={teal}>
            <div className="p-8 text-center">
              <p className="text-lg font-bold text-emerald-700">Form submitted successfully</p>
              <p className="mt-2 text-sm text-slate-600">
                Please visit the sales office for signatures only.
              </p>
              <a href={`/dashboard?token=${encodeURIComponent(token)}`} className="mt-4 inline-block">
                <Button variant="outline">Open Customer Dashboard</Button>
              </a>
            </div>
          </PaperFormShell>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              {STEPS.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStep(i)}
                  className={`inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide ${
                    i === step
                      ? "text-white"
                      : stepDone[i]
                        ? "bg-emerald-50 text-emerald-800"
                        : "bg-white text-navy-600"
                  }`}
                  style={i === step ? { backgroundColor: teal } : undefined}
                >
                  <FieldTick done={Boolean(stepDone[i])} />
                  {s.label}
                  {s.optional ? " *" : ""}
                </button>
              ))}
            </div>

            <PaperFormShell accentTeal={teal}>
              {current.id === "cover" && (
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-6">
                    <UnderlineField
                      label="DATE"
                      type="date"
                      value={getStr("date")}
                      onChange={(v) => setField("date", v)}
                      className="mb-0 min-w-[180px]"
                    />
                    <div className="text-right text-xs font-semibold uppercase tracking-wide text-navy-600">
                      {content.showApplicationNo ? (
                        <p className="mb-2">
                          Application No:{" "}
                          <span className="font-mono tracking-[0.3em] text-slate-400">—————</span>
                        </p>
                      ) : null}
                      <p className="flex flex-wrap items-center justify-end gap-2">
                        <span>Apartment No:</span>
                        <CharBoxes value={unitNo} />
                      </p>
                    </div>
                  </div>

                  {content.showCoverPhotos ? (
                    <>
                      <div className="grid gap-6 px-4 py-8 sm:grid-cols-[1.2fr_0.8fr] sm:px-6">
                        <div>
                          <h1 className="text-2xl font-black uppercase leading-tight text-navy-600 sm:text-3xl">
                            {branding.formTitle}
                            {!branding.formTitle.toUpperCase().includes(" IN") ? (
                              <>
                                <br />
                                IN
                              </>
                            ) : null}
                          </h1>
                          <div className="mt-4 inline-block">
                            <YellowHighlight>
                              <span className="text-xl tracking-wide sm:text-2xl">{projectLabel}</span>
                            </YellowHighlight>
                            <div className="mt-1 border-b border-dashed border-navy-600" />
                          </div>
                        </div>
                        <div
                          className="flex min-h-[160px] items-center justify-center rounded-sm"
                          style={{ backgroundColor: FORM_YELLOW }}
                        >
                          {content.heroImageUrl || content.projectLogoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={content.heroImageUrl || content.projectLogoUrl}
                              alt={projectLabel}
                              className="max-h-40 max-w-full object-contain p-4"
                            />
                          ) : (
                            <p className="px-4 text-center text-sm font-bold uppercase text-navy-600">
                              {projectLabel}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="px-4 pb-2 sm:px-6" style={{ backgroundColor: FORM_YELLOW }}>
                        <div className="grid grid-cols-3 gap-3 py-5">
                          {[
                            "Applicant 1 / Affix Photo",
                            "Applicant 2 / Affix Photo",
                            "Applicant 3 / Affix Photo",
                          ].map((label) => (
                            <div
                              key={label}
                              className="flex aspect-[3/4] items-center justify-center rounded-md bg-[#5F8F5A]/90 px-2 text-center text-[11px] font-semibold text-white sm:text-xs"
                            >
                              {label}
                            </div>
                          ))}
                        </div>
                        <p className="pb-4 text-center text-xs font-medium text-navy-700">
                          The Application form is to be duly filled in CAPITALS and signed by all the
                          applicants
                        </p>
                      </div>

                      <div
                        className="flex flex-wrap items-end justify-between gap-4 px-4 py-5 sm:px-6"
                        style={{ backgroundColor: FORM_YELLOW }}
                      >
                        <div>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={branding.logoUrl || "/logo.svg"}
                            alt={branding.companyName}
                            className="mb-2 h-10 w-auto max-w-[200px] object-contain"
                          />
                          <p className="text-xs italic text-navy-600">
                            {branding.tagline || "creating landmarks since 1971"}
                          </p>
                        </div>
                        <div className="text-right">
                          {content.projectLogoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={content.projectLogoUrl}
                              alt={projectLabel}
                              className="ml-auto h-12 w-auto object-contain"
                            />
                          ) : (
                            <p className="text-lg font-black uppercase text-navy-600">
                              {projectLabel}
                            </p>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-col items-center px-4 py-10 text-center sm:px-6">
                        {content.projectLogoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={content.projectLogoUrl}
                            alt={projectLabel}
                            className="mb-6 h-24 w-auto max-w-[220px] object-contain"
                          />
                        ) : null}
                        <h1 className="text-2xl font-black uppercase leading-tight text-navy-600 sm:text-3xl">
                          {branding.formTitle}
                        </h1>
                        <div className="mt-6 space-y-1">
                          <YellowHighlight>
                            <span className="text-2xl tracking-wide sm:text-3xl">
                              {content.projectDisplayName || projectLabel}
                            </span>
                          </YellowHighlight>
                          {content.projectNameLine2 ? (
                            <p className="text-xl font-black uppercase tracking-wide text-navy-600 sm:text-2xl">
                              {content.projectNameLine2}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div
                        className="flex flex-wrap items-end justify-between gap-6 border-t border-navy-600/10 px-4 py-6 sm:px-8"
                        style={{ backgroundColor: FORM_YELLOW }}
                      >
                        <div className="flex flex-1 flex-col items-center gap-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={branding.logoUrl || "/logo.svg"}
                            alt={branding.companyName}
                            className="h-12 w-auto max-w-[180px] object-contain"
                          />
                          <p className="text-center text-xs font-semibold text-navy-700">
                            {branding.companyName}
                          </p>
                        </div>
                        <div className="flex flex-1 flex-col items-center gap-2">
                          {content.secondaryLogoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={content.secondaryLogoUrl}
                              alt={content.secondaryCompanyName || "Partner"}
                              className="h-12 w-auto max-w-[180px] object-contain"
                            />
                          ) : (
                            <p className="text-lg font-black uppercase text-navy-600">
                              {content.secondaryCompanyName || "Hariyana Group"}
                            </p>
                          )}
                          <p className="text-center text-xs font-semibold text-navy-700">
                            {content.secondaryCompanyName || "Hariyana Group"}
                          </p>
                        </div>
                      </div>
                      <p className="px-4 py-3 text-center text-xs italic text-navy-600 sm:px-6">
                        {branding.tagline || "creating landmarks since 1971"}
                      </p>
                    </>
                  )}
                </div>
              )}

              {current.id === "apartment" && (
                <div>
                  <DetailsBanner accentTeal={teal} />
                  <div className="space-y-6 p-4 sm:p-6">
                    <SectionTitle>Details of Residential Apartment Applied For :</SectionTitle>
                    {page1 ? (
                      <CostSheetEngineView
                        costSheet={page1}
                        title="Residential Apartment / Cost Sheet (Read-only)"
                      />
                    ) : (
                      <p className="text-sm text-slate-500">Cost sheet not available.</p>
                    )}
                    <TealCallout accentTeal={teal}>
                      <p className="mb-2 font-bold uppercase">
                        Request you to submit the following KYC documents of all the applicants :
                      </p>
                      <ul className="list-disc space-y-1 pl-5 text-sm">
                        {kycItems.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </TealCallout>
                    <div>
                      <SectionTitle>Details of the Promoter</SectionTitle>
                      <ReadOnlyLine
                        label="Name of the Promoter (Cum Land Owner)"
                        value={content.promoterName}
                      />
                      <ReadOnlyLine label="Address of the Promoter" value={content.promoterAddress} />
                    </div>
                    {content.showLandOwners ? (
                      <div>
                        <SectionTitle>Details of the Land Owner(s)</SectionTitle>
                        <ReadOnlyLine label="Name(s) of the Land Owner(s)" value={content.landOwnerNames} />
                        <ReadOnlyLine
                          label="Address of the Land Owner(s)"
                          value={content.landOwnerAddress}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              {current.id === "project" && (
                <div>
                  <DetailsBanner accentTeal={teal} />
                  <div className="p-4 sm:p-6">
                    <SectionTitle>Details of the Project :</SectionTitle>
                    {content.showLandArea ? (
                      <ReadOnlyLine label="Land Area" value={content.landArea} />
                    ) : null}
                    <ReadOnlyLine label="Project Phase" value={content.projectPhase} />
                    <ReadOnlyLine label="Project Name" value={projectLabel} />
                    <ReadOnlyLine label="Sanction of Plan by" value={content.sanctionBy} />
                    <ReadOnlyLine label="Plan Sanction / LP No." value={content.planSanctionNo} />
                    <ReadOnlyLine
                      label="Web Site under Real Estate (RERA) Rules, 2016"
                      value={content.reraWebsite}
                    />
                    <ReadOnlyLine label="RERA #" value={content.reraNumber} />
                  </div>
                </div>
              )}

              {current.id === "applicant" && (
                <div>
                  <DetailsBanner accentTeal={teal} />
                  <div className="p-4 sm:p-6">
                    <SectionTitle>Details of the Applicant (S) — First Applicant</SectionTitle>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <UnderlineField
                        label="First Name"
                        value={getStr("firstName")}
                        onChange={(v) => setField("firstName", v)}
                      />
                      <UnderlineField
                        label="Surname Name"
                        value={getStr("surname")}
                        onChange={(v) => setField("surname", v)}
                      />
                    </div>
                    <UnderlineField
                      label="Father / Husband Name"
                      value={getStr("fatherHusbandName")}
                      onChange={(v) => setField("fatherHusbandName", v)}
                    />
                    <UnderlineField
                      label="Date of Birth"
                      type="date"
                      value={getStr("dateOfBirth")}
                      onChange={(v) => setField("dateOfBirth", v)}
                    />
                    <CheckboxRow
                      label="Marital Status"
                      options={["Married", "Unmarried"]}
                      value={getStr("maritalStatus")}
                      onChange={(v) => setField("maritalStatus", String(v))}
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <UnderlineField
                        label="PAN No."
                        value={getStr("pan")}
                        onChange={(v) => setField("pan", v)}
                      />
                      <UnderlineField
                        label="AADHAR No."
                        value={getStr("aadhar")}
                        onChange={(v) => setField("aadhar", v)}
                      />
                    </div>
                    <CheckboxRow
                      label="Nationality"
                      options={["Resident", "Non Resident"]}
                      value={getStr("nationality")}
                      onChange={(v) => setField("nationality", String(v))}
                    />
                  </div>
                </div>
              )}

              {current.id === "jointApplicant" && (
                <div>
                  <DetailsBanner accentTeal={teal} />
                  <div className="p-4 sm:p-6">
                    <SectionTitle>Joint Applicants (If Any) — Optional</SectionTitle>
                    <p className="mb-4 text-sm text-slate-500">Skip if there is no joint applicant.</p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <UnderlineField
                        optional
                        label="First Name"
                        value={getStr("firstName")}
                        onChange={(v) => setField("firstName", v)}
                      />
                      <UnderlineField
                        optional
                        label="Surname Name"
                        value={getStr("surname")}
                        onChange={(v) => setField("surname", v)}
                      />
                    </div>
                    <UnderlineField
                      optional
                      label="Father / Husband Name"
                      value={getStr("fatherHusbandName")}
                      onChange={(v) => setField("fatherHusbandName", v)}
                    />
                    <UnderlineField
                      optional
                      label="Date of Birth"
                      type="date"
                      value={getStr("dateOfBirth")}
                      onChange={(v) => setField("dateOfBirth", v)}
                    />
                    <CheckboxRow
                      label="Marital Status"
                      options={["Married", "Unmarried"]}
                      value={getStr("maritalStatus")}
                      onChange={(v) => setField("maritalStatus", String(v))}
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <UnderlineField
                        optional
                        label="PAN No."
                        value={getStr("pan")}
                        onChange={(v) => setField("pan", v)}
                      />
                      <UnderlineField
                        optional
                        label="AADHAR No."
                        value={getStr("aadhar")}
                        onChange={(v) => setField("aadhar", v)}
                      />
                    </div>
                    <CheckboxRow
                      label="Nationality"
                      options={["Resident", "Non Resident"]}
                      value={getStr("nationality")}
                      onChange={(v) => setField("nationality", String(v))}
                    />
                  </div>
                </div>
              )}

              {current.id === "geographic" && (
                <div>
                  <DetailsBanner accentTeal={teal} />
                  <div className="p-4 sm:p-6">
                    <SectionTitle>Geographic Information</SectionTitle>
                    <UnderlineField
                      label="Communication Address"
                      value={getStr("communicationAddress")}
                      onChange={(v) => setField("communicationAddress", v)}
                    />
                    <UnderlineField
                      label="Permanent Address"
                      value={getStr("permanentAddress")}
                      onChange={(v) => setField("permanentAddress", v)}
                    />
                  </div>
                </div>
              )}

              {current.id === "occupation" && (
                <div>
                  <DetailsBanner accentTeal={teal} />
                  <div className="p-4 sm:p-6">
                    <SectionTitle>Occupation — First Applicant</SectionTitle>
                    <CheckboxRow
                      label="Occupation"
                      options={["Employed", "Professional", "Business"]}
                      value={getStr("occupationType")}
                      onChange={(v) => setField("occupationType", String(v))}
                    />
                    <UnderlineField
                      label="Name of the Employer / Organisation / Business House"
                      value={getStr("organizationName")}
                      onChange={(v) => setField("organizationName", v)}
                    />
                    <UnderlineField
                      label="Designation"
                      value={getStr("designation")}
                      onChange={(v) => setField("designation", v)}
                    />
                    <UnderlineField
                      label="Place of Employment / Office / Place of Business"
                      value={getStr("workPlace")}
                      onChange={(v) => setField("workPlace", v)}
                    />

                    <div className="mt-8 border-t border-slate-200 pt-6">
                      <SectionTitle>Occupation — Second Applicant (Optional)</SectionTitle>
                      <CheckboxRow
                        label="Occupation"
                        options={["Employed", "Professional", "Business"]}
                        value={getStr("occupationType2")}
                        onChange={(v) => setField("occupationType2", String(v))}
                      />
                      <UnderlineField
                        optional
                        label="Name of the Employer / Organisation / Business House"
                        value={getStr("organizationName2")}
                        onChange={(v) => setField("organizationName2", v)}
                      />
                      <UnderlineField
                        optional
                        label="Designation"
                        value={getStr("designation2")}
                        onChange={(v) => setField("designation2", v)}
                      />
                      <UnderlineField
                        optional
                        label="Place of Employment / Office / Place of Business"
                        value={getStr("workPlace2")}
                        onChange={(v) => setField("workPlace2", v)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {current.id === "communication" && (
                <div>
                  <DetailsBanner accentTeal={teal} />
                  <div className="p-4 sm:p-6">
                    <SectionTitle>
                      Communication (please tick the preferred mode of contact)
                    </SectionTitle>
                    <UnderlineField
                      label="Mobile No. of the First Applicant"
                      type="tel"
                      value={getStr("mobile")}
                      onChange={(v) => setField("mobile", v)}
                    />
                    <UnderlineField
                      label="Email ID of the First Applicant"
                      type="email"
                      value={getStr("email")}
                      onChange={(v) => setField("email", v)}
                    />
                    <UnderlineField
                      optional
                      label="Mobile No. of the Joint Applicant"
                      type="tel"
                      value={getStr("jointMobile")}
                      onChange={(v) => setField("jointMobile", v)}
                    />
                    <UnderlineField
                      optional
                      label="Email ID of the Joint Applicant"
                      type="email"
                      value={getStr("jointEmail")}
                      onChange={(v) => setField("jointEmail", v)}
                    />
                    <CheckboxRow
                      label="Preferred contact"
                      options={["Mobile (First)", "Email (First)", "Mobile (Joint)", "Email (Joint)"]}
                      multi
                      value={(fields.preferred as string[]) ?? []}
                      onChange={(v) => setField("preferred", v as string[])}
                    />
                  </div>
                </div>
              )}

              {current.id === "sourceOfFund" && (
                <div>
                  <DetailsBanner accentTeal={teal} />
                  <div className="p-4 sm:p-6">
                    <SectionTitle>Source of Fund</SectionTitle>
                    <CheckboxRow
                      label="Funding"
                      options={["Self Funding", "Home Loan"]}
                      value={getStr("fundingType")}
                      onChange={(v) => setField("fundingType", String(v))}
                    />
                    <UnderlineField
                      optional
                      label="Home Loan % required"
                      value={getStr("homeLoanPercent")}
                      onChange={(v) => setField("homeLoanPercent", v)}
                    />
                  </div>
                </div>
              )}

              {current.id === "authority" && (
                <div>
                  <DetailsBanner accentTeal={teal} />
                  <div className="p-4 sm:p-6">
                    <SectionTitle>Authority — Power of Attorney Holder (if any)</SectionTitle>
                    <p className="mb-4 text-sm text-slate-500">Entire section is optional.</p>
                    <UnderlineField
                      optional
                      label="Power of Attorney Holder"
                      value={getStr("authorityName")}
                      onChange={(v) => setField("authorityName", v)}
                    />
                    <UnderlineField
                      optional
                      label="Relationship with the Applicant / Joint Applicant"
                      value={getStr("authorityRelation")}
                      onChange={(v) => setField("authorityRelation", v)}
                    />
                    <UnderlineField
                      optional
                      label="Contact No. of the Authority Holder"
                      type="tel"
                      value={getStr("authorityMobile")}
                      onChange={(v) => setField("authorityMobile", v)}
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <UnderlineField
                        optional
                        label="PAN No."
                        value={getStr("authorityPan")}
                        onChange={(v) => setField("authorityPan", v)}
                      />
                      <UnderlineField
                        optional
                        label="AADHAR No."
                        value={getStr("authorityAadhar")}
                        onChange={(v) => setField("authorityAadhar", v)}
                      />
                    </div>
                    <UnderlineField
                      optional
                      label="Email ID of the Authority Holder"
                      type="email"
                      value={getStr("authorityEmail")}
                      onChange={(v) => setField("authorityEmail", v)}
                    />
                    <UnderlineField
                      optional
                      label="Correspondence address of the Authority Holder"
                      value={getStr("authorityAddress")}
                      onChange={(v) => setField("authorityAddress", v)}
                    />
                  </div>
                </div>
              )}

              {current.id === "sourceOfEnquiry" && (
                <div>
                  <DetailsBanner accentTeal={teal} />
                  <div className="p-4 sm:p-6">
                    <SectionTitle>Source of Enquiry</SectionTitle>
                    <CheckboxRow
                      label="How did you hear about us?"
                      options={ENQUIRY_OPTIONS}
                      multi
                      value={(fields.sources as string[]) ?? []}
                      onChange={(v) => setField("sources", v as string[])}
                    />
                    <UnderlineField
                      label="Details of source"
                      value={getStr("sourceDetails")}
                      onChange={(v) => setField("sourceDetails", v)}
                    />
                  </div>
                </div>
              )}

              {current.id === "realEstateAgents" && (
                <div>
                  <DetailsBanner accentTeal={teal} />
                  <div className="p-4 sm:p-6">
                    <SectionTitle>Real Estate Agents (Optional)</SectionTitle>
                    <p className="mb-4 text-sm text-slate-500">Skip if you are booking directly.</p>
                    {agentDeclaration ? (
                      <TealCallout accentTeal={teal}>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{agentDeclaration}</p>
                        {content.groupDisplayName ? (
                          <p className="mt-2 text-xs font-semibold uppercase tracking-wide opacity-90">
                            {content.groupDisplayName}
                          </p>
                        ) : null}
                      </TealCallout>
                    ) : null}
                    <div className="mt-4">
                      <UnderlineField
                        optional
                        label="Real Estate Agent Name"
                        value={getStr("agentName")}
                        onChange={(v) => setField("agentName", v)}
                      />
                      <UnderlineField
                        optional
                        label="Represented By"
                        value={getStr("representedBy")}
                        onChange={(v) => setField("representedBy", v)}
                      />
                      <div className="grid gap-4 sm:grid-cols-2">
                        <UnderlineField
                          optional
                          label="Contact No."
                          type="tel"
                          value={getStr("agentPhone")}
                          onChange={(v) => setField("agentPhone", v)}
                        />
                        <UnderlineField
                          optional
                          label="Email ID"
                          type="email"
                          value={getStr("agentEmail")}
                          onChange={(v) => setField("agentEmail", v)}
                        />
                      </div>
                      <UnderlineField
                        optional
                        label="Real Estate Agent RERA Registration #"
                        value={getStr("reraNumber")}
                        onChange={(v) => setField("reraNumber", v)}
                        placeholder="Optional — leave blank if not applicable"
                      />
                    </div>
                  </div>
                </div>
              )}

              {current.id === "earnestDeposit" && (
                <div>
                  <DetailsBanner accentTeal={teal} />
                  <div className="p-4 sm:p-6">
                    <SectionTitle>Refundable Earnest Amount Deposit Details (READ)</SectionTitle>
                    <UnderlineField
                      label="Wire transfer / Cheque / Draft No."
                      value={getStr("instrumentNo")}
                      onChange={(v) => setField("instrumentNo", v)}
                    />
                    <UnderlineField
                      optional
                      label="UPI Transaction No."
                      value={getStr("upiNo")}
                      onChange={(v) => setField("upiNo", v)}
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <UnderlineField
                        label="Dated"
                        type="date"
                        value={getStr("dated")}
                        onChange={(v) => setField("dated", v)}
                      />
                      <UnderlineField
                        label="Drawn on"
                        value={getStr("drawnOn")}
                        onChange={(v) => setField("drawnOn", v)}
                      />
                      <UnderlineField
                        label="Place"
                        value={getStr("place")}
                        onChange={(v) => setField("place", v)}
                      />
                      <UnderlineField
                        label="Amount"
                        value={getStr("amount")}
                        onChange={(v) => setField("amount", v)}
                      />
                    </div>
                    <UnderlineField
                      label="In words"
                      value={getStr("amountInWords") || amountInWords(Number(getStr("amount")))}
                      onChange={(v) => setField("amountInWords", v)}
                    />
                    <p className="mt-4 text-sm text-navy-700">
                      In favour of{" "}
                      <YellowHighlight>
                        {content.collectionAccountName || "RERA COLLECTION ACCOUNT"}
                      </YellowHighlight>{" "}
                      — Payable at {content.payableAt || "Bangalore"}.
                    </p>
                  </div>
                </div>
              )}

              {current.id === "terms" && (
                <div>
                  <div
                    className="px-4 py-3 text-center text-lg font-black uppercase tracking-wide text-navy-600 sm:text-2xl"
                    style={{ backgroundColor: teal }}
                  >
                    Terms &amp; Conditions
                  </div>
                  <div className="space-y-6 p-4 sm:p-6">
                    <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                      {termsRendered}
                    </div>
                    <div>
                      <SectionTitle>Declaration</SectionTitle>
                      <TealCallout accentTeal={teal}>
                        <p className="whitespace-pre-wrap">
                          {content.declarationText ||
                            "I/We hereby declare that the particulars given herein are true and correct to the best of my/our knowledge."}
                        </p>
                      </TealCallout>
                    </div>
                    <div className="mb-4">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-navy-600">
                          I / We accept the terms and declaration
                        </p>
                        <FieldTick done={getStr("accepted") === "yes"} />
                      </div>
                      <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-navy-700">
                        <button
                          type="button"
                          onClick={() =>
                            setField("accepted", getStr("accepted") === "yes" ? "" : "yes")
                          }
                          className={`flex h-4 w-4 items-center justify-center border-2 border-navy-600 ${
                            getStr("accepted") === "yes" ? "bg-navy-600 text-white" : "bg-white"
                          }`}
                        >
                          {getStr("accepted") === "yes" ? "✓" : ""}
                        </button>
                        Accept
                      </label>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <UnderlineField
                        label="Date"
                        type="date"
                        value={getStr("signDate")}
                        onChange={(v) => setField("signDate", v)}
                      />
                      <UnderlineField
                        label="Place"
                        value={getStr("signPlace")}
                        onChange={(v) => setField("signPlace", v)}
                      />
                    </div>
                    <p className="text-xs text-slate-500">
                      Applicant signatures will be collected at the sales office.
                    </p>

                    <div className="rounded-sm border border-slate-200 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="font-semibold text-navy-600">Verify Identity (OTP)</h3>
                        <FieldTick done={otpVerified} />
                      </div>
                      {otpVerified ? (
                        <p className="text-sm text-emerald-700">Identity verified</p>
                      ) : (
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              const res = await fetch(`/api/booking/${token}/otp/send`, {
                                method: "POST",
                              });
                              const d = await parseJsonSafe(res);
                              if (res.ok) {
                                setOtpSent(true);
                                toast.success("OTP sent");
                                if (d.devOtp) toast.message(`Dev OTP: ${d.devOtp}`);
                              } else
                                toast.error(
                                  typeof d.error === "string" ? d.error : "Failed to send OTP"
                                );
                            }}
                          >
                            {otpSent ? "Resend OTP" : "Send OTP"}
                          </Button>
                          <input
                            className="flex-1 border-b-2 border-navy-600/40 bg-transparent px-2 py-1 text-sm outline-none"
                            placeholder="6-digit OTP"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                          />
                          <Button
                            size="sm"
                            disabled={otp.length !== 6}
                            onClick={async () => {
                              const res = await fetch(`/api/booking/${token}/otp/verify`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ otp }),
                              });
                              if (res.ok) {
                                setOtpVerified(true);
                                toast.success("Verified");
                              } else toast.error("Invalid OTP");
                            }}
                          >
                            Verify
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="rounded-sm border border-slate-200 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="font-semibold text-navy-600">Upload KYC Documents</h3>
                        <FieldTick
                          done={docsUploaded.includes("PAN") && docsUploaded.includes("AADHAAR")}
                        />
                      </div>
                      <form
                        className="space-y-2"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const formEl = e.currentTarget;
                          const fd = new FormData(formEl);
                          const type = String(fd.get("type") ?? "");
                          const res = await fetch(`/api/booking/${token}/documents`, {
                            method: "POST",
                            body: fd,
                          });
                          if (res.ok) {
                            toast.success("Document uploaded");
                            setDocsUploaded((prev) =>
                              prev.includes(type) ? prev : [...prev, type]
                            );
                            formEl.reset();
                          } else toast.error("Upload failed");
                        }}
                      >
                        <select name="type" className="w-full rounded border px-3 py-2 text-sm">
                          <option value="PAN">PAN Card</option>
                          <option value="AADHAAR">Aadhaar Card</option>
                        </select>
                        <input
                          type="file"
                          name="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          required
                          className="w-full text-sm"
                        />
                        <Button type="submit" size="sm">
                          Upload
                        </Button>
                      </form>
                    </div>

                    <div className="border-t pt-4 text-center text-xs text-navy-600">
                      <p className="font-bold">{content.promoterName}</p>
                      <p>{content.officeAddress}</p>
                      <p>
                        E: {content.officeEmail || branding.supportEmail} | C: {content.supportPhone}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {current.id === "consent" && content.showConsentPage && (
                <div>
                  <DetailsBanner label="ACKNOWLEDGED AND AGREED" accentTeal={teal} />
                  <div className="space-y-5 p-4 sm:p-6">
                    <div className="space-y-1 text-sm text-navy-700">
                      <p>
                        <span className="font-semibold">To :</span>{" "}
                        {content.consentTo || content.promoterName}
                      </p>
                      <p className="pl-8 text-xs">{content.officeAddress}</p>
                    </div>
                    <p className="text-sm text-navy-700">
                      <span className="font-semibold">Subject :</span> {content.consentSubject}
                    </p>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <UnderlineField
                        label="Name"
                        value={getStr("name")}
                        onChange={(v) => setField("name", v)}
                      />
                      <UnderlineField
                        label="S/o / D/o / W/o"
                        value={getStr("relative")}
                        onChange={(v) => setField("relative", v)}
                      />
                      <UnderlineField
                        label="Age (years)"
                        value={getStr("age")}
                        onChange={(v) => setField("age", v)}
                      />
                      <UnderlineField
                        label="Residing at"
                        value={getStr("address")}
                        onChange={(v) => setField("address", v)}
                      />
                    </div>

                    {consentIntroRendered ? (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-navy-700">
                        {consentIntroRendered}
                      </p>
                    ) : null}

                    <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                      {(content.consentBodyText || "")
                        .replace(/\{\{projectName\}\}/g, projectLabel)
                        .replace(
                          /\{\{landSurveyDetails\}\}/g,
                          content.landSurveyDetails || "________"
                        )}
                    </div>

                    <ReadOnlyLine label="Unit No" value={unitNo || "—"} />

                    <TealCallout accentTeal={teal}>
                      <p className="mb-2 font-bold uppercase">Declaration</p>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {content.consentDeclarationBox || content.declarationText}
                      </p>
                    </TealCallout>

                    <div className="mb-4">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-navy-600">
                          I / We acknowledge and agree to the above consent
                        </p>
                        <FieldTick done={getStr("accepted") === "yes"} />
                      </div>
                      <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-navy-700">
                        <button
                          type="button"
                          onClick={() =>
                            setField("accepted", getStr("accepted") === "yes" ? "" : "yes")
                          }
                          className={`flex h-4 w-4 items-center justify-center border-2 border-navy-600 ${
                            getStr("accepted") === "yes" ? "bg-navy-600 text-white" : "bg-white"
                          }`}
                        >
                          {getStr("accepted") === "yes" ? "✓" : ""}
                        </button>
                        Accept
                      </label>
                    </div>

                    <p className="rounded-sm border border-dashed border-navy-600/30 bg-slate-50 px-3 py-2 text-xs text-navy-600">
                      Please visit the sales office to sign this consent. Soft copy submission is
                      accepted pending wet-ink signatures at the office (
                      {content.officeAddress || branding.companyName}).
                    </p>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3 border-t border-slate-200 px-4 py-4 sm:px-6">
                <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
                  Previous
                </Button>
                {!isViewOnly(current) ? (
                  <Button variant="outline" onClick={saveStep}>
                    Save
                  </Button>
                ) : null}
                {current.optional ? (
                  <Button
                    variant="outline"
                    onClick={async () => {
                      setFormData((prev) => ({
                        ...prev,
                        [current.id]: prev[current.id] ?? {},
                      }));
                      await saveStep();
                      if (step < STEPS.length - 1) setStep((s) => s + 1);
                    }}
                  >
                    Skip
                  </Button>
                ) : null}
                {step < STEPS.length - 1 ? (
                  <Button onClick={goNext} style={{ backgroundColor: teal }}>
                    Next
                  </Button>
                ) : (
                  <Button onClick={submit} disabled={!otpVerified} style={{ backgroundColor: teal }}>
                    Submit Booking Form
                  </Button>
                )}
              </div>
            </PaperFormShell>
          </>
        )}
      </div>
    </div>
  );
}
