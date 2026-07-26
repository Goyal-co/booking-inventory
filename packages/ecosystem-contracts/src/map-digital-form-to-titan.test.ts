import { describe, expect, it } from "vitest";
import { mapDigitalFormToTitanPayload } from "./index";

describe("mapDigitalFormToTitanPayload", () => {
  it("maps customer form keys (geographic, occupationType, fundingType, sources[])", () => {
    const mapped = mapDigitalFormToTitanPayload({
      applicant: {
        fatherSpouseName: "Ramesh Kumar",
        dateOfBirth: "1990-05-15",
        maritalStatus: "Married",
        nationality: "Indian",
      },
      geographic: {
        communicationAddress: "123 Comm St, Bangalore",
        permanentAddress: "456 Perm St, Bangalore",
      },
      occupation: {
        occupationType: "Salaried",
        organizationName: "Acme Pvt Ltd",
        designation: "Manager",
      },
      sourceOfFund: {
        fundingType: "Home Loan",
      },
      sourceOfEnquiry: {
        sources: ["Website", "Channel Partner"],
      },
    });

    expect(mapped).toMatchObject({
      fatherSpouseName: "Ramesh Kumar",
      dateOfBirth: "1990-05-15",
      maritalStatus: "Married",
      nationality: "Indian",
      communicationAddress: "123 Comm St, Bangalore",
      permanentAddress: "456 Perm St, Bangalore",
      occupation: "Salaried",
      organizationName: "Acme Pvt Ltd",
      designation: "Manager",
      sourceOfFund: "Home Loan",
      sourceOfEnquiry: "Website, Channel Partner",
    });
  });

  it("falls back to legacy communication/occupation keys", () => {
    const mapped = mapDigitalFormToTitanPayload({
      applicant: { dateOfBirth: "1988-01-01", maritalStatus: "Single", nationality: "Indian" },
      communication: {
        address: "Legacy Comm",
        permanentAddress: "Legacy Perm",
      },
      occupation: {
        occupation: "Engineer",
        organizationName: "Old Org",
        designation: "Dev",
      },
      sourceOfFund: { source: "Salary" },
      sourceOfEnquiry: { source: "Hoarding" },
    });

    expect(mapped.communicationAddress).toBe("Legacy Comm");
    expect(mapped.permanentAddress).toBe("Legacy Perm");
    expect(mapped.occupation).toBe("Engineer");
    expect(mapped.sourceOfFund).toBe("Salary");
    expect(mapped.sourceOfEnquiry).toBe("Hoarding");
  });
});
