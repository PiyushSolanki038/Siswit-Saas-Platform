import { getErrorMessage } from "@/core/utils/errors";

type LogContext = Record<string, unknown>;

const IS_DEV = import.meta.env.DEV;

function sanitizeContext(context?: LogContext): LogContext | undefined {
  if (!context) return undefined;

  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => {
      if (value instanceof Error) {
        return [key, getErrorMessage(value)];
      }
      return [key, value];
    }),
  );
}

function emit(
  level: "error" | "warn" | "info",
  message: string,
  context?: LogContext,
) {
  const safeContext = {
    ...sanitizeContext(context),
    url: typeof window !== "undefined" ? window.location.href : "unknown",
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
    timestamp: new Date().toISOString(),
  };

  if (IS_DEV) {
    if (level === "error") {
      console.error(message, safeContext);
    } else if (level === "warn") {
      console.warn(message, safeContext);
    } else {
      console.info(message, safeContext);
    }
    return;
  }

  // Production sinks
  // 1. Structured console for log aggregators
  console.log(JSON.stringify({ level, message, ...safeContext }));

  // 2. Monitoring (e.g. Sentry) - Placeholder for developer to add token
  // if (level === 'error') { window.Sentry?.captureException(message, { extra: safeContext }); }

  // 3. Custom Supabase Log Drain (optional)
  // Our logger is a core utility, so we avoid importing the supabase client directly here
  // to avoid circular dependencies. Developers can add a hook to the window for global sinks.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof window !== "undefined" && (window as any).LOG_DRAIN_ENABLED) {
    fetch("/functions/v1/log-drain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level, message, ...safeContext }),
    }).catch(() => { /* Silent fail for logs */ });
  }
}

export const logger = {
  error(message: string, context?: LogContext) {
    emit("error", message, context);
  },
  warn(message: string, context?: LogContext) {
    emit("warn", message, context);
  },
  info(message: string, context?: LogContext) {
    emit("info", message, context);
  },
};
