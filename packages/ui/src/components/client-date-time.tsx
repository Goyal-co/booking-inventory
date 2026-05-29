"use client";

import { useMounted } from "../hooks/use-mounted";

interface ClientDateTimeProps {
  value: string;
  className?: string;
}

export function ClientDateTime({ value, className }: ClientDateTimeProps) {
  const mounted = useMounted();
  if (!mounted) {
    return <span className={className}>...</span>;
  }
  return (
    <span className={className} suppressHydrationWarning>
      {new Date(value).toLocaleString()}
    </span>
  );
}
