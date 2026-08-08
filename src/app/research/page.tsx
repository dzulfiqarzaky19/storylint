// Server component: load a research thread and hand it to the client screen.
// The thread is selected by the URL (?thread=<id>), defaulting to the first by
// sort_order. No mutations here — writes happen via the server actions the
// client invokes (research.ts). Product rule 1: the only wiki write is confirmCard.
import { loadResearchSnapshot } from "@/lib/db/research";
import ResearchScreen from "@/components/research/ResearchScreen";

export const dynamic = "force-dynamic";

export default async function ResearchPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string }>;
}) {
  const { thread } = await searchParams;
  const snapshot = await loadResearchSnapshot(thread);
  // Key by thread id so switching threads remounts the reducer with fresh state.
  return <ResearchScreen key={snapshot.threadId} snapshot={snapshot} />;
}
