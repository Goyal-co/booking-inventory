import { expireBlocks, applyAutoLifecycleTransitions } from "@booking/database";
import { emitRealtimeEvent } from "@booking/database";
import { REALTIME_EVENTS } from "@booking/realtime";

const INTERVAL_MS = 60_000;

async function runExpiryJob() {
  try {
    const expired = await expireBlocks();
    for (const item of expired) {
      await emitRealtimeEvent(item.projectId, REALTIME_EVENTS.BLOCK_EXPIRED, {
        unitId: item.unitId,
        unitNumber: item.unitNumber,
      });
      await emitRealtimeEvent(item.projectId, REALTIME_EVENTS.UNIT_UPDATED, {
        unitId: item.unitId,
        status: "AVAILABLE",
        block: null,
      });
    }
    if (expired.length > 0) {
      console.log(`Expired ${expired.length} blocks`);
    }
  } catch (error) {
    console.error("Block expiry job failed:", error);
  }
}

async function runLifecycleJob() {
  try {
    const updated = await applyAutoLifecycleTransitions();
    if (updated.length > 0) {
      console.log(`Auto-transitioned ${updated.length} project(s) to LAUNCH_DAY`);
    }
  } catch (error) {
    console.error("Lifecycle transition job failed:", error);
  }
}

console.log("Starting block expiry worker...");
runExpiryJob();
setTimeout(runLifecycleJob, 15_000);
setInterval(runExpiryJob, INTERVAL_MS);
setInterval(runLifecycleJob, INTERVAL_MS);
