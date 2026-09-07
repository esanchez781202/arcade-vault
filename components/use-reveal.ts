"use client";

import { useEffect } from "react";

// IntersectionObserver del prototipo: al entrar una .reveal en viewport se le
// añade .in y se deja de observar. Fallback: sin IntersectionObserver, se marcan
// todas como visibles para no dejar secciones invisibles.
// Compartido por app/page.tsx (Home) y app/acerca-de/page.tsx (About).
export function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".reveal");
    if (typeof IntersectionObserver === "undefined") {
      els.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}
