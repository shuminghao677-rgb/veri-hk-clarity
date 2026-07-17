import { useEffect, useRef, useState } from "react";

interface Ripple {
  id: number;
  x: number;
  y: number;
}

export function MouseRipples() {
  const [mounted, setMounted] = useState(false);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const idRef = useRef(0);
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });
  const trailRef = useRef({ x: 0, y: 0, distance: 0 });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);

    const lerp = (start: number, end: number, factor: number) => {
      return start + (end - start) * factor;
    };

    const addRipple = (x: number, y: number) => {
      const id = ++idRef.current;
      setRipples((prev) => {
        const next = [...prev, { id, x, y }];
        return next.length > 6 ? next.slice(next.length - 6) : next;
      });
      window.setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== id));
      }, 900);
    };

    const animate = () => {
      const cursor = cursorRef.current;
      if (cursor) {
        currentRef.current.x = lerp(currentRef.current.x, targetRef.current.x, 0.12);
        currentRef.current.y = lerp(currentRef.current.y, targetRef.current.y, 0.12);
        cursor.style.transform = `translate3d(${currentRef.current.x}px, ${currentRef.current.y}px, 0) translate(-50%, -50%)`;

        const dx = currentRef.current.x - trailRef.current.x;
        const dy = currentRef.current.y - trailRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        trailRef.current.distance += dist;
        trailRef.current.x = currentRef.current.x;
        trailRef.current.y = currentRef.current.y;

        if (trailRef.current.distance > 120) {
          trailRef.current.distance = 0;
          addRipple(currentRef.current.x, currentRef.current.y);
        }
      }
      rafRef.current = requestAnimationFrame(animate);
    };

    const handleMove = (e: MouseEvent) => {
      targetRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleClick = (e: MouseEvent) => {
      addRipple(e.clientX, e.clientY);
    };

    window.addEventListener("mousemove", handleMove, { passive: true });
    window.addEventListener("click", handleClick, { passive: true });
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("click", handleClick);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (!mounted) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
      <div
        ref={cursorRef}
        className="absolute top-0 left-0"
        style={{ willChange: "transform" }}
      >
        <div className="absolute -inset-5 rounded-full bg-primary/12 blur-lg" />
        <div className="absolute inset-0 rounded-full bg-primary/25 blur-[2px]" />
      </div>
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className="absolute rounded-full border border-primary/30 bg-primary/5 ripple-out"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: 14,
            height: 14,
            transform: "translate(-50%, -50%)",
          }}
        />
      ))}
    </div>
  );
}
