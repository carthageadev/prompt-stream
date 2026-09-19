"use client";

import { useEffect, useState } from "react";
import type { TagColor } from "@/lib/types";
import { CORE_TAGS, tagAccent, tagCss } from "@/lib/tags";
import { Overlay, Segmented, useToast } from "./ui";

type Props = {
  open: boolean;
  onClose: () => void;
  tags: { tag: string; count: number }[];
  colors: Map<string, TagColor>;
  theme: "dark" | "light";
  autoTag: boolean;
  columns: number;
  onTheme: (theme: "dark" | "light") => void;
  onAutoTag: (value: boolean) => void;
  onColumns: (value: number) => void;
  onColor: (tag: string, hue: number, lightness: number) => void;
  onResetColor: (tag: string) => void;
};

export function SettingsOverlay(props: Props) {
  const { open, onClose, tags, colors } = props;
  const toast = useToast();
  const [selected, setSelected] = useState<string | null>(null);
  const [hue, setHue] = useState(200);
  const [lightness, setLightness] = useState(58);

  useEffect(() => {
    if (!open) return;
    const first = tags[0]?.tag ?? null;
    setSelected(first);
    const color = first ? colors.get(first) : undefined;
    if (color) {
      setHue(color.hue);
      setLightness(color.lightness);
    }
  }, [open, tags, colors]);

  const core = tags.filter((t) => (CORE_TAGS as readonly string[]).includes(t.tag));
  const custom = tags.filter((t) => !(CORE_TAGS as readonly string[]).includes(t.tag));
  const usedHues = new Set(
    [...colors.entries()].filter(([tag]) => tag !== selected).map(([, color]) => color.hue),
  );

  const pick = (tag: string) => {
    setSelected(tag);
    const color = colors.get(tag);
    if (color) {
      setHue(color.hue);
      setLightness(color.lightness);
    }
  };

  const preview: TagColor = { tag: selected ?? "tag", hue, lightness };

  return (
    <Overlay open={open} onClose={onClose} title="Settings" subtitle="appearance · taxonomy · colour" width="max-w-2xl">
      <section className="surface p-4">
        <h3 className="label !text-ink2">Appearance</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="label mb-1.5">Theme</p>
            <Segmented
              value={props.theme}
              onChange={props.onTheme}
              options={[
                { value: "light", label: "Paper" },
                { value: "dark", label: "Ink" },
              ]}
            />
          </div>
          <div>
            <p className="label mb-1.5">Grid columns · {props.columns}</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => props.onColumns(count)}
                  className="num focus-ring h-7 flex-1 border text-[11px] transition-all duration-150"
                  style={{
                    borderColor: props.columns === count ? "var(--ink)" : "var(--line)",
                    background: props.columns === count ? "var(--ink)" : "transparent",
                    color: props.columns === count ? "var(--bg)" : "var(--ink-3)",
                  }}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2">
            <p className="label mb-1.5">Auto-tagging</p>
            <button
              type="button"
              onClick={() => props.onAutoTag(!props.autoTag)}
              className={`btn focus-ring w-full ${props.autoTag ? "btn-primary" : "btn-secondary"}`}
            >
              {props.autoTag ? "On — infer tags" : "Off — keep as typed"}
            </button>
          </div>
        </div>
      </section>

      <section className="surface mt-4 p-4">
        <h3 className="label !text-ink2">Tag colours</h3>
        {tags.length === 0 ? (
          <p className="mt-2 text-[11.5px] text-ink3">No tags yet.</p>
        ) : (
          <>
            {[
              { label: "core", list: core },
              { label: "custom", list: custom },
            ].map((group) =>
              group.list.length ? (
                <div key={group.label} className="mt-3">
                  <p className="label mb-1.5">{group.label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.list.map(({ tag, count }) => {
                      const color = colors.get(tag);
                      const on = selected === tag;
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => pick(tag)}
                          style={
                            on
                              ? { background: tagCss(color ?? preview).background, borderColor: tagCss(color ?? preview).borderColor }
                              : { borderColor: "var(--line)" }
                          }
                          className="focus-ring inline-flex items-center gap-1.5 border px-2 py-[3px] text-[11px] text-ink2 transition-all duration-150 hover:border-linestrong"
                        >
                          {color && <span className="h-[6px] w-[6px]" style={{ background: tagAccent(color) }} />}
                          {tag}
                          <span className="num text-[10px] text-ink3">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null,
            )}

            {selected && (
              <div className="animate-rise mt-4 border border-line bg-bg p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 border px-2.5 py-1 text-[11px] font-medium"
                    style={{
                      background: tagCss(preview).background,
                      borderColor: tagCss(preview).borderColor,
                      color: "var(--ink)",
                    }}
                  >
                    <span className="h-[6px] w-[6px]" style={{ background: tagAccent(preview) }} />
                    {selected}
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        props.onResetColor(selected);
                        toast.push("Reset to default palette.");
                      }}
                      className="btn btn-ghost focus-ring !px-2.5 !py-1 !text-[11px]"
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        props.onColor(selected, hue, lightness);
                        toast.success(`${selected} saved.`);
                      }}
                      className="btn btn-primary focus-ring !px-3 !py-1 !text-[11px]"
                    >
                      Save
                    </button>
                  </div>
                </div>

                <label className="mt-4 block">
                  <span className="label">Hue · {hue}°</span>
                  <input
                    type="range"
                    min={0}
                    max={359}
                    value={hue}
                    onChange={(event) => setHue(Number(event.target.value))}
                    className="focus-ring mt-2 h-[6px] w-full cursor-pointer appearance-none outline-none"
                    style={{
                      background:
                        "linear-gradient(90deg, hsl(0,70%,55%), hsl(60,70%,50%), hsl(120,60%,45%), hsl(180,60%,48%), hsl(240,65%,58%), hsl(300,60%,55%), hsl(359,70%,55%))",
                    }}
                  />
                </label>

                <label className="mt-3 block">
                  <span className="label">Lightness · {lightness}%</span>
                  <input
                    type="range"
                    min={35}
                    max={80}
                    value={lightness}
                    onChange={(event) => setLightness(Number(event.target.value))}
                    className="focus-ring mt-2 h-[6px] w-full cursor-pointer appearance-none outline-none"
                    style={{ background: `linear-gradient(90deg, hsl(${hue},70%,35%), hsl(${hue},70%,58%), hsl(${hue},70%,80%))` }}
                  />
                </label>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {Array.from({ length: 24 }, (_, index) => index * 15).map((candidate) => {
                    const taken = [...usedHues].some(
                      (used) => Math.min(Math.abs(used - candidate), 360 - Math.abs(used - candidate)) < 12,
                    );
                    return (
                      <button
                        key={candidate}
                        type="button"
                        disabled={taken}
                        title={taken ? "in use by another tag" : `hue ${candidate}`}
                        onClick={() => setHue(candidate)}
                        className={`h-[18px] w-[18px] transition-transform duration-150 ${
                          taken ? "cursor-not-allowed opacity-20" : "hover:scale-110"
                        }`}
                        style={{
                          background: `hsl(${candidate}, 70%, 52%)`,
                          outline: hue === candidate ? "2px solid var(--ink)" : "none",
                          outlineOffset: "2px",
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <section className="mt-4 border border-line p-4">
        <h3 className="label !text-ink2">Shortcuts</h3>
        <ul className="mt-2.5 grid gap-1.5 text-[11.5px] text-ink2 sm:grid-cols-2">
          <li>
            <span className="kbd">a–z</span> type anywhere to search
          </li>
          <li>
            <span className="kbd">/</span> focus the search field
          </li>
          <li>
            <span className="kbd">⌫</span> edit · <span className="kbd">esc</span> clear
          </li>
          <li>paste anywhere to create a block</li>
          <li>
            <span className="kbd">⌘</span> <span className="kbd">↵</span> save the quick creator
          </li>
          <li>
            <span className="kbd">⇧</span> <span className="kbd">R</span> toggle the rack
          </li>
        </ul>
      </section>
    </Overlay>
  );
}
