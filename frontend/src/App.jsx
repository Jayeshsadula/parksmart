// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { BookingProvider } from "./context/BookingContext.jsx";

// Auth pages
import Landing from "./pages/Landing.jsx";
import UserLogin from "./pages/auth/UserLogin.jsx";
import UserSignup from "./pages/auth/UserSignup.jsx";
import AdminLogin from "./pages/auth/AdminLogin.jsx";
import AdminSignup from "./pages/auth/AdminSignup.jsx";

// User pages
import UserDashboard from "./pages/user/UserDashboard.jsx";
import BookSlot from "./pages/user/BookSlot.jsx";
import MyBookings from "./pages/user/MyBookings.jsx";
import UserProfile from "./pages/user/UserProfile.jsx";

// Admin pages
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import LayoutBuilder from "./pages/admin/LayoutBuilder.jsx";
import ParkingManagement from "./pages/admin/ParkingManagement.jsx";
import AdminBookings from "./pages/admin/AdminBookings.jsx";
import Analytics from "./pages/admin/Analytics.jsx";
import Penalties from "./pages/admin/Penalties.jsx";
import QRScanner from "./pages/admin/QRScanner.jsx";

// Route guards
const UserRoute = ({ children }) => {
  const { currentUser, role, loading } = useAuth();
  if (loading) return <div style={{ color: "#fff", padding: 40 }}>Loading...</div>;
  return currentUser && role === "user" ? children : <Navigate to="/user/login" />;
};

const AdminRoute = ({ children }) => {
  const { currentUser, role, loading } = useAuth();
  if (loading) return <div style={{ color: "#fff", padding: 40 }}>Loading...</div>;
  return currentUser && role === "admin" ? children : <Navigate to="/admin/login" />;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Landing />} />
      <Route path="/user/login" element={<UserLogin />} />
      <Route path="/user/signup" element={<UserSignup />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin/signup" element={<AdminSignup />} />

      {/* User protected */}
      <Route path="/user/dashboard" element={<UserRoute><UserDashboard /></UserRoute>} />
      <Route path="/user/book" element={<UserRoute><BookingProvider><BookSlot /></BookingProvider></UserRoute>} />
      <Route path="/user/bookings" element={<UserRoute><MyBookings /></UserRoute>} />
      <Route path="/user/profile" element={<UserRoute><UserProfile /></UserRoute>} />

      {/* Admin protected */}
      <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
      <Route path="/admin/layout-builder" element={<AdminRoute><LayoutBuilder /></AdminRoute>} />
      <Route path="/admin/parking-management" element={<AdminRoute><ParkingManagement /></AdminRoute>} />
      <Route path="/admin/bookings" element={<AdminRoute><AdminBookings /></AdminRoute>} />
      <Route path="/admin/analytics" element={<AdminRoute><Analytics /></AdminRoute>} />
      <Route path="/admin/penalties" element={<AdminRoute><Penalties /></AdminRoute>} />
      <Route path="/admin/scanner" element={<AdminRoute><QRScanner /></AdminRoute>} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
