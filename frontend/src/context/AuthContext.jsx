// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthChange } from "../services/authService.js";
import { getUser, getAdmin } from "../services/firestoreService.js";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [role, setRole] = useState(null); // "user" | "admin"
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        // Try admin first, then user
        let profile = await getAdmin(firebaseUser.uid);
        if (profile) {
          setRole("admin");
        } else {
          profile = await getUser(firebaseUser.uid);
          if (profile) setRole("user");
        }
        setCurrentUser(profile ? { ...firebaseUser, ...profile } : firebaseUser);
      } else {
        setCurrentUser(null);
        setRole(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, role, loading, setCurrentUser, setRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
