/** Shared booking form template content (Template Example 1 & 2). */

import {
  mergePrintLayout,
  type PrintLayout,
} from "./print-layout";

export type BookingFormTemplateVariant = "example1" | "example2";

export type BookingFormTemplateContent = {
  templateVariant: BookingFormTemplateVariant;
  projectDisplayName: string;
  projectNameLine2: string;
  landArea: string;
  projectPhase: string;
  sanctionBy: string;
  planSanctionNo: string;
  reraWebsite: string;
  reraNumber: string;
  landSurveyDetails: string;
  promoterName: string;
  promoterAddress: string;
  landOwnerNames: string;
  landOwnerAddress: string;
  collectionAccountName: string;
  payableAt: string;
  heroImageUrl: string;
  projectLogoUrl: string;
  secondaryLogoUrl: string;
  secondaryCompanyName: string;
  supportPhone: string;
  officeAddress: string;
  officeEmail: string;
  accentTeal: string;
  accentYellow: string;
  accentNavy: string;
  showCoverPhotos: boolean;
  showApplicationNo: boolean;
  showLandArea: boolean;
  showLandOwners: boolean;
  showConsentPage: boolean;
  kycChecklist: string;
  agentDeclarationText: string;
  groupDisplayName: string;
  jurisdiction: string;
  declarationText: string;
  termsText: string;
  consentTo: string;
  consentSubject: string;
  consentIntroText: string;
  consentBodyText: string;
  consentDeclarationBox: string;
  /** Canva-style print section layout (order, visibility, freeform positions). */
  printLayout?: PrintLayout;
};

const SHARED_KYC_SHORT = `Copy of Pan Card
Copy of AADHAR Card
Copy of OCI / PIO card (in case of NRI)`;

const SHARED_KYC_FULL = `Business Card
Passport Size Photograph
Copy of Passport / Voter ID / Driving License
Copy of Pan Card
Copy of AADHAR Card
Copy of OCI / PIO card (in case of NRI)`;

const TERMS_EXAMPLE_1 = `1. This application is not a concluded contract.
2. The promoter reserves the right to accept or reject this application.
3. All prior discussions are superseded by this document.
4. Self-attested KYC documents must be submitted.
5. Payments shall be made only into the designated RERA collection account.
6. NRI / foreign nationals must comply with applicable laws.
7–20. Additional project terms as applicable (edit in admin).`;

const TERMS_EXAMPLE_2 = `a) This application is an offer by the Applicant/s and does not constitute a concluded contract.
b) The Promoter reserves the right to accept or reject this application without assigning any reason.
c) Allotment shall be subject to realization of payments and compliance with KYC.
d) The Applicant/s agree to execute the Agreement for Sale as per RERA timelines.
e) Rates, taxes, and charges as applicable shall be borne by the Applicant/s.
f) Timely payment of installments is the essence of the transaction.
g) Refundable Earnest Amount Deposit (READ) of Rs. ___________/- shall be paid as per the payment schedule.
h) In case of cancellation by the Promoter, READ shall be refunded as per policy.
i) In case of cancellation by the Applicant/s, an amount of Rs. ___________/- may be deducted as processing charges.
j) All payments shall be made in favour of the designated RERA collection account only.
k) The Applicant/s confirm having inspected the project documents and plans.
l) Carpet area is as defined under RERA.
m) Car parking allotment is as per project policy.
n) The Applicant/s shall not transfer the booking without prior written consent.
o) The project name and branding are as configured for this development.
p) Force majeure events may extend timelines.
q) Any dispute shall first be attempted to be resolved amicably.
r) Correspondence shall be sent to the communication address provided.
s) The Applicant/s authorize the Promoter to share details with home loan institutions if requested.
t) Stamp duty, registration, and legal charges are extra.
u) Subject to Courts in Bangalore.
v) This document supersedes all prior oral or written representations.
w) The Applicant/s have read and understood all terms.`;

const DECLARATION_BOX = `I/We hereby declare that the particulars given herein are true and correct to the best of my/our knowledge.

I/We have read and understood the terms and conditions of this application.

I/We are aware that this application does not guarantee allotment until accepted by the Promoter.

I/We confirm receipt of the layout / building plan information as applicable.

I/We agree that no oral representation shall bind the Promoter.

I/We agree to abide by RERA and applicable laws.`;

const CONSENT_BODY = `I/We hereby confirm that I/We are aware of and grant consent for modification of the Development Plan / Building Sanction Plan as may be approved by the competent authority from time to time, in accordance with the Real Estate (Regulation and Development) Act, 2016 (RERA) and applicable rules.

I/We further confirm that such modifications shall not entitle me/us to claim any compensation except as provided under applicable law.`;

export const BOOKING_FORM_TEMPLATE_PRESETS: Record<
  BookingFormTemplateVariant,
  BookingFormTemplateContent
> = {
  example1: {
    templateVariant: "example1",
    projectDisplayName: "ORCHID LIFE",
    projectNameLine2: "",
    landArea: "7 acres 09 guntas",
    projectPhase: "Single Phase",
    sanctionBy: "BBMP",
    planSanctionNo: "",
    reraWebsite: "WWW.RERA.KARNATAKA.GOV.IN",
    reraNumber: "",
    landSurveyDetails: "",
    promoterName: "GOYAL HARIYANA ASSOCIATES",
    promoterAddress: "No 203, Barton Centre, 84, MG Road, Bangalore 560001",
    landOwnerNames: "",
    landOwnerAddress: "",
    collectionAccountName: "G H A ORCHID LIFE RERA COLLECTION ACCOUNT",
    payableAt: "Bangalore",
    heroImageUrl: "",
    projectLogoUrl: "",
    secondaryLogoUrl: "",
    secondaryCompanyName: "Hariyana Group",
    supportPhone: "080 25325717/18/19",
    officeAddress: "NO 203, BARTON CENTRE, 84, MG ROAD, BANGALORE",
    officeEmail: "orchidlifecrm@goyalco.com",
    accentTeal: "#2BB8C8",
    accentYellow: "#F5E000",
    accentNavy: "#1E3A5F",
    showCoverPhotos: true,
    showApplicationNo: true,
    showLandArea: true,
    showLandOwners: false,
    showConsentPage: false,
    kycChecklist: SHARED_KYC_FULL,
    agentDeclarationText:
      "I/We, the undersigned hereby declare that we have booked through the mentioned Authorized Channel Partner. I/We shall not hold the promoter or its sales representatives responsible for any agreement made between us and the channel partner. We request Goyal & Co | Hariyana Group to connect us with authorized home loan institutions.",
    groupDisplayName: "Goyal & Co | Hariyana Group",
    jurisdiction: "Courts in Bangalore",
    declarationText:
      "I/We hereby declare that the particulars given herein are true and correct to the best of my/our knowledge and that I/We have read and understood the terms and conditions of this application.",
    termsText: TERMS_EXAMPLE_1,
    consentTo: "GOYAL HARIYANA ASSOCIATES",
    consentSubject: "Consent for Modification of the Development Plan/Building Sanction Plan – As per approval authority.",
    consentIntroText: "",
    consentBodyText: CONSENT_BODY,
    consentDeclarationBox: DECLARATION_BOX,
  },
  example2: {
    templateVariant: "example2",
    projectDisplayName: "ORCHID",
    projectNameLine2: "SOUTH PARK",
    landArea: "",
    projectPhase: "Single Phase",
    sanctionBy: "BDA",
    planSanctionNo: "",
    reraWebsite: "WWW.RERA.KARNATAKA.GOV.IN",
    reraNumber: "",
    landSurveyDetails: "",
    promoterName: "GOYAL HARIYANA CONSTRUCTIONS",
    promoterAddress: "No 203, Barton Centre, 84, MG Road, Bangalore 560001",
    landOwnerNames:
      "Asha Damodar Chhabria, Rashi Madanlal Hinduja, Sharan Madanlal Hinduja, Bharti Kalro, Vijaykumar N. Kalro, Brijay Naraindas Kalro",
    landOwnerAddress: "",
    collectionAccountName:
      "Goyal Hariyana Constructions Rera Collection Ac for Orchid South Park",
    payableAt: "Bangalore",
    heroImageUrl: "",
    projectLogoUrl: "",
    secondaryLogoUrl: "",
    secondaryCompanyName: "Hariyana Group",
    supportPhone: "080 25325717/18/19",
    officeAddress: "NO 203, BARTON CENTRE, 84, MG ROAD, BANGALORE",
    officeEmail: "orchidsouthparkcrm@goyalco.com",
    accentTeal: "#2BB8C8",
    accentYellow: "#F5E000",
    accentNavy: "#1E3A5F",
    showCoverPhotos: false,
    showApplicationNo: false,
    showLandArea: false,
    showLandOwners: true,
    showConsentPage: true,
    kycChecklist: SHARED_KYC_SHORT,
    agentDeclarationText:
      "I/We, the undersigned hereby declare that we have booked through Mr/Ms ________ representing ________ (Authorized Channel Partner). I/We shall not hold the promoter or its sales representatives responsible for any agreement made between us and the above-mentioned channel partner. We request Goyal & Co | Hariyana Group to connect us with authorized home loan institutions.",
    groupDisplayName: "Goyal & Co | Hariyana Group",
    jurisdiction: "Courts in Bangalore",
    declarationText: DECLARATION_BOX,
    termsText: TERMS_EXAMPLE_2,
    consentTo: "GOYAL HARIYANA CONSTRUCTIONS",
    consentSubject:
      "Consent for Modification of the Development Plan/Building Sanction Plan – As per approval authority.",
    consentIntroText:
      "I/We, ________ S/o / D/o / W/o ________, aged about ________ years, residing at ________ have booked a unit in the project titled {{projectName}}, being developed on land bearing {{landSurveyDetails}}.",
    consentBodyText: CONSENT_BODY,
    consentDeclarationBox: DECLARATION_BOX,
  },
};

export function mergeTemplateContent(
  partial?: Partial<BookingFormTemplateContent> | null,
  projectName = ""
): BookingFormTemplateContent {
  // Default to Orchid South Park (example2) when no variant is set
  const variant = partial?.templateVariant === "example1" ? "example1" : "example2";
  const base = { ...BOOKING_FORM_TEMPLATE_PRESETS[variant] };
  const { printLayout: partialLayout, ...rest } = partial ?? {};
  const merged = { ...base, ...rest };
  if (!merged.projectDisplayName && projectName) {
    merged.projectDisplayName = projectName;
  }
  if (!merged.collectionAccountName && projectName) {
    merged.collectionAccountName = `RERA COLLECTION ACCOUNT — ${projectName.toUpperCase()}`;
  }
  merged.printLayout = mergePrintLayout(partialLayout ?? base.printLayout, {
    showLandOwners: merged.showLandOwners,
    showConsentPage: merged.showConsentPage,
  });
  return merged;
}
