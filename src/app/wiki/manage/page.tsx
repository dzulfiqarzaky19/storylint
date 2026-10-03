import { getWorldTree } from "@/server/db/structure/queries";
import WikiManage from "@/features/wiki/manage/WikiManage";

export const dynamic = "force-dynamic";

export default async function WikiManagePage() {
  const tree = await getWorldTree();
  return <WikiManage tree={tree} />;
}
