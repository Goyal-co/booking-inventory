import type { CostSheetResult } from "./types";

export * from "./types";

function inr(n: number) {
  return `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function num(n: number | null | undefined) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
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
  if (!step) return "—";
  const v = step[key];
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  if (v == null || String(v).trim() === "") return "—";
  return String(v);
}

function section(title: string, rows: Array<[string, string]>) {
  const body = rows
    .map(
      ([l, v]) =>
        `<tr><td style="width:38%;color:#475569;padding:6px 8px;border-bottom:1px solid #E2E8F0">${esc(l)}</td><td style="padding:6px 8px;border-bottom:1px solid #E2E8F0;font-weight:600;color:#1E3A5F">${esc(v)}</td></tr>`
    )
    .join("");
  return `<div class="sec"><h3>${esc(title)}</h3><table>${body}</table></div>`;
}

function wingOf(result: CostSheetResult) {
  return result.wing || result.towerName || "—";
}

function apartmentOf(result: CostSheetResult) {
  return result.apartmentNo || result.unitNumber || "—";
}

function accommodationOf(result: CostSheetResult) {
  return result.accommodationType || result.configuration || "—";
}

function floorOf(result: CostSheetResult) {
  return result.floorLabel || (result.floor != null ? String(result.floor) : "—");
}

export function costSheetToHtml(
  result: CostSheetResult,
  meta: {
    projectName: string;
    unitNumber: string;
    towerName: string;
    customerName?: string;
  }
) {
  const inventoryRows = [
    ["Wing", wingOf(result) || meta.towerName],
    ["Apartment No.", apartmentOf(result) || meta.unitNumber],
    ["Accommodation Type", accommodationOf(result)],
    ["Floors", floorOf(result)],
    ["Saleable Area (Sq.ft.)", num(result.saleableAreaSqft)],
    ["Carpet Area (Sq.Mt)* Excluding Balcony / Utility Area", num(result.carpetAreaSqm)],
    ["Carpet Area (Sq.ft)* Excluding Balcony / Utility Area", num(result.carpetAreaSqft)],
    ["Balcony Area (Sq.Mt.)", num(result.balconyAreaSqm)],
    ["Balcony Area (Sq.ft.)", num(result.balconyAreaSqft)],
    ["Unit Price per sq.ft. on Saleable Area (Rs.)", inr(result.saleablePricePerSqft)],
    ["Unit Price per sq.ft. on Carpet Area (Rs.)", inr(result.carpetPricePerSqft)],
    ["Basic Sale Value", inr(result.basicSaleValue)],
    [`GST applicable on Basic Sale Value (${result.gstPercent ?? 5}%)`, inr(result.gstAmount)],
    ["Basic Sale Value with GST (A)", inr(result.basicSaleValueWithGst)],
  ];

  const paymentRows = result.paymentSchedule
    .map(
      (s) =>
        `<tr><td>${esc(s.stageName)}</td><td style="text-align:right">${s.percentage != null ? `${s.percentage}%` : "—"}</td><td style="text-align:right">${inr(s.amount)}</td></tr>`
    )
    .join("");

  const paymentTotal = result.paymentSchedule.reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const paymentPct = result.paymentSchedule.reduce((sum, s) => sum + Number(s.percentage || 0), 0);

  const otherRows = result.otherCharges
    .map((c) => `<tr><td>${esc(c.name)}</td><td style="text-align:right">${inr(c.amount)}</td></tr>`)
    .join("");

  const inventoryHtml = inventoryRows
    .map(([l, v]) => `<tr><td>${esc(l)}</td><td style="text-align:right;font-weight:600">${esc(v)}</td></tr>`)
    .join("");

  return `<div class="cost-sheet">
<h2>Details of Residential Apartment Applied For</h2>
<table class="grid">${inventoryHtml}</table>
<h3>Payment Schedule</h3>
<table class="grid">
<thead><tr><th>Milestone</th><th style="text-align:right">%</th><th style="text-align:right">Amount</th></tr></thead>
<tbody>${paymentRows}
<tr class="total"><td>TOTAL</td><td style="text-align:right">${paymentPct ? `${Math.round(paymentPct * 100) / 100}%` : "—"}</td><td style="text-align:right">${inr(paymentTotal)}</td></tr>
</tbody></table>
<h3>Other Charges (B)</h3>
<table class="grid">
<tbody>${otherRows}
<tr class="total"><td>Sub Total (B)</td><td style="text-align:right" colspan="1">${inr(result.otherChargesTotal)}</td></tr>
<tr class="gross"><td>Gross Apartment Value (A+B)</td><td style="text-align:right">${inr(result.grossApartmentValue)}</td></tr>
</tbody></table>
</div>`;
}

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

export function digitalFormToPrintHtml(
  form: {
    page1Snapshot: Record<string, unknown>;
    formData: Record<string, unknown> | null;
  },
  options?: {
    templateHtml?: string;
    branding?: PrintBranding;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
  }
) {
  const page1 = form.page1Snapshot as unknown as CostSheetResult;
  const fd = (form.formData ?? {}) as Record<string, Record<string, unknown>>;
  const branding = options?.branding ?? {};
  const content = (branding.content ?? {}) as Record<string, unknown>;
  const teal = String(content.accentTeal || branding.primaryColor || "#2BB8C8");
  const navy = String(content.accentNavy || "#1E3A5F");
  const projectName = String(
    content.projectDisplayName || branding.projectName || page1.projectName || ""
  );
  const projectLine2 = String(content.projectNameLine2 || "");
  const unitNumber = String(
    branding.unitNumber || page1.apartmentNo || page1.unitNumber || ""
  );
  const applicant = fd.applicant ?? {};
  const customerName =
    options?.customerName ||
    [val(applicant, "firstName"), val(applicant, "surname")].filter((x) => x !== "—").join(" ") ||
    val(applicant, "fullName");

  const costHtml = costSheetToHtml(page1, {
    projectName,
    unitNumber,
    towerName: String(page1.wing ?? page1.towerName ?? ""),
    customerName,
  });

  if (options?.templateHtml) {
    return options.templateHtml
      .replace(/\{\{page1\}\}/g, costHtml)
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

  const bodySections = [
    section("Cover", [
      ["Date", val(cover, "date")],
      ["Apartment No.", unitNumber],
      ["Project", `${projectName}${projectLine2 ? ` ${projectLine2}` : ""}`],
    ]),
    costHtml,
    section("Promoter", [
      ["Name", String(content.promoterName || "—")],
      ["Address", String(content.promoterAddress || "—")],
    ]),
    content.showLandOwners
      ? section("Land Owners", [
          ["Names", String(content.landOwnerNames || "—")],
          ["Address", String(content.landOwnerAddress || "—")],
        ])
      : "",
    section("Project Details", [
      ...(content.showLandArea ? [["Land Area", String(content.landArea || "—")] as [string, string]] : []),
      ["Project Phase", String(content.projectPhase || "—")],
      ["Project Name", projectName],
      ["Sanction of Plan by", String(content.sanctionBy || "—")],
      ["Plan Sanction / LP No.", String(content.planSanctionNo || "—")],
      ["RERA Website", String(content.reraWebsite || "—")],
      ["RERA #", String(content.reraNumber || "—")],
    ]),
    section("First Applicant", [
      ["First Name", val(applicant, "firstName")],
      ["Surname", val(applicant, "surname")],
      ["Father / Spouse Name", val(applicant, "fatherHusbandName") !== "—" ? val(applicant, "fatherHusbandName") : val(applicant, "fatherSpouseName")],
      ["Date of Birth", val(applicant, "dateOfBirth")],
      ["Marital Status", val(applicant, "maritalStatus")],
      ["PAN No.", val(applicant, "pan")],
      ["AADHAR No.", val(applicant, "aadhar")],
      ["Nationality", val(applicant, "nationality")],
      ["Mobile", options?.customerPhone || val(comm, "mobile")],
      ["Email", options?.customerEmail || val(comm, "email")],
    ]),
    section("Joint Applicant", [
      ["First Name", val(joint, "firstName")],
      ["Surname", val(joint, "surname")],
      ["Father / Spouse Name", val(joint, "fatherHusbandName")],
      ["Date of Birth", val(joint, "dateOfBirth")],
      ["Marital Status", val(joint, "maritalStatus")],
      ["PAN No.", val(joint, "pan")],
      ["AADHAR No.", val(joint, "aadhar")],
      ["Nationality", val(joint, "nationality")],
    ]),
    section("Geographic Information", [
      ["Communication Address", val(geo, "communicationAddress") !== "—" ? val(geo, "communicationAddress") : val(fd.communication, "address")],
      ["Permanent Address", val(geo, "permanentAddress") !== "—" ? val(geo, "permanentAddress") : val(fd.communication, "permanentAddress")],
    ]),
    section("Occupation", [
      ["Occupation (First)", val(occ, "occupationType") !== "—" ? val(occ, "occupationType") : val(occ, "occupation")],
      ["Organisation", val(occ, "organizationName")],
      ["Designation", val(occ, "designation")],
      ["Place of Work", val(occ, "workPlace")],
      ["Occupation (Second)", val(occ, "occupationType2")],
      ["Organisation (Second)", val(occ, "organizationName2")],
      ["Designation (Second)", val(occ, "designation2")],
    ]),
    section("Source of Fund", [
      ["Funding", val(fund, "fundingType") !== "—" ? val(fund, "fundingType") : val(fund, "source")],
      ["Home Loan %", val(fund, "homeLoanPercent")],
      ["Annual Income", val(fund, "annualIncome")],
    ]),
    section("Authority (POA)", [
      ["Name", val(auth, "authorityName")],
      ["Relationship", val(auth, "authorityRelation")],
      ["Contact", val(auth, "authorityMobile")],
      ["PAN", val(auth, "authorityPan")],
      ["AADHAR", val(auth, "authorityAadhar")],
      ["Email", val(auth, "authorityEmail")],
      ["Address", val(auth, "authorityAddress")],
    ]),
    section("Source of Enquiry", [
      ["Sources", val(enquiry, "sources") !== "—" ? val(enquiry, "sources") : val(enquiry, "source")],
      ["Details", val(enquiry, "sourceDetails") !== "—" ? val(enquiry, "sourceDetails") : val(enquiry, "campaign")],
    ]),
    section("Real Estate Agents (Optional)", [
      ["Agent Name", val(agent, "agentName")],
      ["Represented By", val(agent, "representedBy")],
      ["Contact", val(agent, "agentPhone")],
      ["Email", val(agent, "agentEmail")],
      ["RERA #", val(agent, "reraNumber")],
    ]),
    section("Refundable Earnest Amount Deposit (READ)", [
      ["Cheque / Wire / Draft No.", val(deposit, "instrumentNo")],
      ["UPI Transaction No.", val(deposit, "upiNo")],
      ["Dated", val(deposit, "dated")],
      ["Drawn on", val(deposit, "drawnOn")],
      ["Place", val(deposit, "place")],
      ["Amount", val(deposit, "amount")],
      ["In words", val(deposit, "amountInWords")],
      ["In favour of", String(content.collectionAccountName || "—")],
      ["Payable at", String(content.payableAt || "—")],
    ]),
    section("Terms Acceptance", [
      ["Accepted", val(terms, "accepted")],
      ["Date", val(terms, "signDate")],
      ["Place", val(terms, "signPlace")],
    ]),
    content.showConsentPage
      ? section("Consent / Acknowledged & Agreed", [
          ["Accepted", val(consent, "accepted")],
          ["Applicant Name", val(consent, "fullName")],
          ["S/o D/o W/o", val(consent, "relativeName")],
          ["Age", val(consent, "age")],
          ["Residing at", val(consent, "address")],
        ])
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Booking Form — ${esc(projectName)}</title>
<style>
@page{margin:16mm}
body{font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:${navy};margin:0;padding:24px;background:#fff}
.header{border-bottom:3px solid ${teal};padding-bottom:16px;margin-bottom:20px;display:flex;justify-content:space-between;gap:16px;align-items:flex-start}
.logo{max-height:56px;max-width:180px}
h1{font-size:18px;margin:0 0 4px;text-transform:uppercase;letter-spacing:.02em}
.project{font-size:22px;font-weight:800;color:${navy}}
.banner{background:${teal};color:${navy};font-weight:800;font-size:18px;padding:8px 14px;margin:24px 0 12px;text-transform:uppercase}
.sec{margin:18px 0;page-break-inside:avoid}
.sec h3,.cost-sheet h2,.cost-sheet h3{margin:0 0 8px;font-size:14px;text-transform:uppercase;color:${navy}}
table{width:100%;border-collapse:collapse}
table.grid td,table.grid th{border:1px solid #CBD5E1;padding:7px 9px;font-size:12px}
.total td{background:#EEF2FF;font-weight:700}
.gross td{background:#FEF3C7;font-weight:700}
.muted{color:#64748B;font-size:12px}
.sign{margin-top:36px;display:grid;grid-template-columns:1fr 1fr;gap:28px;page-break-inside:avoid}
.sign .line{border-top:1px solid ${navy};margin-top:48px;padding-top:6px;font-size:12px}
.footer{margin-top:28px;padding-top:12px;border-top:1px solid #E2E8F0;text-align:center;font-size:11px;color:#64748B}
@media print{body{padding:0}.no-print{display:none!important}}
</style></head><body>
<div class="no-print" style="margin-bottom:16px">
  <button onclick="window.print()" style="background:${teal};color:#fff;border:0;padding:10px 18px;border-radius:6px;font-weight:600;cursor:pointer">Print / Save as PDF</button>
  <span class="muted" style="margin-left:12px">Use this printout for physical customer signatures.</span>
</div>
<div class="header">
  <div>
    ${branding.logoUrl ? `<img class="logo" src="${esc(branding.logoUrl)}" alt="logo"/>` : ""}
    <p class="muted" style="margin:8px 0 0">${esc(branding.companyName || "Goyal & Co.")}</p>
    <p class="muted">${esc(branding.tagline || "creating landmarks since 1971")}</p>
  </div>
  <div style="text-align:right">
    <h1>${esc(branding.formTitle || "APPLICATION FOR ALLOTMENT OF A RESIDENTIAL UNIT IN")}</h1>
    <div class="project">${esc(projectName)}</div>
    ${projectLine2 ? `<div class="project" style="font-size:18px">${esc(projectLine2)}</div>` : ""}
    <p class="muted" style="margin-top:8px">Unit ${esc(unitNumber)} · ${esc(customerName)}</p>
  </div>
</div>
<div class="banner">DETAILS — Filled Booking Form</div>
${bodySections}
<div class="sign">
  <div><div class="line">Applicant Signature 1</div></div>
  <div><div class="line">Applicant Signature 2</div></div>
  <div><div class="line">Date / Place</div></div>
  <div><div class="line">Sales Advisor / Authorized Signatory</div></div>
</div>
<div class="footer">
  <strong>${esc(String(content.promoterName || branding.companyName || ""))}</strong><br/>
  ${esc(String(content.officeAddress || ""))}<br/>
  E: ${esc(String(content.officeEmail || branding.supportEmail || ""))} | C: ${esc(String(content.supportPhone || ""))}
</div>
</body></html>`;
}
