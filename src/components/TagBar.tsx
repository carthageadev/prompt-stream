"use client";

import { useRef } from "react";
import type { TagColor } from "@/lib/types";
import { tagCss } from "@/lib/tags";
import { Chip } from "./ui";
import { IconChevronLeft, IconChevronRight, IconClose } from "./icons";

export function TagBar({
  tags,
  active,
  colors,
  onToggle,
  onReset,
}: {
  tags: { tag: string; count: number }[];
  active: Set<string>;
  colors: Map<string, TagColor>;
  onToggle: (tag: string) => void;
  onReset: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const nudge = (direction: -1 | 1) =>
    scroller.current?.scrollBy({ left: direction * 240, behavior: "smooth" });

  if (tags.length === 0) {
    return (
      <p className="px-0.5 py-1 text-[11px] text-ink3">
        No tags yet — create a block to seed the taxonomy.
      </p>
    );
  }

  return (
    <div className="relative flex items-center gap-1">
      <button
        type="button"
        onClick={() => nudge(-1)}
        aria-label="Scroll tags left"
        className="icon-btn focus-ring z-[3] shrink-0 !h-6 !w-6 bg-elev"
        style={{ borderColor: "var(--line)" }}
      >
        <IconChevronLeft width={13} height={13} />
      </button>

      <div className="edge-left edge-right relative min-w-0 flex-1 overflow-hidden">
        <div ref={scroller} className="flex items-center gap-1.5 overflow-x-auto scroll-thin py-[3px]">
          {tags.map(({ tag, count }) => {
            const color = colors.get(tag);
            const css = color ? tagCss(color) : undefined;
            const isActive = active.has(tag);
            return (
              <Chip
                key={tag}
                label={`${tag} ${count}`}
                onClick={() => onToggle(tag)}
                active={isActive}
                title={`Filter by ${tag}`}
                style={
                  css
                    ? {
                        ...css,
                        boxShadow: isActive ? "inset 0 0 0 1px currentColor" : undefined,
                        fontWeight: isActive ? 600 : 500,
                      }
                    : undefined
                }
              />
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={() => nudge(1)}
        aria-label="Scroll tags right"
        className="icon-btn focus-ring z-[3] shrink-0 !h-6 !w-6 bg-elev"
        style={{ borderColor: "var(--line)" }}
      >
        <IconChevronRight width={13} height={13} />
      </button>

      {active.size > 0 && (
        <button
          type="button"
          onClick={onReset}
          className="btn btn-ghost focus-ring !px-2 !py-1 !text-[11px] shrink-0"
        >
          <IconClose width={11} height={11} />
          {active.size}
        </button>
      )}
    </div>
  );
}
