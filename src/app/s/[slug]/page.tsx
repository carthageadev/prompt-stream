import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/CopyButton";
import { ToastProvider } from "@/components/ui";
import { IconBack, IconPublic } from "@/components/icons";
import { publicStackBySlug } from "@/lib/data";
import { BLOCK_TYPE_META } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await publicStackBySlug(slug).catch(() => null);
  return {
    title: data ? `${data.stack.name} — prompt stack` : "Stack not found",
    description: data?.stack.description || undefined,
  };
}

export default async function PublicStackPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await publicStackBySlug(slug);
  if (!data) notFound();

  const { stack, blocks } = data;
  const combined = blocks.map((block) => block.content).join("\n\n");

  return (
    <ToastProvider>
      <main data-stack-theme={stack.theme} className="min-h-screen">
        {stack.coverImageUrl && (
          <div className="relative h-56 w-full overflow-hidden border-b border-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={stack.coverImageUrl} alt="" className="h-full w-full object-cover" />
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(180deg, transparent 40%, var(--bg))" }}
            />
          </div>
        )}

        <article className="mx-auto max-w-2xl px-6 py-14">
          <div className="flex items-center gap-2">
            <IconPublic width={13} height={13} style={{ color: "var(--accent)" }} />
            <p className="label">public stack · /s/{stack.slug}</p>
          </div>

          <h1 className="mt-3 text-[34px] font-semibold leading-[1.1] tracking-[-0.035em] text-ink">
            {stack.name}
          </h1>
          {stack.description && (
            <p className="mt-3 max-w-xl text-[14px] leading-[1.7] text-ink2">{stack.description}</p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-2 border-y border-line py-3">
            <span className="num text-[11px] text-ink3">
              {String(blocks.length).padStart(2, "0")} blocks
            </span>
            <span className="h-3 w-px bg-line" />
            <CopyButton text={combined} label="Copy entire stack" />
            <Link href="/" className="btn btn-ghost focus-ring ml-auto !px-2 !py-1 !text-[11.5px]">
              <IconBack width={12} height={12} />
              made in prompt studio
            </Link>
          </div>

          <div className="mt-10 space-y-9">
            {blocks.map((block) => (
              <section key={block.id}>
                <header className="flex items-baseline justify-between gap-4">
                  <div className="flex min-w-0 items-baseline gap-2.5">
                    <span className="num shrink-0 text-[11px] text-ink3">
                      {String(block.stackOrder).padStart(2, "0")}
                    </span>
                    <h2 className="truncate text-[16px] font-semibold tracking-[-0.02em] text-ink">
                      {block.title}
                    </h2>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="label" style={{ color: `hsl(${BLOCK_TYPE_META[block.blockType].hue}, 42%, var(--type-fg))` }}>
                      {BLOCK_TYPE_META[block.blockType].label}
                    </span>
                    <CopyButton text={block.content} label="Copy" />
                  </div>
                </header>
                <pre className="mt-2.5 whitespace-pre-wrap border-l border-line pl-4 font-sans text-[13.5px] leading-[1.75] text-ink2">
                  {block.content}
                </pre>
                {block.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5 pl-4">
                    {block.tags.map((tag) => (
                      <span key={tag} className="border border-line px-2 py-[2px] text-[10.5px] text-ink3">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        </article>
      </main>
    </ToastProvider>
  );
}
