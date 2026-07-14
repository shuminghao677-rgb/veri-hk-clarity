import { ShieldCheck } from "lucide-react";

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <div
      className="grid shrink-0 place-items-center rounded-2xl gradient-primary text-white shadow-elegant"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <ShieldCheck className="h-5 w-5" />
    </div>
  );
}
