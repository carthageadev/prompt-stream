import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Composer } from "@/components/Composer";
import { ToastProvider } from "@/components/ui";
import { getComposition, listBlocks } from "@/lib/data";
import { resolveSessions } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ComposePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const compositionId = Number(id);
  if (!Number.isFinite(compositionId)) notFound();

  const resolved = await resolveSessions();
  if (!("active" in resolved)) redirect("/");
  const [composition, blocks] = await Promise.all([getComposition(resolved.visible, compositionId), listBlocks(resolved.visible)]);
  if (!composition) notFound();

  return (
    <ToastProvider>
      <main className="min-h-screen">
        <header className="border-b border-line bg-bg/70 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-5 py-3">
            <Link href="/compose" className="text-[11px] uppercase tracking-[0.14em] text-ink3 hover:text-accent">
              ← compositions
            </Link>
            <span className="text-ink3">/</span>
            <h1 className="truncate text-[14px] font-semibold tracking-tight">{composition.title}</h1>
          </div>
        </header>
        <Composer composition={composition} library={blocks} readOnly={composition.sessionId !== resolved.active} />
      </main>
    </ToastProvider>
  );
}
