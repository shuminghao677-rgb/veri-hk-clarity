import { createFileRoute } from "@tanstack/react-router";
import {
  Target,
  Workflow,
  Eye,
  Database,
  Cpu,
  Rocket,
  ShieldCheck,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/about")({
  head: () => ({
    meta: [
      { title: "About — VeriHK" },
      { name: "description", content: "About VeriHK: mission, how it works, and why explainable AI matters for public information." },
      { property: "og:title", content: "About — VeriHK" },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-8 md:py-16">
      <div className="mb-10 max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-[11px] font-medium text-muted-foreground">
          <ShieldCheck className="h-3 w-3 text-primary" /> About VeriHK
        </div>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
          Public trust, built on <span className="text-gradient">explainable AI</span>.
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          VeriHK is an AI-powered fact verification platform that grounds every answer in official
          Hong Kong government data — with reasoning users can inspect, cite, and share.
        </p>
      </div>

      <Section icon={Target} title="Mission">
        <p>
          Empower Hong Kong residents, journalists and public servants to separate rumor from fact
          in minutes — using transparent AI that shows its work.
        </p>
      </Section>

      <Section icon={Workflow} title="How it works">
        <ol className="grid gap-4 md:grid-cols-3">
          {[
            { t: "Upload", d: "Paste text, drop a screenshot, or upload a PDF." },
            { t: "Extract & retrieve", d: "AI extracts factual claims and pulls live evidence from official sources." },
            { t: "Explain", d: "Every result comes with step-by-step reasoning and cited evidence." },
          ].map((s, i) => (
            <Card key={s.t} className="rounded-2xl border-border/60 p-5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                Step {i + 1}
              </div>
              <div className="mt-1 text-base font-semibold">{s.t}</div>
              <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
            </Card>
          ))}
        </ol>
      </Section>

      <Section icon={Eye} title="Why explainable AI matters">
        <p>
          Black-box answers erode trust. VeriHK exposes the reasoning chain, the retrieved
          evidence, and the confidence score behind every verdict — so users can audit the AI, not
          just trust it.
        </p>
      </Section>

      <Section icon={Database} title="Official data sources">
        <div className="flex flex-wrap gap-2">
          {["Hong Kong Observatory", "Transport Department", "Education Bureau", "news.gov.hk", "data.gov.hk", "Drainage Services"].map(
            (n) => (
              <Badge key={n} variant="outline" className="rounded-full border-border/60 bg-muted/40 px-3 py-1.5">
                {n}
              </Badge>
            ),
          )}
        </div>
      </Section>

      <Section icon={Cpu} title="Technology stack">
        <div className="flex flex-wrap gap-2">
          {["Retrieval-Augmented Generation", "LLM Reasoning", "Vector Search", "OCR", "PDF Parsing", "Government Open Data APIs"].map(
            (n) => (
              <Badge key={n} variant="secondary" className="rounded-full px-3 py-1.5">
                {n}
              </Badge>
            ),
          )}
        </div>
      </Section>

      <Section icon={Rocket} title="Future roadmap">
        <ol className="relative space-y-5 border-l border-border/70 pl-6">
          {[
            { q: "Q3 2026", t: "Bilingual reports", d: "Full 繁體中文 and English side-by-side verification reports." },
            { q: "Q4 2026", t: "Realtime alerts", d: "Subscribe to topics and get notified when official sources contradict trending claims." },
            { q: "Q1 2027", t: "Public API", d: "Programmatic access for newsrooms, government units and research teams." },
          ].map((s, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-[29px] grid h-6 w-6 place-items-center rounded-full bg-background ring-2 ring-primary/30 text-[10px] font-bold text-primary">
                {i + 1}
              </span>
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {s.q}
              </div>
              <div className="text-base font-semibold">{s.t}</div>
              <p className="text-sm text-muted-foreground">{s.d}</p>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Target;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <div className="mb-5 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      </div>
      <div className="text-base leading-relaxed text-foreground/90">{children}</div>
    </section>
  );
}
