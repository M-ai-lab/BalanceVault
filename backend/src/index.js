require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const db = require("./db");
const { sign, requireAuth, requireRole, audit } = require("./auth");
const { limiter, redisReady } = require("./ratelimit");
const { bootstrapAdmin } = require("./bootstrap");

const app = express();
app.set("trust proxy", 1);
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json({ limit: "50kb" }));

const safe = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, active: u.active, createdAt: u.createdAt });
const wrap = (fn) => (req, res) => fn(req, res).catch((e) => { console.error(e); res.status(500).json({ error: "Server error" }); });

app.get("/health", (_q, r) => r.json({ status: "ok" }));
app.get("/ready", async (_q, r) => {
  let dbOk = false;
  try { await db.$queryRaw`SELECT 1`; dbOk = true; } catch {}
  r.status(dbOk ? 200 : 503).json({ ready: dbOk, database: dbOk, redis: await redisReady() });
});

const authLimit = limiter({ name: "auth", windowSec: 60, max: 10 });
app.use("/api", limiter({ name: "api", windowSec: 60, max: 120 }));

app.post("/api/bootstrap-admin", authLimit, wrap(async (req, res) => {
  if (req.headers["x-bootstrap-token"] !== process.env.BOOTSTRAP_TOKEN) return res.status(403).json({ error: "Forbidden" });
  const { email, password } = req.body || {};
  if (!email || !password || password.length < 10) return res.status(400).json({ error: "email and password (10+ chars) required" });
  try { res.status(201).json(safe(await bootstrapAdmin(email.toLowerCase(), password))); }
  catch (e) { res.status(409).json({ error: e.message }); }
}));

app.post("/api/auth/register", authLimit, wrap(async (req, res) => {
  const { email, name, password } = req.body || {};
  if (!email || !name || !password || password.length < 8) return res.status(400).json({ error: "email, name, password (8+ chars) required" });
  if (await db.user.findUnique({ where: { email: email.toLowerCase() } })) return res.status(409).json({ error: "Email already registered" });
  const u = await db.user.create({ data: { email: email.toLowerCase(), name, passwordHash: await bcrypt.hash(password, 12) } });
  await audit(u.id, "USER_REGISTERED", u.id);
  res.status(201).json({ token: sign(u), user: safe(u) });
}));
app.post("/api/auth/login", authLimit, wrap(async (req, res) => {
  const { email, password } = req.body || {};
  const u = email && (await db.user.findUnique({ where: { email: String(email).toLowerCase() } }));
  if (!u || !u.active || !(await bcrypt.compare(password || "", u.passwordHash))) {
    await audit(u?.id || null, "LOGIN_FAILED", email ? String(email) : null);
    return res.status(401).json({ error: "Invalid credentials" });
  }
  await audit(u.id, "LOGIN", u.id);
  res.json({ token: sign(u), user: safe(u) });
}));
app.get("/api/me", requireAuth, (req, res) => res.json(safe(req.user)));

app.post("/api/accounts", requireAuth, wrap(async (req, res) => {
  const type = ["CHECKING", "SAVINGS"].includes(req.body?.type) ? req.body.type : null;
  if (!type) return res.status(400).json({ error: "type must be CHECKING or SAVINGS" });
  const a = await db.account.create({ data: { number: "BV" + Math.floor(1e9 + Math.random() * 9e9), type, ownerId: req.user.id } });
  await audit(req.user.id, "ACCOUNT_APPLIED", a.id, { type });
  res.status(201).json(a);
}));
app.get("/api/accounts", requireAuth, wrap(async (req, res) => {
  const where = req.user.role === "ADMIN" ? {} : { ownerId: req.user.id };
  res.json(await db.account.findMany({ where, orderBy: { createdAt: "desc" }, include: { owner: { select: { email: true, name: true } } } }));
}));

const admin = [requireAuth, requireRole("ADMIN")];
app.get("/api/admin/users", ...admin, wrap(async (_q, res) => res.json((await db.user.findMany({ orderBy: { createdAt: "desc" } })).map(safe))));
app.patch("/api/admin/users/:id", ...admin, wrap(async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: "Cannot modify your own account" });
  const data = {};
  if (typeof req.body.active === "boolean") data.active = req.body.active;
  if (["ADMIN", "HOLDER"].includes(req.body.role)) data.role = req.body.role;
  const u = await db.user.update({ where: { id: req.params.id }, data });
  await audit(req.user.id, "USER_UPDATED", u.id, data);
  res.json(safe(u));
}));
for (const [verb, status] of [["approve", "ACTIVE"], ["reject", "REJECTED"]]) {
  app.post(`/api/admin/accounts/:id/${verb}`, ...admin, wrap(async (req, res) => {
    const a = await db.account.update({ where: { id: req.params.id }, data: { status } });
    await audit(req.user.id, `ACCOUNT_${status}`, a.id);
    res.json(a);
  }));
}
app.get("/api/admin/audit", ...admin, wrap(async (_q, res) => {
  const logs = await db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { actor: { select: { email: true } } } });
  res.json(logs.map(l => ({ ...l, meta: l.meta ? JSON.parse(l.meta) : null })));
}));

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`BalanceVault API on :${port}`));
