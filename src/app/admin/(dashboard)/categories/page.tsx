import { Suspense } from "react";
import { CategoriesManager } from "./categories-manager";

// CategoriesManager reads useSearchParams(); Next requires a Suspense boundary
// around it, otherwise the production build fails while prerendering.
export default function AdminCategoriesPage() {
  return (
    <Suspense>
      <CategoriesManager />
    </Suspense>
  );
}
