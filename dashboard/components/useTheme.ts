"use client";
import { useSyncExternalStore } from "react";

const query = "(prefers-color-scheme: dark)";

function subscribe(cb: () => void) {
  const mq = window.matchMedia(query);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

// สีของกราฟ (SVG) ต้องเป็น hex จริง จึงต้องรู้ว่าตอนนี้ธีมไหน
export function useTheme(): "light" | "dark" {
  return useSyncExternalStore(
    subscribe,
    () => {
      const forced = document.documentElement.dataset.theme;
      if (forced === "light" || forced === "dark") return forced;
      return window.matchMedia(query).matches ? "dark" : "light";
    },
    () => "light",
  );
}
