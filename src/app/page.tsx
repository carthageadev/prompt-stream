import { Studio } from "@/components/Studio";
import { ToastProvider } from "@/components/ui";
import { listBaskets, listBlocks, listStacks, listTagColors } from "@/lib/data";
import { currentSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await currentSession();
  const [blocks, stacks, baskets, colors] = session
    ? await Promise.all([
        listBlocks(session.id, true),
        listStacks(session.id),
        listBaskets(session.id),
        listTagColors(session.id),
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
