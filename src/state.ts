import { MEDICINES } from "./data";
import type { Medicine, Status, Ven } from "./types";

/* ============================================================
   UI STATE - module-level, mutated by event handlers, read by render/*
   ============================================================ */
export let focusMed = "oxytocin";
export let selectedFacility = "nalbdh";
export let scrubDay = 90;
export let playing = false;
export let playTimer: ReturnType<typeof setInterval> | null = null;
export let venFilter: "all" | Ven = "all";
export let medSearch = "";
export let facSearch = "";
export let medicinesExpanded = false;

export function setFocusMed(id: string): void { focusMed = id; }
export function setSelectedFacility(id: string): void { selectedFacility = id; }
export function setScrubDay(day: number): void { scrubDay = day; }
export function setPlaying(v: boolean): void { playing = v; }
export function setPlayTimer(t: ReturnType<typeof setInterval> | null): void { playTimer = t; }
export function setVenFilter(v: "all" | Ven): void { venFilter = v; }
export function setMedSearch(v: string): void { medSearch = v; }
export function setFacSearch(v: string): void { facSearch = v; }
export function setMedicinesExpanded(v: boolean): void { medicinesExpanded = v; }

export function medicinesMatchingFilters(): Medicine[] {
  const q = medSearch.trim().toLowerCase();
  return MEDICINES.filter(
    (m) =>
      (venFilter === "all" || m.ven === venFilter) &&
      (!q || m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q))
  );
}

export function statusColorVar(st: Status): string {
  return { good: "var(--good)", warning: "var(--warning)", watch: "var(--watch)", critical: "var(--critical)" }[st];
}
