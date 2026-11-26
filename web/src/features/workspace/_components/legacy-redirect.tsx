"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function Redirect({ view }: { view: string }) {
  const router = useRouter();
  const params = useSearchParams();
  useEffect(() => {
    const next = new URLSearchParams(params.toString());
    next.set("view", view);
    router.replace(`/studio/?${next.toString()}`);
  }, [router, params, view]);
  return null;
}

/** Sends the old /studio/canvas and /studio/explorer addresses to the workspace view. */
export function LegacyRedirect({ view }: { view: "diagram" | "data" }) {
  return (
    <Suspense fallback={null}>
      <Redirect view={view} />
    </Suspense>
  );
}
