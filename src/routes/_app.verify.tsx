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
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { uploadedContent } from "@/lib/mock-data";
import { MAX_ANALYSIS_INPUT_CHARS, PENDING_INPUT_KEY } from "@/lib/report-contract";

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
        content: "Explainable, source-cited verification grounded in official Hong Kong data.",
      },
    ],
  }),
  component: VerifyPage,
});

function VerifyPage() {
  const navigate = useNavigate();
  const [text, setText] = useState(uploadedContent);
  const [error, setError] = useState("");

  const analyze = () => {
    const trimmed = text.trim();

    if (!trimmed) {
      setError("Please enter some text to analyze.");
      return;
    }

    if (trimmed.length > MAX_ANALYSIS_INPUT_CHARS) {
      setError(
        `Please keep the text under ${MAX_ANALYSIS_INPUT_CHARS.toLocaleString()} characters for this first version.`,
      );
      return;
    }

    window.sessionStorage.setItem(PENDING_INPUT_KEY, trimmed);
    setError("");
    navigate({ to: "/processing" });
  };

  return (
    <div className="premium-container py-10 md:py-16">
      <div className="mb-10 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
        <div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-foreground" /> Verification workspace
          </div>
          <h1 className="mt-4 max-w-2xl text-4xl font-semibold leading-tight tracking-normal md:text-6xl">
            Turn a message into an evidence network.
          </h1>
        </div>
        <p className="max-w-xl text-base leading-7 text-muted-foreground lg:justify-self-end">
          Paste the content you want checked. VeriHK will keep the same secure backend flow:
          extract claims, query official sources, and build an explainable report.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="panel overflow-hidden rounded-[2rem] p-5 md:p-8">
          <Tabs defaultValue="text">
            <TabsList className="grid w-full grid-cols-3 rounded-full bg-muted/70 p-1">
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
                className="min-h-72 resize-none rounded-3xl border-border/70 bg-background/80 p-6 text-base leading-relaxed shadow-inner"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                {text.length} / {MAX_ANALYSIS_INPUT_CHARS.toLocaleString()} characters · English &
                繁體中文 supported
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
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Live official-source checking runs on the server. Your API keys never enter the browser.
              </p>
              {error && (
                <p className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {error}
                </p>
              )}
            </div>
            <Button
              size="lg"
              onClick={analyze}
              className="rounded-full px-8 shadow-soft sm:min-w-52"
            >
              Start analysis
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
    const size =
      file.size > 1024 * 1024 ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : `${kb} KB`;
    return (
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-success/30 bg-success/5 p-5">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-success/15 text-success">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{file.name}</div>
          <div className="text-xs text-muted-foreground">Selected · {size} · ready to analyze</div>
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
