import { Suspense } from "react";
import { Catalog } from "@/components/catalog-browser";
export default function Page() {
  return (
    <Suspense fallback={<p className="loading">正在打开片库…</p>}>
      <Catalog />
    </Suspense>
  );
}
