"use client";

import { useState, useRef, useCallback } from "react";
import { parseTakeoutJSON, type TakeoutFeature } from "@/lib/import/takeout-parser";
import Link from "next/link";

type Phase = "upload" | "preview" | "processing" | "complete";

interface ImportResults {
  listId: string;
  imported: number;
  skipped: number;
  errors: number;
  apiCallsUsed: number;
  total: number;
}

export default function TakeoutUpload() {
  const [phase, setPhase] = useState<Phase>("upload");
  const [features, setFeatures] = useState<TakeoutFeature[]>([]);
  const [totalInFile, setTotalInFile] = useState(0);
  const [skippedInParse, setSkippedInParse] = useState(0);
  const [parseError, setParseError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ processed: 0, total: 0, current: "" });
  const [results, setResults] = useState<ImportResults | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    setParseError(null);

    if (!file.name.endsWith(".json")) {
      setParseError("Please upload a JSON file. Expected \"Saved Places.json\" from Google Takeout.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = JSON.parse(e.target?.result as string);
        const result = parseTakeoutJSON(raw);

        if (result.features.length === 0) {
          setParseError("No valid places found in this file. Make sure you uploaded the right file.");
          return;
        }

        setFeatures(result.features);
        setTotalInFile(result.total);
        setSkippedInParse(result.skipped);
        setPhase("preview");
      } catch (err) {
        setParseError(
          err instanceof Error
            ? err.message
            : "Failed to parse file. Make sure this is a valid Google Takeout Saved Places file."
        );
      }
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const startImport = async () => {
    setPhase("processing");
    setProgress({ processed: 0, total: features.length, current: "" });

    try {
      const res = await fetch("/api/import/takeout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ features }),
      });

      if (!res.ok) {
        const err = await res.json();
        setParseError(err.error || "Import failed");
        setPhase("upload");
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setParseError("Failed to read import stream");
        setPhase("upload");
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);

            if (event.type === "progress" || event.type === "error") {
              setProgress({
                processed: event.processed,
                total: event.total,
                current: event.current || "",
              });
            }

            if (event.type === "complete") {
              setResults({
                listId: event.list_id,
                imported: event.imported,
                skipped: event.skipped,
                errors: event.errors,
                apiCallsUsed: event.api_calls_used,
                total: event.total,
              });
              setPhase("complete");
            }
          } catch {
            // Skip malformed lines
          }
        }
      }
    } catch {
      setParseError("Import failed. Please try again.");
      setPhase("upload");
    }
  };

  return (
    <div className="bg-cream min-h-screen">
      <div className="mx-auto max-w-lg px-4 py-8 pb-24">
        <h1 className="font-serif text-2xl text-ink">Import from Google Maps</h1>
        <p className="mt-2 text-ink-light">
          Import your saved places from Google Takeout to get started.
        </p>

        {/* Upload Phase */}
        {phase === "upload" && (
          <div className="mt-6">
            <div
              onDrop={handleDrop}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
              className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                isDragOver
                  ? "border-ink bg-cream-dark"
                  : "border-cream-dark hover:border-ink-light"
              }`}
            >
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-cream-dark">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="h-6 w-6 text-ink-light"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
                  />
                </svg>
              </div>
              <p className="font-medium text-ink">
                Drop your Saved Places.json here
              </p>
              <p className="mt-1 text-sm text-ink-light">
                or click to browse
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
              className="hidden"
            />

            {parseError && (
              <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">
                {parseError}
              </div>
            )}

            <div className="mt-8 rounded-xl bg-white p-4 shadow-sm">
              <h3 className="font-medium text-ink">How to get your file</h3>
              <ol className="mt-2 space-y-2 text-sm text-ink-light">
                <li>
                  1. Go to{" "}
                  <a
                    href="https://takeout.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-ink"
                  >
                    takeout.google.com
                  </a>
                </li>
                <li>2. Click &quot;Deselect all&quot;, then find and select &quot;Maps (your places)&quot;</li>
                <li>3. Click &quot;Next step&quot; → &quot;Create export&quot;</li>
                <li>4. Download the zip file and extract it</li>
                <li>5. Upload the <strong className="text-ink">Saved Places.json</strong> file here</li>
              </ol>
            </div>
          </div>
        )}

        {/* Preview Phase */}
        {phase === "preview" && (
          <div className="mt-6">
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rust-light/30">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="h-5 w-5 text-rust"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-ink">
                    {features.length} places ready to import
                  </p>
                  {skippedInParse > 0 && (
                    <p className="text-sm text-ink-light">
                      {skippedInParse} entries skipped (invalid data)
                      {totalInFile > 500 && ` · capped at 500 of ${totalInFile} total`}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-cream-dark p-3 text-sm text-ink-light">
              Places will be imported into a private list called &quot;Google Maps Import&quot;.
              You can browse them and log your favorites with ratings later.
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setPhase("upload");
                  setFeatures([]);
                }}
                className="flex-1 rounded-full border border-cream-dark px-4 py-2.5 text-sm font-medium text-ink-light hover:bg-cream-dark"
              >
                Cancel
              </button>
              <button
                onClick={startImport}
                className="flex-1 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-cream hover:bg-ink/90"
              >
                Start Import
              </button>
            </div>
          </div>
        )}

        {/* Processing Phase */}
        {phase === "processing" && (
          <div className="mt-6">
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-light">Importing places...</span>
                  <span className="font-medium text-ink">
                    {progress.processed} / {progress.total}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-cream-dark">
                  <div
                    className="h-full rounded-full bg-rust transition-all duration-300"
                    style={{
                      width: `${progress.total > 0 ? (progress.processed / progress.total) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              {progress.current && (
                <p className="truncate text-sm text-ink-light">
                  {progress.current}
                </p>
              )}

              <p className="text-xs text-ink-light">
                This may take a minute. Please don&apos;t close this page.
              </p>
            </div>
          </div>
        )}

        {/* Complete Phase */}
        {phase === "complete" && results && (
          <div className="mt-6">
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rust-light/30">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="h-5 w-5 text-rust"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-ink">Import complete!</p>
                  <p className="text-sm text-ink-light">
                    {results.imported} places imported
                    {results.skipped > 0 && ` · ${results.skipped} skipped`}
                    {results.errors > 0 && ` · ${results.errors} errors`}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Link
                href={`/list/${results.listId}`}
                className="flex-1 rounded-full bg-ink px-4 py-2.5 text-center text-sm font-medium text-cream hover:bg-ink/90"
              >
                View Imported Places
              </Link>
              <Link
                href="/feed"
                className="flex-1 rounded-full border border-cream-dark px-4 py-2.5 text-center text-sm font-medium text-ink-light hover:bg-cream-dark"
              >
                Go to Feed
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
