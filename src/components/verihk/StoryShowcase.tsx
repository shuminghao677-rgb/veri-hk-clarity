import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";


const claims = [
  "The Hong Kong Observatory has issued a Black Rainstorm Warning.",
  "All schools will suspend classes tomorrow.",
  "Major roads in Kowloon are expected to close.",
];

const sources = [
  { name: "HKO", label: "Hong Kong Observatory", status: "live" },
  { name: "TD", label: "Transport Department", status: "live" },
  { name: "GovHK", label: "Government news", status: "live" },
  { name: "EDB", label: "Education Bureau", status: "future" },
];

const verdicts = [
  { label: "Supported", className: "text-[#12805c]" },
  { label: "Refuted", className: "text-[#d92d20]" },
  { label: "Need evidence", className: "text-[#a16207]" },
];


export function StoryShowcase() {
  const reducedMotion = useReducedMotion();

  return (
    <div className="overflow-hidden bg-[#fafbfd]">
      <section className="relative min-h-[calc(100vh-3.5rem)]">
        <HeroBackground />
        <div className="premium-container relative grid min-h-[calc(100vh-3.5rem)] items-center pt-8">
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65 }}
            className="max-w-4xl"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Official Hong Kong data · Explainable AI
            </div>
            <h1 className="mt-6 max-w-4xl text-[2.75rem] font-semibold leading-[1.05] text-foreground sm:text-5xl md:text-6xl lg:text-[4.25rem]">
              Verify information
              <span className="text-gradient"> with official Hong Kong data.</span>
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-muted-foreground">
              VeriHK turns public claims into evidence-backed conclusions using up-to-date official
              sources.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-6">
              <Link
                to="/verify"
                className="text-base font-bold text-foreground transition-colors hover:text-primary"
              >
                Start Verification
              </Link>
              <Link
                to="/verify"
                className="text-sm font-medium text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
              >
                Paste text or upload a screenshot
              </Link>
            </div>
          </motion.div>
        </div>
      </section>


      <section className="premium-container grid gap-14 py-24 md:py-32 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
        <StoryCopy eyebrow="Scene 2" title="Claims are extracted before evidence is searched.">
          A public message can mix weather, school and transport statements. VeriHK separates each
          factual claim so the right source can be checked.
        </StoryCopy>
        <ClaimTimeline reducedMotion={Boolean(reducedMotion)} />
      </section>

      <section className="border-y border-[rgb(8_23_45_/_10%)] bg-white/56 py-24 md:py-32">
        <div className="premium-container">
          <StoryCopy eyebrow="Scene 3" title="Official evidence returns as a source network.">
            Small, specific connectors route each claim to the relevant live source. The result is
            traceable without looking like a dense knowledge graph.
          </StoryCopy>
          <EvidenceNetwork reducedMotion={Boolean(reducedMotion)} />
        </div>
      </section>

      <section className="premium-container py-24 md:py-32">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <StoryCopy eyebrow="Scene 4" title="A calm verdict, with the evidence still visible.">
            The interface resolves into three readable outcomes while preserving the official
            records behind each decision.
          </StoryCopy>
          <div className="grid gap-6 border-y border-[rgb(8_23_45_/_12%)] py-8 md:grid-cols-3">
            {verdicts.map((item, index) => (
              <motion.div
                key={item.label}
                initial={reducedMotion ? false : { opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
                className="border-b border-[rgb(8_23_45_/_10%)] pb-6 last:border-b-0 md:border-b-0 md:border-r md:pb-0 md:pr-6 md:last:border-r-0"
              >
                <div className={`text-3xl font-semibold ${item.className}`}>{item.label}</div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="mt-16">
          <Button asChild size="lg" className="h-11 rounded-xl bg-[#0878f9] px-5 shadow-none hover:bg-[#006ee8]">
            <Link to="/dashboard">Enter dashboard</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

function HeroBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#f7f9fc_0%,#fbfcfe_48%,#fafbfd_100%)]" />
      <div
        className="absolute inset-0 bg-cover bg-center opacity-25"
        style={{ backgroundImage: "url('/images/verihk-hong-kong-hero.webp')" }}
      />
      <svg
        viewBox="0 0 1440 720"
        className="absolute inset-x-0 bottom-0 h-[72%] w-full text-[#08172d]"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="harbour" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0878f9" stopOpacity="0.13" />
            <stop offset="100%" stopColor="#0878f9" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path
          d="M0 382 C120 310 220 324 350 272 C520 204 625 247 760 194 C912 135 1057 157 1210 101 C1292 72 1370 78 1440 48 L1440 720 L0 720 Z"
          fill="#dce8f3"
          opacity="0.46"
        />
        <path
          d="M0 486 C230 448 324 512 532 474 C720 440 866 378 1038 414 C1190 446 1302 392 1440 404 L1440 720 L0 720 Z"
          fill="url(#harbour)"
        />
        {/* Decorative skyline and accent line removed for a cleaner hero background */}

      </svg>
    </div>
  );
}

function ClaimTimeline({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <div>
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-20%" }}
        className="border-y border-[rgb(8_23_45_/_12%)] py-5"
      >
        <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-[rgb(8_23_45_/_42%)]">
          <FileText className="h-4 w-4" />
          Incoming information
        </div>
        <p className="max-w-2xl text-base leading-7 text-[rgb(8_23_45_/_72%)]">
          The Hong Kong Observatory has issued a Black Rainstorm Warning. All schools will suspend
          classes tomorrow, and major roads in Kowloon are expected to close.
        </p>
      </motion.div>

      <div className="relative mt-10 pl-8">
        <motion.div
          initial={reducedMotion ? false : { scaleY: 0 }}
          whileInView={{ scaleY: 1 }}
          viewport={{ once: true, margin: "-20%" }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="absolute left-[7px] top-2 h-[calc(100%-16px)] w-px origin-top bg-[rgb(8_23_45_/_14%)]"
        />
        {claims.map((claim, index) => (
          <motion.div
            key={claim}
            initial={reducedMotion ? false : { opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-20%" }}
            transition={{ delay: 0.12 + index * 0.1 }}
            className="relative pb-10 last:pb-0"
          >
            <span className="absolute -left-8 top-1 h-3.5 w-3.5 rounded-full border border-[#0878f9] bg-white shadow-[0_0_0_4px_rgba(8,120,249,0.06)]" />
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[rgb(8_23_45_/_42%)]">
              Claim {String(index + 1).padStart(2, "0")}
            </div>
            <p className="mt-2 max-w-2xl text-lg leading-8 text-[rgb(8_23_45_/_84%)]">{claim}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function EvidenceNetwork({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <div className="mt-14 grid gap-8 sm:grid-cols-2 md:grid-cols-4">
      {sources.map((source, index) => (
        <motion.div
          key={source.name}
          initial={reducedMotion ? false : { opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: index * 0.08 }}
          className="text-center"
        >
          <div className="text-2xl font-semibold text-[rgb(8_23_45_/_88%)]">{source.name}</div>
          <div className="mt-1 text-sm text-[rgb(8_23_45_/_48%)]">{source.label}</div>
          <div className="mt-2 text-xs uppercase tracking-[0.16em] text-[rgb(8_23_45_/_42%)]">
            {source.status}
          </div>
        </motion.div>
      ))}
    </div>
  );
}


function StoryCopy({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-xl">
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[rgb(8_23_45_/_42%)]">
        {eyebrow}
      </div>
      <h2 className="mt-3 text-4xl font-semibold leading-tight text-[rgb(8_23_45_/_88%)] md:text-5xl">
        {title}
      </h2>
      <p className="mt-5 text-base leading-7 text-[rgb(8_23_45_/_58%)]">{children}</p>
    </div>
  );
}
