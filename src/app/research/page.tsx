// Server component: load the seeded research thread and hand it to the client
// screen. No mutations here — writes happen via the server actions the client
// invokes (research.ts). Product rule 1: the only wiki write is confirmCard.
import { loadResearchSnapshot } from "@/lib/db/research";
import ResearchScreen from "@/components/research/ResearchScreen";

export const dynamic = "force-dynamic";

export default async function ResearchPage() {
  const snapshot = await loadResearchSnapshot();
  return <ResearchScreen snapshot={snapshot} />;
}
