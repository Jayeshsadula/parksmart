// src/services/authService.js
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "./firebase";
import { createUser, getUser, createAdmin, getAdmin } from "./firestoreService";

// ── User Auth ──────────────────────────────────────────────────────────────
export const signupUser = async ({ name, email, password, phone, vehicleNumber }) => {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await createUser(cred.user.uid, { name, email, phone, vehicleNumber });
  return cred.user;
};

export const loginUser = async (email, password) => {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const profile = await getUser(cred.user.uid);
  if (!profile || profile.role !== "user") {
    await signOut(auth);
    throw new Error("Not a user account");
  }
  return { ...cred.user, ...profile };
};

// ── Admin Auth ─────────────────────────────────────────────────────────────
export const signupAdmin = async ({ ownerName, businessName, email, password, location, capacity }) => {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await createAdmin(cred.user.uid, { ownerName, businessName, email, location, capacity });
  return cred.user;
};

export const loginAdmin = async (email, password) => {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const profile = await getAdmin(cred.user.uid);
  if (!profile || profile.role !== "admin") {
    await signOut(auth);
    throw new Error("Not an admin account");
  }
  return { ...cred.user, ...profile };
};

// ── Shared ─────────────────────────────────────────────────────────────────
export const logout = () => signOut(auth);

export const resetPassword = (email) => sendPasswordResetEmail(auth, email);

export const onAuthChange = (callback) => onAuthStateChanged(auth, callback);
