// Visuele styling helpers voor projecten (intern, bedrijf, particulier)
import { customerAccent } from "./customer-colors";

export const INTERNAL_PURPLE = "#8b5cf6";
export const INDIVIDUAL_BLUE = "#0ea5e9";

export function isInternalProject(p: any): boolean {
  return !!p?.is_internal;
}

export function isIndividualProject(p: any): boolean {
  if (isInternalProject(p)) return false;
  return p?.customers?.customer_type === "individual";
}

export function isCompanyProject(p: any): boolean {
  if (isInternalProject(p)) return false;
  return !isIndividualProject(p);
}

export type ProjectKind = "internal" | "individual" | "company";
export function projectKind(p: any): ProjectKind {
  if (isInternalProject(p)) return "internal";
  if (isIndividualProject(p)) return "individual";
  return "company";
}

/** Linker accent kleur voor cards (taken / projecten) */
export function projectAccent(p: any): string {
  if (isInternalProject(p)) return INTERNAL_PURPLE;
  if (isIndividualProject(p)) return p?.customers?.color || INDIVIDUAL_BLUE;
  return customerAccent(p?.customers?.color);
}

// Internal (paars)
export const internalCardClass =
  "bg-violet-50 dark:bg-violet-950/40 border-violet-300 dark:border-violet-800";
export const internalHeaderClass =
  "bg-gradient-to-br from-violet-100 via-violet-50 to-purple-100 dark:from-violet-950/60 dark:via-violet-900/40 dark:to-purple-950/60";
export const internalBadgeClass =
  "bg-violet-600 text-white border-0 hover:bg-violet-700";
export const internalIconWrapClass =
  "bg-violet-200/70 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300";

// Particulier (lichter / sky)
export const individualCardClass =
  "bg-sky-50/60 dark:bg-sky-950/30 border-sky-200 dark:border-sky-900";
export const individualBadgeClass =
  "bg-sky-100 text-sky-800 border-sky-200 hover:bg-sky-100 dark:bg-sky-900/60 dark:text-sky-200 dark:border-sky-800";
export const individualIconWrapClass =
  "bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300";

// Bedrijf
export const companyBadgeClass =
  "bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-100 dark:bg-slate-800/60 dark:text-slate-200 dark:border-slate-700";
