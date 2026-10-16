/**
 * SafeSpace In-Memory Abuse Prevention & Sliding Window Rate Limiter
 *
 * Designed for anonymous public traffic to prevent API key exhaustion and runaway bills.
 */

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

const ROUTE_LIMITS: Record<string, RateLimitConfig> = {
  interpretation: { windowMs: 60_000, maxRequests: 15 }, // 15/min
  explanation: { windowMs: 60_000, maxRequests: 25 },    // 25/min
  visualize: { windowMs: 60_000, maxRequests: 4 },       // 4/min for image gen
  default: { windowMs: 60_000, maxRequests: 30 },
};

// Global daily ceiling across all anonymous requests on this instance
const GLOBAL_DAILY_CEILING = 300;
let globalDailyCount = 0;
let globalDailyReset = Date.now() + 86_400_000;

// IP -> Map<route, timestamp[]>
const ipRequestHistory = new Map<string, Map<string, number[]>>();

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0].trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "anonymous-local";
}

export interface RateLimitCheckResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds?: number;
  reason?: string;
}

export function checkRateLimit(ip: string, routeKey: string): RateLimitCheckResult {
  const now = Date.now();

  // Check global daily ceiling
  if (now > globalDailyReset) {
    globalDailyCount = 0;
    globalDailyReset = now + 86_400_000;
  }

  if (globalDailyCount >= GLOBAL_DAILY_CEILING) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((globalDailyReset - now) / 1000),
      reason: "Global daily AI request budget reached for SafeSpace guest preview.",
    };
  }

  const config = ROUTE_LIMITS[routeKey] || ROUTE_LIMITS.default;
  const cutoff = now - config.windowMs;

  let ipMap = ipRequestHistory.get(ip);
  if (!ipMap) {
    ipMap = new Map();
    ipRequestHistory.set(ip, ipMap);
  }

  let timestamps = ipMap.get(routeKey) || [];
  // Prune expired timestamps
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

  // Record request
  timestamps.push(now);
  ipMap.set(routeKey, timestamps);
  globalDailyCount++;

  // Periodic pruning of dead IPs to prevent memory leak
  if (ipRequestHistory.size > 2000) {
    for (const [key, map] of ipRequestHistory.entries()) {
      let active = false;
      for (const list of map.values()) {
        if (list.some((t) => t > cutoff)) {
          active = true;
          break;
        }
      }
      if (!active) {
        ipRequestHistory.delete(key);
      }
    }
  }

  return {
    allowed: true,
    remaining: config.maxRequests - timestamps.length,
  };
}
