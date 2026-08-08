// Server component: load the wiki snapshot from the Phase 1 query layer and
// hand it to the read-only client screen. No mutations here (Phase 3 is read-only).
import { loadWikiSnapshot } from "@/lib/db/queries";
import WikiScreen from "@/components/wiki/WikiScreen";

export const dynamic = "force-dynamic";

export default async function WikiPage() {
  const snapshot = await loadWikiSnapshot();
  return <WikiScreen snapshot={snapshot} />;
}
