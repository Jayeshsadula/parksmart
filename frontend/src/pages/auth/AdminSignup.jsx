// src/pages/auth/AdminSignup.jsx
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signupAdmin } from "../../services/authService.js";
import { useAuth } from "../../context/AuthContext.jsx";

export default function AdminSignup() {
  const nav = useNavigate();
  const { setCurrentUser, setRole } = useAuth();
  const [form, setForm] = useState({
    ownerName: "", businessName: "", email: "",
    password: "", location: "", capacity: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const admin = await signupAdmin(form);
      setCurrentUser(admin); setRole("admin");
      nav("/admin/dashboard");
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
        <button className="btn-back" onClick={() => nav("/admin/login")}>← Back</button>
        <div className="auth-title">Register Parking 🏢</div>
        <div className="auth-sub">Set up your parking management account</div>
        {error && <div className="error-box">{error}</div>}
        <form onSubmit={handle}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Owner Name</label>
              <input className="form-input" required {...f("ownerName")} />
            </div>
            <div className="form-group">
              <label className="form-label">Business Name</label>
              <input className="form-input" required {...f("businessName")} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" required {...f("email")} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" required minLength={6} {...f("password")} />
            </div>
            <div className="form-group">
              <label className="form-label">Total Capacity</label>
              <input className="form-input" type="number" min="1" required {...f("capacity")} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Location</label>
            <input className="form-input" placeholder="Banjara Hills, Hyderabad" required {...f("location")} />
          </div>
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? "Registering..." : "Register & Continue"}
          </button>
        </form>
        <div className="auth-switch">Have account? <Link to="/admin/login">Sign in</Link></div>
      </div>
    </div>
  );
}
