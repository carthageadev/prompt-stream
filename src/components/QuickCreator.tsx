"use client";

import { useEffect, useRef, useState } from "react";
import type { BlockType, Stack } from "@/lib/types";
import { FieldLabel, Overlay } from "./ui";

/** Paste-first creator. Cmd/Ctrl+Enter saves, Esc closes. */
export function QuickCreator({
  open,
  stacks,
  defaultStackId,
  autoTag,
  onClose,
  onCreate,
}: {
  open: boolean;
  stacks: Stack[];
  defaultStackId: number | null;
  autoTag: boolean;
  onClose: () => void;
  onCreate: (payload: {
    title: string;
    content: string;
    blockType: BlockType;
    stackId: number | null;
    autoTag: boolean;
    stackOrder: number;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [blockType, setBlockType] = useState<BlockType>("instruction");
  const [stackId, setStackId] = useState<number | null>(defaultStackId);
  const [order, setOrder] = useState(1);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setContent("");
    setBlockType("instruction");
    setStackId(defaultStackId);
    setOrder(1);
    const timer = setTimeout(() => areaRef.current?.focus(), 60);
    return () => clearTimeout(timer);
  }, [open, defaultStackId]);

  const submit = () => {
    if (!content.trim()) return;
    onCreate({
      title,
      content,
      blockType,
      stackId,
      autoTag,
      stackOrder: Math.max(1, Math.min(99, order || 1)),
    });
  };

  return (
    <Overlay open={open} onClose={onClose} title="New block" subtitle="quick creator" width="max-w-2xl">
      <textarea
        ref={areaRef}
        value={content}
        onChange={(event) => setContent(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            submit();
          }
        }}
        rows={11}
        placeholder={"Paste anything — a persona, a set of rules, an output contract.\n\nThe first line becomes the title."}
        className="field focus-ring font-mono !text-[12.5px]"
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <FieldLabel>Title</FieldLabel>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="derived from first line"
            className="field focus-ring"
          />
        </label>

        <label className="block">
          <FieldLabel>Stack</FieldLabel>
          <select
            value={stackId ?? ""}
            onChange={(event) => setStackId(event.target.value ? Number(event.target.value) : null)}
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
          <FieldLabel hint="1 – 99">Order</FieldLabel>
          <input
            type="number"
            min={1}
            max={99}
            value={order}
            onChange={(event) => setOrder(Number(event.target.value))}
            className="field focus-ring num"
          />
        </label>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4">
        <p className="flex items-center gap-1.5 text-[11px] text-ink3">
          <span className="kbd">⌘</span>
          <span className="kbd">↵</span>
          to save · {autoTag ? "auto-tagging on" : "auto-tagging off"}
        </p>
        <button type="button" onClick={submit} disabled={!content.trim()} className="btn btn-primary focus-ring">
          Save block
        </button>
      </div>
    </Overlay>
  );
}
