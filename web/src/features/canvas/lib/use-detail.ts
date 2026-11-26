"use client";

import { useViewportStore } from "@xyflow/react";
import { detailAt } from "./overview";

/** The canvas's level of detail; components re-render only when it changes tier. */
export const useDetail = () => useViewportStore((s) => detailAt(s.transform[2]));
