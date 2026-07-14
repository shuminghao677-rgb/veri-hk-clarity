import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ShieldCheck,
  Sparkles,
  FileSearch,
  Landmark,
  ScrollText,
  BadgeCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_app/")({
  head: () => ({
    meta: [
      { title: "VeriHK — AI-powered Explainable Fact Verification" },
      {
        name: "description",
        content:
          "Verify public information using official Hong Kong data. VeriHK extracts claims, retrieves government evidence, and generates transparent verification reports.",
      },
      { property: "og:title", content: "VeriHK — Explainable Fact Verification" },
      {
        property: "og:description",
        content: "Upload text, screenshots or PDFs. Get transparent, source-cited verification.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="gradient-hero">
      {/* Hero */}
      <section className="relative overflow-hidden px-4 pt-16 pb-24 md:px-10 md:pt-24 md:pb-32">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mx-auto inline-flex items-center gap-2 rounded-full border bg-background/60 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Official Hong Kong data · Explainable AI
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05 }}
            className="mt-6 text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl"
          >
            Verify Public Information
            <br />
            Using <span className="text-gradient">Official Hong Kong Data</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="mx-auto mt-6 max-w-2xl text-pretty text-base text-muted-foreground md:text-lg"
          >
            Upload text, screenshots or PDF documents. Our AI extracts factual claims, retrieves
            evidence from official Hong Kong sources, and generates transparent verification
            reports.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-3"
          >
            <Button asChild size="lg" className="rounded-full px-6 shadow-elegant">
              <Link to="/verify">
                Start Verification <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-full border-border/70 px-6 backdrop-blur"
            >
              <Link to="/about">Learn More</Link>
            </Button>
          </motion.div>

          {/* Flow diagram */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.4 }}
            className="mt-20"
          >
            <FlowDiagram />
          </motion.div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="border-y bg-background/50 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 py-6 text-xs uppercase tracking-widest text-muted-foreground md:px-10">
          <span>Trusted signals from</span>
          <span className="font-semibold text-foreground/80">Hong Kong Observatory</span>
          <span>·</span>
          <span className="font-semibold text-foreground/80">Transport Dept.</span>
          <span>·</span>
          <span className="font-semibold text-foreground/80">Education Bureau</span>
          <span>·</span>
          <span className="font-semibold text-foreground/80">news.gov.hk</span>
          <span>·</span>
          <span className="font-semibold text-foreground/80">data.gov.hk</span>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-20 md:px-10 md:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Built for public trust
            </h2>
            <p className="mt-3 text-muted-foreground">
              Every verification is explainable, auditable, and rooted in official government
              sources.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {features.map((f) => (
              <Card
                key={f.title}
                className="rounded-3xl border-border/60 p-8 shadow-soft transition-all hover:-translate-y-1 hover:shadow-elegant"
              >
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

const features = [
  {
    icon: FileSearch,
    title: "Explainable by design",
    desc: "Every claim comes with step-by-step reasoning and traceable evidence — never a black box.",
  },
  {
    icon: Landmark,
    title: "Government-grade sources",
    desc: "Retrieves live data from HKO, Transport Dept, EDB, news.gov.hk and data.gov.hk.",
  },
  {
    icon: BadgeCheck,
    title: "Confidence-scored",
    desc: "Each verified claim is scored so you know exactly how strong the evidence is.",
  },
];

function FlowDiagram() {
  const nodes = [
    { label: "User Upload", icon: ScrollText, sub: "Text · Image · PDF" },
    { label: "AI Analysis", icon: Sparkles, sub: "Extract & Reason" },
    { label: "Official Data", icon: Landmark, sub: "HK Gov Sources" },
    { label: "Explainable Report", icon: ShieldCheck, sub: "Transparent Result" },
  ];
  return (
    <div className="glass mx-auto max-w-5xl rounded-3xl p-6 shadow-elegant md:p-10">
      <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] md:items-center">
        {nodes.map((n, i) => (
          <div key={n.label} className="contents">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.15 }}
              className="rounded-2xl border bg-card p-4 text-center shadow-soft"
            >
              <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl gradient-primary text-white">
                <n.icon className="h-4 w-4" />
              </div>
              <div className="mt-3 text-sm font-semibold">{n.label}</div>
              <div className="text-[11px] text-muted-foreground">{n.sub}</div>
            </motion.div>
            {i < nodes.length - 1 && (
              <div className="mx-auto hidden h-px w-10 bg-gradient-to-r from-primary/40 to-primary-glow/40 md:block" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
