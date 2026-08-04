import { cn } from "../lib/utils";

const DEFAULT_LOGO_SRC = "/new_logo.jpeg";
const LOGO_ALT = "Goyal & Co. | Hariyana Group — creating landmarks since 1971";

/**
 * Official Goyal & Co. | Hariyana Group wordmark.
 * Serve `public/new_logo.jpeg` from each app (reception may also use /images/auth/new_logo.jpeg).
 */
export function GhcLogo({
  className,
  size = 40,
  src = DEFAULT_LOGO_SRC,
  alt = LOGO_ALT,
}: {
  className?: string;
  /** Height in px; width scales with the landscape wordmark. */
  size?: number;
  src?: string;
  alt?: string;
}) {
  return (
    <img
      src={src}
      alt={alt}
      className={cn("shrink-0 object-contain object-left", className)}
      style={{ height: size, width: "auto", maxWidth: Math.max(size * 5.5, 160) }}
    />
  );
}
