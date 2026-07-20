import type { CostSheetResult } from "./types";

/** Sample filled booking form — field keys match the customer booking form exactly. */
export function samplePage1Snapshot(projectName = "ORCHID SOUTH PARK"): CostSheetResult {
  const basicSaleValue = 1_20_00_000;
  const gstAmount = basicSaleValue * 0.05;
  const a = basicSaleValue + gstAmount;
  const otherCharges = [
    { name: "Legal Charges", amount: 25_000 },
    { name: "Corpus Fund", amount: 50_000 },
    { name: "Maintenance Deposit (12 months)", amount: 1_20_000 },
  ];
  const otherChargesTotal = otherCharges.reduce((s, c) => s + c.amount, 0);
  const read = 2_00_000;
  const bookingTarget = a * 0.1;
  return {
    projectName,
    wing: "A",
    apartmentNo: "1204",
    accommodationType: "3 BHK",
    floor: 12,
    floorLabel: "12",
    saleableAreaSqft: 1650,
    carpetAreaSqft: 1180,
    carpetAreaSqm: 109.6,
    balconyAreaSqft: 85,
    balconyAreaSqm: 7.9,
    saleablePricePerSqft: 7273,
    carpetPricePerSqft: 10170,
    basicSaleValue,
    gstPercent: 5,
    gstAmount,
    basicSaleValueWithGst: a,
    paymentSchedule: [
      { stageName: "READ / Token", percentage: null, amount: read, type: "FIXED" },
      {
        stageName: "Balance Booking (10% of A − READ)",
        percentage: 10,
        amount: Math.max(0, bookingTarget - read),
        type: "BALANCE_BOOKING",
      },
      { stageName: "On Agreement", percentage: 20, amount: a * 0.2 },
      { stageName: "On Foundation", percentage: 15, amount: a * 0.15 },
      { stageName: "On Slab", percentage: 25, amount: a * 0.25 },
      { stageName: "On Possession", percentage: 30, amount: a * 0.3 },
    ],
    otherCharges,
    otherChargesTotal,
    grossApartmentValue: a + otherChargesTotal,
  };
}

export function sampleFormData() {
  return {
    cover: { date: "2026-07-12" },
    applicant: {
      firstName: "Rahul",
      surname: "Sharma",
      fatherHusbandName: "Suresh Sharma",
      dateOfBirth: "1988-03-15",
      maritalStatus: "Married",
      pan: "ABCDE1234F",
      aadhar: "XXXX-XXXX-1234",
      nationality: "Resident",
    },
    jointApplicant: {
      firstName: "Priya",
      surname: "Sharma",
      fatherHusbandName: "Anil Mehta",
      dateOfBirth: "1990-08-22",
      maritalStatus: "Married",
      pan: "FGHIJ5678K",
      aadhar: "XXXX-XXXX-5678",
      nationality: "Resident",
    },
    geographic: {
      communicationAddress: "42, Residency Road, Bangalore 560025",
      permanentAddress: "42, Residency Road, Bangalore 560025",
    },
    communication: {
      mobile: "9876543210",
      email: "rahul.sharma@example.com",
      jointMobile: "9876501234",
      jointEmail: "priya.sharma@example.com",
      preferred: ["Mobile (First)", "Email (First)"],
    },
    occupation: {
      occupationType: "Employed",
      organizationName: "Acme Technologies Pvt Ltd",
      designation: "Senior Manager",
      workPlace: "Bangalore",
      occupationType2: "Professional",
      organizationName2: "Freelance",
      designation2: "Consultant",
      workPlace2: "Bangalore",
    },
    sourceOfFund: {
      fundingType: "Home Loan",
      homeLoanPercent: "70",
    },
    authority: {
      authorityName: "",
      authorityRelation: "",
      authorityMobile: "",
      authorityPan: "",
      authorityAadhar: "",
      authorityEmail: "",
      authorityAddress: "",
    },
    sourceOfEnquiry: {
      sources: ["Website", "Real Estate Agent"],
      sourceDetails: "Orchid South Park campaign",
    },
    realEstateAgents: {
      agentName: "Premium Homes Realty",
      representedBy: "Amit Verma",
      agentPhone: "9988776655",
      agentEmail: "amit@premiumhomes.example",
      reraNumber: "PRM/KA/RERA/1251/309/AG/220101/000123",
    },
    earnestDeposit: {
      instrumentNo: "CHQ-452189",
      upiNo: "",
      dated: "2026-07-10",
      drawnOn: "HDFC Bank",
      place: "Bangalore",
      amount: "200000",
      amountInWords: "Two Lakh Rupees Only",
    },
    terms: {
      accepted: "yes",
      signDate: "2026-07-12",
      signPlace: "Bangalore",
    },
    consent: {
      name: "Rahul Sharma",
      relative: "Suresh Sharma",
      age: "38",
      address: "42, Residency Road, Bangalore 560025",
      accepted: "yes",
    },
  };
}

export function buildSamplePrintForm(projectName?: string) {
  return {
    page1Snapshot: samplePage1Snapshot(projectName) as unknown as Record<string, unknown>,
    formData: sampleFormData() as unknown as Record<string, unknown>,
  };
}
