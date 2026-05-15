// Visuele styling helpers voor projecten (intern vs klant)
import { customerAccent } from "./customer-colors";

export const INTERNAL_PURPLE = "#8b5cf6";

export function isInternalProject(p: any): boolean {
  return !!p?.is_internal;
}

/** Linker accent kleur voor cards (taken / projecten) */
export function projectAccent(p: any): string {
  if (isInternalProject(p)) return INTERNAL_PURPLE;
  return customerAccent(p?.customers?.color);
}

/** Tailwind classes voor een volledig paarse projectkaart */
export const internalCardClass =
  "bg-violet-50 dark:bg-violet-950/40 border-violet-300 dark:border-violet-800";

export const internalHeaderClass =
  "bg-gradient-to-br from-violet-100 via-violet-50 to-purple-100 dark:from-violet-950/60 dark:via-violet-900/40 dark:to-purple-950/60";

export const internalBadgeClass =
  "bg-violet-600 text-white border-0 hover:bg-violet-700";

export const internalIconWrapClass =
  "bg-violet-200/70 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300";
