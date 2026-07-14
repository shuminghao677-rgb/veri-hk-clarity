import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Image as ImageIcon,
  FileType,
  UploadCloud,
  Sparkles,
  
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { uploadedContent } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/verify")({
  head: () => ({
    meta: [
      { title: "Verify — VeriHK" },
      {
        name: "description",
        content: "Upload text, an image, or a PDF and let VeriHK verify it against official Hong Kong data.",
      },
      { property: "og:title", content: "Verify — VeriHK" },
      { property: "og:description", content: "Explainable, source-cited verification for Hong Kong public information." },
    ],
  }),
  component: VerifyPage,
});

function VerifyPage() {
  const navigate = useNavigate();
  const [text, setText] = useState(uploadedContent);

  const analyze = () => navigate({ to: "/processing" });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-8 md:py-14">
      <div className="mb-8 flex flex-col gap-2">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-[11px] font-medium text-muted-foreground">
          <Sparkles className="h-3 w-3 text-primary" /> New verification
        </div>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          What would you like to verify?
        </h1>
        <p className="text-muted-foreground">
          Paste text, drop a screenshot, or upload a PDF. VeriHK will extract every factual claim
          and check it against official sources.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="glass overflow-hidden rounded-3xl border-border/60 p-6 shadow-elegant md:p-8">
          <Tabs defaultValue="text">
            <TabsList className="grid w-full grid-cols-3 rounded-2xl bg-muted/60 p-1">
              <TabsTrigger value="text" className="rounded-xl gap-2">
                <FileText className="h-4 w-4" /> Text
              </TabsTrigger>
              <TabsTrigger value="image" className="rounded-xl gap-2">
                <ImageIcon className="h-4 w-4" /> Image
              </TabsTrigger>
              <TabsTrigger value="pdf" className="rounded-xl gap-2">
                <FileType className="h-4 w-4" /> PDF
              </TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="mt-6">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste news, claims or announcements..."
                className="min-h-52 resize-none rounded-2xl border-border/70 bg-background/60 p-5 text-base leading-relaxed"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                {text.length} characters · English & 繁體中文 supported
              </p>
            </TabsContent>

            <TabsContent value="image" className="mt-6">
              <DropZone
                icon={<ImageIcon className="h-6 w-6" />}
                title="Drag & drop an image"
                hint="PNG, JPG or WEBP · up to 10MB"
                cta="Upload Image"
              />
            </TabsContent>

            <TabsContent value="pdf" className="mt-6">
              <DropZone
                icon={<FileType className="h-6 w-6" />}
                title="Drag & drop a PDF"
                hint="PDF · up to 25MB"
                cta="Upload PDF"
              />
            </TabsContent>
          </Tabs>

          <div className="mt-8 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              By analyzing, you agree that content will be checked against public official sources.
            </p>
            <Button
              size="lg"
              onClick={analyze}
              className="rounded-full px-8 shadow-elegant sm:min-w-52"
            >
              Analyze
            </Button>
          </div>
        </Card>
      </motion.div>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {[
          { title: "Rainstorm warning rumor", desc: "Class suspension claim in circulation." },
          { title: "MTR service update", desc: "Verify against Transport Dept feed." },
          { title: "Housing policy claim", desc: "Cross-check government press releases." },
        ].map((s) => (
          <Card key={s.title} className="rounded-2xl border-dashed p-4 hover:bg-muted/40">
            <Link to="/verify" className="block">
              <div className="text-sm font-medium">{s.title}</div>
              <div className="text-xs text-muted-foreground">{s.desc}</div>
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}

function DropZone({
  icon,
  title,
  hint,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  cta: string;
}) {
  return (
    <label className="group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border/70 bg-background/40 p-12 text-center transition-colors hover:border-primary/50 hover:bg-primary/5">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary transition-transform group-hover:scale-105">
        <UploadCloud className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <div className="text-base font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
      <Button variant="secondary" className="rounded-full" type="button">
        {icon}
        <span className="ml-2">{cta}</span>
      </Button>
      <input type="file" className="hidden" />
    </label>
  );
}
