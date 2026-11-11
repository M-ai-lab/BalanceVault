let redis = null;
if (process.env.REDIS_URL) {
  const Redis = require("ioredis");
  redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
  redis.on("error", () => {});
  redis.connect().catch(() => { console.warn("Redis unavailable, using in-memory rate limiting"); });
}
const mem = new Map();
function limiter({ windowSec, max, name }) {
  return async (req, res, next) => {
    const key = `rl:${name}:${req.ip}`;
    let count;
    try {
      if (redis && redis.status === "ready") {
        count = await redis.incr(key);
        if (count === 1) await redis.expire(key, windowSec);
      } else throw new Error("fallback");
    } catch {
      const now = Date.now(), e = mem.get(key);
      if (!e || e.exp < now) { mem.set(key, { n: 1, exp: now + windowSec * 1000 }); count = 1; }
      else count = ++e.n;
    }
    if (count > max) return res.status(429).json({ error: "Too many requests" });
    next();
  };
}
const redisReady = async () => { if (!redis || redis.status !== "ready") return false; try { return (await redis.ping()) === "PONG"; } catch { return false; } };
module.exports = { limiter, redisReady };
