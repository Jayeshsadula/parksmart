// src/pages/auth/UserLogin.jsx
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { loginUser } from "../../services/authService.js";
import { useAuth } from "../../context/AuthContext.jsx";

export default function UserLogin() {
  const nav = useNavigate();
  const { setCurrentUser, setRole } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const user = await loginUser(form.email, form.password);
      setCurrentUser(user); setRole("user");
      nav("/user/dashboard");
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
        <div className="auth-title">Welcome back 🚗</div>
        <div className="auth-sub">Sign in to your driver account</div>
        {error && <div className="error-box">{error}</div>}
        <form onSubmit={handle}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          </div>
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
        <div className="auth-switch">No account? <Link to="/user/signup">Sign up</Link></div>
      </div>
    </div>
  );
}
