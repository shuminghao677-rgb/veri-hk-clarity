import { Link, useRouterState } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";


const navItems = [
  { label: "Story", to: "/" },
  { label: "Verify", to: "/verify" },
  { label: "Dashboard", to: "/dashboard" },
  { label: "History", to: "/history" },
  { label: "Sources", to: "/sources" },
  { label: "About", to: "/about" },
];

export function PremiumNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <header className="sticky top-0 z-40 border-b border-[rgb(8_23_45_/_10%)] bg-white/85 backdrop-blur-[18px]">
      <div className="premium-container flex h-14 items-center gap-3">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#08172d] text-white">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold text-[rgb(8_23_45_/_88%)]">VeriHK</span>
        </Link>

        <nav className="ml-auto hidden items-center gap-7 md:flex">
          {navItems.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`relative py-1 text-sm transition-colors after:absolute after:-bottom-3 after:left-0 after:h-px after:bg-[#08172d] after:transition-all after:duration-200 ${
                  active
                    ? "font-medium text-[rgb(8_23_45_/_90%)] after:w-full after:opacity-100"
                    : "text-[rgb(8_23_45_/_55%)] after:w-0 after:opacity-0 hover:text-[rgb(8_23_45_/_78%)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-3">
          <Button asChild className="h-9 rounded-xl bg-[#0878f9] px-4 text-sm shadow-none hover:bg-[#006ee8]">
            <Link to="/verify">Start Verification</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
