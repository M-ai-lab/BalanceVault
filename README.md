# BalanceVault (hackathon demo, synthetic data only)

Prereqs: Node 18+, Docker (for Postgres + Redis). Redis is optional (falls back to in-memory rate limiting).

```bash
npm install
npm run db:up            # Postgres + Redis via docker compose
npm run db:generate      # prisma generate
npm run db:migrate       # creates tables (migration "init")
npm run bootstrap:admin  # first admin from backend/.env (admin@balancevault.test / Admin#12345)
npm run dev              # API :4000, web http://localhost:5173
```

Flow: register a holder -> apply for account -> sign in as admin -> approve -> view Users & Audit log.
Health: GET /health, GET /ready. Remote bootstrap: POST /api/bootstrap-admin with header `x-bootstrap-token`.
Optional least-privilege DB roles: db/roles.sql. Change secrets in backend/.env before deploying anywhere.
