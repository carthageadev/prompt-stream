"use client";

import { useState } from "react";
import { copyText, useToast } from "./ui";
import { IconCheck, IconCopy } from "./icons";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async (event) => {
        event.stopPropagation();
        const ok = await copyText(text);
        if (ok) {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } else {
          toast.error("Clipboard blocked by the browser.");
        }
      }}
      className={`btn focus-ring !px-2.5 !py-1 !text-[11.5px] ${copied ? "btn-accent" : "btn-secondary"}`}
    >
      {copied ? <IconCheck width={12} height={12} /> : <IconCopy width={12} height={12} />}
      {copied ? "Copied" : label}
    </button>
  );
}
