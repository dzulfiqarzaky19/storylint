// Server component: load the wiki snapshot + the seeded Chapter 7 manuscript,
// run the consistency-check engine to DERIVE the Suggestions and the entries carrying an unresolved
// contradiction, and hand everything to the interactive client screen.
//
// TCK-017 (W-5 UI cut-over): the wiki header now presents exactly Universe +
// World. Series and Book are no longer surfaced here — book handling lives on
// /write. The ACTIVE universe still comes from the URL (?u=); the active WORLD is
// derived 1:1 from it (`world-${universeId}`). Scope resolution is the PURE
// resolveActiveScope (see lib/scope/activeScope.ts) so its ladder lives in one place.
import { loadWorldSnapshot } from "@/lib/db/gazetteer";
import { getChaptersForBook, getDismissedSuggestionKeys, getResolvedMarkKeys } from "@/lib/db/chapter-queries";
import { getWorldTree } from "@/lib/db/queries";
import { checkWikiBook } from "@/lib/domain/wikiCheck";
import Wiki from "@/features/wiki/Wiki";
import { resolveActiveScope } from "@/lib/scope/activeScope";

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
      loadWorldSnapshot(scope.worldId, scope.bookId),
      // Suggestions derives from the ACTIVE book's chapters (every chapter), so a
      // not-recorded detail the writer mentioned in ANY chapter surfaces here.
      // Replaces the DUMMY single-chapter-7-of-default-book read.
      getChaptersForBook(scope.bookId),
      getDismissedSuggestionKeys(),
      getResolvedMarkKeys(),
    ]);

  const { suggestions, contradictionEntryIds } = checkWikiBook({
    snapshot,
    chapters: chapters.map((c) => ({ number: c.number, body: c.body })),
    dismissedSuggestionKeys,
    resolvedMarkKeys,
  });

  // TCK-023 (W-4b): the flat world list (every world across universes) is the
  // share-target pool for the entry's ShareControls. The active world is the
  // unlink target. Both are derived from the same tree already loaded above.
  const worlds = tree.flatMap((u) => u.worlds.map((w) => ({ id: w.id, title: w.title })));

  return (
    <Wiki
        // TCK-E02: key on the active world so switching worlds REMOUNTS the
        // screen. Wiki seeds its reducer from `snapshot` in a once-only
        // initializer (no prop-sync effect), so without a changing key a
        // client-side world switch keeps the previous world's entries on screen
        // even though the server sent the new (empty) snapshot — the visible
        // "snap-back". Remounting on world id re-runs the initializer with the
        // new snapshot.
        key={scope.worldId}
        snapshot={snapshot}
        suggestions={suggestions}
        contradictionEntryIds={contradictionEntryIds}
        worlds={worlds}
        activeWorldId={scope.worldId}
      />
  );
}
