// Server component: the /wiki/manage screen (design 3c). Loads the full
// universe -> world tree and hands it to the interactive client manager, which
// wires the existing structural create/delete actions plus the new rename
// actions. The active scope isn't needed here (manage operates on the whole
// tree), so this is a plain tree load with no scope resolution.
import { getWorldTree } from "@/lib/db/queries";
import WikiManage from "@/components/wiki/WikiManage";

export const dynamic = "force-dynamic";

export default async function WikiManagePage() {
  const tree = await getWorldTree();
  return <WikiManage tree={tree} />;
}
