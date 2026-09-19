"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Basket, BlockType, PromptBlock, SemanticHit, Stack, TagColor } from "@/lib/types";
import { BLOCK_TYPE_META } from "@/lib/types";
import { deriveTagColor, groupColor, groupEnvelope } from "@/lib/tags";
import { BlurPanel, copyText, Overlay, Spinner, useBlurPanel, useLocalState, useToast } from "./ui";
import { PromptCard, type CardHandles } from "./PromptCard";
import { GroupFields } from "./GroupFields";
import { Rack, rackKey, type RackItem } from "./Rack";
import { TagBar } from "./TagBar";
import { QuickCreator } from "./QuickCreator";
import { EditorOverlay } from "./EditorOverlay";
import { SettingsOverlay } from "./SettingsOverlay";
import { SessionGate, type SessionRef } from "./SessionGate";
import { StackSettingsOverlay } from "./StackSettingsOverlay";
import {
  IconArchive,
  IconCheck,
  IconClose,
  IconColumns,
  IconDoc,
  IconLayers,
  IconMoon,
  IconPlus,
  IconRestore,
  IconSearch,
  IconSettings,
  IconSun,
  IconTrash,
} from "./icons";

type Filter = "all" | "unassigned" | "archived" | number;

let tempId = -1;

export function Studio({
  initialBlocks,
  initialStacks,
  initialBaskets,
  initialColors,
  initialSession,
}: {
  initialBlocks: PromptBlock[];
  initialStacks: Stack[];
  initialBaskets: Basket[];
  initialColors: TagColor[];
  initialSession: SessionRef | null;
}) {
  const toast = useToast();

  const [session, setSession] = useState<SessionRef | null>(initialSession);
  const [gateOpen, setGateOpen] = useState(initialSession == null);

  const [blocks, setBlocks] = useState<PromptBlock[]>(initialBlocks);
  const [stacks, setStacks] = useState<Stack[]>(initialStacks);
  const [baskets, setBaskets] = useState<Basket[]>(initialBaskets);
  const [savedColors, setSavedColors] = useState<TagColor[]>(initialColors);

  const [filter, setFilter] = useState<Filter>("all");
  const [renaming, setRenaming] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [query, setQuery] = useState("");
  const [searchAwake, setSearchAwake] = useState(false);
  const [mode, setMode] = useState<"keyword" | "semantic">("keyword");
  const [semanticHits, setSemanticHits] = useState<Map<number, SemanticHit>>(new Map());
  const [searching, setSearching] = useState(false);
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  const [organizing, setOrganizing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [basketDialogOpen, setBasketDialogOpen] = useState(false);
  const [basketName, setBasketName] = useState("");
  const [renamingBasketId, setRenamingBasketId] = useState<number | null>(null);
  const [renamingBasketName, setRenamingBasketName] = useState("");
  const [collapsedBaskets, setCollapsedBaskets] = useLocalState<number[]>("ps.collapsed-baskets", []);
  const [groupView, setGroupView] = useLocalState<"flow" | "stacked">("ps.group-view", "flow");

  // Panels stay mounted through their exit so they blur out instead of vanishing.
  const searchOpen = query.length > 0 || searchAwake;
  const { mounted: searchMounted, leaving: searchLeaving } = useBlurPanel(searchOpen);
  const { mounted: organizeMounted, leaving: organizeLeaving } = useBlurPanel(organizing);
  const { mounted: filterMounted, leaving: filterLeaving } = useBlurPanel(filterOpen);

  const [columns, setColumns] = useLocalState<number>("ps.columns", 3);
  const [theme, setTheme] = useLocalState<"dark" | "light">("ps.theme", "light");
  const [autoTag, setAutoTag] = useLocalState<boolean>("ps.autotag", true);

  const [rackItems, setRackItems] = useState<RackItem[]>([]);
  const [rackOpen, setRackOpen] = useState(false);

  const [quickOpen, setQuickOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [stackSettingsId, setStackSettingsId] = useState<number | null>(null);

  const [newIds, setNewIds] = useState<Set<number>>(new Set());
  const [removing, setRemoving] = useState<Set<number>>(new Set());
  const pendingDeletes = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const activeStack = typeof filter === "number" ? stacks.find((s) => s.id === filter) ?? null : null;

  const liveBlocks = useMemo(() => blocks.filter((b) => !b.isArchived), [blocks]);
  const archivedBlocks = useMemo(() => blocks.filter((b) => b.isArchived), [blocks]);

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    liveBlocks.forEach((block) => block.tags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1)));
    return [...counts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }, [liveBlocks]);

  const colors = useMemo(() => {
    const map = new Map<string, TagColor>();
    const used: number[] = [];
    savedColors.forEach((color) => {
      map.set(color.tag, color);
      used.push(color.hue);
    });
    tagCounts.forEach(({ tag }) => {
      if (map.has(tag)) return;
      const derived = deriveTagColor(tag, used);
      map.set(tag, derived);
      used.push(derived.hue);
    });
    return map;
  }, [savedColors, tagCounts]);

  const pool = useMemo(() => {
    if (filter === "archived") return archivedBlocks;
    if (filter === "unassigned") return liveBlocks.filter((b) => b.stackId === null);
    if (typeof filter === "number") return liveBlocks.filter((b) => b.stackId === filter);
    return liveBlocks;
  }, [filter, liveBlocks, archivedBlocks]);

  const { visibleIds, matches } = useMemo(() => {
    const visible = new Set<number>();
    const scores = new Map<number, SemanticHit>();
    const keyword = query.trim().toLowerCase();

    for (const block of pool) {
      if (activeTags.size > 0 && !block.tags.some((tag) => activeTags.has(tag))) continue;
      if (!keyword) {
        visible.add(block.id);
        continue;
      }
      if (mode === "semantic") {
        const hit = semanticHits.get(block.id);
        if (hit) {
          visible.add(block.id);
          scores.set(block.id, hit);
        }
        continue;
      }
      const haystack = `${block.title}\n${block.content}\n${block.tags.join(" ")}`.toLowerCase();
      if (haystack.includes(keyword)) visible.add(block.id);
    }
    return { visibleIds: visible, matches: scores };
  }, [pool, query, mode, semanticHits, activeTags]);

  const orderedVisible = useMemo(() => {
    if (mode === "semantic" && query.trim()) {
      const ranked = [...visibleIds].sort((a, b) => (matches.get(b)?.score ?? 0) - (matches.get(a)?.score ?? 0));
      const rank = new Map(ranked.map((id, index) => [id, index]));
      return [...pool].sort((a, b) => (rank.get(a.id) ?? 9999) - (rank.get(b.id) ?? 9999));
    }
    return pool;
  }, [pool, visibleIds, matches, mode, query]);

  useEffect(() => {
    if (mode !== "semantic" || !query.trim()) {
      setSemanticHits(new Map());
      setSearching(false);
      return;
    }
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch("/api/search/semantic", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ query, limit: 40 }),
        });
        const data = (await res.json()) as { hits: SemanticHit[] };
        setSemanticHits(new Map(data.hits.map((hit) => [hit.id, hit])));
      } catch {
        toast.error("Semantic search failed — falling back to keyword.");
        setMode("keyword");
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => clearTimeout(handle);
  }, [mode, query, toast]);

  const flashNew = (id: number) => {
    setNewIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setNewIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 950);
  };

  const createBlock = useCallback(
    async (payload: {
      title: string;
      content: string;
      blockType: BlockType;
      stackId: number | null;
      autoTag: boolean;
      stackOrder: number;
    }) => {
      const optimistic: PromptBlock = {
        id: tempId--,
        title: payload.title || payload.content.split("\n")[0].slice(0, 70) || "Untitled block",
        content: payload.content,
        blockType: payload.blockType,
        stackId: payload.stackId,
        stackOrder: payload.stackOrder,
        basketId: null,
        basketOrder: 1,
        tags: [],
        parentPromptId: null,
        rootPromptId: null,
        isArchived: false,
        isFavorite: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setBlocks((prev) => [optimistic, ...prev]);
      flashNew(optimistic.id);
      try {
        const res = await fetch("/api/prompts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as { block?: PromptBlock; error?: string };
        if (!res.ok || !data.block) throw new Error(data.error ?? "create failed");
        setBlocks((prev) => prev.map((b) => (b.id === optimistic.id ? data.block! : b)));
        flashNew(data.block.id);
        toast.success("Block created.");
      } catch (error) {
        setBlocks((prev) => prev.filter((b) => b.id !== optimistic.id));
        toast.error(`Could not save: ${(error as Error).message}`);
      }
    },
    [toast],
  );

  const saveBlock = useCallback(
    async (id: number, patch: Partial<PromptBlock> & { autoTag?: boolean }) => {
      const before = blocks.find((b) => b.id === id);
      if (!before) return;
      setBlocks((prev) => prev.map((b) => (b.id === id ? ({ ...b, ...patch } as PromptBlock) : b)));
      try {
        const res = await fetch(`/api/prompts/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
        });
        const data = (await res.json()) as { block?: PromptBlock; error?: string };
        if (!res.ok || !data.block) throw new Error(data.error ?? "save failed");
        setBlocks((prev) => prev.map((b) => (b.id === id ? data.block! : b)));
      } catch (error) {
        setBlocks((prev) => prev.map((b) => (b.id === id ? before : b)));
        toast.error(`Could not save: ${(error as Error).message}`);
      }
    },
    [blocks, toast],
  );

  const forkBlock = useCallback(
    async (block: PromptBlock) => {
      try {
        const res = await fetch(`/api/prompts/${block.id}/fork`, { method: "POST" });
        const data = (await res.json()) as { block?: PromptBlock; error?: string };
        if (!res.ok || !data.block) throw new Error(data.error ?? "fork failed");
        setBlocks((prev) => [data.block!, ...prev]);
        flashNew(data.block.id);
        setEditingId(data.block.id);
        toast.success("Forked — lineage linked.");
      } catch (error) {
        toast.error((error as Error).message);
      }
    },
    [toast],
  );

  const deleteBlock = useCallback(
    (block: PromptBlock) => {
      setRemoving((prev) => new Set(prev).add(block.id));
      setTimeout(() => {
        setRemoving((prev) => {
          const next = new Set(prev);
          next.delete(block.id);
          return next;
        });
        setBlocks((prev) => prev.map((b) => (b.id === block.id ? { ...b, isArchived: true } : b)));
      }, 380);

      const handle = setTimeout(async () => {
        pendingDeletes.current.delete(block.id);
        try {
          await fetch(`/api/prompts/${block.id}`, { method: "DELETE" });
        } catch {
          toast.error("Archive sync failed.");
        }
      }, 6000);
      pendingDeletes.current.set(block.id, handle);

      toast.push("Moved to archives", {
        action: {
          label: "Undo",
          run: () => {
            const pending = pendingDeletes.current.get(block.id);
            if (pending) {
              clearTimeout(pending);
              pendingDeletes.current.delete(block.id);
            }
            setBlocks((prev) => prev.map((b) => (b.id === block.id ? { ...b, isArchived: false } : b)));
            flashNew(block.id);
          },
        },
      });
    },
    [toast],
  );

  const purgeBlock = useCallback(
    async (block: PromptBlock) => {
      setBlocks((prev) => prev.filter((b) => b.id !== block.id));
      await fetch(`/api/prompts/${block.id}?hard=1`, { method: "DELETE" }).catch(() => undefined);
      toast.push("Prompt deleted permanently.");
    },
    [toast],
  );

  const toggleRack = useCallback((block: PromptBlock) => {
    const key = rackKey(block.id);
    setRackItems((prev) => {
      if (prev.some((item) => item.key === key)) return prev.filter((item) => item.key !== key);
      return [...prev, { kind: "block", key, id: block.id, title: block.title, content: block.content }];
    });
    setRackOpen(true);
  }, []);

  const handles: CardHandles = useMemo(
    () => ({
      onOpen: (block) => setEditingId(block.id),
      onCopy: async (block) => {
        if (await copyText(block.content)) toast.success("Copied to clipboard.");
        else toast.error("Clipboard blocked.");
      },
      onToggleRack: toggleRack,
      inRack: (id) => rackItems.some((item) => item.key === rackKey(id)),
    }),
    [rackItems, toggleRack, toast],
  );

  const overlayOpen = quickOpen || editingId !== null || settingsOpen || stackSettingsId !== null;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const inField =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if (event.key === "Escape") {
        if (overlayOpen) return;
        if (organizing) {
          setOrganizing(false);
          setSelectedIds(new Set());
          return;
        }
        if (inField) (target as HTMLElement).blur();
        setQuery("");
        setSearchAwake(false);
        setActiveTags(new Set());
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "g") {
        event.preventDefault();
        setOrganizing((value) => !value);
        setSelectedIds(new Set());
        return;
      }
      if (inField || overlayOpen || event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "Backspace") {
        event.preventDefault();
        setQuery((value) => value.slice(0, -1));
        return;
      }
      if (event.key === " " && query) {
        event.preventDefault();
        setQuery((value) => `${value} `);
        return;
      }
      if (event.shiftKey && (event.key === "R" || event.key === "r")) {
        event.preventDefault();
        setRackOpen((open) => !open);
        return;
      }
      if (event.key === "/") {
        event.preventDefault();
        setSearchAwake(true);
        setTimeout(() => searchRef.current?.focus(), 0);
        return;
      }
      if (event.key.length === 1 && /[a-z0-9\-_ .]/i.test(event.key)) {
        event.preventDefault();
        setSearchAwake(true);
        setQuery((value) => (value + event.key).slice(0, 64));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [organizing, overlayOpen, query]);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (overlayOpen) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      const text = event.clipboardData?.getData("text/plain")?.trim();
      if (!text || text.length < 3) return;
      event.preventDefault();
      createBlock({
        title: "",
        content: text,
        blockType: "instruction",
        stackId: typeof filter === "number" ? filter : null,
        autoTag,
        stackOrder: 1,
      });
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [autoTag, createBlock, filter, overlayOpen]);

  const createStack = async () => {
    const name = `Stack ${stacks.length + 1}`;
    const res = await fetch("/api/stacks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = (await res.json()) as { stack?: Stack };
    if (data.stack) {
      setStacks((prev) => [...prev, data.stack!]);
      setFilter(data.stack.id);
      setRenaming(data.stack.id);
      setRenameValue(name);
    }
  };

  const renameStack = async (id: number, name: string) => {
    setRenaming(null);
    const trimmed = name.trim();
    if (!trimmed) return;
    const current = stacks.find((s) => s.id === id);
    setStacks((prev) => prev.map((s) => (s.id === id ? { ...s, name: trimmed } : s)));
    await fetch(`/api/stacks/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: trimmed, isPublic: current?.isPublic, slug: current?.slug ?? "" }),
    });
  };

  const saveStack = async (id: number, patch: Partial<Stack>) => {
    const res = await fetch(`/api/stacks/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = (await res.json()) as { stack?: Stack; error?: string };
    if (!res.ok || !data.stack) {
      toast.error(data.error ?? "Could not save stack.");
      return;
    }
    setStacks((prev) => prev.map((s) => (s.id === id ? data.stack! : s)));
    toast.success("Stack saved.");
  };

  const deleteStack = async (id: number) => {
    setStacks((prev) => prev.filter((s) => s.id !== id));
    setBlocks((prev) => prev.map((b) => (b.stackId === id ? { ...b, stackId: null } : b)));
    setFilter("all");
    setStackSettingsId(null);
    await fetch(`/api/stacks/${id}`, { method: "DELETE" });
    toast.push("Stack deleted — its blocks are now unassigned.");
  };

  const saveTagColor = async (tag: string, hue: number, lightness: number) => {
    setSavedColors((prev) => [...prev.filter((c) => c.tag !== tag), { tag, hue, lightness }]);
    await fetch("/api/tag-colors", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tag, hue, lightness }),
    });
  };

  const resetTagColor = async (tag: string) => {
    setSavedColors((prev) => prev.filter((c) => c.tag !== tag));
    await fetch(`/api/tag-colors?tag=${encodeURIComponent(tag)}`, { method: "DELETE" });
  };

  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const assignSelected = async (basketId: number | null) => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    setBlocks((prev) => prev.map((block) => (selectedIds.has(block.id) ? { ...block, basketId } : block)));
    setSelectedIds(new Set());
    try {
      const res = await fetch("/api/baskets", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ basketId, promptIds: ids }),
      });
      if (!res.ok) throw new Error("Could not move selection");
      toast.success(basketId ? "Moved to basket." : "Removed from basket.");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const createBasketFromSelection = async () => {
    const name = basketName.trim();
    if (!name) return;
    const ids = [...selectedIds];
    try {
      const res = await fetch("/api/baskets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, promptIds: ids }),
      });
      const data = (await res.json()) as { basket?: Basket; error?: string };
      if (!res.ok || !data.basket) throw new Error(data.error ?? "Could not create group");
      setBaskets((prev) => [...prev, data.basket!]);
      setBlocks((prev) => prev.map((block) => (selectedIds.has(block.id) ? { ...block, basketId: data.basket!.id } : block)));
      setBasketName("");
      setBasketDialogOpen(false);
      setSelectedIds(new Set());
      toast.success(`Created “${data.basket.name}”.`);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const renameBasket = async (id: number, name: string) => {
    const trimmed = name.trim();
    setRenamingBasketId(null);
    if (!trimmed) return;
    setBaskets((prev) => prev.map((basket) => (basket.id === id ? { ...basket, name: trimmed } : basket)));
    await fetch(`/api/baskets/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    }).catch(() => toast.error("Could not rename group."));
  };

  const deleteBasket = async (id: number) => {
    setBaskets((prev) => prev.filter((basket) => basket.id !== id));
    setBlocks((prev) => prev.map((block) => (block.basketId === id ? { ...block, basketId: null } : block)));
    await fetch(`/api/baskets/${id}`, { method: "DELETE" }).catch(() => toast.error("Could not remove group."));
    toast.push("Group removed. Prompts are now ungrouped.");
  };

  const toggleBasketCollapsed = (id: number) => {
    setCollapsedBaskets((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
  };

  const basketSections = useMemo(() => {
    const sections = baskets
      .map((basket) => ({ basket, blocks: orderedVisible.filter((block) => block.basketId === basket.id) }))
      .filter((section) => section.blocks.length > 0);
    const loose = orderedVisible.filter((block) => block.basketId === null);
    return { sections, loose };
  }, [baskets, orderedVisible]);

  /** Stable envelope per group, computed once per colour set — never per card. */
  const groupEnvelopes = useMemo(() => {
    const usedHues = [...colors.values()].map((color) => color.hue);
    const map = new Map<number, ReturnType<typeof groupEnvelope> & { name: string }>();
    baskets.forEach((basket) => {
      map.set(basket.id, { ...groupEnvelope(groupColor(basket.name, usedHues)), name: basket.name });
    });
    return map;
  }, [baskets, colors]);

  /** Flow view: one natural stream. Collapsed groups are lifted out into a strip. */
  const flowBlocks = useMemo(
    () => orderedVisible.filter((block) => !(block.basketId && collapsedBaskets.includes(block.basketId))),
    [orderedVisible, collapsedBaskets],
  );
  const collapsedSections = useMemo(
    () => basketSections.sections.filter((section) => collapsedBaskets.includes(section.basket.id)),
    [basketSections, collapsedBaskets],
  );



  const editingBlock = blocks.find((b) => b.id === editingId) ?? null;
  const stackSettingsStack = stacks.find((s) => s.id === stackSettingsId) ?? null;
  const showEmpty = pool.length === 0 && filter !== "archived";

  return (
    <div className={`min-h-screen md:pl-[208px] ${rackOpen ? "lg:pr-[380px]" : ""}`}>
      {/* Quiet workspace rail: navigation replaces the old control bar. */}
      <aside className="fixed inset-y-0 left-0 z-[70] hidden w-[208px] border-r border-line bg-elev md:flex md:flex-col">
        <Link href="/" className="flex h-14 items-center gap-2 border-b border-line px-5">
          <span className="h-2 w-2 bg-ink" />
          <span className="text-[13px] font-semibold tracking-[-0.02em] text-ink">prompt</span>
          <span className="text-[13px] text-ink3">studio</span>
        </Link>
        <div className="border-b border-line px-5 py-3">
          <button
            type="button"
            onClick={() => setGateOpen(true)}
            title={session ? "Switch session" : "Choose a session"}
            className="focus-ring flex w-full items-center gap-2.5 text-left"
          >
            <span
              aria-hidden
              className="flex h-7 w-7 shrink-0 items-center justify-center text-[13px] font-semibold uppercase"
              style={{ background: "var(--surface-2)", color: "var(--accent)" }}
            >
              {(session?.name ?? "?").slice(0, 1)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-medium text-ink">
                {session?.name ?? "No session"}
              </span>
              <span className="block text-[10.5px] text-ink3">switch →</span>
            </span>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto scroll-thin px-3 py-5">
          <p className="label px-2">Library</p>
          {[
            { value: "all" as Filter, label: "All prompts", count: liveBlocks.length },
            { value: "unassigned" as Filter, label: "Loose", count: liveBlocks.filter((b) => b.stackId === null).length },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => setFilter(item.value)}
              className="focus-ring mt-1 flex w-full items-center justify-between px-2 py-1.5 text-left text-[12.5px]"
              style={{ background: filter === item.value ? "var(--surface-2)" : "transparent", color: filter === item.value ? "var(--ink)" : "var(--ink-2)" }}
            >
              <span>{item.label}</span>
              <span className="num text-[10px] text-ink3">{item.count}</span>
            </button>
          ))}

          <div className="mt-7 flex items-center justify-between px-2">
            <p className="label">Stacks</p>
            <button type="button" onClick={createStack} aria-label="New stack" className="icon-btn focus-ring !h-5 !w-5">
              <IconPlus width={11} height={11} />
            </button>
          </div>
          <div className="mt-1 space-y-0.5">
            {stacks.map((stack) => (
              <div key={stack.id} className="group/stack flex items-center">
                {renaming === stack.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                    onBlur={() => renameStack(stack.id, renameValue)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") renameStack(stack.id, renameValue);
                      if (event.key === "Escape") setRenaming(null);
                    }}
                    className="field !px-2 !py-1.5 !text-[12px]"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setFilter(stack.id)}
                    onDoubleClick={() => {
                      setRenaming(stack.id);
                      setRenameValue(stack.name);
                    }}
                    className="focus-ring flex min-w-0 flex-1 items-center justify-between px-2 py-1.5 text-left text-[12.5px]"
                    style={{ background: filter === stack.id ? "var(--surface-2)" : "transparent", color: filter === stack.id ? "var(--ink)" : "var(--ink-2)" }}
                  >
                    <span className="truncate">{stack.name}</span>
                    <span className="num text-[10px] text-ink3">{liveBlocks.filter((b) => b.stackId === stack.id).length}</span>
                  </button>
                )}
                {filter === stack.id && (
                  <button type="button" onClick={() => setStackSettingsId(stack.id)} aria-label="Stack settings" className="icon-btn focus-ring !h-6 !w-6 opacity-0 group-hover/stack:opacity-100">
                    <IconSettings width={11} height={11} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </nav>

        <div className="border-t border-line p-3">
          <Link href="/compose" className="btn btn-ghost focus-ring w-full !justify-start !px-2 !text-[12px]">
            <IconLayers width={13} height={13} /> Compose
          </Link>
          <Link href="/sessions" className="btn btn-ghost focus-ring w-full !justify-start !px-2 !text-[12px]">
            <IconDoc width={13} height={13} /> Sessions
          </Link>
          <button type="button" onClick={() => setFilter("archived")} className="btn btn-ghost focus-ring w-full !justify-start !px-2 !text-[12px]">
            <IconArchive width={13} height={13} /> Archives
            {archivedBlocks.length > 0 && <span className="num ml-auto text-[10px]">{archivedBlocks.length}</span>}
          </button>
          <button type="button" onClick={() => setSettingsOpen(true)} className="btn btn-ghost focus-ring w-full !justify-start !px-2 !text-[12px]">
            <IconSettings width={13} height={13} /> Settings
          </button>
        </div>
      </aside>

      {/* Mobile-only minimal header. */}
      <header className="sticky top-0 z-[60] flex h-12 items-center border-b border-line bg-elev px-4 md:hidden">
        <Link href="/" className="flex items-center gap-2">
          <span className="h-2 w-2 bg-ink" />
          <span className="text-[13px] font-semibold">prompt studio</span>
        </Link>
        <select
          value={typeof filter === "number" ? `s${filter}` : filter}
          onChange={(event) => {
            const value = event.target.value;
            setFilter(value.startsWith("s") ? Number(value.slice(1)) : (value as Filter));
          }}
          className="field ml-auto !w-auto !py-1 !text-[11px]"
        >
          <option value="all">All prompts</option>
          <option value="unassigned">Loose</option>
          {stacks.map((stack) => <option key={stack.id} value={`s${stack.id}`}>{stack.name}</option>)}
          <option value="archived">Archives</option>
        </select>
      </header>

      <main className="mx-auto max-w-[1320px] px-5 py-7 sm:px-8">
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="label">{filter === "archived" ? "Library" : "Workspace"}</p>
            <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.035em] text-ink">
              {filter === "archived" ? "Archives" : activeStack ? activeStack.name : filter === "unassigned" ? "Loose prompts" : "All prompts"}
            </h1>
            <p className="mt-1 text-[11.5px] text-ink3">
              {filter === "archived"
                ? `${archivedBlocks.length} stored away`
                : `${visibleIds.size} of ${pool.length} visible${basketSections.sections.length ? ` · ${basketSections.sections.length} group${basketSections.sections.length === 1 ? "" : "s"}` : ""}`}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {filter !== "archived" && (
              <>
                {basketSections.sections.length > 0 && (
                  <div className="mr-1 flex items-center border border-line p-[2px]" title="Flow keeps every card in one stream; Groups stacks each group into its own envelope">
                    {(["flow", "stacked"] as const).map((view) => (
                      <button
                        key={view}
                        type="button"
                        onClick={() => setGroupView(view)}
                        className="focus-ring px-2 py-1 text-[10.5px] font-medium capitalize transition-all duration-150"
                        style={{
                          background: groupView === view ? "var(--ink)" : "transparent",
                          color: groupView === view ? "var(--bg)" : "var(--ink-3)",
                        }}
                      >
                        {view === "stacked" ? "groups" : "flow"}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setFilterOpen((value) => !value)}
                  className={`btn focus-ring !px-2.5 !py-1.5 !text-[11.5px] ${filterOpen || activeTags.size ? "btn-primary" : "btn-ghost"}`}
                >
                  <IconColumns width={13} height={13} />
                  Filters{activeTags.size ? ` ${activeTags.size}` : ""}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOrganizing((value) => !value);
                    setSelectedIds(new Set());
                  }}
                  className={`btn focus-ring !px-2.5 !py-1.5 !text-[11.5px] ${organizing ? "btn-primary" : "btn-ghost"}`}
                >
                  <IconCheck width={13} height={13} /> Organize
                </button>
                <button type="button" onClick={() => setRackOpen(true)} aria-label="Open rack" className={`icon-btn focus-ring relative ${rackItems.length ? "on" : ""}`}>
                  <IconLayers width={14} height={14} />
                  {rackItems.length > 0 && <span className="num absolute -right-1 -top-1 bg-ink px-1 text-[9px] text-bg">{rackItems.length}</span>}
                </button>
                <button type="button" onClick={() => setQuickOpen(true)} className="btn btn-primary focus-ring !px-3 !py-1.5 !text-[11.5px]">
                  <IconPlus width={13} height={13} /> New
                </button>
              </>
            )}
          </div>
        </div>

        {filterMounted && filter !== "archived" && (
          <section className={`mt-6 border-y border-line py-4 panel-in ${filterLeaving ? "panel-out" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="label">Search</span>
                <button type="button" onClick={() => setMode(mode === "keyword" ? "semantic" : "keyword")} className="btn btn-secondary focus-ring !px-2 !py-1 !text-[10.5px]">
                  {mode}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="label">Density</span>
                {[2, 3, 4, 5].map((count) => (
                  <button key={count} type="button" onClick={() => setColumns(count)} className="num focus-ring h-6 w-6 border text-[10px]" style={{ background: columns === count ? "var(--ink)" : "transparent", color: columns === count ? "var(--bg)" : "var(--ink3)", borderColor: "var(--line)" }}>{count}</button>
                ))}
                <button type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="icon-btn focus-ring !h-6 !w-6">
                  {theme === "dark" ? <IconSun width={12} height={12} /> : <IconMoon width={12} height={12} />}
                </button>
              </div>
            </div>
            <div className="mt-3">
              <TagBar
                tags={tagCounts}
                colors={colors}
                active={activeTags}
                onToggle={(tag) => setActiveTags((prev) => {
                  const next = new Set(prev);
                  if (next.has(tag)) next.delete(tag); else next.add(tag);
                  return next;
                })}
                onReset={() => setActiveTags(new Set())}
              />
            </div>
          </section>
        )}

        {filter === "archived" ? (
          <div className="mt-8 max-w-3xl space-y-1">
            {archivedBlocks.length === 0 && <p className="border border-dashed border-line px-4 py-12 text-center text-[12px] text-ink3">Nothing archived.</p>}
            {archivedBlocks.map((block) => (
              <div key={block.id} className="flex items-center gap-3 border border-line bg-surface px-4 py-2.5">
                <span className="label">{BLOCK_TYPE_META[block.blockType].label}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink2">{block.title}</span>
                <button type="button" onClick={() => saveBlock(block.id, { isArchived: false })} className="btn btn-ghost focus-ring !px-2 !py-1 !text-[11px]"><IconRestore width={12} height={12} /> restore</button>
                <button type="button" onClick={() => purgeBlock(block)} className="icon-btn focus-ring"><IconTrash width={13} height={13} /></button>
              </div>
            ))}
          </div>
        ) : showEmpty ? (
          <div className="animate-rise mx-auto mt-28 max-w-sm text-center">
            <IconArchive width={18} height={18} className="mx-auto text-ink3" />
            <h2 className="mt-4 text-[15px] font-semibold">Canvas empty</h2>
            <p className="mt-1.5 text-[12px] leading-relaxed text-ink3">Paste anywhere to create a block, or start one manually.</p>
            <button type="button" onClick={() => setQuickOpen(true)} className="btn btn-primary focus-ring mt-5"><IconPlus width={13} height={13} /> New block</button>
          </div>
        ) : groupView === "flow" ? (
          <div className="mt-9">
            {collapsedSections.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-1.5">
                <span className="label mr-1">tucked away</span>
                {collapsedSections.map(({ basket, blocks: basketBlocks }) => {
                  const envelope = groupEnvelopes.get(basket.id);
                  return (
                    <button
                      key={basket.id}
                      type="button"
                      onClick={() => toggleBasketCollapsed(basket.id)}
                      className="focus-ring flex items-center gap-1.5 border px-2 py-1 text-[11px] transition-colors hover:border-linestrong"
                      style={{ borderColor: "var(--line)", color: "var(--ink-2)" }}
                      title="Expand group"
                    >
                      {envelope && <span className="h-[6px] w-[6px] shrink-0" style={{ background: envelope.dot }} />}
                      {basket.name}
                      <span className="num text-[10px] text-ink3">
                        {basketBlocks.filter((block) => visibleIds.has(block.id)).length}
                      </span>
                      <span className="text-[12px] leading-none">+</span>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="masonry relative" style={{ columnCount: columns, columnGap: "12px" }}>
              <GroupFields
                groups={basketSections.sections
                  .filter(({ basket }) => !collapsedBaskets.includes(basket.id))
                  .map(({ basket }) => {
                    const envelope = groupEnvelopes.get(basket.id)!;
                    return {
                      id: basket.id,
                      name: basket.name,
                      fill: envelope.wash,
                      outline: envelope.outline,
                      label: envelope.label,
                      dot: envelope.dot,
                    };
                  })}
              />
              {flowBlocks.map((block) => {
                const envelope = block.basketId ? groupEnvelopes.get(block.basketId) : undefined;
                return (
                  <PromptCard
                    key={block.id}
                    block={block}
                    visible={visibleIds.has(block.id)}
                    isNew={newIds.has(block.id)}
                    removing={removing.has(block.id)}
                    colors={colors}
                    reason={matches.get(block.id)?.reason}
                    handles={handles}
                    organizing={organizing}
                    selected={selectedIds.has(block.id)}
                    onSelect={toggleSelected}
                    group={
                      envelope && block.basketId
                        ? {
                            id: block.basketId,
                            name: envelope.name,
                            outline: envelope.outlineStrong,
                            label: envelope.label,
                            dot: envelope.dot,
                          }
                        : null
                    }
                  />
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mt-9 space-y-11">
            {basketSections.sections.map(({ basket, blocks: basketBlocks }) => {
              const collapsed = collapsedBaskets.includes(basket.id);
              const envelope = groupEnvelopes.get(basket.id) ?? groupEnvelope(groupColor(basket.name));
              const visibleCount = basketBlocks.filter((block) => visibleIds.has(block.id)).length;
              // Never render more columns than cards — that's what left half the box empty.
              const envelopeColumns = Math.max(1, Math.min(columns, Math.max(visibleCount, 1)));
              return (
                <section
                  key={basket.id}
                  className="animate-rise group"
                  style={{
                    border: `1px solid ${envelope.outline}`,
                    background: envelope.wash,
                    padding: collapsed ? "10px 14px" : "12px 14px 14px",
                    transition: "padding 0.3s var(--ease), border-color 0.2s var(--ease)",
                  }}
                >
                  <header className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleBasketCollapsed(basket.id)}
                      className="icon-btn focus-ring !h-5 !w-5 !border-0"
                      style={{ color: envelope.label }}
                      aria-label={collapsed ? "Expand group" : "Collapse group"}
                    >
                      <span className="text-[13px] leading-none">{collapsed ? "+" : "−"}</span>
                    </button>

                    <span className="h-[7px] w-[7px] shrink-0" style={{ background: envelope.dot }} />

                    {renamingBasketId === basket.id ? (
                      <input
                        autoFocus
                        value={renamingBasketName}
                        onChange={(event) => setRenamingBasketName(event.target.value)}
                        onBlur={() => renameBasket(basket.id, renamingBasketName)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") renameBasket(basket.id, renamingBasketName);
                          if (event.key === "Escape") setRenamingBasketId(null);
                        }}
                        className="field !w-52 !px-2 !py-1 !text-[12px]"
                      />
                    ) : (
                      <button
                        type="button"
                        onDoubleClick={() => {
                          setRenamingBasketId(basket.id);
                          setRenamingBasketName(basket.name);
                        }}
                        className="focus-ring truncate text-[12.5px] font-semibold tracking-[-0.01em]"
                        style={{ color: envelope.label }}
                        title="Double-click to rename"
                      >
                        {basket.name}
                      </button>
                    )}

                    <span className="num text-[10px] text-ink3">{visibleCount}</span>

                    <button
                      type="button"
                      onClick={() => deleteBasket(basket.id)}
                      className="btn btn-ghost focus-ring ml-auto !px-2 !py-0.5 !text-[10.5px] opacity-0 transition-opacity duration-200 hover:!text-ink focus-within:opacity-100 group-hover:opacity-100"
                    >
                      ungroup
                    </button>
                  </header>

                  {!collapsed && (
                    <div className="masonry mt-3" style={{ columnCount: envelopeColumns, columnGap: "12px" }}>
                      {basketBlocks.map((block) => (
                        <PromptCard
                          key={block.id}
                          block={block}
                          visible={visibleIds.has(block.id)}
                          isNew={newIds.has(block.id)}
                          removing={removing.has(block.id)}
                          colors={colors}
                          reason={matches.get(block.id)?.reason}
                          handles={handles}
                          organizing={organizing}
                          selected={selectedIds.has(block.id)}
                          onSelect={toggleSelected}
                        />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}

            {basketSections.loose.length > 0 && (
              <section>
                {basketSections.sections.length > 0 && (
                  <header className="mb-3 flex items-center border-b border-line pb-2">
                    <h2 className="text-[12.5px] font-semibold text-ink">Ungrouped</h2>
                    <span className="num ml-2 text-[10px] text-ink3">{basketSections.loose.filter((block) => visibleIds.has(block.id)).length}</span>
                  </header>
                )}
                <div className="masonry" style={{ columnCount: columns, columnGap: "12px" }}>
                  {basketSections.loose.map((block) => (
                    <PromptCard
                      key={block.id}
                      block={block}
                      visible={visibleIds.has(block.id)}
                      isNew={newIds.has(block.id)}
                      removing={removing.has(block.id)}
                      colors={colors}
                      reason={matches.get(block.id)?.reason}
                      handles={handles}
                      organizing={organizing}
                      selected={selectedIds.has(block.id)}
                      onSelect={toggleSelected}
                    />
                  ))}
                </div>
              </section>
            )}

            {query.trim() && visibleIds.size === 0 && (
              <div className="py-20 text-center text-[12.5px] text-ink3">No prompts match “{query.trim()}”.</div>
            )}
          </div>
        )}
      </main>

      {/* Search does not exist visually until invoked by typing or “/”. */}
      <div className="pointer-events-none fixed left-1/2 top-5 z-[100] w-[min(90vw,440px)] -translate-x-1/2">
        <BlurPanel mounted={searchMounted} leaving={searchLeaving} className="pointer-events-auto">
          <div className="flex items-center gap-3 px-3.5 py-2.5">
            {searching ? <Spinner size={14} /> : <IconSearch width={14} height={14} className="text-ink3" />}
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onBlur={() => {
                if (!query.trim()) setSearchAwake(false);
              }}
              autoFocus
              className="min-w-0 flex-1 bg-transparent text-[13.5px] text-ink outline-none"
              aria-label="Search prompts"
            />
            <span className="num text-[10px] text-ink3">{visibleIds.size}/{pool.length}</span>
            <button type="button" onClick={() => { setQuery(""); setSearchAwake(false); }} className="icon-btn focus-ring !h-6 !w-6"><IconClose width={12} height={12} /></button>
          </div>
        </BlurPanel>
      </div>

      <div className="pointer-events-none fixed bottom-5 left-1/2 z-[100] -translate-x-1/2">
        <BlurPanel mounted={organizeMounted} leaving={organizeLeaving} className="pointer-events-auto">
          <div className="flex items-center gap-2 p-2">
          <span className="num px-2 text-[11px] text-ink2">{selectedIds.size} selected</span>
          <button type="button" onClick={() => setSelectedIds(new Set([...visibleIds]))} className="btn btn-ghost focus-ring !px-2 !py-1 !text-[10.5px]">select visible</button>
          <span className="h-5 w-px bg-line" />
          <button type="button" disabled={!selectedIds.size} onClick={() => setBasketDialogOpen(true)} className="btn btn-primary focus-ring !px-2.5 !py-1.5 !text-[11px]"><IconPlus width={11} height={11} /> new group</button>
          <select
            disabled={!selectedIds.size}
            defaultValue=""
            onChange={(event) => {
              if (!event.target.value) return;
              void assignSelected(Number(event.target.value));
              event.target.value = "";
            }}
            className="field !w-auto !py-1.5 !text-[11px]"
          >
            <option value="">Move to…</option>
            {baskets.map((basket) => <option key={basket.id} value={basket.id}>{basket.name}</option>)}
          </select>
          <button type="button" disabled={!selectedIds.size} onClick={() => void assignSelected(null)} className="btn btn-ghost focus-ring !px-2 !py-1 !text-[10.5px]">ungroup</button>
          <button type="button" onClick={() => { setOrganizing(false); setSelectedIds(new Set()); }} className="btn btn-secondary focus-ring !px-2.5 !py-1.5 !text-[11px]">done</button>
          </div>
        </BlurPanel>
      </div>

      <Rack
        open={rackOpen}
        items={rackItems}
        onReorder={(from, to) => setRackItems((prev) => { const next = [...prev]; const [moved] = next.splice(from, 1); next.splice(to, 0, moved); return next; })}
        onRemove={(key) => setRackItems((prev) => prev.filter((item) => item.key !== key))}
        onUpdateStub={(key, text) => setRackItems((prev) => prev.map((item) => item.key === key && item.kind === "stub" ? { ...item, text } : item))}
        onAddStub={() => setRackItems((prev) => [...prev, { kind: "stub", key: `s${Date.now().toString(36)}`, text: "" }])}
        onWipe={() => setRackItems([])}
        onClose={() => setRackOpen(false)}
        onCreateNote={(content) => createBlock({ title: "Rack note", content, blockType: "instruction", stackId: typeof filter === "number" ? filter : null, autoTag, stackOrder: 99 })}
      />

      <QuickCreator
        open={quickOpen}
        stacks={stacks}
        defaultStackId={typeof filter === "number" ? filter : null}
        autoTag={autoTag}
        onClose={() => setQuickOpen(false)}
        onCreate={(payload) => { setQuickOpen(false); createBlock(payload); }}
      />

      <EditorOverlay
        open={editingBlock !== null}
        block={editingBlock}
        stacks={stacks}
        baskets={baskets}
        library={blocks}
        colors={colors}
        onClose={() => setEditingId(null)}
        onSave={(id, patch) => { saveBlock(id, patch); toast.success("Block saved."); }}
        onFork={forkBlock}
        onJump={(id) => setEditingId(id)}
        onDelete={(block) => { setEditingId(null); deleteBlock(block); }}
      />

      <SettingsOverlay
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        tags={tagCounts}
        colors={colors}
        theme={theme}
        autoTag={autoTag}
        columns={columns}
        onTheme={setTheme}
        onAutoTag={setAutoTag}
        onColumns={setColumns}
        onColor={saveTagColor}
        onResetColor={resetTagColor}
      />

      <StackSettingsOverlay
        open={stackSettingsStack !== null}
        stack={stackSettingsStack}
        onClose={() => setStackSettingsId(null)}
        onSave={saveStack}
        onDelete={deleteStack}
      />

      <Overlay open={basketDialogOpen} onClose={() => setBasketDialogOpen(false)} title="New group" subtitle={`${selectedIds.size} prompts selected`} width="max-w-sm">
        <label className="block">
          <span className="label mb-2 block">Group name</span>
          <input
            autoFocus
            value={basketName}
            onChange={(event) => setBasketName(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") void createBasketFromSelection(); }}
            placeholder="e.g. Shipping checklist"
            className="field"
          />
        </label>
        <div className="mt-5 flex justify-end gap-2 border-t border-line pt-4">
          <button type="button" onClick={() => setBasketDialogOpen(false)} className="btn btn-ghost">Cancel</button>
          <button type="button" disabled={!basketName.trim()} onClick={() => void createBasketFromSelection()} className="btn btn-primary">Create group</button>
        </div>
      </Overlay>

      {gateOpen && (
        <SessionGate
          current={session}
          onDone={(next) => {
            setSession(next);
            setGateOpen(false);
            location.reload();
          }}
        />
      )}
    </div>
  );
}
