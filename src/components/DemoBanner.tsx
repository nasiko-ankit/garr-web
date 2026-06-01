"use client";

import { usePathname } from "next/navigation";

export function DemoBanner() {
  const pathname = usePathname() ?? "/";
  // Show on demo dashboard, L2, L3, and the register page (which is L1).
  const isDemoArea =
    pathname.startsWith("/demo") || pathname.startsWith("/register");
  if (!isDemoArea) return null;

  return (
    <div className="border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-xs font-medium text-amber-900">
      <span className="uppercase tracking-[0.18em]">Demo mode</span>
      <span className="mx-2 text-amber-700">·</span>
      <span>
        Backend running with <span className="font-mono">GARR_DEMO_MODE=true</span> —
        DMARC / RAP reachability checks are bypassed.
      </span>
    </div>
  );
}
