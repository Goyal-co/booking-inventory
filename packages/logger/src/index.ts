export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function parseLogLevel(raw?: string | null): LogLevel | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (v === "debug" || v === "info" || v === "warn" || v === "error") return v;
  return null;
}

export function getEffectiveLogLevel(): LogLevel {
  const fromEnv = parseLogLevel(process.env.LOG_LEVEL);
  if (fromEnv) return fromEnv;
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

export function shouldLog(level: LogLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[getEffectiveLogLevel()];
}

function fieldValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value.replace(/\s+/g, " ").slice(0, 500);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value).slice(0, 500);
  } catch {
    return String(value);
  }
}

export function redactEmail(email?: string | null): string | undefined {
  if (!email || !email.includes("@")) return email || undefined;
  const [local, domain] = email.split("@");
  const safeLocal = local.length <= 2 ? "***" : `${local.slice(0, 2)}***`;
  return `${safeLocal}@${domain}`;
}

export function redactPhone(phone?: string | null): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `***${digits.slice(-4)}`;
}

export function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  if (err && typeof err === "object") {
    try {
      return { message: JSON.stringify(err) };
    } catch {
      return { message: String(err) };
    }
  }
  return { message: String(err) };
}

export function formatLog(
  level: LogLevel,
  scope: string,
  message: string,
  fields?: Record<string, unknown>,
): string {
  const parts = [`[${level}]`, `scope=${scope}`];
  if (fields) {
    for (const [key, value] of Object.entries(fields)) {
      if (key === "cause" || value === undefined || value === "") continue;
      parts.push(`${key}=${fieldValue(value)}`);
    }
  }
  parts.push(`msg=${fieldValue(message)}`);
  return parts.join(" ");
}

export function log(
  level: LogLevel,
  scope: string,
  message: string,
  fields?: Record<string, unknown>,
  cause?: unknown,
) {
  if (!shouldLog(level)) return;
  const line = formatLog(level, scope, message, fields);
  if (level === "error") {
    if (cause !== undefined) console.error(line, serializeError(cause));
    else console.error(line);
    return;
  }
  if (level === "warn") {
    if (cause !== undefined) console.warn(line, serializeError(cause));
    else console.warn(line);
    return;
  }
  if (level === "debug") {
    if (cause !== undefined) console.debug(line, serializeError(cause));
    else console.debug(line);
    return;
  }
  if (cause !== undefined) console.info(line, serializeError(cause));
  else console.info(line);
}

export const logger = {
  debug: (scope: string, message: string, fields?: Record<string, unknown>, cause?: unknown) =>
    log("debug", scope, message, fields, cause),
  info: (scope: string, message: string, fields?: Record<string, unknown>, cause?: unknown) =>
    log("info", scope, message, fields, cause),
  warn: (scope: string, message: string, fields?: Record<string, unknown>, cause?: unknown) =>
    log("warn", scope, message, fields, cause),
  error: (scope: string, message: string, fields?: Record<string, unknown>, cause?: unknown) =>
    log("error", scope, message, fields, cause),
};

/** Wrap a Next.js route handler with enter/exit lifecycle logs. */
export function withLoggedHandler<T extends (...args: any[]) => Promise<Response> | Response>(
  scope: string,
  handler: T,
): T {
  return (async (...args: unknown[]) => {
    const started = Date.now();
    const maybeReq = args[0];
    const req = maybeReq instanceof Request ? maybeReq : undefined;
    let path = "unknown";
    let method = "UNKNOWN";
    if (req) {
      method = req.method;
      try {
        path = new URL(req.url).pathname;
      } catch {
        /* ignore */
      }
    }
    logger.debug(scope, "request start", { method, path });
    try {
      const res = await handler(...args);
      logger.info(scope, "request complete", {
        method,
        path,
        status: res.status,
        durationMs: Date.now() - started,
      });
      return res;
    } catch (cause) {
      logger.error(
        scope,
        "Unhandled route error",
        { method, path, status: 500, durationMs: Date.now() - started },
        cause,
      );
      throw cause;
    }
  }) as T;
}
