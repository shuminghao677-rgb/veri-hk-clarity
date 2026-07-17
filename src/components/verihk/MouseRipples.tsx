import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Ripple {
  id: number;
  x: number;
  y: number;
}

export function MouseRipples() {
  const [mounted, setMounted] = useState(false);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const idRef = useRef(0);
  const lastRef = useRef(0);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    setMounted(true);

    const handleMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
      const now = Date.now();
      if (now - lastRef.current < 120) return;
      lastRef.current = now;

      const id = ++idRef.current;
      setRipples((prev) => {
        const next = [...prev, { id, x: e.clientX, y: e.clientY }];
        return next.length > 8 ? next.slice(next.length - 8) : next;
      });

      window.setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== id));
      }, 900);
    };

    const handleClick = (e: MouseEvent) => {
      const id = ++idRef.current;
      setRipples((prev) => {
        const next = [...prev, { id, x: e.clientX, y: e.clientY }];
        return next.length > 8 ? next.slice(next.length - 8) : next;
      });

      window.setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== id));
      }, 900);
    };

    window.addEventListener("mousemove", handleMove, { passive: true });
    window.addEventListener("click", handleClick, { passive: true });

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("click", handleClick);
    };
  }, []);

  if (!mounted) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
      <AnimatePresence>
        {ripples.map((ripple) => (
          <motion.span
            key={ripple.id}
            initial={{ opacity: 0.35, scale: 0, x: ripple.x, y: ripple.y }}
            animate={{ opacity: 0, scale: 2.2, x: ripple.x, y: ripple.y }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/25 bg-primary/8"
            style={{ width: 12, height: 12 }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
