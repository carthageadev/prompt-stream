"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { IconCheck, IconClose } from "./icons";

/* --------------------- animated blur panel mount ------------------------- */

/**
 * Keeps a panel mounted through its exit animation so it can blur *out*
 * instead of vanishing. Returns mount + leave flags for the transition.
 */
export function useBlurPanel(open: boolean, duration = 200) {
  const [mounted, setMounted] = useState(open);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setLeaving(false);
      return;
    }
    if (!mounted) return;
    setLeaving(true);
    const timer = setTimeout(() => {
      setMounted(false);
      setLeaving(false);
    }, duration);
    return () => clearTimeout(timer);
  }, [open, mounted, duration]);

  return { mounted, leaving };
}

/** Floating frosted panel that blurs into place and blurs away. */
export function BlurPanel({
  mounted,
  leaving,
  children,
  className = "",
}: {
  mounted: boolean;
  leaving: boolean;
  children: ReactNode;
  className?: string;
}) {
  if (!mounted) return null;
  return (
    <div className={`frost panel-in ${leaving ? "panel-out" : ""} ${className}`}>{children}</div>
  );
}

/* ------------------------------- toasts ---------------------------------- */

export type ToastAction = { label: string; run: () => void };
type Toast = {
  id: number;
  kind: "info" | "error" | "success";
  message: string;
  action?: ToastAction;
};

type ToastApi = {
  push: (message: string, opts?: { kind?: Toast["kind"]; action?: ToastAction }) => void;
  error: (message: string) => void;
  success: (message: string) => void;
};

const ToastCtx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback<ToastApi["push"]>(
    (message, opts) => {
      const id = idRef.current++;
      const toast: Toast = { id, kind: opts?.kind ?? "info", message, action: opts?.action };
      setToasts((list) => [...list.slice(-2), toast]);
      // Toasts carrying an action live 6s so the undo stays usable.
      const ttl = toast.action ? 6000 : 3000;
      setTimeout(() => dismiss(id), ttl);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      push,
      error: (message: string) => push(message, { kind: "error" }),
      success: (message: string) => push(message, { kind: "success" }),
    }),
    [push],
  );

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-6 left-1/2 z-[130] flex w-[min(92vw,400px)] -translate-x-1/2 flex-col gap-1.5">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className="animate-toast-in pointer-events-auto flex items-center gap-3 border border-line bg-elev px-3.5 py-2.5 text-[12.5px] shadow-[var(--shadow-2)]"
            style={{
              borderColor:
                toast.kind === "error" ? "var(--line-strong)" : toast.kind === "success" ? "var(--line-strong)" : "var(--line)",
            }}
          >
            {toast.kind === "success" && <IconCheck width={13} height={13} />}
            <span className="flex-1 leading-snug text-ink">{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action?.run();
                  dismiss(toast.id);
                }}
                className="btn btn-accent focus-ring !px-2.5 !py-1 !text-[11.5px]"
              >
                {toast.action.label}
              </button>
            )}
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismiss(toast.id)}
              className="focus-ring -mr-1 grid h-5 w-5 place-items-center text-ink3 hover:text-ink"
            >
              <IconClose width={12} height={12} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (ctx) return ctx;
  return { push: () => {}, error: () => {}, success: () => {} };
}

/* ------------------------------ overlays --------------------------------- */

export function Overlay({
  open,
  onClose,
  children,
  title,
  subtitle,
  width = "max-w-3xl",
  footer,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  subtitle?: string;
  width?: string;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  // Stays mounted through the exit so the panel fades out (faster than it entered).
  const { mounted, leaving } = useBlurPanel(open, 150);
  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close overlay"
        onClick={onClose}
        className={`${leaving ? "animate-fade-out" : "animate-fade-in"} fixed inset-0 cursor-default`}
        style={{ background: "color-mix(in oklab, var(--bg) 58%, transparent)", backdropFilter: "blur(2px)" }}
      />
      <div
        className={`${leaving ? "animate-overlay-out" : "animate-overlay-in"} relative z-10 my-auto w-full ${width} overflow-hidden border border-line bg-elev shadow-[var(--shadow-3)]`}
      >
        {(title || subtitle) && (
          <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
            <div className="min-w-0">
              {title && <h2 className="truncate text-[15px] font-semibold text-ink">{title}</h2>}
              {subtitle && <p className="label mt-1">{subtitle}</p>}
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="icon-btn focus-ring -mr-1 -mt-1">
              <IconClose width={15} height={15} />
            </button>
          </header>
        )}
        <div className="max-h-[72vh] overflow-y-auto scroll-thin px-6 py-5">{children}</div>
        {footer && <footer className="border-t border-line px-6 py-4">{footer}</footer>}
      </div>
    </div>
  );
}

/* ------------------------------ utilities -------------------------------- */

export function useLocalState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* quota */
    }
  }, [key, value, hydrated]);

  return [value, setValue, hydrated] as const;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      document.body.removeChild(area);
      return true;
    } catch {
      return false;
    }
  }
}

/** Tag pill: hue-filled, square, colour is the signal. */
export function Chip({
  label,
  dot,
  onClick,
  active,
  title,
  style,
}: {
  label: string;
  dot?: string;
  onClick?: () => void;
  active?: boolean;
  title?: string;
  style?: CSSProperties;
}) {
  const interactive = Boolean(onClick);
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={!interactive}
      style={
        style ??
        (active
          ? { borderColor: "var(--line-strong)", color: "var(--ink)", background: "var(--surface-2)" }
          : { borderColor: "var(--line)", color: "var(--ink-2)", background: "transparent" })
      }
      className={`focus-ring inline-flex shrink-0 items-center gap-1.5 border px-2 py-[3px] text-[11px] font-medium leading-none transition-all duration-150 ${
        interactive ? "cursor-pointer hover:border-linestrong" : "cursor-default"
      }`}
    >
      {dot && <span className="h-[6px] w-[6px] shrink-0" style={{ background: dot }} />}
      {label}
    </button>
  );
}

export function Spinner({ size = 13 }: { size?: number }) {
  return (
    <span
      className="animate-spin-slow inline-block border-[1.5px] border-current border-t-transparent"
      style={{ width: size, height: size }}
    />
  );
}

export function Bar({ value, label, note }: { value: number; label: string; note?: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[12px] text-ink-2">{label}</span>
        <span className="num text-[11px] text-ink3">{value}</span>
      </div>
      <div className="mt-1.5 h-[3px] w-full overflow-hidden bg-surface2">
        <div
          className="h-full transition-[width] duration-700 ease-out"
          style={{ width: `${Math.max(2, value)}%`, background: "var(--accent)" }}
        />
      </div>
      {note && <p className="mt-1.5 text-[11px] leading-snug text-ink3">{note}</p>}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = "md",
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex border border-line bg-surface2 p-[2px]">
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`focus-ring font-medium transition-all duration-150 ${
              size === "sm" ? "px-2 py-[3px] text-[10.5px]" : "px-2.5 py-1 text-[11.5px]"
            }`}
            style={{
              background: on ? "var(--surface)" : "transparent",
              color: on ? "var(--ink)" : "var(--ink-3)",
              boxShadow: on ? "var(--shadow-1)" : undefined,
              border: on ? "1px solid var(--line)" : "1px solid transparent",
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function FieldLabel({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <span className="mb-1.5 flex items-baseline justify-between gap-2">
      <span className="label">{children}</span>
      {hint && <span className="text-[10.5px] text-ink3">{hint}</span>}
    </span>
  );
}
