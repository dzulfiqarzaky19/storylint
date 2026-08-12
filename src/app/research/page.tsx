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
  searchParams: Promise<{ thread?: string }>;
}) {
  const { thread } = await searchParams;
  const snapshot = await loadResearchSnapshot(thread);
  // Live wiki entries (getAllEntries is soft-delete-filtered, F6-S2) so the
  // confirmation strip can recommend enriching an existing entry instead of
  // spawning a duplicate. Mapped to the minimal shape the recommender needs.
  const entries = (await getAllEntries()).map((e) => ({
    id: e.id,
    name: e.name,
    kind: e.kind,
    deletedAt: e.deletedAt,
  }));
  // TCK-E06: resolve the active world so a research-minted entry is linked into it
  // (else it persists but is invisible on /wiki). The research URL carries no
  // ?u=/?w=, so resolveWikiScope(tree, undefined, undefined) yields the default
  // universe's first world (world-universe-1 today) — provably correct while every
  // thread is universe-1 (see the invariant test that REDs the moment that changes).
  const { activeWorldId } = resolveWikiScope(await getWorldTree(), undefined, undefined);
  // Key by thread id so switching threads remounts the reducer with fresh state.
  return (
    <ResearchScreen
      key={snapshot.threadId}
      snapshot={snapshot}
      entries={entries}
      activeWorldId={activeWorldId}
    />
  );
}
