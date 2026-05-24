// src/pages/auth/UserSignup.jsx
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signupUser } from "../../services/authService.js";
import { useAuth } from "../../context/AuthContext.jsx";

export default function UserSignup() {
  const nav = useNavigate();
  const { setCurrentUser, setRole } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", vehicleNumber: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const user = await signupUser(form);
      setCurrentUser(user); setRole("user");
      nav("/user/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const f = (k) => ({ value: form[k], onChange: e => setForm({ ...form, [k]: e.target.value }) });

  return (
    <div className="auth-page">
      <div className="auth-box">
        <button className="btn-back" onClick={() => nav("/user/login")}>← Back</button>
        <div className="auth-title">Create Account 🚗</div>
        <div className="auth-sub">Join ParkSmart AI today</div>
        {error && <div className="error-box">{error}</div>}
        <form onSubmit={handle}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input className="form-input" required {...f("name")} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" required {...f("email")} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-input" type="tel" required {...f("phone")} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" required minLength={6} {...f("password")} />
            </div>
            <div className="form-group">
              <label className="form-label">Vehicle Number</label>
              <input className="form-input" placeholder="TS09AB1234" required {...f("vehicleNumber")} />
            </div>
          </div>
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>
        <div className="auth-switch">Have account? <Link to="/user/login">Sign in</Link></div>
      </div>
    </div>
  );
}
