import { Link, useRouterState } from "@tanstack/react-router";

const navItems = [

  { label: "Story", to: "/" },
  { label: "Verify", to: "/verify" },
  { label: "History", to: "/history" },
  { label: "Sources", to: "/sources" },
  { label: "About", to: "/about" },
];

export function PremiumNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <header className="sticky top-0 z-40 border-b border-[rgb(8_23_45_/_10%)] bg-white/85 backdrop-blur-[18px]">
      <div className="premium-container">
        <div className="flex h-14 items-center gap-3">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <span className="text-[15px] font-medium tracking-[-0.01em] text-[rgb(8_23_45_/_92%)]">
              VeriHK
            </span>
          </Link>


          <nav className="ml-auto hidden items-center gap-7 md:flex">
            {navItems.map((item) => {
              const active = pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`relative py-1 text-sm transition-colors after:absolute after:-bottom-3 after:left-0 after:h-0.5 after:bg-[#08172d] after:transition-all after:duration-200 ${
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

        </div>

        <nav
          className="-mx-4 flex gap-5 overflow-x-auto px-4 pb-3 text-sm [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden"
          aria-label="Mobile navigation"
        >
          {navItems.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`shrink-0 border-b pb-1 transition-colors ${
                  active
                    ? "border-[#08172d] font-medium text-[rgb(8_23_45_/_90%)]"
                    : "border-transparent text-[rgb(8_23_45_/_55%)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
