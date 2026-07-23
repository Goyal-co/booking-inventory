import type { CostSheetResult } from "./types";
import { normalizeMediaUrl } from "./media-url";
import { amountToIndianWords } from "./amount-words";

export * from "./types";
export * from "./sample-data";
export { normalizeMediaUrl } from "./media-url";
export { amountToIndianWords } from "./amount-words";

function inr(n: number) {
  return `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function num(n: number | null | undefined) {
  if (n == null || !Number.isFinite(Number(n))) return "";
  return Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function esc(v: unknown) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function val(step: Record<string, unknown> | undefined, key: string) {
  if (!step) return "";
  const v = step[key];
  if (Array.isArray(v)) return v.length ? v.map(String).join(", ") : "";
  if (v == null || String(v).trim() === "") return "";
  return String(v);
}

function asList(step: Record<string, unknown> | undefined, key: string): string[] {
  if (!step) return [];
  const v = step[key];
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === "string" && v.trim()) {
    return v.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function listHas(list: string[], opt: string) {
  const o = opt.toLowerCase();
  return list.some((s) => {
    const x = s.toLowerCase();
    return x === o || x.includes(o) || o.includes(x);
  });
}

function yesNo(v: unknown) {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return "";
  if (s === "yes" || s === "true" || s === "1" || s === "accepted") return "Yes";
  if (s === "no" || s === "false" || s === "0") return "No";
  return String(v);
}

function mapNationality(raw: string) {
  const s = raw.toLowerCase();
  if (!s) return "";
  if (s.includes("non") || s.includes("nri") || s.includes("oci") || s.includes("pio")) {
    return "Non Resident";
  }
  if (s.includes("resident") || s.includes("indian") || s === "india") return "Resident";
  return raw;
}

function mapOccupation(raw: string) {
  const s = raw.toLowerCase();
  if (!s) return "";
  if (s.includes("employ") || s.includes("salaried") || s.includes("service")) return "Employed";
  if (s.includes("profess")) return "Professional";
  if (s.includes("business") || s.includes("self")) return "Business";
  return raw;
}

function mapFunding(raw: string) {
  const s = raw.toLowerCase();
  if (!s) return "";
  if (s.includes("self")) return "Self Funding";
  if (s.includes("loan") || s.includes("home")) return "Home Loan";
  return raw;
}

function display(v: unknown) {
  const s = String(v ?? "").trim();
  return s && s !== "—" ? s : "";
}

/** Label + filled underline (paper booking form style — not a table). */
function uline(label: string, value: unknown, opts?: { full?: boolean; className?: string }) {
  const text = display(value);
  return `<div class="uline ${opts?.full ? "uline-full" : ""} ${opts?.className || ""}">
  <span class="ulabel">${esc(label)} :</span>
  <span class="uvalue">${text ? esc(text) : "&nbsp;"}</span>
</div>`;
}

function ulinePair(a: [string, unknown], b: [string, unknown]) {
  return `<div class="uline-row">${uline(a[0], a[1])}${uline(b[0], b[1])}</div>`;
}

function ulineTriple(a: [string, unknown], b: [string, unknown], c: [string, unknown]) {
  return `<div class="uline-row three">${uline(a[0], a[1])}${uline(b[0], b[1])}${uline(c[0], c[1])}</div>`;
}

function checkboxes(label: string | null, options: string[], selected: string | string[]) {
  const sel = Array.isArray(selected)
    ? selected.map((s) => String(s))
    : selected
      ? [String(selected)]
      : [];
  const boxes = options
    .map((opt) => {
      const on = listHas(sel, opt);
      return `<label class="chk"><span class="box">${on ? "✓" : ""}</span> ${esc(opt)}</label>`;
    })
    .join("");
  return `<div class="chk-row">${label ? `<span class="ulabel">${esc(label)} :</span>` : ""}${boxes}</div>`;
}

function preferredTick(preferred: string[], keys: string[]) {
  const on = keys.some((k) => listHas(preferred, k));
  return `<span class="box" style="margin-right:6px">${on ? "✓" : ""}</span>`;
}

function sectionTitle(title: string) {
  return `<h3 class="sec-title">${esc(title)}</h3>`;
}

function detailsBanner(label: string, teal: string, navy: string) {
  return `<div class="details-banner">
  <div class="details-stripe" style="background-image:repeating-linear-gradient(-45deg,${teal} 0 4px,${navy} 4px 8px)"></div>
  <div class="details-label" style="background:${teal};color:${navy}">${esc(label)}</div>
</div>`;
}

function tealBanner(label: string, teal: string, navy: string) {
  return `<div class="teal-banner" style="background:${teal};color:${navy}">${esc(label)}</div>`;
}

function wingOf(result: CostSheetResult) {
  return result.wing || result.towerName || "";
}

function apartmentOf(result: CostSheetResult) {
  return result.apartmentNo || result.unitNumber || "";
}

function accommodationOf(result: CostSheetResult) {
  return result.accommodationType || result.configuration || "";
}

function floorOf(result: CostSheetResult) {
  return result.floorLabel || (result.floor != null ? String(result.floor) : "");
}

function amountInWordsFallback(n: number) {
  return amountToIndianWords(n);
}

/** Standalone / embeddable cost sheet — paper underline layout (full HTML document). */
export function costSheetToHtml(
  result: CostSheetResult,
  meta: {
    projectName: string;
    unitNumber: string;
    towerName: string;
    customerName?: string;
  }
) {
  const teal = "#2BB8C8";
  const navy = "#1E3A5F";
  const body = apartmentDetailsPaper(result, meta);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Cost Sheet — ${esc(meta.projectName)}</title>
<style>${paperCss(teal, navy)}</style></head><body>
<div class="no-print" style="padding:12px 16px"><button onclick="window.print()" style="background:${teal};color:#fff;border:0;padding:10px 18px;border-radius:6px;font-weight:600;cursor:pointer">Print / Save as PDF</button></div>
<div class="page">
  <div class="page-inner">
    ${detailsBanner("COST SHEET", teal, navy)}
    <p class="meta-line">${esc(meta.projectName)} · Unit ${esc(meta.unitNumber || apartmentOf(result))} · ${esc(meta.customerName || "")}</p>
    ${body}
  </div>
</div>
</body></html>`;
}

function apartmentDetailsPaper(
  result: CostSheetResult,
  meta: {
    projectName: string;
    unitNumber: string;
    towerName: string;
    carParks?: string;
    includePaymentSchedule?: boolean;
  }
) {
  const unit = apartmentOf(result) || meta.unitNumber;
  const wing = wingOf(result) || meta.towerName;
  const otherTotal = result.otherChargesTotal;

  return `
${sectionTitle("Details of Residential Apartment Applied For")}
${ulineTriple(
  ["Type of Apartment", accommodationOf(result)],
  ["Unit No", unit],
  ["Wing", wing]
)}
${uline("Saleable Area / Super builtup area in sqft", num(result.saleableAreaSqft), { full: true })}
${ulinePair(
  ["Carpet area in sqft*", num(result.carpetAreaSqft)],
  ["Carpet area in sqmt*", num(result.carpetAreaSqm)]
)}
<p class="note">* Carpet Area as per RERA</p>
${ulinePair(
  ["Exclusive balcony area in sqft", num(result.balconyAreaSqft)],
  ["Exclusive balcony area in sqmt", num(result.balconyAreaSqm)]
)}
${uline("No of car parks", meta.carParks || "", { full: true })}
${uline(
  "Unit Price per sqft on saleable area / super builtup area (Rs)",
  inr(result.saleablePricePerSqft),
  { full: true }
)}
${uline("Unit Price per sqft on carpet area (Rs)", inr(result.carpetPricePerSqft), { full: true })}
${uline("Basic Sale Value (Rs)", inr(result.basicSaleValue), { full: true })}
${uline(`GST (${result.gstPercent ?? 5}%) (Rs)`, inr(result.gstAmount), { full: true })}
${uline("Basic Sale Value with GST (A) (Rs)", inr(result.basicSaleValueWithGst), { full: true })}
${uline(
  "Other cost charges & expenses (B) (Rs)",
  inr(otherTotal),
  { full: true }
)}
<p class="note">Inclusive of GST as applicable</p>
${uline("Gross Apartment Value (A+B) (Rs)", inr(result.grossApartmentValue), { full: true })}
${uline("In words (Rs)", amountInWordsFallback(result.grossApartmentValue), { full: true })}
${uline("Offers if applicable", "", { full: true })}
${
  meta.includePaymentSchedule !== false && result.paymentSchedule?.length
    ? `<div class="pay-sched">
  ${sectionTitle("Payment Schedule")}
  ${result.paymentSchedule
    .map((s) =>
      uline(
        s.stageName + (s.percentage != null ? ` (${s.percentage}%)` : ""),
        inr(s.amount),
        { full: true }
      )
    )
    .join("")}
</div>`
    : ""
}`;
}

function kycBox(checklist: string, teal: string, navy: string) {
  const items = checklist
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!items.length) return "";
  const half = Math.ceil(items.length / 2);
  const col = (arr: string[]) =>
    arr.map((i) => `<li><span class="sq"></span> ${esc(i)}</li>`).join("");
  return `
${sectionTitle("Request you to submit the following KYC documents of all the applicants :")}
<div class="kyc-box" style="background:${teal};color:${navy}">
  <ul class="kyc-col">${col(items.slice(0, half))}</ul>
  <ul class="kyc-col">${col(items.slice(half))}</ul>
</div>`;
}

function paperCss(teal: string, navy: string, fontScale = 1.35) {
  const s = Math.min(1.7, Math.max(1, fontScale || 1.35));
  const px = (n: number) => `${+(n * s).toFixed(2)}px`;
  // Slightly tighten large vertical gaps as text grows so pages fill better
  const space = (n: number) => `${+((n * (0.8 + 0.2 / s)) * s).toFixed(2)}px`;
  // Base 12px × scale applies to every page (labels, values, notes inherit)
  const bodyPx = +(12 * s).toFixed(2);
  return `
@page{size:A4 portrait;margin:0}
*{box-sizing:border-box}
html{font-size:${bodyPx}px}
html,body{width:210mm;margin:0;padding:0;background:#fff}
body{font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:${navy};font-size:1rem;line-height:1.4}
.page{position:relative;width:210mm;height:297mm;overflow:hidden;padding:9mm 9mm 10mm 15mm;border-right:2.5mm solid ${teal};break-after:page;page-break-after:always}
.page:last-child{break-after:auto;page-break-after:auto}
.page::before{content:"";position:absolute;left:0;top:0;bottom:0;width:18px;background-image:repeating-linear-gradient(-45deg,${navy} 0 5px,#152a45 5px 10px)}
.page-inner{position:relative;height:100%}
.cover{display:flex;flex-direction:column;height:100%;padding:2mm 3mm 4mm}
.cover-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:${space(28)};font-size:1rem}
.apt-boxes{display:inline-flex;gap:4px;vertical-align:middle}
.apt-boxes span{display:inline-block;width:18px;height:22px;border:1.5px solid ${navy}}
.cover-title{text-align:center;font-size:${px(20)};font-weight:800;letter-spacing:.02em;text-transform:uppercase;color:${navy};margin:${space(14)} 0 ${space(16)};line-height:1.35}
.cover-logo{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;margin:0 auto;max-width:320px;width:100%}
.cover-logo img{max-width:100%;max-height:180px;object-fit:contain}
.cover-project{text-align:center;font-size:${px(28)};font-weight:300;letter-spacing:.08em;color:#64748B;margin-top:8px}
.cover-project strong{display:block;font-size:${px(36)};font-weight:800;color:${navy};letter-spacing:.04em;margin-top:4px}
.cover-foot{margin-top:auto;text-align:center;padding-top:${space(28)}}
.dual-logos{display:flex;align-items:center;justify-content:center;gap:28px;margin-bottom:12px}
.dual-logos img{max-height:56px;max-width:140px;object-fit:contain}
.dual-logos .divider{width:1px;height:48px;background:${navy};opacity:.35}
.tagline{font-style:italic;font-size:${px(13)};color:#0f172a}
.details-banner{display:flex;margin:0 0 12px -8px;break-inside:avoid;break-after:avoid}
.details-stripe{width:36px;flex-shrink:0}
.details-label{flex:1;padding:7px 14px;font-size:${px(21)};font-weight:900;letter-spacing:.04em;text-transform:uppercase}
.teal-banner{text-align:center;padding:9px 14px;font-size:${px(19)};font-weight:900;letter-spacing:.06em;text-transform:uppercase;margin:0 0 14px}
.sec-title{margin:${space(10)} 0 7px;font-size:${px(13)};font-weight:800;text-transform:uppercase;color:${navy};letter-spacing:.03em;break-after:avoid}
.uline{display:flex;align-items:baseline;gap:5px;margin:5px 0;min-width:0;flex:1;break-inside:avoid;font-size:1rem}
.uline-full{width:100%}
.uline-row{display:flex;gap:18px;margin:6px 0;break-inside:avoid}
.uline-row.three .uline{flex:1}
.ulabel{flex-shrink:0;font-weight:600;color:${navy};white-space:nowrap;font-size:1rem}
.uvalue{flex:1;min-width:40px;border-bottom:1.5px solid ${navy};padding:0 4px 2px;font-weight:500;color:#0f172a;min-height:1.2em;font-size:1rem}
.chk-row{display:flex;flex-wrap:wrap;align-items:center;gap:7px 13px;margin:6px 0;break-inside:avoid}
.chk{display:inline-flex;align-items:center;gap:6px;font-size:1rem}
.box{display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;border:1.5px solid ${navy};font-size:${px(11)};line-height:1;flex-shrink:0}
.note{font-size:${px(11)};color:#64748B;margin:2px 0 8px 0}
.meta-line{font-size:1rem;color:#64748B;margin:0 0 12px}
.kyc-box{display:flex;gap:20px;padding:9px 14px;margin:6px 0 12px;border-radius:2px;break-inside:avoid}
.kyc-col{margin:0;padding:0;list-style:none;flex:1}
.kyc-col li{display:flex;align-items:flex-start;gap:8px;margin:6px 0;font-weight:600;font-size:1rem}
.sq{display:inline-block;width:10px;height:10px;border:1.5px solid currentColor;margin-top:3px;flex-shrink:0;background:transparent}
.prose{font-size:${px(11)};line-height:1.45;color:#475569;white-space:pre-wrap}
.prose-terms{font-size:${px(9.25)};line-height:1.32;color:#334155;white-space:pre-wrap}
.callout{background:${teal};color:${navy};padding:10px 12px;font-size:${px(11)};line-height:1.45;margin:7px 0;white-space:pre-wrap;break-inside:avoid}
.sign-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px 32px;margin-top:${space(16)};break-inside:avoid}
.sign-line{border-top:1.5px solid ${navy};margin-top:${space(18)};padding-top:5px;font-size:${px(11)}}
.footer-block{margin-top:${space(22)};text-align:center;font-size:1rem;color:#334155}
.footer-block strong{display:block;font-size:${px(13)};color:${navy};margin-bottom:4px}
.enquiry-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;margin:8px 0 12px;font-size:1rem}
.preview-ribbon{background:#FEF3C7;color:#92400E;text-align:center;font-weight:700;font-size:${px(12)};padding:8px;margin:0 0 12px;letter-spacing:.04em}
.no-print{margin-bottom:12px}
@media screen{body{background:#e5e7eb}.page{margin:0 auto 16px;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.15)}}
@media print{html,body{width:210mm}.no-print{display:none!important}.page{margin:0;box-shadow:none}}
`;
}

type LayoutBlock = {
  id: string;
  visible?: boolean;
  order?: number;
  x?: number;
  y?: number;
  w?: number;
};

type PrintLayoutOpt = {
  mode?: "flow" | "freeform";
  blocks?: LayoutBlock[];
  fontScale?: number;
};

export type PrintBranding = {
  logoUrl?: string | null;
  companyName?: string | null;
  tagline?: string | null;
  formTitle?: string | null;
  supportEmail?: string | null;
  primaryColor?: string | null;
  projectName?: string | null;
  unitNumber?: string | null;
  content?: Record<string, unknown> | null;
};

export type PrintFormOptions = {
  templateHtml?: string;
  branding?: PrintBranding;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  preview?: boolean;
  /** Filled after booking approval (sales executive who owns the booking). */
  salesAdvisorName?: string | null;
  /** Filled after booking approval (admin who approved). */
  approvedByName?: string | null;
};

function wrapBlock(id: string, html: string, layout?: PrintLayoutOpt) {
  if (!html) return "";
  const block = layout?.blocks?.find((b) => b.id === id);
  if (block && block.visible === false) return "";
  if (layout?.mode === "freeform" && block) {
    const x = Math.max(0, Math.min(100, Number(block.x ?? 0)));
    const y = Math.max(0, Number(block.y ?? 0));
    const w = Math.max(10, Math.min(100, Number(block.w ?? 100)));
    return `<div class="layout-block" data-block="${esc(id)}" style="left:${x}%;top:${y}%;width:${w}%">${html}</div>`;
  }
  return `<div class="layout-block flow" data-block="${esc(id)}">${html}</div>`;
}

function orderedIds(layout?: PrintLayoutOpt, fallback: string[] = []): string[] {
  const blocks = layout?.blocks ?? [];
  if (!blocks.length) return fallback;
  return [...blocks]
    .filter((b) => b.visible !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((b) => b.id);
}

function page(inner: string) {
  return `<div class="page"><div class="page-inner">${inner}</div></div>`;
}

/** Single-page terms: shrink font so all clauses fit without clipping. */
function buildTermsPage(params: {
  termsText: string;
  teal: string;
  navy: string;
  termsAccepted: string[];
  signDate: string;
  signPlace: string;
  fontScale: number;
}) {
  const raw = String(params.termsText || "").trim();
  const lineCount = raw ? raw.split(/\n/).filter((l) => l.trim()).length : 0;
  const charCount = raw.length;
  // Fit long terms on one A4: denser type as content grows (independent of global print scale a bit)
  const density =
    charCount > 4200 || lineCount > 28
      ? 0.72
      : charCount > 3200 || lineCount > 22
        ? 0.78
        : charCount > 2200 || lineCount > 16
          ? 0.85
          : charCount > 1400 || lineCount > 12
            ? 0.92
            : 1;
  const scale = Math.min(1.7, Math.max(1, params.fontScale || 1.35));
  const termsPx = Math.max(7.5, +(9.25 * scale * density).toFixed(2));
  const lineHeight = density < 0.8 ? 1.22 : density < 0.9 ? 1.28 : 1.32;
  const body = esc(raw).replace(/\n/g, "<br/>");

  return page(`
${tealBanner("TERMS & CONDITIONS", params.teal, params.navy)}
<div class="prose prose-terms" style="font-size:${termsPx}px;line-height:${lineHeight}">${body}</div>
${checkboxes("Terms accepted", ["Yes"], params.termsAccepted)}
<div class="sign-grid">
  <div>${uline("Date", params.signDate)}${uline("Place", params.signPlace)}</div>
  <div>
    <div class="sign-line">Applicant Signature : 1</div>
    <div class="sign-line">Applicant Signature : 2</div>
  </div>
</div>
`);
}

export function digitalFormToPrintHtml(
  form: {
    page1Snapshot: Record<string, unknown>;
    formData: Record<string, unknown> | null;
  },
  options?: PrintFormOptions
) {
  const page1 = form.page1Snapshot as unknown as CostSheetResult;
  const fd = (form.formData ?? {}) as Record<string, Record<string, unknown>>;
  const branding = options?.branding ?? {};
  const content = (branding.content ?? {}) as Record<string, unknown>;
  const layout = (content.printLayout ?? null) as PrintLayoutOpt | null;
  const teal = String(content.accentTeal || branding.primaryColor || "#2BB8C8");
  const navy = String(content.accentNavy || "#1E3A5F");
  const projectName = String(
    content.projectDisplayName || branding.projectName || page1.projectName || ""
  );
  const projectLine2 = String(content.projectNameLine2 || "");
  const fullProject = `${projectName}${projectLine2 ? ` ${projectLine2}` : ""}`.trim();
  const unitNumber = String(
    branding.unitNumber || page1.apartmentNo || page1.unitNumber || ""
  );
  const applicant = fd.applicant ?? {};
  const customerName =
    options?.customerName ||
    [val(applicant, "firstName"), val(applicant, "surname")].filter(Boolean).join(" ") ||
    val(applicant, "fullName");

  const costOnly = apartmentDetailsPaper(page1, {
    projectName: fullProject,
    unitNumber,
    towerName: String(page1.wing ?? page1.towerName ?? ""),
    carParks: String(
      (page1 as unknown as Record<string, unknown>).carParks ??
        (page1 as unknown as Record<string, unknown>).noOfCarParks ??
        ""
    ),
    // The physical booking form only shows apartment totals. The detailed
    // milestone schedule is a separate cost-sheet document and caused this
    // booking-form page to overflow onto the next PDF page.
    includePaymentSchedule: false,
  });

  if (options?.templateHtml) {
    return options.templateHtml
      .replace(/\{\{page1\}\}/g, costOnly)
      .replace(/\{\{formData\}\}/g, JSON.stringify(form.formData ?? {}, null, 2))
      .replace(/\{\{customerName\}\}/g, esc(customerName));
  }

  const joint = fd.jointApplicant ?? {};
  const geo = fd.geographic ?? {};
  const occ = fd.occupation ?? {};
  const comm = fd.communication ?? {};
  const fund = fd.sourceOfFund ?? {};
  const auth = fd.authority ?? {};
  const enquiry = fd.sourceOfEnquiry ?? {};
  const agent = fd.realEstateAgents ?? {};
  const deposit = fd.earnestDeposit ?? {};
  const terms = fd.terms ?? {};
  const consent = fd.consent ?? {};
  const cover = fd.cover ?? {};

  const showLandOwners =
    Boolean(content.showLandOwners) &&
    layout?.blocks?.find((b) => b.id === "landOwners")?.visible !== false;
  const showConsent =
    Boolean(content.showConsentPage) &&
    layout?.blocks?.find((b) => b.id === "consent")?.visible !== false;

  const coverDate = val(cover, "date") || val(terms, "signDate");
  const aptDigits = unitNumber.replace(/\D/g, "").slice(0, 5).padEnd(5, " ");
  const aptBoxes = aptDigits
    .split("")
    .map((d) => `<span>${d.trim() ? esc(d) : ""}</span>`)
    .join("");

  const projectLogo = normalizeMediaUrl(
    String(content.projectLogoUrl || content.heroImageUrl || "")
  );
  const secondaryLogo = normalizeMediaUrl(String(content.secondaryLogoUrl || ""));
  const companyLogo = normalizeMediaUrl(branding.logoUrl);

  const marital = val(applicant, "maritalStatus");
  const jointMarital = val(joint, "maritalStatus");
  const nationality = mapNationality(val(applicant, "nationality"));
  const jointNat = mapNationality(val(joint, "nationality"));

  const fundingRaw = mapFunding(val(fund, "fundingType") || val(fund, "source"));
  let enquirySources = asList(enquiry, "sources");
  if (!enquirySources.length && val(enquiry, "source")) {
    enquirySources = asList(enquiry, "source");
  }
  const preferred = asList(comm, "preferred");
  const enquiryList = [
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

  const mobile1 = options?.customerPhone || val(comm, "mobile");
  const email1 = options?.customerEmail || val(comm, "email");
  const mobile2 = val(comm, "jointMobile") || val(comm, "mobile2") || val(joint, "mobile");
  const email2 = val(comm, "jointEmail") || val(comm, "email2") || val(joint, "email");
  const occ1 = mapOccupation(val(occ, "occupationType") || val(occ, "occupation"));
  const occ2 = mapOccupation(val(occ, "occupationType2"));
  const termsAccepted = yesNo(val(terms, "accepted"));
  const consentAccepted = yesNo(val(consent, "accepted"));

  const parts: Record<string, string> = {
    header: page(`
<div class="cover">
  <div class="cover-top">
    <div>${uline("DATE", coverDate)}</div>
    <div><span class="ulabel">Apartment No :</span> <span class="apt-boxes">${aptBoxes}</span></div>
  </div>
  <div class="cover-title">${esc(
    branding.formTitle || "APPLICATION FOR ALLOTMENT OF A RESIDENTIAL UNIT IN"
  )}</div>
  <div class="cover-logo">
    ${projectLogo ? `<img src="${esc(projectLogo)}" alt="project" referrerpolicy="no-referrer"/>` : ""}
    <div class="cover-project">
      ${esc(projectName || "ORCHID")}
      ${projectLine2 ? `<strong>${esc(projectLine2)}</strong>` : ""}
    </div>
  </div>
  <div class="cover-foot">
    <div class="dual-logos">
      ${companyLogo ? `<img src="${esc(companyLogo)}" alt="company" referrerpolicy="no-referrer"/>` : `<strong>${esc(branding.companyName || "Goyal & Co.")}</strong>`}
      <div class="divider"></div>
      ${
        secondaryLogo
          ? `<img src="${esc(secondaryLogo)}" alt="secondary" referrerpolicy="no-referrer"/>`
          : `<strong>${esc(String(content.secondaryCompanyName || "Hariyana Group"))}</strong>`
      }
    </div>
    <div class="tagline">${esc(branding.tagline || "creating landmarks since 1971")}</div>
  </div>
</div>`),

    cover: "", // covered by header/cover page

    costSheet: page(`
${costOnly}
${kycBox(String(content.kycChecklist || ""), teal, navy)}
${detailsBanner("DETAILS", teal, navy)}
${sectionTitle("Details of the Promoter")}
${uline("Name", content.promoterName, { full: true })}
${uline("Address", content.promoterAddress, { full: true })}
${
  showLandOwners
    ? `${sectionTitle("Details of the Land Owner")}
${uline("Name of the Owners", content.landOwnerNames, { full: true })}
${uline("Address of the Owners", content.landOwnerAddress, { full: true })}`
    : ""
}`),

    promoter: "", // merged into costSheet page for paper fidelity
    landOwners: "",
    projectDetails: page(`
${detailsBanner("DETAILS", teal, navy)}
${sectionTitle("Details of the Project")}
${uline("Project Phase", content.projectPhase, { full: true })}
${uline("Project Name", fullProject, { full: true })}
${uline("Sanction of Plan by", content.sanctionBy, { full: true })}
${uline("Plan Sanction / LP No.", content.planSanctionNo, { full: true })}
${uline("Website (RERA)", content.reraWebsite, { full: true })}
${uline("RERA #", content.reraNumber, { full: true })}
${sectionTitle("Details of the First Applicant (S)")}
${uline("First Name", val(applicant, "firstName"), { full: true })}
${uline("Surname Name", val(applicant, "surname"), { full: true })}
${uline(
  "Father / Spouse Name",
  val(applicant, "fatherHusbandName") || val(applicant, "fatherSpouseName"),
  { full: true }
)}
${uline("Date of Birth", val(applicant, "dateOfBirth"), { full: true })}
${checkboxes("Marital Status", ["Married", "Unmarried"], marital)}
${ulinePair(["PAN No.", val(applicant, "pan")], ["AADHAR No.", val(applicant, "aadhar")])}
${checkboxes("Nationality", ["Resident", "Non Resident"], nationality)}
${sectionTitle("Joint Applicants (If Any)")}
${uline("First Name", val(joint, "firstName"), { full: true })}
${uline("Surname Name", val(joint, "surname"), { full: true })}
${uline("Father / Spouse Name", val(joint, "fatherHusbandName"), { full: true })}
${uline("Date of Birth", val(joint, "dateOfBirth"), { full: true })}
${checkboxes("Marital Status", ["Married", "Unmarried"], jointMarital)}
${ulinePair(["PAN No.", val(joint, "pan")], ["AADHAR No.", val(joint, "aadhar")])}
${checkboxes("Nationality", ["Resident", "Non Resident"], jointNat)}
${sectionTitle("Geographic Information")}
${uline("Communication Address", val(geo, "communicationAddress") || val(comm, "address") || val(fd.communication, "address"), { full: true })}
${uline("", "", { full: true })}
${uline("", "", { full: true })}
${uline("Permanent Address", val(geo, "permanentAddress") || val(comm, "permanentAddress") || val(fd.communication, "permanentAddress"), { full: true })}
${uline("", "", { full: true })}
`),

    applicant: "",
    jointApplicant: "",
    geographic: "",

    occupation: page(`
${detailsBanner("DETAILS", teal, navy)}
${sectionTitle("Occupation")}
<p class="note" style="font-weight:700;color:${navy}">First Applicant</p>
${checkboxes("Occupation", ["Employed", "Professional", "Business"], occ1)}
${uline("Name of the Employer / Business / Profession", val(occ, "organizationName"), { full: true })}
${uline("Designation", val(occ, "designation"), { full: true })}
${uline("Place of Employment / Business / Profession", val(occ, "workPlace"), { full: true })}
<p class="note" style="font-weight:700;color:${navy};margin-top:16px">Second Applicant</p>
${checkboxes("Occupation", ["Employed", "Professional", "Business"], occ2)}
${uline("Name of the Employer / Business / Profession", val(occ, "organizationName2"), { full: true })}
${uline("Designation", val(occ, "designation2"), { full: true })}
${uline("Place of Employment / Business / Profession", val(occ, "workPlace2"), { full: true })}
${sectionTitle("Communication")}
<p class="note">(please tick the preferred mode of contact)</p>
<div class="uline uline-full"><span class="ulabel">${preferredTick(preferred, ["Mobile (First)", "mobile (first)", "Mobile No. of the First"])}Mobile No. of the First Applicant :</span><span class="uvalue">${esc(mobile1) || "&nbsp;"}</span></div>
<div class="uline uline-full"><span class="ulabel">${preferredTick(preferred, ["Email (First)", "email (first)", "Email ID of the First"])}Email ID of the First Applicant :</span><span class="uvalue">${esc(email1) || "&nbsp;"}</span></div>
<div class="uline uline-full"><span class="ulabel">${preferredTick(preferred, ["Mobile (Joint)", "mobile (joint)", "Mobile No. of the Joint"])}Mobile No. of the Joint Applicant :</span><span class="uvalue">${esc(mobile2) || "&nbsp;"}</span></div>
<div class="uline uline-full"><span class="ulabel">${preferredTick(preferred, ["Email (Joint)", "email (joint)", "Email ID of the Joint"])}Email ID of the Joint Applicant :</span><span class="uvalue">${esc(email2) || "&nbsp;"}</span></div>
${sectionTitle("Source of Fund")}
${checkboxes(null, ["Self Funding", "Home Loan"], fundingRaw)}
${uline("Home Loan % required", val(fund, "homeLoanPercent"), { full: true })}
${sectionTitle("Authority")}
${uline("Power of Attorney Holder (if any)", val(auth, "authorityName"), { full: true })}
${uline("Relationship with the Applicant / Joint Applicant", val(auth, "authorityRelation"), { full: true })}
${uline("Contact No. of the Authority Holder", val(auth, "authorityMobile"), { full: true })}
${ulinePair(["PAN No.", val(auth, "authorityPan")], ["AADHAR No.", val(auth, "authorityAadhar")])}
${uline("Email ID of the Authority Holder", val(auth, "authorityEmail"), { full: true })}
${uline("Correspondence address of the Authority Holder", val(auth, "authorityAddress"), { full: true })}
${uline("", "", { full: true })}
`),

    sourceOfFund: "",
    authority: "",

    sourceOfEnquiry: page(`
${detailsBanner("DETAILS", teal, navy)}
${sectionTitle("Source of Enquiry")}
<div class="enquiry-grid">
${enquiryList
  .map((opt) => {
    const on = listHas(enquirySources, opt);
    return `<label class="chk"><span class="box">${on ? "✓" : ""}</span> ${esc(opt)}</label>`;
  })
  .join("")}
</div>
${uline("Details of source", val(enquiry, "sourceDetails") || val(enquiry, "campaign"), { full: true })}
${sectionTitle("Real Estate Agents")}
${ulinePair(
  ["Real Estate Agent Name", val(agent, "agentName")],
  ["Represented By", val(agent, "representedBy")]
)}
${ulinePair(
  ["Contact No.", val(agent, "agentPhone")],
  ["Email ID", val(agent, "agentEmail")]
)}
${uline("Real Estate Agent RERA Registration #", val(agent, "reraNumber"), { full: true })}
<p class="prose" style="margin-top:14px">${esc(
      String(content.agentDeclarationText || "")
    ).replace(/\n/g, "<br/>")}</p>
<div class="sign-grid">
  <div><div class="sign-line">Signature of the First Applicant</div></div>
  <div><div class="sign-line">Signature of the Second / Joint Applicant</div></div>
</div>
${sectionTitle("Refundable Earnest Amount Deposit Details (READ)")}
${uline("Wire transfer / Cheque / Draft No.", val(deposit, "instrumentNo"), { full: true })}
${uline("UPI Transaction No.", val(deposit, "upiNo"), { full: true })}
${ulinePair(["Dated", val(deposit, "dated")], ["Drawn on", val(deposit, "drawnOn")])}
${ulinePair(["Place", val(deposit, "place")], ["Amount", val(deposit, "amount")])}
${uline(
  "In words",
  val(deposit, "amountInWords") ||
    amountToIndianWords(val(deposit, "amount")),
  { full: true }
)}
<p style="margin-top:12px;font-weight:700">in favour of <strong>${esc(
      String(content.collectionAccountName || "")
    )}</strong> Payable at ${esc(String(content.payableAt || ""))}</p>
<div class="sign-grid" style="margin-top:28px">
  <div>${uline("Date", val(terms, "signDate"))}${uline("Place", val(terms, "signPlace"))}</div>
  <div>
    <div class="sign-line">Applicant Signature : 1</div>
    <div class="sign-line">Applicant Signature : 2</div>
  </div>
</div>
`),

    agents: "",
    earnestDeposit: "",

    terms: buildTermsPage({
      termsText: String(content.termsText || ""),
      teal,
      navy,
      termsAccepted,
      signDate: val(terms, "signDate"),
      signPlace: val(terms, "signPlace"),
      fontScale: Number(layout?.fontScale ?? 1.35),
    }),

    consent: showConsent
      ? page(`
${tealBanner("ACKNOWLEDGED AND AGREED", teal, navy)}
<p><strong>To</strong> ${esc(String(content.consentTo || content.promoterName || ""))}</p>
<p class="prose">${esc(String(content.promoterAddress || ""))}</p>
<p style="margin-top:12px"><strong>Subject:</strong> ${esc(String(content.consentSubject || ""))}</p>
<p class="prose" style="margin-top:14px">${esc(
          String(content.consentIntroText || "")
            .replace(/\{\{projectName\}\}/g, fullProject)
            .replace(/\{\{landSurveyDetails\}\}/g, String(content.landSurveyDetails || ""))
        ).replace(/\n/g, "<br/>")}</p>
${uline("Applicant No. 1", val(consent, "name") || val(consent, "fullName") || customerName, { full: true })}
${uline("Applicant No. 2", [val(joint, "firstName"), val(joint, "surname")].filter(Boolean).join(" "), { full: true })}
${uline("Unit No.", unitNumber, { full: true })}
${checkboxes("Consent accepted", ["Yes"], consentAccepted)}
<p class="prose" style="margin-top:12px">${esc(String(content.consentBodyText || "")).replace(/\n/g, "<br/>")}</p>
<p style="margin-top:14px;font-weight:800">Declaration:</p>
<div class="callout">${esc(String(content.consentDeclarationBox || content.declarationText || "")).replace(/\n/g, "<br/>")}</div>
<p style="margin-top:28px;font-weight:700">For M/s ${esc(String(content.promoterName || branding.companyName || ""))}</p>
${ulinePair(
  ["SALES ADVISOR NAME", options?.salesAdvisorName || val(consent, "salesAdvisorName")],
  ["APPROVED BY", options?.approvedByName || val(consent, "approvedBy")]
)}
${uline("AUTHORIZED SIGNATORY", options?.approvedByName || "", { full: true })}
<div class="footer-block">
  <strong>${esc(String(content.promoterName || branding.companyName || ""))}</strong>
  ${esc(String(content.officeAddress || ""))}<br/>
  E: ${esc(String(content.officeEmail || branding.supportEmail || ""))} | C: ${esc(String(content.supportPhone || ""))}
</div>
`)
      : "",

    signatures: "",
    footer: "",
  };

  // Fill consent intro blanks with applicant data
  if (parts.consent) {
    const fills = [
      val(consent, "name") || customerName,
      val(consent, "relative") || val(consent, "relativeName"),
      val(consent, "age"),
      val(consent, "address") || val(geo, "communicationAddress"),
    ];
    let fi = 0;
    parts.consent = parts.consent.replace(/_{3,}/g, () => {
      const f = fills[fi++] || "";
      return f
        ? `<span style="display:inline;border-bottom:1.5px solid ${navy};padding:0 6px;font-weight:600">${esc(f)}</span>`
        : "________";
    });
  }

  const defaultOrder = [
    "header",
    "costSheet",
    "projectDetails",
    "occupation",
    "sourceOfEnquiry",
    "terms",
    "consent",
  ];
  const ids = orderedIds(layout ?? undefined, defaultOrder).filter((id) => parts[id]);
  // If layout reorders legacy block ids, still emit paper pages in sensible order when those are empty
  const used = new Set(ids.filter((id) => parts[id]));
  const sequence = [
    ...ids.filter((id) => parts[id]),
    ...defaultOrder.filter((id) => parts[id] && !used.has(id)),
  ];

  // Printable blocks are complete A4 pages. Applying editor x/y coordinates
  // to those page wrappers nests A4 pages in one absolute canvas and causes
  // clipping/misalignment. Print in the configured order; freeform coordinates
  // remain an editor aid until element-level (rather than page-level) layout.
  const freeform = false;
  const bodyInner = sequence
    .map((id) => wrapBlock(id, parts[id] ?? "", layout ?? undefined))
    .filter(Boolean)
    .join("\n");

  const maxY = freeform
    ? Math.max(
        100,
        ...(layout?.blocks ?? [])
          .filter((b) => b.visible !== false)
          .map((b) => Number(b.y ?? 0) + 14)
      )
    : 100;

  const bodyHtml = freeform
    ? `<div class="freeform-canvas" style="position:relative;min-height:${Math.round((maxY / 100) * 1123)}px;width:100%">${bodyInner}</div>`
    : bodyInner;

  const previewRibbon = options?.preview
    ? `<div class="no-print preview-ribbon">SAMPLE DATA PREVIEW — paper booking form layout (not tables)</div>`
    : "";

  const printBtn = options?.preview
    ? ""
    : `<div class="no-print" style="padding:12px 16px">
  <button onclick="window.print()" style="background:${teal};color:#fff;border:0;padding:10px 18px;border-radius:6px;font-weight:600;cursor:pointer">Print / Save as PDF</button>
  <span style="margin-left:12px;color:#64748B;font-size:12px">Matches physical booking form layout.</span>
</div>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Booking Form — ${esc(fullProject)}</title>
<style>
${paperCss(teal, navy, Number(layout?.fontScale ?? 1.35))}
.freeform-canvas .layout-block{position:absolute;box-sizing:border-box}
.layout-block.flow{position:relative}
.layout-block.flow{break-inside:avoid;page-break-inside:avoid}
.layout-block.flow > .page{break-after:page;page-break-after:always}
</style></head><body>
${previewRibbon}
${printBtn}
${bodyHtml}
</body></html>`;
}
