import type { ReactNode } from "react";
import SurfaceLayout from "@/app/SurfaceLayout";

export const dynamic = "force-dynamic";

export default function WikiLayout({ children }: { children: ReactNode }) {
  return <SurfaceLayout surface="wiki">{children}</SurfaceLayout>;
}
