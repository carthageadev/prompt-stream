"use client";

import { useMemo, useState } from "react";
import { copyText, Overlay } from "./ui";
import {
  IconArrowDown,
  IconArrowUp,
  IconClose,
  IconGrip,
  IconLayers,
  IconMinus,
  IconPlus,
} from "./icons";

export type RackItem =
  | { kind: "block"; key: string; id: number; title: string; content: string }
  | { kind: "stub"; key: string; text: string };

export const rackKey = (id: number) => `b${id}`;

export function rackBuffer(items: RackItem[]): string {
  return items
    .map((item) => (item.kind === "block" ? item.content.trim() : item.text.trim()))
    .filter(Boolean)
    .join("\n\n");
}

export function Rack({
  open,
  items,
  onReorder,
  onRemove,
  onUpdateStub,
  onAddStub,
  onWipe,
  onClose,
  onCreateNote,
}: {
  open: boolean;
  items: RackItem[];
  onReorder: (from: number, to: number) => void;
  onRemove: (key: string) => void;
  onUpdateStub: (key: string, text: string) => void;
  onAddStub: () => void;
  onWipe: () => void;
  onClose: () => void;
  onCreateNote: (content: string) => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const buffer = useMemo(() => rackBuffer(items), [items]);

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    onReorder(index, target);
  };

  return (
    <>
      <aside
        className={`fixed right-0 top-0 z-[110] flex h-full w-[min(94vw,380px)] flex-col border-l border-line bg-elev transition-transform duration-300 [transition-timing-function:var(--ease)] ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ boxShadow: open ? "var(--shadow-3)" : undefined }}
      >
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <IconLayers width={14} height={14} style={{ color: "var(--accent)" }} />
            <h2 className="text-[13px] font-semibold text-ink">Rack</h2>
            <span className="num text-[10.5px] text-ink3">{items.length}</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close rack" className="icon-btn focus-ring">
            <IconClose width={14} height={14} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto scroll-thin px-3 py-3">
          {items.length === 0 && (
            <div className="mt-14 px-5 text-center">
              <div
                className="mx-auto grid h-9 w-9 place-items-center border border-line"
                style={{ color: "var(--ink-3)" }}
              >
                <IconLayers width={15} height={15} />
              </div>
              <p className="mt-3 text-[12.5px] font-medium text-ink">Nothing mounted</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-ink3">
                Press <span className="kbd">+</span> on any card to mount it here. Drag to reorder, or
                add a stub node for scratch text.
              </p>
            </div>
          )}

          <ul className="flex flex-col gap-1.5">
            {items.map((item, index) => (
              <li
                key={item.key}
                draggable={item.kind === "block"}
                onDragStart={() => setDragIndex(index)}
                onDragOver={(event) => {
                  event.preventDefault();
                  setOverIndex(index);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (dragIndex !== null && dragIndex !== index) onReorder(dragIndex, index);
                  setDragIndex(null);
                  setOverIndex(null);
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                  setOverIndex(null);
                }}
                className="border bg-surface p-2.5 transition-all duration-150 [transition-timing-function:var(--ease)]"
                style={{
                 borderColor:
                    overIndex === index && dragIndex !== null && dragIndex !== index
                      ? "var(--accent)"
                      : "var(--line)",
                  opacity: dragIndex === index ? 0.4 : 1,
                }}
              >
                <div className="flex items-center gap-1">
                  <span className="num w-4 shrink-0 text-[10px] text-ink3">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={`shrink-0 ${item.kind === "block" ? "cursor-grab text-ink3" : "text-transparent"}`}
                  >
                    <IconGrip width={12} height={12} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-ink">
                    {item.kind === "block" ? item.title : "stub node"}
                  </span>
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    aria-label="Move up"
                    className="icon-btn focus-ring !h-6 !w-6"
                  >
                    <IconArrowUp width={12} height={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    aria-label="Move down"
                    className="icon-btn focus-ring !h-6 !w-6"
                  >
                    <IconArrowDown width={12} height={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(item.key)}
                    aria-label="Unmount"
                    className="icon-btn focus-ring !h-6 !w-6 hover:!text-accent"
                  >
                    <IconMinus width={12} height={12} />
                  </button>
                </div>

                {item.kind === "block" ? (
                  <p className="mt-1.5 line-clamp-2 whitespace-pre-wrap pl-[30px] text-[11px] leading-relaxed text-ink3">
                    {item.content}
                  </p>
                ) : (
                  <textarea
                    value={item.text}
                    onChange={(event) => onUpdateStub(item.key, event.target.value)}
                    placeholder="Scratch node — lives only in the rack…"
                    rows={3}
                    className="field focus-ring mt-1.5  !p-2 !text-[11.5px] !leading-relaxed"
                  />
                )}
              </li>
            ))}
          </ul>

          {items.length > 0 && (
            <button
              type="button"
              onClick={onAddStub}
              className="btn btn-ghost focus-ring mt-2 w-full !justify-start !border border-dashed !border-line !text-[11.5px]"
            >
              <IconPlus width={12} height={12} />
              stub node
            </button>
          )}
        </div>

        <footer className="border-t border-line px-3 py-3">
          <div className="max-h-24 overflow-y-auto scroll-thin border border-line bg-bg p-2.5 font-mono text-[10.5px] leading-relaxed text-ink3">
            {buffer || "preview buffer — empty"}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="num text-[10.5px] text-ink3">{buffer.length.toLocaleString()} chars</span>
            <button
              type="button"
              onClick={onWipe}
              className="btn btn-ghost focus-ring !px-2 !py-0.5 !text-[11px]"
            >
              wipe
            </button>
          </div>
          <button
            type="button"
            onClick={async () => {
              if (!buffer.trim()) return;
              await copyText(buffer);
              setResult(buffer);
            }}
            disabled={!buffer.trim()}
            className="btn btn-primary focus-ring mt-2 w-full !py-2.5 !text-[13px] !font-semibold"
          >
            Commit signal
          </button>
        </footer>
      </aside>

      <Overlay
        open={Boolean(result)}
        onClose={() => setResult(null)}
        title="Signal committed"
        subtitle="combined prompt copied to clipboard"
        width="max-w-2xl"
      >
        <pre className="max-h-[46vh] overflow-auto scroll-thin whitespace-pre-wrap border border-line bg-bg p-4 font-mono text-[11.5px] leading-relaxed text-ink2">
          {result}
        </pre>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              if (result) void copyText(result);
            }}
            className="btn btn-secondary focus-ring"
          >
            Copy again
          </button>
          <button
            type="button"
            onClick={() => {
              if (result) onCreateNote(result);
              setResult(null);
            }}
            className="btn btn-primary focus-ring"
          >
            Create note
          </button>
        </div>
      </Overlay>
    </>
  );
}
