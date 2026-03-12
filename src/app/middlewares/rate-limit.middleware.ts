import type { NextFunction, Request, Response } from "express";
import {
  BETTER_AUTH_BASE_PATH,
  RATE_LIMIT_AUTH_MAX,
  RATE_LIMIT_AUTH_WINDOW_MS,
  RATE_LIMIT_ENABLED,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
} from "../../shared/config/env.config.js";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitConfig = {
  maxRequests: number;
  windowMs: number;
  errorCode: string;
  message: string;
  matches: (req: Request) => boolean;
};

const resolveClientIp = (req: Request): string => {
  if (typeof req.ip === "string" && req.ip.length > 0) {
    return req.ip;
  }

  const forwardedForHeader = req.headers["x-forwarded-for"];
  if (typeof forwardedForHeader === "string" && forwardedForHeader.length > 0) {
    return forwardedForHeader.split(",")[0]?.trim() ?? "unknown";
  }

  return req.socket.remoteAddress ?? "unknown";
};

const createRateLimitMiddleware = (config: RateLimitConfig) => {
  const bucketByClient = new Map<string, RateLimitBucket>();

  return (req: Request, res: Response, next: NextFunction) => {
    if (!RATE_LIMIT_ENABLED || req.method === "OPTIONS" || !config.matches(req)) {
      next();
      return;
    }

    const now = Date.now();
    const clientIp = resolveClientIp(req);
    const bucketKey = `${clientIp}:${config.errorCode}`;
    const existingBucket = bucketByClient.get(bucketKey);

    if (!existingBucket || existingBucket.resetAt <= now) {
      bucketByClient.set(bucketKey, {
        count: 1,
        resetAt: now + config.windowMs,
      });
    } else {
      existingBucket.count += 1;
    }

    const activeBucket = bucketByClient.get(bucketKey);
    if (!activeBucket) {
      next();
      return;
    }

    const remaining = Math.max(0, config.maxRequests - activeBucket.count);
    const retryAfterSeconds = Math.max(1, Math.ceil((activeBucket.resetAt - now) / 1000));

    res.setHeader("X-RateLimit-Limit", String(config.maxRequests));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("X-RateLimit-Reset", String(Math.floor(activeBucket.resetAt / 1000)));

    if (activeBucket.count > config.maxRequests) {
      res.setHeader("Retry-After", String(retryAfterSeconds));
      res.status(429).json({
        error: config.message,
        code: config.errorCode,
        retryAfterSeconds,
      });
      return;
    }

    next();
  };
};

const authEndpointMatcher = (req: Request): boolean => {
  const path = req.path.toLowerCase();
  const authBasePath = BETTER_AUTH_BASE_PATH.toLowerCase();
  if (!path.startsWith(authBasePath)) {
    return false;
  }

  return (
    path.includes("/sign-in") ||
    path.includes("/sign-up") ||
    path.includes("/forget-password") ||
    path.includes("/reset-password")
  );
};

export const globalRateLimitMiddleware = createRateLimitMiddleware({
  maxRequests: RATE_LIMIT_MAX,
  windowMs: RATE_LIMIT_WINDOW_MS,
  errorCode: "RATE_LIMIT_GLOBAL_EXCEEDED",
  message: "Too many requests. Please try again in a moment.",
  matches: (req) => req.path.startsWith("/api"),
});

export const authRateLimitMiddleware = createRateLimitMiddleware({
  maxRequests: RATE_LIMIT_AUTH_MAX,
  windowMs: RATE_LIMIT_AUTH_WINDOW_MS,
  errorCode: "RATE_LIMIT_AUTH_EXCEEDED",
  message: "Too many authentication attempts. Please try again later.",
  matches: authEndpointMatcher,
});
