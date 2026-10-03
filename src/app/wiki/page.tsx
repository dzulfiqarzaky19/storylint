import { loadWorldSnapshot } from "@/server/db/gazetteer/snapshots";
import { getChaptersForBook, getDismissedSuggestionKeys, getResolvedMarkKeys } from "@/server/db/chapters/queries";
import { getWorldTree } from "@/server/db/structure/queries";
import { checkWikiBook } from "@/domain/wikiCheck";
import Wiki from "@/features/wiki/Wiki";
import { resolveActiveScope } from "@/domain/scope/activeScope";

export const dynamic = "force-dynamic";

export default async function WikiPage({
  searchParams,
}: {
  searchParams: Promise<{ u?: string; w?: string }>;
}) {
  const sp = await searchParams;
  const tree = await getWorldTree();

  const scope = resolveActiveScope(tree, sp);

  const [snapshot, chapters, dismissedSuggestionKeys, resolvedMarkKeys] =
    await Promise.all([
      loadWorldSnapshot(scope.worldId),
      getChaptersForBook(scope.bookId),
      getDismissedSuggestionKeys(scope.worldId),
      getResolvedMarkKeys(scope.bookId),
    ]);

  const { suggestions, contradictionEntryIds } = checkWikiBook({
    snapshot,
    chapters: chapters.map((c) => ({ number: c.number, body: c.body })),
    dismissedSuggestionKeys,
    resolvedMarkKeys,
  });

  const worlds = tree.flatMap((u) => u.worlds.map((w) => ({ id: w.id, title: w.title })));

  return (
    <Wiki
        key={scope.worldId}
        snapshot={snapshot}
        suggestions={suggestions}
        contradictionEntryIds={contradictionEntryIds}
        worlds={worlds}
        activeWorldId={scope.worldId}
      />
  );
}
