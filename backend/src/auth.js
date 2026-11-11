const jwt = require("jsonwebtoken");
const db = require("./db");
const SECRET = process.env.JWT_SECRET || "dev-secret";
const sign = (u) => jwt.sign({ sub: u.id, role: u.role }, SECRET, { expiresIn: "8h" });
async function requireAuth(req, res, next) {
  const h = req.headers.authorization || "";
  try {
    const p = jwt.verify(h.replace("Bearer ", ""), SECRET);
    const user = await db.user.findUnique({ where: { id: p.sub } });
    if (!user || !user.active) return res.status(401).json({ error: "Invalid session" });
    req.user = user; next();
  } catch { res.status(401).json({ error: "Unauthorized" }); }
}
const requireRole = (role) => (req, res, next) =>
  req.user.role === role ? next() : res.status(403).json({ error: "Forbidden" });
const audit = (actorId, action, target, meta) =>
  db.auditLog.create({ data: { actorId, action, target, meta: meta ? JSON.stringify(meta) : undefined } });
module.exports = { sign, requireAuth, requireRole, audit };
