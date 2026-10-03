import { loadResearchSnapshot } from "@/server/db/research";
import { getWorldEntries, getCategories } from "@/server/db/gazetteer/reads";
import { getWorldTree } from "@/server/db/structure/queries";
import { getWorldKeptCards } from "@/server/db/research/queries";
import { resolveActiveScope } from "@/domain/scope/activeScope";
import Research from "@/features/research/Research";

export const dynamic = "force-dynamic";

export default async function ResearchPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string; u?: string; w?: string; focus?: string }>;
}) {
  const { thread, u, w, focus } = await searchParams;
  const tree = await getWorldTree();
  const scope = resolveActiveScope(tree, { u, w });
  const activeWorldName = tree
    .find((x) => x.id === scope.universeId)
    ?.worlds.find((x) => x.id === scope.worldId)?.title;
  const snapshot = await loadResearchSnapshot(thread, scope.worldId);
  const worldKept = await getWorldKeptCards(scope.worldId);
  const entries = (await getWorldEntries(scope.worldId)).map((e) => ({
    id: e.id,
    name: e.name,
    kind: e.kind,
    deletedAt: e.deletedAt,
  }));
  const categories = (await getCategories()).map((c) => ({
    id: c.id,
    label: c.label,
  }));
  return (
    <Research
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
