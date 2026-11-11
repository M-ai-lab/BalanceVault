require("dotenv").config();
const bcrypt = require("bcryptjs");
const db = require("./db");
async function bootstrapAdmin(email, password) {
  if (await db.user.findFirst({ where: { role: "ADMIN" } })) throw new Error("Admin already exists");
  const admin = await db.user.create({
    data: { email, name: "Administrator", role: "ADMIN", passwordHash: await bcrypt.hash(password, 12) },
  });
  await db.auditLog.create({ data: { actorId: admin.id, action: "ADMIN_BOOTSTRAPPED", target: admin.id } });
  return admin;
}
module.exports = { bootstrapAdmin };
if (require.main === module) {
  bootstrapAdmin(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD)
    .then((a) => { console.log("Admin created:", a.email); process.exit(0); })
    .catch((e) => { console.error(e.message); process.exit(1); });
}
