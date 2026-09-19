"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

export type GroupFieldMeta = {
  id: number;
  name: string;
  fill: string;
  outline: string;
  label: string;
  dot: string;
};

type Rect = { x: number; y: number; width: number; height: number };
type Field = GroupFieldMeta & { rects: Rect[]; bridges: Rect[]; anchor: Rect };

const intersects = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

/**
 * Draws one shared background per group behind a masonry flow.
 * Same-group cards are connected only when their edges are genuinely adjacent;
 * connectors never cross a card owned by another group. The resulting stepped
 * L/S silhouettes follow the live card positions and update through reflow.
 */
export function GroupFields({ groups }: { groups: GroupFieldMeta[] }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [fields, setFields] = useState<Field[]>([]);

  useLayoutEffect(() => {
    const host = hostRef.current?.parentElement;
    if (!host || !groups.length) {
      setFields([]);
      return;
    }

    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const hostBox = host.getBoundingClientRect();
        const allCards = Array.from(host.querySelectorAll<HTMLElement>("[data-card-group]"))
          .map((element) => ({
            id: Number(element.dataset.cardGroup),
            rect: element.getBoundingClientRect(),
          }))
          .filter(({ id, rect }) => Number.isFinite(id) && id > 0 && rect.width > 20 && rect.height > 20)
          .map(({ id, rect }) => ({
            id,
            rect: {
              x: rect.left - hostBox.left,
              y: rect.top - hostBox.top,
              width: rect.width,
              height: rect.height,
            },
          }));

        const blockers = allCards.map(({ id, rect }) => ({ id, rect }));
        const next: Field[] = [];
        const pad = 5;
        const maxGap = 18;

        for (const group of groups) {
          const raw = allCards.filter((card) => card.id === group.id).map((card) => card.rect);
          if (!raw.length) continue;

          const rects = raw.map((rect) => ({
            x: rect.x - pad,
            y: rect.y - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
          }));
          const bridges: Rect[] = [];

          for (let i = 0; i < raw.length; i += 1) {
            for (let j = i + 1; j < raw.length; j += 1) {
              const a = raw[i];
              const b = raw[j];
              const aRight = a.x + a.width;
              const bRight = b.x + b.width;
              const aBottom = a.y + a.height;
              const bBottom = b.y + b.height;
              const overlapX = Math.min(aRight, bRight) - Math.max(a.x, b.x);
              const overlapY = Math.min(aBottom, bBottom) - Math.max(a.y, b.y);
              let bridge: Rect | null = null;

              // Vertical neighbors in one masonry column.
              const upper = a.y <= b.y ? a : b;
              const lower = a.y <= b.y ? b : a;
              const verticalGap = lower.y - (upper.y + upper.height);
              if (overlapX > Math.min(a.width, b.width) * 0.55 && verticalGap >= 0 && verticalGap <= maxGap) {
                bridge = {
                  x: Math.max(a.x, b.x) - pad,
                  y: upper.y + upper.height - pad,
                  width: overlapX + pad * 2,
                  height: verticalGap + pad * 2,
                };
              }

              // Horizontal neighbors on the same visual row.
              if (!bridge) {
                const left = a.x <= b.x ? a : b;
                const right = a.x <= b.x ? b : a;
                const horizontalGap = right.x - (left.x + left.width);
                if (overlapY > Math.min(a.height, b.height) * 0.45 && horizontalGap >= 0 && horizontalGap <= maxGap) {
                  bridge = {
                    x: left.x + left.width - pad,
                    y: Math.max(a.y, b.y) - pad,
                    width: horizontalGap + pad * 2,
                    height: overlapY + pad * 2,
                  };
                }
              }

              if (bridge) {
                const crossesOther = blockers.some(
                  (blocker) => blocker.id !== group.id && intersects(bridge!, blocker.rect),
                );
                if (!crossesOther) bridges.push(bridge);
              }
            }
          }

          const anchor = [...raw].sort((a, b) => a.y - b.y || a.x - b.x)[0];
          next.push({ ...group, rects, bridges, anchor });
        }
        setFields(next);
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    host.querySelectorAll<HTMLElement>("[data-card-group]").forEach((card) => observer.observe(card));
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [groups]);

  // Re-measure when fonts settle; card heights can change by a pixel or two.
  useEffect(() => {
    document.fonts?.ready.then(() => window.dispatchEvent(new Event("resize")));
  }, []);

  return (
    <div ref={hostRef} className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden>
      <svg className="absolute inset-0 z-0 h-full w-full overflow-visible">
        {fields.map((field) => (
          <g key={field.id}>
            {/* A compound fill does not double-opacity where rectangles meet. */}
            <path
              d={[...field.rects, ...field.bridges]
                .map((rect) => `M${rect.x},${rect.y}h${rect.width}v${rect.height}h-${rect.width}Z`)
                .join(" ")}
              fill={field.fill}
            />
            {field.rects.map((rect, index) => (
              <rect
                key={index}
                x={rect.x}
                y={rect.y}
                width={rect.width}
                height={rect.height}
                fill="none"
                stroke={field.outline}
                strokeWidth="1"
              />
            ))}
          </g>
        ))}
      </svg>

      {fields.map((field) => (
        <div
          key={field.id}
          className="absolute z-20 flex items-center gap-1.5 border bg-elev px-1.5 py-[2px] font-mono text-[9px] font-medium uppercase tracking-[0.1em] shadow-[var(--shadow-1)]"
          style={{
            left: Math.max(0, field.anchor.x + 7),
            top: Math.max(0, field.anchor.y - 10),
            maxWidth: Math.max(80, field.anchor.width - 14),
            color: field.label,
            borderColor: field.outline,
          }}
        >
          <span className="h-[5px] w-[5px]" style={{ background: field.dot }} />
          {field.name}
        </div>
      ))}
    </div>
  );
}
