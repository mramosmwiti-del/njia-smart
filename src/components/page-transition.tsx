import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [animating, setAnimating] = useState(false);
  const initialPath = useRef(pathname);

  useEffect(() => {
    if (pathname === initialPath.current) return;
    setAnimating(true);
    const id = requestAnimationFrame(() => setAnimating(false));
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  return (
    <div
      className={`transition-all duration-300 ease-out ${
        animating ? "opacity-0 mt-1" : "opacity-100 mt-0"
      }`}
    >
      {children}
    </div>
  );
}
