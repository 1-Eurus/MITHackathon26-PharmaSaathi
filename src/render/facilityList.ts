import { $ } from "../dom";
import { FACILITIES, HUBS, MEDICINES, facilityCarries } from "../data";
import { stateOf } from "../simulate";
import { focusMed, facSearch, scrubDay, selectedFacility, setSelectedFacility } from "../state";
import { renderAll } from "./index";
import { capHeightToMatch } from "./layoutSync";

export function renderFacilityList(): void {
  const med = MEDICINES.find((m) => m.id === focusMed)!;
  const q = facSearch.trim().toLowerCase();
  let facilities = FACILITIES;
  if (q) {
    facilities = facilities.filter((f) => {
      const hub = HUBS.find((h) => h.id === f.hub)!;
      return f.name.toLowerCase().includes(q) || hub.district.toLowerCase().includes(q) || hub.name.toLowerCase().includes(q);
    });
  }
  const carrierRows = facilities
    .filter((f) => facilityCarries(f, med))
    .map((f) => ({ f, s: stateOf(f.id, focusMed, scrubDay) }));
  const nonCarrierRows = facilities.filter((f) => !facilityCarries(f, med));
  $("flistNote").textContent = `Sorted by risk for ${med.name}`;
  if (!carrierRows.length && !nonCarrierRows.length) {
    $("facilityList").innerHTML = `<div class="empty-state">No facilities match "${facSearch}".</div>`;
    return;
  }
  const carrierHtml = carrierRows
    .sort((a, b) => a.s.daysOfSupply - b.s.daysOfSupply)
    .map(({ f, s }) => {
      const hub = HUBS.find((h) => h.id === f.hub)!;
      const sel = f.id === selectedFacility ? "selected" : "";
      return `<button class="frow ${sel}" data-fac="${f.id}">
      <span class="hubdot" style="background:${hub.color}"></span>
      <span class="fmeta">
        <span class="fname">${f.name}</span>
        <span class="fhub">${hub.district} &middot; ${s.daysOfSupply.toFixed(1)}d supply</span>
      </span>
      <span class="chip ${s.status}">${s.status}</span>
    </button>`;
    })
    .join("");
  const nonCarrierHtml = nonCarrierRows
    .map((f) => {
      const hub = HUBS.find((h) => h.id === f.hub)!;
      const sel = f.id === selectedFacility ? "selected" : "";
      return `<button class="frow not-stocked ${sel}" data-fac="${f.id}">
      <span class="hubdot" style="background:${hub.color}; opacity:0.35;"></span>
      <span class="fmeta">
        <span class="fname">${f.name}</span>
        <span class="fhub">${hub.district} &middot; below the tier that stocks this line</span>
      </span>
      <span class="chip" style="background:var(--surface-2); color:var(--ink-muted); border:1px solid var(--line);">not stocked</span>
    </button>`;
    })
    .join("");
  $("facilityList").innerHTML = carrierHtml + nonCarrierHtml;
  $("facilityList").querySelectorAll<HTMLButtonElement>(".frow").forEach((btn) => {
    btn.addEventListener("click", () => {
      setSelectedFacility(btn.dataset.fac!);
      renderAll();
    });
  });
}

/** the Facilities list (28 rows and growing) shouldn't run on far past the
 *  Supply network map beside it - see capHeightToMatch for how/why. */
export function syncFacilityListHeight(): void {
  capHeightToMatch(document.getElementById("facilityList"), document.querySelector<HTMLElement>(".netcanvas"));
}
