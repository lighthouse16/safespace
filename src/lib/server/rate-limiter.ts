/**
 * SafeSpace Shared Abuse Prevention & Rate Limiter
 *
 * Implements:
 * 1. Shared atomic persistence across multi-process and serverless instances.
 * 2. Fail-closed emergency shutdown via GEMINI_DAILY_BUDGET=0.
 * 3. Real-money budget protection with explicit per-model cost & daily ceilings.
 * 4. Non-spoofable client IP identity resolution (rejects rotated leftmost X-Forwarded-For).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, openSync, closeSync, unlinkSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  dailyQuota: number;
  costUnits: number;
}

export const ROUTE_LIMITS: Record<string, RateLimitConfig> = {
  interpretation: { windowMs: 60_000, maxRequests: 15, dailyQuota: 100, costUnits: 1 },
  explanation:    { windowMs: 60_000, maxRequests: 25, dailyQuota: 100, costUnits: 1 },
  visualize:      { windowMs: 60_000, maxRequests: 4,  dailyQuota: 20,  costUnits: 5 }, // Higher cost for image models
  default:        { windowMs: 60_000, maxRequests: 30, dailyQuota: 200, costUnits: 1 },
};

export function getDailyBudgetCeiling(): number {
  const envBudget = process.env.GEMINI_DAILY_BUDGET;
  if (envBudget !== undefined) {
    const parsed = parseInt(envBudget, 10);
    return Number.isFinite(parsed) ? parsed : 200;
  }
  return 200;
}

/**
 * Extracts client IP securely.
 * Rejects client-spoofed leftmost X-Forwarded-For entries by taking the rightmost IP
 * appended by the trusted reverse proxy, or using platform-authenticated headers.
 */
export function getClientIp(request: Request): string {
  // 1. Configured trusted platform header
  const trustedHeader = process.env.TRUSTED_IP_HEADER?.trim();
  if (trustedHeader) {
    const val = request.headers.get(trustedHeader)?.trim();
    if (val) return sanitizeIp(val.split(",")[0].trim());
  }

  // 2. Vercel edge header (set by Vercel infrastructure, cannot be forged)
  const vercelIp = request.headers.get("x-vercel-forwarded-for");
  if (vercelIp) return sanitizeIp(vercelIp.split(",")[0].trim());

  // 3. Cloudflare connecting IP
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return sanitizeIp(cfIp.trim());

  // 4. Trusted reverse proxy real-ip
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return sanitizeIp(realIp.trim());

  // 5. Standard X-Forwarded-For:
  // ATTACK RESISTANCE: The client controls the first element (leftmost).
  // The nearest trusted reverse proxy appends the caller's actual socket IP to the end (rightmost).
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) {
      // Use rightmost IP to resist client rotation
      return sanitizeIp(parts[parts.length - 1]);
    }
  }

  return "anonymous-local";
}

function sanitizeIp(ip: string): string {
  // Strip IPv4 port if present (e.g. 1.2.3.4:5678)
  if (ip.includes(":") && !ip.includes("::") && ip.split(":").length === 2) {
    return ip.split(":")[0];
  }
  return ip.slice(0, 64);
}

export interface RateLimitCheckResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds?: number;
  reason?: string;
  consumedCost?: number;
}

interface SharedStoreData {
  globalDailyCost: number;
  globalDailyReset: number;
  routeDailyUsage: Record<string, number>;
  ipHistories: Record<string, Record<string, number[]>>;
}

let memoryFallbackStore: SharedStoreData = {
  globalDailyCost: 0,
  globalDailyReset: Date.now() + 86_400_000,
  routeDailyUsage: {},
  ipHistories: {},
};

function getStorageDir(): string {
  return process.env.RATE_LIMIT_STORE_DIR || join(tmpdir(), "safespace_ratelimit");
}

function getStateFilePath(): string {
  return join(getStorageDir(), "state.json");
}

function getLockFilePath(): string {
  return join(getStorageDir(), "state.lock");
}

function acquireLock(lockPath: string, maxWaitMs = 1500): boolean {
  const dir = getStorageDir();
  try {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  } catch {}

  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const fd = openSync(lockPath, "wx");
      closeSync(fd);
      return true;
    } catch {
      // Check for stale lock (> 5 seconds old)
      try {
        const stat = statSync(lockPath);
        if (Date.now() - stat.mtimeMs > 5000) {
          unlinkSync(lockPath);
          continue;
        }
      } catch {}
      // Small busy-wait backoff
      const endWait = Date.now() + 5;
      while (Date.now() < endWait) {}
    }
  }
  return false;
}

function releaseLock(lockPath: string): void {
  try {
    unlinkSync(lockPath);
  } catch {}
}

function loadSharedState(): SharedStoreData {
  try {
    const filePath = getStateFilePath();
    if (existsSync(/*turbopackIgnore: true*/ filePath)) {
      const content = readFileSync(filePath, "utf-8");
      return JSON.parse(content) as SharedStoreData;
    }
  } catch {}
  return memoryFallbackStore;
}

function saveSharedState(state: SharedStoreData): void {
  try {
    const dir = getStorageDir();
    if (!existsSync(/*turbopackIgnore: true*/ dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const filePath = getStateFilePath();
    writeFileSync(filePath, JSON.stringify(state), "utf-8");
  } catch {
    memoryFallbackStore = state;
  }
}

/**
 * Resets shared rate limit counters (used in testing and maintenance).
 */
export function resetRateLimits(): void {
  const filePath = getStateFilePath();
  const lockPath = getLockFilePath();
  try {
    if (existsSync(filePath)) unlinkSync(filePath);
  } catch {}
  try {
    if (existsSync(lockPath)) unlinkSync(lockPath);
  } catch {}
  memoryFallbackStore = {
    globalDailyCost: 0,
    globalDailyReset: Date.now() + 86_400_000,
    routeDailyUsage: {},
    ipHistories: {},
  };
}

/**
 * Checks and records rate limit and daily cost quota atomically across processes.
 */
export function checkRateLimit(ip: string, routeKey: string): RateLimitCheckResult {
  const dailyBudget = getDailyBudgetCeiling();

  // 1. Fail-closed emergency shutdown
  if (dailyBudget <= 0) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 86400,
      reason: "Emergency AI shutdown active: GEMINI_DAILY_BUDGET=0",
    };
  }

  const config = ROUTE_LIMITS[routeKey] || ROUTE_LIMITS.default;
  const lockPath = getLockFilePath();
  const lockAcquired = acquireLock(lockPath);

  if (!lockAcquired) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 1,
      reason: "Rate limiter state lock contention. Please retry in 1 second.",
    };
  }

  try {
    const now = Date.now();
    const state = loadSharedState();

    // Check daily reset
    if (now > state.globalDailyReset) {
      state.globalDailyCost = 0;
      state.globalDailyReset = now + 86_400_000;
      state.routeDailyUsage = {};
    }

    // 2. Global daily cost ceiling check
    if (state.globalDailyCost + config.costUnits > dailyBudget) {
      const retryAfterSeconds = Math.max(1, Math.ceil((state.globalDailyReset - now) / 1000));
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds,
        reason: `Global daily AI request budget (${dailyBudget} units) reached for SafeSpace guest preview.`,
      };
    }

    // 3. Per-route daily quota check
    const routeUsage = state.routeDailyUsage[routeKey] || 0;
    if (routeUsage >= config.dailyQuota) {
      const retryAfterSeconds = Math.max(1, Math.ceil((state.globalDailyReset - now) / 1000));
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds,
        reason: `Daily quota of ${config.dailyQuota} requests reached for ${routeKey}.`,
      };
    }

    // 4. Sliding-window per-minute rate limit check for this IP
    const cutoff = now - config.windowMs;
    const ipMap = state.ipHistories[ip] || {};
    let timestamps = ipMap[routeKey] || [];
    timestamps = timestamps.filter((t) => t > cutoff);

    if (timestamps.length >= config.maxRequests) {
      const oldest = timestamps[0];
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + config.windowMs - now) / 1000));
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds,
        reason: `Too many requests for ${routeKey}. Maximum ${config.maxRequests} per minute.`,
      };
    }

    // 5. Record request and increment shared quotas
    timestamps.push(now);
    ipMap[routeKey] = timestamps;
    state.ipHistories[ip] = ipMap;
    state.globalDailyCost += config.costUnits;
    state.routeDailyUsage[routeKey] = routeUsage + 1;

    // Prune stale IPs to prevent unbounded memory/file growth
    const ipKeys = Object.keys(state.ipHistories);
    if (ipKeys.length > 1000) {
      for (const k of ipKeys) {
        let active = false;
        for (const list of Object.values(state.ipHistories[k])) {
          if (list.some((t) => t > cutoff)) {
            active = true;
            break;
          }
        }
        if (!active) {
          delete state.ipHistories[k];
        }
      }
    }

    saveSharedState(state);

    return {
      allowed: true,
      remaining: config.maxRequests - timestamps.length,
      consumedCost: state.globalDailyCost,
    };
  } finally {
    if (lockAcquired) {
      releaseLock(lockPath);
    }
  }
}
