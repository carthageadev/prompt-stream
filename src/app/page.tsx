import { Studio } from "@/components/Studio";
import { ToastProvider } from "@/components/ui";
import { ensureSeed, listBaskets, listBlocks, listStacks, listTagColors } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await ensureSeed();
  const [blocks, stacks, baskets, colors] = await Promise.all([
    listBlocks(true),
    listStacks(),
    listBaskets(),
    listTagColors(),
  ]);

  return (
    <ToastProvider>
      <Studio
        initialBlocks={blocks}
        initialStacks={stacks}
        initialBaskets={baskets}
        initialColors={colors}
      />
    </ToastProvider>
  );
}
