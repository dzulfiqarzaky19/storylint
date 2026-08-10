// Server component: load the wiki snapshot + the seeded Chapter 7 manuscript,
// run the consistency-check engine (HANDOFF §7 "one engine, two screens") to
// DERIVE the poster-band suggestions and the entries carrying an unresolved
// contradiction, and hand everything to the interactive client screen.
//
// F7 S5: the ACTIVE universe/series/book come from the URL (?u=&se=&b=), so a
// scope is shareable and the server re-renders loadWikiSnapshot for it. Absent
// params the scope defaults to U1/Se1/B1 (Ashkeld), so the page reads identically
// to before F7. The world tree feeds the top-bar switcher.
import { loadWikiSnapshot, getChapter, getDismissedSuggestionKeys, getResolvedMarkKeys, getWorldTree } from "@/lib/db/queries";
import { DEFAULT_UNIVERSE_ID, DEFAULT_SERIES_ID, DEFAULT_BOOK_ID } from "@/lib/db/scope";
import { checkWiki, paragraphsFromBody } from "@/lib/domain/wikiCheck";
import WikiScreen from "@/components/wiki/WikiScreen";
import WorldSwitcher from "@/components/wiki/WorldSwitcher";

export const dynamic = "force-dynamic";

export default async function WikiPage({
  searchParams,
}: {
  searchParams: Promise<{ u?: string; se?: string; b?: string }>;
}) {
  const sp = await searchParams;
  const tree = await getWorldTree();

  // Resolve the active scope from the URL, validated against the tree so a stale
  // or unknown id falls back to the default world (never a broken empty page).
  const universe = tree.find((x) => x.id === sp.u) ?? tree.find((x) => x.id === DEFAULT_UNIVERSE_ID) ?? tree[0];
  const series =
    universe?.series.find((x) => x.id === sp.se) ??
    universe?.series.find((x) => x.id === DEFAULT_SERIES_ID) ??
    universe?.series[0];
  const book =
    series?.books.find((x) => x.id === sp.b) ??
    series?.books.find((x) => x.id === DEFAULT_BOOK_ID) ??
    series?.books[0];

  const activeUniverseId = universe?.id ?? DEFAULT_UNIVERSE_ID;
  const activeSeriesId = series?.id ?? DEFAULT_SERIES_ID;
  const activeBookId = book?.id ?? DEFAULT_BOOK_ID;

  const [snapshot, chapter, dismissedSuggestionKeys, resolvedMarkKeys] =
    await Promise.all([
      loadWikiSnapshot(activeUniverseId, activeBookId),
      getChapter(7),
      getDismissedSuggestionKeys(),
      getResolvedMarkKeys(),
    ]);

  const paragraphs = chapter ? paragraphsFromBody(chapter.body) : [];
  const { suggestions, contradictionEntryIds } = checkWiki({
    snapshot,
    paragraphs,
    dismissedSuggestionKeys,
    resolvedMarkKeys,
  });

  return (
    <>
      <WorldSwitcher
        tree={tree}
        activeUniverseId={activeUniverseId}
        activeSeriesId={activeSeriesId}
        activeBookId={activeBookId}
      />
      <WikiScreen
        snapshot={snapshot}
        suggestions={suggestions}
        contradictionEntryIds={contradictionEntryIds}
      />
    </>
  );
}
