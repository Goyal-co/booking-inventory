import type { Config } from "tailwindcss";
// @ts-expect-error preset has no types
import { adminPreset } from "@booking/config-tailwind/presets";

export default {
  presets: [adminPreset],
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
} satisfies Config;
