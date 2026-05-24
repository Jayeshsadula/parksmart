// src/pages/auth/AdminLogin.jsx
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { loginAdmin } from "../../services/authService.js";
import { useAuth } from "../../context/AuthContext.jsx";

export default function AdminLogin() {
  const nav = useNavigate();
  const { setCurrentUser, setRole } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const admin = await loginAdmin(form.email, form.password);
      setCurrentUser(admin); setRole("admin");
      nav("/admin/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-box">
        <button className="btn-back" onClick={() => nav("/")}>← Back</button>
        <div className="logo" style={{ marginBottom: 20 }}><div className="logo-icon">🅿</div> ParkSmart AI</div>
        <div className="auth-title">Admin Portal 🏢</div>
        <div className="auth-sub">Manage your parking infrastructure</div>
        {error && <div className="error-box">{error}</div>}
        <form onSubmit={handle}>
          <div className="form-group">
            <label className="form-label">Admin Email</label>
            <input className="form-input" type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          </div>
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Admin Sign In"}
          </button>
        </form>
        <div className="auth-switch">New admin? <Link to="/admin/signup">Register</Link></div>
      </div>
    </div>
  );
}
