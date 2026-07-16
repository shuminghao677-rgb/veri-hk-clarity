import { Outlet, createFileRoute } from "@tanstack/react-router";
import { PremiumNav } from "@/components/verihk/PremiumNav";

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
    </div>
  );
}
