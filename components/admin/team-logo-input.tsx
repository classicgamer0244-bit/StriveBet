"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Upload, Link as LinkIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const MAX_SIZE_BYTES = 500 * 1024;

async function readJson(res: Response) {
  return res.json().catch(() => null);
}

export function TeamLogoInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
}) {
  const [mode, setMode] = useState<"upload" | "url">("upload");
  const [isUploading, setIsUploading] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      toast.error("Logo must be 500KB or smaller.");
      return;
    }
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/uploads/logo", { method: "POST", body: formData });
      const data = await readJson(res);
      if (!res.ok) {
        toast.error(data?.error ?? "Couldn't upload that logo.");
        return;
      }
      onChange(data.url);
      toast.success(`${label} logo uploaded.`);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div>
      <Label className="mb-1.5">{label} logo</Label>
      <div className="mb-1.5 flex overflow-hidden rounded-md border border-border text-xs font-semibold">
        <button
          type="button"
          onClick={() => setMode("upload")}
          className={cn("flex flex-1 items-center justify-center gap-1.5 px-2 py-1.5", mode === "upload" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground")}
        >
          <Upload className="size-3.5" />
          Upload
        </button>
        <button
          type="button"
          onClick={() => setMode("url")}
          className={cn("flex flex-1 items-center justify-center gap-1.5 px-2 py-1.5", mode === "url" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground")}
        >
          <LinkIcon className="size-3.5" />
          Paste URL
        </button>
      </div>

      {mode === "upload" ? (
        <div className="flex items-center gap-2">
          <Input
            type="file"
            accept="image/*"
            disabled={isUploading}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          {isUploading && <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />}
        </div>
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://example.com/logo.png" />
      )}

      {value && (
        <div className="mt-2 flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary admin-pasted URL, next/image's allowlist can't cover it */}
          <img src={value} alt={`${label} logo preview`} className="size-10 rounded-full border border-border object-contain" />
          <span className="truncate text-xs text-muted-foreground">{value}</span>
        </div>
      )}
    </div>
  );
}
