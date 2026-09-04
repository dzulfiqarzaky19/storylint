// Server component: load a research thread and hand it to the client screen.
// The thread is selected by the URL (?thread=<id>), defaulting to the first by
// sort_order. No mutations here — writes happen via the server actions the
// client invokes (research.ts). Product rule 1: the only wiki write is confirmCard.
import { loadResearchSnapshot } from "@/lib/db/research";
import { getWorldEntries, getCategories } from "@/lib/db/gazetteer";
import { getWorldTree } from "@/lib/db/queries";
import { getWorldKeptCards } from "@/lib/db/research-queries";
import { resolveActiveScope } from "@/lib/scope/activeScope";
import ResearchScreen from "@/components/research/ResearchScreen";

export const dynamic = "force-dynamic";

export default async function ResearchPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string; u?: string; w?: string; focus?: string }>;
}) {
  const { thread, u, w, focus } = await searchParams;
  // T-RESEARCH-2: resolve the ACTIVE world from ?u=/?w= (same resolver /wiki
  // uses) and scope the thread list + selected thread to it, so switching worlds
  // in the header shows THAT world's threads.
  const tree = await getWorldTree();
  const scope = resolveActiveScope(tree, { u, w });
  // The thread head names the world the thread belongs to, so the writer can
  // tell at a glance which world's canon the collaborator is reading from.
  const activeWorldName = tree
    .find((x) => x.id === scope.universeId)
    ?.worlds.find((x) => x.id === scope.worldId)?.title;
  const snapshot = await loadResearchSnapshot(thread, scope.worldId);
  // T-RES-E2E-KEPT: the Kept board is WORLD-WIDE, so it seeds from every kept
  // card in the active world (with its source thread for attribution + click-
  // through), not just the open thread's cards.
  const worldKept = await getWorldKeptCards(scope.worldId);
  // Live wiki entries scoped to the ACTIVE world (getWorldEntries joins
  // world_entities, same membership /wiki shows, soft-delete-filtered) so the
  // wiki-target picker recommends/lists only THIS world's entries, never a
  // sibling world's. Mapped to the minimal shape the recommender + picker need.
  const entries = (await getWorldEntries(scope.worldId)).map((e) => ({
    id: e.id,
    name: e.name,
    kind: e.kind,
    deletedAt: e.deletedAt,
  }));
  // Live categories for the wiki-target picker pills (F9-B): the 4 built-ins
  // plus any user-created ones, mapped to the minimal {id,label} the modal needs.
  const categories = (await getCategories()).map((c) => ({
    id: c.id,
    label: c.label,
  }));
  // Key by thread id so switching threads remounts the reducer with fresh state.
  // The active world (resolved above) is threaded into the confirmed picker write so a
  // research-minted entry is linked into the ACTIVE world (else invisible on
  // /wiki) AND into the composer so a first-message auto-create (T-RESEARCH-1)
  // lands the default thread in the world the writer is viewing.
  return (
    <ResearchScreen
      key={snapshot.threadId}
      snapshot={snapshot}
      entries={entries}
      categories={categories}
      activeWorldId={scope.worldId}
      activeWorldName={activeWorldName}
      worldKept={worldKept}
      focusPropositionId={focus}
    />
  );
}
