import { withLoggedHandler } from "@booking/logger";
import * as H from "./api-handlers";

export const GET_units = withLoggedHandler("sales.units.list", H.GET_units);
export const GET_unit = withLoggedHandler("sales.units.get", H.GET_unit);
export const POST_blocks = withLoggedHandler("sales.blocks.create", H.POST_blocks);
export const DELETE_blocks = withLoggedHandler("sales.blocks.delete", H.DELETE_blocks);
export const POST_bookings = withLoggedHandler("sales.bookings.create", H.POST_bookings);
export const GET_myBlocks = withLoggedHandler("sales.blocks.mine", H.GET_myBlocks);
export const GET_bookings = withLoggedHandler("sales.bookings.list", H.GET_bookings);
export const GET_activities = withLoggedHandler("sales.activities", H.GET_activities);
export const GET_heatmap = withLoggedHandler("sales.heatmap", H.GET_heatmap);
export const GET_projects = withLoggedHandler("sales.projects", H.GET_projects);
export const GET_dashboard = withLoggedHandler("sales.dashboard", H.GET_dashboard);
export const GET_filters = withLoggedHandler("sales.filters", H.GET_filters);
export const GET_booking_stats = withLoggedHandler("sales.bookingStats", H.GET_booking_stats);
export const GET_notifications = withLoggedHandler("sales.notifications.list", H.GET_notifications);
export const GET_notifications_unread_count = withLoggedHandler(
  "sales.notifications.unread",
  H.GET_notifications_unread_count,
);
export const POST_notifications_read_all = withLoggedHandler(
  "sales.notifications.readAll",
  H.POST_notifications_read_all,
);
export const PATCH_notification_read = withLoggedHandler(
  "sales.notifications.read",
  H.PATCH_notification_read,
);
export const GET_profile = withLoggedHandler("sales.profile.get", H.GET_profile);
export const PATCH_profile = withLoggedHandler("sales.profile.patch", H.PATCH_profile);
export const POST_profile_password = withLoggedHandler(
  "sales.profile.password",
  H.POST_profile_password,
);
export const GET_booking_receipt = withLoggedHandler("sales.bookings.receipt", H.GET_booking_receipt);
export const GET_block_detail = withLoggedHandler("sales.blocks.detail", H.GET_block_detail);
export const POST_block_customer = withLoggedHandler("sales.blocks.customer", H.POST_block_customer);
export const PATCH_block_detail = withLoggedHandler("sales.blocks.patch", H.PATCH_block_detail);
export const POST_unit_costSheetPreview = withLoggedHandler(
  "sales.units.costSheetPreview",
  H.POST_unit_costSheetPreview,
);
export const POST_block_costSheetPreview = withLoggedHandler(
  "sales.blocks.costSheetPreview",
  H.POST_block_costSheetPreview,
);
export const GET_block_costSheetPdf = withLoggedHandler(
  "sales.blocks.costSheetPdf",
  H.GET_block_costSheetPdf,
);
export const GET_leads_search = withLoggedHandler("sales.leads.search", H.GET_leads_search);
export const GET_booking_digitalForm = withLoggedHandler(
  "sales.bookings.digitalForm",
  H.GET_booking_digitalForm,
);
export const GET_booking_printPdf = withLoggedHandler(
  "sales.bookings.printPdf",
  H.GET_booking_printPdf,
);
export const POST_block_resendBookingEmail = withLoggedHandler(
  "sales.blocks.resendEmail",
  H.POST_block_resendBookingEmail,
);
export const GET_directLeads = withLoggedHandler("sales.directLeads.list", H.GET_directLeads);
export const POST_directLeadSiteVisit = withLoggedHandler(
  "sales.directLeads.siteVisit",
  H.POST_directLeadSiteVisit,
);
export const POST_directLeadBookOtpSend = withLoggedHandler(
  "sales.directLeads.otp.send",
  H.POST_directLeadBookOtpSend,
);
export const POST_directLeadBook = withLoggedHandler(
  "sales.directLeads.book",
  H.POST_directLeadBook,
);
