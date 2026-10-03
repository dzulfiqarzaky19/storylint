import type { ReactNode } from "react";
import SurfaceLayout from "@/app/SurfaceLayout";

export const dynamic = "force-dynamic";

export default function ResearchLayout({ children }: { children: ReactNode }) {
  return <SurfaceLayout surface="research">{children}</SurfaceLayout>;
}
