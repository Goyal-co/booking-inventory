import type { PostCRMProvider } from "../types";

export const mockPostCRM: PostCRMProvider = {
  async syncBooking(data) {
    console.log("[PostCRM Mock] syncBooking", data);
    return { postCrmId: `POST-${Date.now()}` };
  },
  async syncPaymentSchedule(data) {
    console.log("[PostCRM Mock] syncPaymentSchedule", data);
  },
  async getPaymentStatus(postCrmId) {
    console.log("[PostCRM Mock] getPaymentStatus", postCrmId);
    return [];
  },
};
