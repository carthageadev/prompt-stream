import { Studio } from "@/components/Studio";
import { ToastProvider } from "@/components/ui";
import { listBaskets, listBlocks, listStacks, listTagColors } from "@/lib/data";
import { currentSession, resolveSessions } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const resolved = await resolveSessions();
  const session = await currentSession();
  const visible = "active" in resolved ? resolved.visible : [];
  const [blocks, stacks, baskets, colors] = session
    ? await Promise.all([
        listBlocks(visible, true),
        listStacks(visible),
        listBaskets(visible),
        listTagColors(visible),
      ])
    : [[], [], [], []];

  return (
    <ToastProvider>
      <Studio
        initialBlocks={blocks}
        initialStacks={stacks}
        initialBaskets={baskets}
        initialColors={colors}
        initialSession={session}
      />
    </ToastProvider>
  );
}
