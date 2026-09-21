"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  COMPOSITION_SECTION_LABELS,
  COMPOSITION_SECTIONS,
  BLOCK_TYPE_META,
  type Composition,
  type CompositionSection,
  type PromptBlock,
} from "@/lib/types";
import { FieldLabel, useToast } from "./ui";
import { CopyButton } from "./CopyButton";
import { IconArrowDown, IconArrowUp, IconClose, IconPlus, IconSearch } from "./icons";

type Preset = "chatgpt" | "claude" | "gemini" | "openrouter";

type DraftItem = {
  key: string;
  promptId: number | null;
  label: string;
  content: string;
  section: CompositionSection;
};

/**
 * Sections come from tags — the single source of meaning. Block type is only a
 * fallback for legacy rows that were never tagged.
 */
const TAG_TO_SECTION: Record<string, CompositionSection> = {
  role: "role",
  context: "context",
  rules: "rules",
  constraint: "rules",
  output: "output",
  format: "output",
  example: "examples",
  examples: "examples",
};

const TYPE_TO_SECTION: Record<string, CompositionSection> = {
  persona: "role",
  context: "context",
  constraint: "rules",
  instruction: "rules",
  format: "output",
  example: "examples",
};

export function sectionForBlock(block: PromptBlock): CompositionSection {
  for (const tag of block.tags) {
    const match = TAG_TO_SECTION[tag.toLowerCase()];
    if (match) return match;
  }
  return TYPE_TO_SECTION[block.blockType] ?? "freeform";
}

export function Composer({ composition, library, readOnly = false }: { composition: Composition; library: PromptBlock[]; readOnly?: boolean }) {
  const toast = useToast();
  const [title, setTitle] = useState(composition.title);
  const [items, setItems] = useState<DraftItem[]>(
    composition.items.map((item) => ({
      key: `i${item.id}`,
      promptId: item.promptId,
      label: item.label,
      content: item.content,
      section: item.section,
    })),
  );
  const [paletteQuery, setPaletteQuery] = useState("");
  const [preset, setPreset] = useState<Preset>("chatgpt");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("saved");
  const dirty = useRef(false);

  const patch = useCallback(async () => {
    setStatus("saving");
    try {
      const res = await fetch(`/api/compositions/${composition.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          description: composition.description,
          items: items
            .filter((item) => item.content.trim())
            .map((item, index) => ({
              promptId: item.promptId,
              label: item.label,
              content: item.content,
              section: item.section,
              position: index,
            })),
        }),
      });
      if (!res.ok) throw new Error("save failed");
      setStatus("saved");
    } catch {
      setStatus("idle");
      toast.error("Could not save composition.");
    }
  }, [composition.description, composition.id, items, title, toast]);

  useEffect(() => {
    if (readOnly || !dirty.current) return;
    const handle = setTimeout(() => {
      void patch();
    }, 700);
    return () => clearTimeout(handle);
  }, [items, title, patch, readOnly]);

  const touch = () => {
    dirty.current = true;
    setStatus("saving");
  };

  const addItem = (block?: PromptBlock) => {
    touch();
    setItems((prev) => [
      ...prev,
      {
        key: `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
        promptId: block?.id ?? null,
        label: block?.title ?? "",
        content: block?.content ?? "",
        section: block ? sectionForBlock(block) : "freeform",
      },
    ]);
  };

  const update = (key: string, changes: Partial<DraftItem>) => {
    touch();
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...changes } : item)));
  };

  const move = (index: number, delta: number) => {
    touch();
    setItems((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
  };

  const palette = useMemo(() => {
    const needle = paletteQuery.trim().toLowerCase();
    return library
      .filter((block) =>
        !needle ? true : `${block.title}\n${block.content}\n${block.tags.join(" ")}`.toLowerCase().includes(needle),
      )
      .slice(0, 60);
  }, [library, paletteQuery]);

  const exportText = useMemo(() => {
    const live = items.filter((item) => item.content.trim());
    if (preset === "chatgpt") {
      return live
        .map((item) =>
          item.section === "freeform" ? item.content : `## ${COMPOSITION_SECTION_LABELS[item.section]}\n${item.content}`,
        )
        .join("\n\n");
    }
    if (preset === "claude") {
      return live
        .map((item) => (item.section === "freeform" ? item.content : `<${item.section}>\n${item.content}\n</${item.section}>`))
        .join("\n\n");
    }
    if (preset === "gemini") {
      return live
        .map(
          (item, index) =>
            `Part ${index + 1}${item.section === "freeform" ? "" : ` — ${COMPOSITION_SECTION_LABELS[item.section]}`}\n${item.content}`,
        )
        .join("\n\n---\n\n");
    }
    const system = live
      .filter((item) => ["role", "context", "rules"].includes(item.section))
      .map((item) => item.content)
      .join("\n\n");
    const user = live
      .filter((item) => !["role", "context", "rules"].includes(item.section))
      .map((item) => (item.section === "freeform" ? item.content : `${COMPOSITION_SECTION_LABELS[item.section]}:\n${item.content}`))
      .join("\n\n");
    return JSON.stringify(
      {
        model: "openai/gpt-4o-mini",
        messages: [
          ...(system ? [{ role: "system", content: system }] : []),
          { role: "user", content: user || "(empty)" },
        ],
      },
      null,
      2,
    );
  }, [items, preset]);

  return (
    <div className="grid gap-4 p-5 lg:grid-cols-[272px_1fr_1fr]">
      {readOnly && (
        <p className="label border border-line bg-surface px-4 py-2.5 lg:col-span-3">
          Read-only — this composition belongs to another session. Export still works.
        </p>
      )}
      <section className="surface flex max-h-[80vh] flex-col p-3">
        <h2 className="label px-0.5">Library</h2>
        <div className="relative mt-2">
          <IconSearch width={13} height={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink3" />
          <input
            value={paletteQuery}
            onChange={(event) => setPaletteQuery(event.target.value)}
            placeholder="search blocks"
            className="field focus-ring !pl-8 !text-[12px]"
          />
        </div>
        <div className="mt-2 flex-1 space-y-1 overflow-y-auto scroll-thin pr-0.5">
          <fieldset disabled={readOnly} className="contents space-y-1">
          {palette.map((block) => (
            <button
              key={block.id}
              type="button"
              onClick={() => addItem(block)}
              className="focus-ring w-full border border-transparent px-2.5 py-2 text-left transition-all duration-150 hover:border-line hover:bg-surface2"
            >
              <span className="label">{BLOCK_TYPE_META[block.blockType].label}</span>
              <span className="mt-0.5 block truncate text-[12.5px] font-medium text-ink">{block.title}</span>
              <span className="mt-0.5 block truncate text-[10.5px] text-ink3">{block.tags.join(" · ")}</span>
            </button>
          ))}
          </fieldset>
        </div>
      </section>

      <section className="surface flex max-h-[80vh] flex-col p-4">
        <fieldset disabled={readOnly} className="contents">
        <div className="flex items-center gap-2">
          <input
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              touch();
            }}
            className="focus-ring min-w-0 flex-1 border border-transparent bg-transparent px-1.5 py-1 text-[14.5px] font-semibold tracking-[-0.02em] text-ink outline-none transition-colors hover:border-line focus:border-linestrong"
          />
          <span className="label shrink-0" style={{ color: status === "saving" ? "var(--accent)" : "var(--ink-3)" }}>
            {status === "saving" ? "saving" : "saved"}
          </span>
        </div>

        <div className="mt-3 flex-1 space-y-2 overflow-y-auto scroll-thin pr-0.5">
          {items.length === 0 && (
            <p className="border border-dashed border-line px-4 py-8 text-center text-[12px] text-ink3">
              Canvas empty. Add blocks from the library, or drop in an inline item.
            </p>
          )}
          {items.map((item, index) => (
            <article key={item.key} className="border border-line bg-bg p-3">
              <div className="flex items-center gap-1.5">
                <span className="num shrink-0 text-[10px] text-ink3">{String(index + 1).padStart(2, "0")}</span>
                <select
                  value={item.section}
                  onChange={(event) => update(item.key, { section: event.target.value as CompositionSection })}
                  className="field focus-ring !w-auto !px-2 !py-1 !text-[11px]"
                >
                  {COMPOSITION_SECTIONS.map((section) => (
                    <option key={section} value={section}>
                      {COMPOSITION_SECTION_LABELS[section]}
                    </option>
                  ))}
                </select>
                <input
                  value={item.label}
                  onChange={(event) => update(item.key, { label: event.target.value })}
                  placeholder="label"
                  className="focus-ring min-w-0 flex-1 border border-transparent bg-transparent px-1.5 py-1 text-[12px] text-ink outline-none transition-colors hover:border-line focus:border-linestrong"
                />
                {item.promptId && <span className="num shrink-0 text-[10px] text-ink3">#{item.promptId}</span>}
                <button type="button" onClick={() => move(index, -1)} aria-label="Move up" className="icon-btn focus-ring !h-6 !w-6">
                  <IconArrowUp width={12} height={12} />
                </button>
                <button type="button" onClick={() => move(index, 1)} aria-label="Move down" className="icon-btn focus-ring !h-6 !w-6">
                  <IconArrowDown width={12} height={12} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    touch();
                    setItems((prev) => prev.filter((entry) => entry.key !== item.key));
                  }}
                  aria-label="Remove item"
                  className="icon-btn focus-ring !h-6 !w-6 hover:!text-ink"
                >
                  <IconClose width={12} height={12} />
                </button>
              </div>
              <textarea
                value={item.content}
                onChange={(event) => update(item.key, { content: event.target.value })}
                rows={4}
                className="field focus-ring mt-2 font-mono !text-[11.5px]"
              />
            </article>
          ))}
        </div>

        <button
          type="button"
          onClick={() => addItem()}
          className="btn btn-ghost focus-ring mt-3 w-full !justify-start border border-dashed !border-line !text-[11.5px]"
        >
          <IconPlus width={12} height={12} />
          inline item
        </button>
        </fieldset>
      </section>

      <section className="surface flex max-h-[80vh] flex-col p-4">
        <FieldLabel>Export</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {(["chatgpt", "claude", "gemini", "openrouter"] as Preset[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setPreset(option)}
              className={`btn focus-ring !px-2.5 !py-1 !text-[11px] ${preset === option ? "btn-primary" : "btn-secondary"}`}
            >
              {option === "openrouter" ? "OpenRouter JSON" : option}
            </button>
          ))}
        </div>
        <pre className="mt-3 flex-1 overflow-auto scroll-thin whitespace-pre-wrap border border-line bg-bg p-3 font-mono text-[11px] leading-relaxed text-ink2">
          {exportText || "nothing to export yet"}
        </pre>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="num text-[10.5px] text-ink3">{exportText.length.toLocaleString()} chars</span>
          <div className="flex gap-1.5">
            <button type="button" onClick={() => void patch()} className="btn btn-secondary focus-ring !px-2.5 !py-1 !text-[11.5px]">
              Save now
            </button>
            <CopyButton text={exportText} label="Copy export" />
          </div>
        </div>
      </section>
    </div>
  );
}
