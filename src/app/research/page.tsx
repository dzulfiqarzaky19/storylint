// Server component: load a research thread and hand it to the client screen.
// The thread is selected by the URL (?thread=<id>), defaulting to the first by
// sort_order. No mutations here — writes happen via the server actions the
// client invokes (research.ts). Product rule 1: the only wiki write is confirmCard.
import { loadResearchSnapshot } from "@/lib/db/research";
import { getAllEntries, getWorldTree } from "@/lib/db/queries";
import { resolveWikiScope } from "@/app/wiki/scope";
import ResearchScreen from "@/components/research/ResearchScreen";

export const dynamic = "force-dynamic";

export default async function ResearchPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string; u?: string; w?: string }>;
}) {
  const { thread, u, w } = await searchParams;
  // T-RESEARCH-2: resolve the ACTIVE world from ?u=/?w= (same resolver /wiki
  // uses) and scope the thread list + selected thread to it, so switching worlds
  // in the header shows THAT world's threads.
  const { activeWorldId } = resolveWikiScope(await getWorldTree(), u, w);
  const snapshot = await loadResearchSnapshot(thread, activeWorldId);
  // Live wiki entries (getAllEntries is soft-delete-filtered, F6-S2) so the
  // confirmation strip can recommend enriching an existing entry instead of
  // spawning a duplicate. Mapped to the minimal shape the recommender needs.
  const entries = (await getAllEntries()).map((e) => ({
    id: e.id,
    name: e.name,
    kind: e.kind,
    deletedAt: e.deletedAt,
  }));
  // Key by thread id so switching threads remounts the reducer with fresh state.
  // activeWorldId (resolved above) is threaded into confirmCard so a
  // research-minted entry is linked into the ACTIVE world (else invisible on
  // /wiki) AND into the composer so a first-message auto-create (T-RESEARCH-1)
  // lands the default thread in the world the writer is viewing.
  return (
    <ResearchScreen
      key={snapshot.threadId}
      snapshot={snapshot}
      entries={entries}
      activeWorldId={activeWorldId}
    />
  );
}
