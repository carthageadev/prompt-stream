"use client";

import { useEffect, useState } from "react";
import type { PromptBlock, TagColor } from "@/lib/types";
import { tagCss } from "@/lib/tags";
import { Chip } from "./ui";
import { IconCheck, IconClose, IconCopy, IconFork, IconMinus, IconPlus } from "./icons";

export type CardHandles = {
  onOpen: (block: PromptBlock) => void;
  onCopy: (block: PromptBlock) => void;
  onToggleRack: (block: PromptBlock) => void;
  inRack: (id: number) => boolean;
  onHide?: (block: PromptBlock) => void;
  onDuplicate?: (block: PromptBlock) => void;
};

export type CardGroup = {
  id: number;
  name: string;
  outline: string;
  label: string;
  dot: string;
};

/**
 * A card carries content + tags. In flow view its group shows as a small
 * ledger line and a tinted outline, so same-group cards read as loosely
 * linked wherever they land. In stacked view the envelope owns the label.
 */
export function PromptCard({
  block,
  visible,
  isNew,
  removing,
  colors,
  reason,
  handles,
  organizing = false,
  selected = false,
  onSelect,
  group = null,
  readOnly = false,
  bare = false,
}: {
  block: PromptBlock;
  visible: boolean;
  isNew: boolean;
  removing: boolean;
  colors: Map<string, TagColor>;
  reason?: string;
  handles: CardHandles;
  organizing?: boolean;
  selected?: boolean;
  onSelect?: (id: number) => void;
  group?: CardGroup | null;
  /** Someone else's row: no editor, no select — hide or save a copy instead. */
  readOnly?: boolean;
  /** Melt into the parent envelope: no border, no surface — one article. */
  bare?: boolean;
  /** Collapse the bottom margin so melted cards touch edge to edge. */
  tight?: boolean;
}) {
  const [flash, setFlash] = useState(false);
  const [copied, setCopied] = useState(false);
  const inRack = handles.inRack(block.id);

  useEffect(() => {
    if (!isNew) return;
    setFlash(true);
    const timer = setTimeout(() => setFlash(false), 900);
    return () => clearTimeout(timer);
  }, [isNew]);

  const shown = visible && !removing;
  const shownTags = block.tags.slice(0, 4);
  const overflow = block.tags.length - shownTags.length;

  return (
    <article
      data-card-group={group?.id ?? undefined}
      onClick={() => {
        if (organizing) {
          if (!readOnly) onSelect?.(block.id);
          return;
        }
        if (!readOnly) handles.onOpen(block);
      }}
      className={[
        "group relative z-10 break-inside-avoid cursor-pointer overflow-hidden transition-all duration-[380ms] [transition-timing-function:var(--ease)]",
        bare ? "border-0 bg-transparent" : "border bg-surface",
        tight ? "mb-0" : "mb-3",
        shown
          ? "max-h-[900px] scale-100 p-4 opacity-100"
          : "pointer-events-none mb-0 max-h-0 scale-[0.98] translate-y-3 border-0 p-0 opacity-0",
        selected ? "border-linestrong bg-surface2" : bare ? "" : "border-line",
        flash ? "animate-flash-border" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 flex-1 text-[14px] font-semibold leading-[1.35] text-ink">
          {block.title}
        </h3>
        {organizing ? (
          readOnly ? (
            <span className="num shrink-0 pt-[3px] text-[10px] text-ink3">shared</span>
          ) : (
            <span className={`check ${selected ? "on" : ""}`}>
              <IconCheck width={11} height={11} />
            </span>
          )
        ) : (
          <span className="num shrink-0 pt-[3px] text-[10px] text-ink3">
            {String(block.stackOrder).padStart(2, "0")}
          </span>
        )}
      </div>

      <p className="mt-1.5 line-clamp-4 whitespace-pre-wrap text-[12.5px] leading-[1.65] text-ink2">
        {block.content}
      </p>

      {reason && (
        <p className="mt-2.5 flex items-start gap-1.5 text-[11px] leading-snug text-ink2">
          <span className="mt-[5px] h-[3px] w-[3px] shrink-0 bg-ink" />
          <span className="truncate">{reason}</span>
        </p>
      )}

      {(shownTags.length > 0 || overflow > 0) && (
        <div className="mt-3.5 flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            {shownTags.map((tag) => {
              const color = colors.get(tag);
              return <Chip key={tag} label={tag} style={color ? tagCss(color) : undefined} />;
            })}
            {overflow > 0 && <span className="num text-[10.5px] text-ink3">+{overflow}</span>}
          </div>

          {!organizing && (
            <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100">
              <button
                type="button"
                aria-label="Copy prompt"
                onClick={(event) => {
                  event.stopPropagation();
                  handles.onCopy(block);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1200);
                }}
                className="icon-btn focus-ring !h-7 !w-7"
                style={{ borderColor: "var(--line)", background: "var(--surface)" }}
              >
                {copied ? (
                  <IconCheck width={13} height={13} />
                ) : (
                  <IconCopy width={13} height={13} />
                )}
              </button>
              <button
                type="button"
                aria-label={inRack ? "Unmount from rack" : "Mount to rack"}
                onClick={(event) => {
                  event.stopPropagation();
                  handles.onToggleRack(block);
                }}
                className={`icon-btn focus-ring !h-7 !w-7 ${inRack ? "on" : ""}`}
                style={{
                  borderColor: inRack ? "var(--line-strong)" : "var(--line)",
                  background: inRack ? "var(--surface-2)" : "var(--surface)",
                }}
              >
                {inRack ? <IconMinus width={13} height={13} /> : <IconPlus width={13} height={13} />}
              </button>
              {readOnly && (
                <>
                  <button
                    type="button"
                    aria-label="Save a copy to your session"
                    title="Save a copy to your session"
                    onClick={(event) => {
                      event.stopPropagation();
                      handles.onDuplicate?.(block);
                    }}
                    className="icon-btn focus-ring !h-7 !w-7"
                    style={{ borderColor: "var(--line)", background: "var(--surface)" }}
                  >
                    <IconFork width={13} height={13} />
                  </button>
                  <button
                    type="button"
                    aria-label="Hide from your view"
                    title="Hide from your view (owner keeps it)"
                    onClick={(event) => {
                      event.stopPropagation();
                      handles.onHide?.(block);
                    }}
                    className="icon-btn focus-ring !h-7 !w-7"
                    style={{ borderColor: "var(--line)", background: "var(--surface)" }}
                  >
                    <IconClose width={13} height={13} />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
