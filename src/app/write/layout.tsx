import type { ReactNode } from "react";
import SurfaceLayout from "@/app/SurfaceLayout";

export const dynamic = "force-dynamic";

export default function WriteLayout({ children }: { children: ReactNode }) {
  return <SurfaceLayout surface="write">{children}</SurfaceLayout>;
}
