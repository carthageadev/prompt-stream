"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BLOCK_TYPE_META,
  type Basket,
  type BlockType,
  type PromptBlock,
  type QualityReport,
  type RelatedHit,
  type Stack,
  type TagColor,
  type TagSuggestion,
} from "@/lib/types";
import { tagCss, tagAccent } from "@/lib/tags";
import { Bar, copyText, FieldLabel, Overlay, Spinner, useToast } from "./ui";
import { IconArchive, IconCopy, IconFork, IconPlus, IconSpark, IconTrash } from "./icons";

type Props = {
  open: boolean;
  block: PromptBlock | null;
  stacks: Stack[];
  baskets: Basket[];
  library: PromptBlock[];
  colors: Map<string, TagColor>;
  onClose: () => void;
  onSave: (id: number, patch: Partial<PromptBlock> & { autoTag?: boolean }) => void;
  onFork: (block: PromptBlock) => void;
  onJump: (id: number) => void;
  onDelete: (block: PromptBlock) => void;
};

export function EditorOverlay({
  open,
  block,
  stacks,
  baskets,
  library,
  colors,
  onClose,
  onSave,
  onFork,
  onJump,
  onDelete,
}: Props) {
  const toast = useToast();
  const [draft, setDraft] = useState<PromptBlock | null>(block);
  const [tagInput, setTagInput] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [quality, setQuality] = useState<QualityReport | null>(null);
  const [suggestions, setSuggestions] = useState<TagSuggestion | null>(null);
  const [related, setRelated] = useState<RelatedHit[]>([]);

  useEffect(() => {
    setDraft(block);
    setQuality(null);
    setSuggestions(null);
    setRelated([]);
    setTagInput("");
  }, [block]);

  const runInsight = useCallback(
    async (kind: "quality" | "tags" | "related") => {
      if (!block) return;
      setBusy(kind);
      try {
        const res = await fetch(`/api/insights/${kind}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ promptId: block.id }),
        });
        const data = (await res.json()) as QualityReport &
          TagSuggestion & { related?: RelatedHit[]; error?: string };
        if (!res.ok) throw new Error(data.error ?? "insight failed");
        if (kind === "quality") setQuality(data);
        if (kind === "tags") setSuggestions(data);
        if (kind === "related") setRelated(data.related ?? []);
      } catch (error) {
        toast.error((error as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [block, toast],
  );

  if (!open || !block || !draft) return null;

  const addTag = (raw: string) => {
    const tag = raw.trim().replace(/,$/, "");
    if (!tag || draft.tags.includes(tag)) return;
    setDraft({ ...draft, tags: [...draft.tags, tag] });
    setTagInput("");
  };

  const ancestors: PromptBlock[] = [];
  let cursor = draft.parentPromptId;
  let guard = 0;
  while (cursor && guard < 10) {
    const parent = library.find((b) => b.id === cursor);
    if (!parent) break;
    ancestors.unshift(parent);
    cursor = parent.parentPromptId;
    guard += 1;
  }
  const descendants = library.filter((b) => b.parentPromptId === draft.id);
  const root = ancestors[0] ?? (draft.rootPromptId ? library.find((b) => b.id === draft.rootPromptId) : null);

  return (
    <Overlay
      open={open}
      onClose={onClose}
      title={block.title}
      subtitle={`prompt ${String(block.id).padStart(3, "0")} · ${draft?.tags.length ? draft.tags.slice(0, 3).join(" · ") : "untagged"}`}
      width="max-w-4xl"
    >
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <label className="block">
            <FieldLabel>Title</FieldLabel>
            <input
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              className="field focus-ring !text-[14px] !font-semibold"
            />
          </label>

          <label className="mt-4 block">
            <FieldLabel hint={`${draft.content.length} chars`}>Content</FieldLabel>
            <textarea
              value={draft.content}
              onChange={(event) => setDraft({ ...draft, content: event.target.value })}
              rows={12}
              className="field focus-ring font-mono !text-[12px]"
            />
          </label>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="block">
              <FieldLabel>Stack</FieldLabel>
              <select
                value={draft.stackId ?? ""}
                onChange={(event) =>
                  setDraft({ ...draft, stackId: event.target.value ? Number(event.target.value) : null })
                }
                className="field focus-ring"
              >
                <option value="">unassigned</option>
                {stacks.map((stack) => (
                  <option key={stack.id} value={stack.id}>
                    {stack.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <FieldLabel>Group</FieldLabel>
              <select
                value={draft.basketId ?? ""}
                onChange={(event) =>
                  setDraft({ ...draft, basketId: event.target.value ? Number(event.target.value) : null })
                }
                className="field focus-ring"
              >
                <option value="">ungrouped</option>
                {baskets.map((basket) => (
                  <option key={basket.id} value={basket.id}>
                    {basket.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <FieldLabel>Order</FieldLabel>
              <input
                type="number"
                min={1}
                max={99}
                value={draft.stackOrder}
                onChange={(event) => setDraft({ ...draft, stackOrder: Number(event.target.value) })}
                className="field focus-ring num"
              />
            </label>
          </div>

          <div className="mt-4">
            <FieldLabel>Tags</FieldLabel>
            <div className="flex flex-wrap items-center gap-1.5">
              {draft.tags.map((tag) => {
                const color = colors.get(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    title="Remove tag"
                    onClick={() => setDraft({ ...draft, tags: draft.tags.filter((t) => t !== tag) })}
                    style={
                      color
                        ? { background: tagCss(color).background, borderColor: tagCss(color).borderColor }
                        : undefined
                    }
                    className="focus-ring group inline-flex items-center gap-1.5 border border-line px-2 py-[3px] text-[11px] text-ink2 transition-colors hover:border-linestrong"
                  >
                    {color && <span className="h-[6px] w-[6px]" style={{ background: tagAccent(color) }} />}
                    {tag}
                    <span className="text-ink3 group-hover:text-accent">×</span>
                  </button>
                );
              })}
              <input
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === ",") {
                    event.preventDefault();
                    addTag(tagInput);
                  }
                }}
                placeholder="add tag"
                className="focus-ring w-24 border border-dashed border-line bg-transparent px-2.5 py-[3px] text-[11px] text-ink outline-none placeholder:text-ink3"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <button type="button" onClick={() => onSave(draft.id, draft)} className="btn btn-primary focus-ring">
              Save changes
            </button>
            <button type="button" onClick={() => onFork(draft)} className="btn btn-secondary focus-ring">
              <IconFork width={13} height={13} />
              Fork
            </button>
            <button
              type="button"
              onClick={async () => {
                if (await copyText(draft.content)) toast.success("Block copied.");
              }}
              className="btn btn-secondary focus-ring"
            >
              <IconCopy width={13} height={13} />
              Copy
            </button>
            <button type="button" onClick={() => onDelete(draft)} className="btn btn-ghost focus-ring ml-auto hover:!text-accent">
              <IconArchive width={13} height={13} />
              Archive
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <section className="surface p-4">
            <div className="flex items-center gap-1.5">
              <IconSpark width={13} height={13} style={{ color: "var(--accent)" }} />
              <h3 className="label !text-ink2">Intelligence</h3>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {[
                { key: "tags" as const, label: "Suggest tags" },
                { key: "quality" as const, label: "Analyze quality" },
                { key: "related" as const, label: "Find related" },
              ].map((tool) => (
                <button
                  key={tool.key}
                  type="button"
                  onClick={() => runInsight(tool.key)}
                  disabled={busy !== null}
                  className="btn btn-secondary focus-ring !px-2.5 !py-1 !text-[11px]"
                >
                  {busy === tool.key ? <Spinner size={11} /> : null}
                  {tool.label}
                </button>
              ))}
            </div>

            {quality && (
              <div className="animate-rise mt-4 space-y-3 border-t border-line pt-4">
                <div className="flex items-baseline gap-2">
                  <span className="num text-[26px] font-semibold leading-none text-ink">{quality.overall}</span>
                  <span className="label">/ 100 · {quality.source}</span>
                </div>
                {quality.metrics.map((metric) => (
                  <Bar key={metric.key} label={metric.label} value={metric.score} note={metric.note} />
                ))}
                <p className="text-[11.5px] leading-relaxed text-ink2">{quality.summary}</p>
                {quality.recommendations.length > 0 && (
                  <ul className="space-y-1 border-t border-line pt-2.5 text-[11.5px] leading-relaxed text-ink3">
                    {quality.recommendations.map((rec) => (
                      <li key={rec}>— {rec}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {suggestions && (
              <div className="animate-rise mt-4 space-y-3 border-t border-line pt-4">
                <p className="label">suggestions · {suggestions.source}</p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.tags.length === 0 && <span className="text-[11.5px] text-ink3">Nothing new found.</span>}
                  {suggestions.tags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => addTag(tag)}
                      className="btn btn-accent focus-ring !px-2 !py-[3px] !text-[11px]"
                    >
                      <IconPlus width={10} height={10} />
                      {tag}
                    </button>
                  ))}
                </div>
                {suggestions.merges.length > 0 && (
                  <div className="space-y-1">
                    <p className="label">merges</p>
                    {suggestions.merges.map((merge) => (
                      <button
                        key={`${merge.source}-${merge.target}`}
                        type="button"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            tags: [
                              ...draft.tags.filter((t) => t !== merge.source),
                              ...(draft.tags.includes(merge.target) ? [] : [merge.target]),
                            ],
                          })
                        }
                        className="focus-ring block w-full border border-line px-2.5 py-1.5 text-left text-[11.5px] text-ink2 transition-colors hover:border-linestrong hover:text-ink"
                      >
                        {merge.source} <span className="text-ink3">→</span> {merge.target}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {related.length > 0 && (
              <div className="animate-rise mt-4 space-y-1 border-t border-line pt-4">
                <p className="label mb-1.5">related</p>
                {related.map((hit) => (
                  <button
                    key={hit.id}
                    type="button"
                    onClick={() => onJump(hit.id)}
                    className="focus-ring block w-full border border-line px-2.5 py-2 text-left transition-colors hover:border-linestrong"
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[12px] font-medium text-ink">{hit.title}</span>
                      <span className="num shrink-0 text-[10px] text-accent">{Math.round(hit.score * 100)}%</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[10.5px] text-ink3">{hit.reason}</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="surface p-4">
            <h3 className="label !text-ink2">Lineage</h3>
            {ancestors.length === 0 && descendants.length === 0 && (
              <p className="mt-2 text-[11.5px] text-ink3">Root block — fork it to start a branch.</p>
            )}
            {ancestors.length > 0 && (
              <div className="mt-2.5 space-y-1">
                <p className="label">ancestors</p>
                {ancestors.map((parent) => (
                  <button
                    key={parent.id}
                    type="button"
                    onClick={() => onJump(parent.id)}
                    className="focus-ring block w-full truncate border border-line px-2.5 py-1.5 text-left text-[11.5px] text-ink2 transition-colors hover:border-linestrong hover:text-ink"
                  >
                    ↑ {parent.title}
                  </button>
                ))}
              </div>
            )}
            {descendants.length > 0 && (
              <div className="mt-3 space-y-1">
                <p className="label">descendants</p>
                {descendants.map((child) => (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => onJump(child.id)}
                    className="focus-ring block w-full truncate border border-line px-2.5 py-1.5 text-left text-[11.5px] text-ink2 transition-colors hover:border-linestrong hover:text-ink"
                  >
                    ↓ {child.title}
                  </button>
                ))}
              </div>
            )}
            <p className="num mt-3 border-t border-line pt-2.5 text-[10.5px] text-ink3">
              root {root?.id ?? draft.id} · parent {draft.parentPromptId ?? "—"}
            </p>
          </section>

          <button
            type="button"
            onClick={() => onDelete(draft)}
            className="btn btn-ghost focus-ring w-full !justify-start !text-[11.5px] hover:!text-accent"
          >
            <IconTrash width={12} height={12} />
            Archive this block
          </button>
        </div>
      </div>
    </Overlay>
  );
}
