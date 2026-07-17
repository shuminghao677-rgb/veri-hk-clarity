import { Outlet, createFileRoute } from "@tanstack/react-router";
import { PremiumNav } from "@/components/verihk/PremiumNav";
import { MouseRipples } from "@/components/verihk/MouseRipples";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  return (
    <div className="premium-page min-h-screen">
      <PremiumNav />
      <main>
        <Outlet />
      </main>
      <MouseRipples />
    </div>
  );
}
