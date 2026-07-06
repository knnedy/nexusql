"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function StudioPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/studio/canvas");
  }, [router]);

  return null;
}
