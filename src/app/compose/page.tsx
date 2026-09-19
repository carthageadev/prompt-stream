import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { compositions } from "@/db/schema";
import { listCompositions } from "@/lib/data";
import { currentSessionId } from "@/lib/session";
import { IconBack, IconLayers, IconPlus } from "@/components/icons";

export const dynamic = "force-dynamic";

async function createComposition() {
  "use server";
  const sessionId = await currentSessionId();
  if (!sessionId) redirect("/");
  const inserted = await db
    .insert(compositions)
    .values({ title: "Untitled composition", description: "", sessionId })
    .returning();
  redirect(`/compose/${inserted[0].id}`);
}

export default async function ComposeIndexPage() {
  const sessionId = await currentSessionId();
  if (!sessionId) redirect("/");
  const list = await listCompositions(sessionId);

  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <Link href="/" className="btn btn-ghost focus-ring !px-2 !py-1 !text-[11.5px]">
        <IconBack width={13} height={13} />
        studio
      </Link>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <IconLayers width={15} height={15} style={{ color: "var(--accent)" }} />
            <p className="label">composition studio</p>
          </div>
          <h1 className="mt-2 text-[26px] font-semibold leading-tight tracking-[-0.03em] text-ink">
            Chain blocks into one prompt
          </h1>
          <p className="mt-2 max-w-md text-[13px] leading-relaxed text-ink2">
            Give each block a section role, order the argument, then export for any model.
          </p>
        </div>
        <form action={createComposition}>
          <button type="submit" className="btn btn-primary focus-ring !py-2.5">
            <IconPlus width={14} height={14} />
            New composition
          </button>
        </form>
      </div>

      <div className="mt-10 space-y-2">
        {list.length === 0 && (
          <p className="border border-dashed border-line px-4 py-10 text-center text-[12.5px] text-ink3">
            No compositions yet.
          </p>
        )}
        {list.map((composition) => (
          <Link
            key={composition.id}
            href={`/compose/${composition.id}`}
            className="surface group flex items-center gap-4 px-5 py-4 transition-all duration-200 [transition-timing-function:var(--ease)] hover:border-linestrong"
          >
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[14px] font-semibold text-ink">{composition.title}</h2>
              <p className="mt-1 truncate text-[12px] text-ink3">
                {composition.description || composition.items.map((item) => item.label).filter(Boolean).join(" · ")}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="num text-[15px] font-semibold text-ink">{composition.items.length}</p>
              <p className="label">items</p>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
