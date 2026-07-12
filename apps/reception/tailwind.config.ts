import type { Config } from "tailwindcss";
// @ts-expect-error preset has no types
import preset from "@booking/config-tailwind/presets";

export default {
  presets: [preset],
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
} satisfies Config;
