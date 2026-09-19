"use client";

import { useEffect, useState } from "react";
import { STACK_THEMES, STACK_THEME_META, type Stack, type StackTheme } from "@/lib/types";
import { copyText, FieldLabel, Overlay, useToast } from "./ui";
import { IconLink, IconPublic, IconTrash } from "./icons";

export function StackSettingsOverlay({
  open,
  stack,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  stack: Stack | null;
  onClose: () => void;
  onSave: (id: number, patch: Partial<Stack>) => void;
  onDelete: (id: number) => void;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [cover, setCover] = useState("");
  const [theme, setTheme] = useState<StackTheme>("midnight");

  useEffect(() => {
    if (!stack) return;
    setName(stack.name);
    setSlug(stack.slug ?? "");
    setDescription(stack.description ?? "");
    setCover(stack.coverImageUrl ?? "");
    setTheme(stack.theme);
  }, [stack]);

  // Note: Overlay handles the exit animation itself, so this stays mounted
  // while closing (only unmounts when there is nothing to show).
  if (!stack) return null;

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const publicUrl = slug ? `${origin}/s/${slug}` : "";

  const commit = (extra?: Partial<Stack>) =>
    onSave(stack.id, {
      name,
      description,
      coverImageUrl: cover || null,
      theme,
      slug: slug || null,
      ...extra,
    });

  return (
    <Overlay open={open} onClose={onClose} title="Stack settings" subtitle={stack.name} width="max-w-xl">
      <div className="grid gap-4">
        <label className="block">
          <FieldLabel>Name</FieldLabel>
          <input value={name} onChange={(event) => setName(event.target.value)} className="field focus-ring !text-[14px] !font-semibold" />
        </label>

        <label className="block">
          <FieldLabel>Description</FieldLabel>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} className="field focus-ring" />
        </label>

        <label className="block">
          <FieldLabel hint="optional">Cover image URL</FieldLabel>
          <input value={cover} onChange={(event) => setCover(event.target.value)} placeholder="https://…" className="field focus-ring font-mono !text-[12px]" />
        </label>

        <div>
          <p className="label mb-1.5">Theme</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {STACK_THEMES.map((option) => {
              const on = theme === option;
              return (
                <button
                  key={option}
                  type="button"
                  data-stack-theme={option}
                  onClick={() => setTheme(option)}
                  className="focus-ring border px-3 py-2.5 text-left transition-all duration-150"
                  style={{ borderColor: on ? "var(--accent)" : "var(--line)", background: on ? "var(--accent-soft)" : "transparent" }}
                >
                  <span className="block h-[3px] w-6 " style={{ background: "var(--accent)" }} />
                  <span className="mt-2 block text-[11.5px] font-medium text-ink">{STACK_THEME_META[option].label}</span>
                  <span className="mt-0.5 block text-[10px] leading-snug text-ink3">{STACK_THEME_META[option].hint}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border border-line bg-bg p-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-2">
              <IconPublic width={14} height={14} style={{ color: stack.isPublic ? "var(--accent)" : "var(--ink-3)", marginTop: 2 }} />
              <div>
                <p className="text-[12.5px] font-medium text-ink">{stack.isPublic ? "Published" : "Private"}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-ink3">
                  {stack.isPublic ? "Anyone with the link can read this stack." : "Only visible in your studio."}
                </p>
              </div>
            </div>
            <button type="button" onClick={() => commit({ isPublic: !stack.isPublic })} className={`btn focus-ring shrink-0 ${stack.isPublic ? "btn-secondary" : "btn-primary"}`}>
              {stack.isPublic ? "Unpublish" : "Publish"}
            </button>
          </div>

          <label className="mt-3 block">
            <FieldLabel hint="leave blank to auto-mint">Public slug</FieldLabel>
            <input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="my-stack" className="field focus-ring font-mono !text-[12px]" />
          </label>

          {stack.isPublic && publicUrl && (
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate border border-line bg-surface px-2.5 py-1.5 font-mono text-[11px] text-accent">
                {publicUrl}
              </code>
              <button
                type="button"
                onClick={async () => {
                  if (await copyText(publicUrl)) toast.success("Link copied.");
                }}
                className="btn btn-secondary focus-ring !px-2.5"
              >
                <IconLink width={12} height={12} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
        <button type="button" onClick={() => onDelete(stack.id)} className="btn btn-ghost focus-ring hover:!text-accent">
          <IconTrash width={13} height={13} />
          Delete stack
        </button>
        <button type="button" onClick={() => commit()} className="btn btn-primary focus-ring">
          Save stack
        </button>
      </div>
    </Overlay>
  );
}
