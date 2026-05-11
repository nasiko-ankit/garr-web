import type { EntityStatus } from "@/lib/garr-types";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: EntityStatus }) {
  const styles: Record<EntityStatus, string> = {
    active: "border-emerald-200 bg-emerald-50 text-emerald-700",
    stale: "border-amber-200 bg-amber-50 text-amber-700",
    suspended: "border-rose-200 bg-rose-50 text-rose-700",
    pending: "border-slate-200 bg-slate-50 text-slate-700",
  };

  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em]",
        styles[status]
      )}
    >
      {status}
    </span>
  );
}