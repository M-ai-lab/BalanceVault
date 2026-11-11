import { useState, useEffect, useCallback } from "react";

async function api(path, { method = "GET", body, token } = {}) {
  const r = await fetch("/api" + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "Request failed");
  return data;
}

function AuthForm({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [f, setF] = useState({ email: "", name: "", password: "" });
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async () => {
    setErr("");
    try { onAuth(await api(`/auth/${mode}`, { method: "POST", body: f })); } catch (e) { setErr(e.message); }
  };
  return (
    <div className="card">
      <h2>{mode === "login" ? "Sign in" : "Register as account holder"}</h2>
      <input placeholder="Email" value={f.email} onChange={set("email")} />
      {mode === "register" && <input placeholder="Full name" value={f.name} onChange={set("name")} />}
      <input type="password" placeholder="Password" value={f.password} onChange={set("password")} />
      <div><button onClick={submit}>{mode === "login" ? "Sign in" : "Register"}</button>
      <button className="sec" onClick={() => setMode(mode === "login" ? "register" : "login")}>
        {mode === "login" ? "Need an account?" : "Have an account?"}</button></div>
      {err && <p className="err">{err}</p>}
    </div>
  );
}

function Accounts({ token, isAdmin }) {
  const [rows, setRows] = useState([]);
  const [type, setType] = useState("CHECKING");
  const [err, setErr] = useState("");
  const load = useCallback(() => api("/accounts", { token }).then(setRows).catch((e) => setErr(e.message)), [token]);
  useEffect(() => { load(); }, [load]);
  const act = (id, v) => api(`/admin/accounts/${id}/${v}`, { method: "POST", token }).then(load).catch((e) => setErr(e.message));
  return (
    <div className="card">
      <h3>Accounts</h3>
      {!isAdmin && <div>
        <select value={type} onChange={(e) => setType(e.target.value)}><option>CHECKING</option><option>SAVINGS</option></select>
        <button onClick={() => api("/accounts", { method: "POST", token, body: { type } }).then(load).catch((e) => setErr(e.message))}>Apply for account</button>
      </div>}
      {err && <p className="err">{err}</p>}
      <div className="tbl"><table><thead><tr><th>Number</th><th>Type</th><th>Status</th><th>Balance</th>{isAdmin && <><th>Owner</th><th></th></>}</tr></thead>
        <tbody>{rows.map((a) => <tr key={a.id}><td>{a.number}</td><td>{a.type}</td><td>{a.status}</td><td>{a.balance}</td>
          {isAdmin && <><td>{a.owner?.email}</td><td>{a.status === "PENDING" && <><button onClick={() => act(a.id, "approve")}>Approve</button><button className="sec" onClick={() => act(a.id, "reject")}>Reject</button></>}</td></>}
        </tr>)}</tbody></table></div>
    </div>
  );
}

function Users({ token }) {
  const [rows, setRows] = useState([]);
  const load = useCallback(() => api("/admin/users", { token }).then(setRows), [token]);
  useEffect(() => { load(); }, [load]);
  const patch = (id, body) => api(`/admin/users/${id}`, { method: "PATCH", token, body }).then(load).catch((e) => alert(e.message));
  return (
    <div className="card"><h3>Users</h3><div className="tbl"><table>
      <thead><tr><th>Email</th><th>Role</th><th>Active</th><th></th></tr></thead>
      <tbody>{rows.map((u) => <tr key={u.id}><td>{u.email}</td><td>{u.role}</td><td>{String(u.active)}</td>
        <td><button className="sec" onClick={() => patch(u.id, { active: !u.active })}>{u.active ? "Deactivate" : "Activate"}</button></td></tr>)}</tbody></table></div></div>
  );
}

function Audit({ token }) {
  const [rows, setRows] = useState([]);
  useEffect(() => { api("/admin/audit", { token }).then(setRows); }, [token]);
  return (
    <div className="card"><h3>Audit log</h3><div className="tbl"><table>
      <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Target</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.id}><td>{new Date(r.createdAt).toLocaleString()}</td><td>{r.actor?.email || "-"}</td><td>{r.action}</td><td className="mut">{r.target}</td></tr>)}</tbody></table></div></div>
  );
}

export default function App() {
  const [s, setS] = useState(() => { try { return JSON.parse(sessionStorage.getItem("bv")); } catch { return null; } });
  const [tab, setTab] = useState("accounts");
  const auth = (v) => { sessionStorage.setItem("bv", JSON.stringify(v)); setS(v); };
  const out = () => { sessionStorage.removeItem("bv"); setS(null); };
  if (!s) return <div className="wrap"><h1>BalanceVault</h1><p className="mut">Hackathon demo, synthetic data only.</p><AuthForm onAuth={auth} /></div>;
  const isAdmin = s.user.role === "ADMIN";
  return (
    <div className="wrap">
      <nav><h2>BalanceVault</h2><button className="sec" onClick={() => setTab("accounts")}>Accounts</button>
        {isAdmin && <><button className="sec" onClick={() => setTab("users")}>Users</button><button className="sec" onClick={() => setTab("audit")}>Audit log</button></>}
        <span className="sp" /><span className="mut">{s.user.email} ({s.user.role})</span><button onClick={out}>Sign out</button></nav>
      {tab === "accounts" && <Accounts token={s.token} isAdmin={isAdmin} />}
      {tab === "users" && isAdmin && <Users token={s.token} />}
      {tab === "audit" && isAdmin && <Audit token={s.token} />}
    </div>
  );
}
