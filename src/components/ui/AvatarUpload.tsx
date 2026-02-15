"use client";

import { useState, useRef } from "react";
import Avatar from "./Avatar";

interface AvatarUploadProps {
  currentUrl?: string | null;
  onUpload: (url: string) => void;
}

export default function AvatarUpload({ currentUrl, onUpload }: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl ?? null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setPreviewUrl(URL.createObjectURL(file));

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/profile/avatar", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      setUploading(false);
      return;
    }

    const data = await res.json();
    onUpload(data.url);
    setUploading(false);
  };

  return (
    <div className="flex items-center gap-4">
      <Avatar src={previewUrl} alt="Your avatar" size="xl" />
      <div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          {uploading ? "Uploading..." : "Upload photo"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleUpload}
          className="hidden"
        />
      </div>
    </div>
  );
}
