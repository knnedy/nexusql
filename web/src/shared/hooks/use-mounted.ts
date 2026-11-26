"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** False while hydrating, true after: browser-only values render once the server's HTML is adopted. */
export const useMounted = () => useSyncExternalStore(noop, () => true, () => false);
