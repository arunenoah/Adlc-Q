"use client";

import { useState } from "react";
import { toggleCLI as toggleCLIAction } from "../../app/actions";
import type { CLIRegistration } from "../types";

// Local mirror of the connected-CLI registry. Optimistically toggles UI
// state then fires the server action; the server is the source of truth
// (next page load reads from store) so we don't await.
//
// SRP: hook owns the optimistic-UI mirror. Persistence is server-side.
// Returns a tuple matching the original useState shape so call sites stay
// drop-in.

export const useConnectedCLIs = (
  initial: Record<string, CLIRegistration>,
): [Record<string, CLIRegistration>, (id: string) => void] => {
  const [clis, setClis] = useState(initial);
  const toggle = (id: string) => {
    setClis((s) => ({
      ...s,
      [id]: s[id]?.active
        ? { active: false }
        : { active: true, plan: "Pro", until: "Dec 2026" },
    }));
    void toggleCLIAction(id);
  };
  return [clis, toggle];
};
