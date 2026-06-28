import { cn } from "../lib/utils";

export function GhcLogo({ className, size = 40 }: { className?: string; size?: number }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg bg-brand-500 font-bold text-white",
        className
      )}
      style={{ width: size, height: size, fontSize: size * 0.5 }}
    >
      G
    </div>
  );
}
