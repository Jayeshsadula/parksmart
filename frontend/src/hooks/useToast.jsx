// src/hooks/useToast.jsx
import React, { useState, useCallback } from "react";
import Toast from "../components/shared/Toast.jsx";

export default function useToast() {
  const [toasts, setToasts] = useState([]);

  const show = useCallback((message, type = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const ToastContainer = () => (
    <>
      {toasts.map((t) => (
        <Toast
          key={t.id}
          message={t.message}
          type={t.type}
          onClose={() => remove(t.id)}
        />
      ))}
    </>
  );

  return { show, ToastContainer };
}
