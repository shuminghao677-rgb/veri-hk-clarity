import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Image as ImageIcon,
  FileType,
  UploadCloud,
  Sparkles,
  X,
  CheckCircle2,
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
        content:
          "Submit text, an image, or a PDF and verify it against timely official Hong Kong sources.",
      },
      { property: "og:title", content: "Verify — VeriHK" },
      {
        property: "og:description",
        content:
          "Explainable, source-cited verification grounded in official Hong Kong data.",
      },
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
          Paste text, drop a screenshot, or upload a PDF. VeriHK extracts every factual claim and
          cross-checks it against timely official Hong Kong sources.
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
              <FileDropZone
                accept="image/png,image/jpeg,image/webp"
                icon={<ImageIcon className="h-6 w-6" />}
                title="Drop an image or click to browse"
                hint="PNG, JPG or WEBP · up to 10 MB"
                cta="Choose Image"
              />
            </TabsContent>

            <TabsContent value="pdf" className="mt-6">
              <FileDropZone
                accept="application/pdf"
                icon={<FileType className="h-6 w-6" />}
                title="Drop a PDF or click to browse"
                hint="PDF · up to 25 MB"
                cta="Choose PDF"
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

    </div>
  );
}

function FileDropZone({
  accept,
  icon,
  title,
  hint,
  cta,
}: {
  accept: string;
  icon: React.ReactNode;
  title: string;
  hint: string;
  cta: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const pick = () => inputRef.current?.click();

  const onFiles = (files: FileList | null) => {
    if (files && files[0]) setFile(files[0]);
  };

  if (file) {
    const kb = (file.size / 1024).toFixed(1);
    const size = file.size > 1024 * 1024 ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : `${kb} KB`;
    return (
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-success/30 bg-success/5 p-5">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-success/15 text-success">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{file.name}</div>
          <div className="text-xs text-muted-foreground">
            Selected · {size} · ready to analyze
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 rounded-full text-muted-foreground"
          onClick={() => setFile(null)}
          type="button"
        >
          <X className="h-4 w-4" /> Remove
        </Button>
      </div>
    );
  }

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        onFiles(e.dataTransfer.files);
      }}
      className={`group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-12 text-center transition-colors ${
        dragOver
          ? "border-primary/60 bg-primary/5"
          : "border-border/70 bg-background/40 hover:border-primary/50 hover:bg-primary/5"
      }`}
    >
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary transition-transform group-hover:scale-105">
        <UploadCloud className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <div className="text-base font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
      <Button variant="secondary" className="rounded-full" type="button" onClick={pick}>
        {icon}
        <span className="ml-2">{cta}</span>
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
    </label>
  );
}
