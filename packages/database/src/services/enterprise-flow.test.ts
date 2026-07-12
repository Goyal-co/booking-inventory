import { describe, it, expect } from "vitest";
import { mapDigitalFormToTitanPayload } from "@goyal/ecosystem-contracts";

describe("enterprise integration flow", () => {
  it("maps nested digital form steps to flat Titan payload", () => {
    const mapped = mapDigitalFormToTitanPayload({
      applicant: {
        fatherSpouseName: "Raj Kumar",
        dateOfBirth: "1990-01-15",
        maritalStatus: "Married",
        nationality: "Indian",
      },
      occupation: {
        occupation: "Engineer",
        organizationName: "Tech Corp",
        designation: "Manager",
      },
      communication: {
        address: "123 Main St",
        permanentAddress: "456 Home St",
      },
      sourceOfFund: { source: "Savings" },
      sourceOfEnquiry: { source: "Channel Partner" },
    });

    expect(mapped.fatherSpouseName).toBe("Raj Kumar");
    expect(mapped.occupation).toBe("Engineer");
    expect(mapped.communicationAddress).toBe("123 Main St");
    expect(mapped.sourceOfEnquiry).toBe("Channel Partner");
  });
});
