-- OPTIONAL: separate DB roles by responsibility (run as DB owner AFTER migrations).
CREATE ROLE bv_app LOGIN PASSWORD 'app_pw_change_me';
CREATE ROLE bv_readonly LOGIN PASSWORD 'ro_pw_change_me';
GRANT SELECT, INSERT, UPDATE ON "User", "Account" TO bv_app;
GRANT SELECT, INSERT ON "AuditLog" TO bv_app;      -- audit log is append-only
GRANT SELECT ON ALL TABLES IN SCHEMA public TO bv_readonly;
-- Point backend DATABASE_URL at bv_app to enforce least privilege.
