// Server component: load the wiki snapshot + the seeded Chapter 7 manuscript,
// run the consistency-check engine (HANDOFF §7 "one engine, two screens") to
// DERIVE the poster-band suggestions and the entries carrying an unresolved
// contradiction, and hand everything to the interactive client screen.
import { loadWikiSnapshot, getChapter, getDismissedSuggestionKeys, getResolvedMarkKeys } from "@/lib/db/queries";
import { checkWiki, paragraphsFromBody } from "@/lib/domain/wikiCheck";
import WikiScreen from "@/components/wiki/WikiScreen";

export const dynamic = "force-dynamic";

export default async function WikiPage() {
  const [snapshot, chapter, dismissedSuggestionKeys, resolvedMarkKeys] =
    await Promise.all([
      loadWikiSnapshot(),
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
    <WikiScreen
      snapshot={snapshot}
      suggestions={suggestions}
      contradictionEntryIds={contradictionEntryIds}
    />
  );
}
