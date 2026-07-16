import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Database, Eye, Network, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/about")({
  head: () => ({
    meta: [
      { title: "About — VeriHK" },
      { name: "description", content: "How VeriHK verifies information with official Hong Kong data." },
      { property: "og:title", content: "About — VeriHK" },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="premium-container py-10 md:py-16">
      <div className="max-w-4xl">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[rgb(8_23_45_/_42%)]">
          <Sparkles className="h-3.5 w-3.5" />
          Explainable AI for public information
        </div>
        <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-normal text-[rgb(8_23_45_/_90%)] md:text-6xl">
          Built for people who need to trust the answer.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-[rgb(8_23_45_/_58%)]">
          VeriHK turns public claims into auditable evidence trails using official Hong Kong data.
          The product goal is not just to answer, but to show how the answer was reached.
        </p>
        <Button asChild size="lg" className="mt-8 h-11 rounded-xl bg-[#0878f9] px-5 shadow-none hover:bg-[#006ee8]">
          <Link to="/verify">
            Try the verification flow
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="mt-16 border-y border-[rgb(8_23_45_/_12%)]">
        {[
          {
            icon: ShieldCheck,
            title: "Official by default",
            body: "Weather and transport claims are routed to live official sources before a verdict is shown.",
          },
          {
            icon: Network,
            title: "Evidence network",
            body: "The system separates claims, matches evidence, and keeps the path inspectable.",
          },
          {
            icon: Eye,
            title: "Readable explanations",
            body: "Every report explains the result in plain language, with timestamps and source links.",
          },
          {
            icon: Database,
            title: "Designed for a future evidence archive",
            body: "Scheduled ingestion, deduplication, upserts and sync logs can be added later without changing the report experience.",
          },
        ].map((item) => (
          <section
            key={item.title}
            className="grid gap-5 border-b border-[rgb(8_23_45_/_10%)] py-8 last:border-b-0 md:grid-cols-[220px_1fr]"
          >
            <div className="flex items-center gap-3 text-sm font-semibold text-[rgb(8_23_45_/_84%)]">
              <item.icon className="h-4 w-4 text-[#0878f9]" />
              {item.title}
            </div>
            <p className="max-w-2xl text-base leading-7 text-[rgb(8_23_45_/_58%)]">{item.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
