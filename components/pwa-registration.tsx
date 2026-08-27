"use client";

import { useEffect } from "react";

export function PwaRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // La app sigue funcionando como web si el navegador no admite el registro.
      });
    }
  }, []);

  return null;
}
