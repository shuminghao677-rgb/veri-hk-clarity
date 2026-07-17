import { useEffect, useRef, useState } from "react";

export function MouseRipples() {
  const [mounted, setMounted] = useState(false);
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);

    const lerp = (start: number, end: number, factor: number) => {
      return start + (end - start) * factor;
    };

    const animate = () => {
      const cursor = cursorRef.current;
      if (cursor) {
        currentRef.current.x = lerp(currentRef.current.x, targetRef.current.x, 0.12);
        currentRef.current.y = lerp(currentRef.current.y, targetRef.current.y, 0.12);
        cursor.style.transform = `translate3d(${currentRef.current.x}px, ${currentRef.current.y}px, 0) translate(-50%, -50%)`;
      }
      rafRef.current = requestAnimationFrame(animate);
    };

    const handleMove = (e: MouseEvent) => {
      targetRef.current = { x: e.clientX, y: e.clientY };
    };

    window.addEventListener("mousemove", handleMove, { passive: true });
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", handleMove);
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
    </div>
  );
}
