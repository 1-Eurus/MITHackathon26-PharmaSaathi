import * as L from "leaflet";
import { $ } from "../dom";
import { FACILITIES, HUBS, MEDICINES, facilityCarries } from "../data";
import { stateOf } from "../simulate";
import { focusMed, scrubDay, selectedFacility, setSelectedFacility, statusColorVar } from "../state";
import type { Signal } from "../types";
import { renderAll } from "./index";

/* ============================================================
   SUPPLY NETWORK MAP - a real Leaflet map (OpenStreetMap/CARTO tiles,
   no API key needed) centered on Noida/Greater Noida. Facilities orbit
   their supplying hub at real coordinates; edges, colors and click
   behaviour work the same way the old abstract diagram did.
   ============================================================ */

let map: L.Map | null = null;
let edgeLayer: L.LayerGroup | null = null;
let hubLayer: L.LayerGroup | null = null;
let facilityLayer: L.LayerGroup | null = null;
let initialBounds: L.LatLngBounds | null = null;

function ensureMap(): L.Map {
  if (map) return map;
  // fit to every facility (not a fixed center/zoom) so all 18 are framed and
  // spread as far apart as the screen allows, rather than an arbitrary crop
  initialBounds = L.latLngBounds(FACILITIES.map((f) => [f.lat, f.lng] as L.LatLngTuple));
  map = L.map($("netMap") as HTMLElement, {
    minZoom: 9,
    maxZoom: 17,
    zoomControl: false,
    attributionControl: true,
  }).fitBounds(initialBounds, { padding: [28, 28] });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    subdomains: "abc",
    maxZoom: 19,
    className: "map-tiles-dark",
  }).addTo(map);
  edgeLayer = L.layerGroup().addTo(map);
  hubLayer = L.layerGroup().addTo(map);
  facilityLayer = L.layerGroup().addTo(map);
  return map;
}

export function renderNetwork(signals: Signal[]): void {
  const m = ensureMap();
  const med = MEDICINES.find((mm) => mm.id === focusMed)!;
  const activeHubs = new Set(signals.map((s) => s.hub.id));

  edgeLayer!.clearLayers();
  hubLayer!.clearLayers();
  facilityLayer!.clearLayers();

  // edges first (under nodes) - a gentle bend for an organic, orbital feel
  FACILITIES.forEach((f) => {
    if (f.anchor) return;
    const hub = HUBS.find((h) => h.id === f.hub)!;
    const isActive = activeHubs.has(hub.id);
    const mid: L.LatLngTuple = [(hub.lat + f.lat) / 2, (hub.lng + f.lng) / 2];
    const dLat = f.lat - hub.lat, dLng = f.lng - hub.lng;
    const bend: L.LatLngTuple = [mid[0] - dLng * 0.35, mid[1] + dLat * 0.35];
    L.polyline([[hub.lat, hub.lng], bend, [f.lat, f.lng]], {
      color: hub.color.startsWith("var(") ? cssVar(hub.color) : hub.color,
      opacity: isActive ? 0.9 : 0.3,
      weight: isActive ? 2.4 : 1.3,
      dashArray: isActive ? "5 4" : undefined,
      smoothFactor: 1,
      interactive: false,
    }).addTo(edgeLayer!);
  });

  // hub nodes
  HUBS.forEach((h) => {
    const isActive = activeHubs.has(h.id);
    const color = cssVar(h.color);
    if (isActive) {
      L.circleMarker([h.lat, h.lng], {
        radius: 26, color: "transparent", fillColor: color, fillOpacity: 0.18, interactive: false,
      }).addTo(hubLayer!);
    }
    L.circleMarker([h.lat, h.lng], {
      radius: isActive ? 15 : 12,
      color,
      weight: isActive ? 2.4 : 1.4,
      fillColor: color,
      fillOpacity: 0.16,
      interactive: false,
    }).addTo(hubLayer!);
  });

  // facility markers - muted/hatched for facilities that don't stock the focused medicine
  FACILITIES.forEach((f) => {
    const carries = facilityCarries(f, med);
    const s = carries ? stateOf(f.id, focusMed, scrubDay) : null;
    const hub = HUBS.find((h) => h.id === f.hub)!;
    const isSel = f.id === selectedFacility;
    const r = f.anchor ? 9 : 6.5;
    const fill = carries && s ? cssVar(statusColorVar(s.status)) : cssVar("var(--surface-2)");
    const stroke = isSel ? cssVar("var(--ink)") : carries ? cssVar("var(--surface)") : cssVar("var(--line-strong)");
    const tipText = carries && s
      ? `<b>${f.name}</b><br>${hub.district} &middot; ${s.daysOfSupply.toFixed(1)}d supply (${s.status})`
      : `<b>${f.name}</b><br>${hub.district} &middot; does not stock ${med.name}`;

    if (isSel) {
      L.circleMarker([f.lat, f.lng], {
        radius: r + 3, color: "transparent", fillColor: cssVar(hub.color), fillOpacity: 0.22, interactive: false,
      }).addTo(facilityLayer!);
    }
    const marker = L.circleMarker([f.lat, f.lng], {
      radius: r,
      color: stroke,
      weight: isSel ? 2.2 : 1.6,
      dashArray: carries ? undefined : "2 2",
      fillColor: fill,
      fillOpacity: carries ? 1 : 0.5,
      className: `node-facility${carries ? "" : " not-stocked"}`,
    }).addTo(facilityLayer!);
    marker.bindTooltip(tipText, { direction: "top", offset: [0, -r], className: "net-tip" });
    if (f.anchor) {
      marker.bindTooltip(hub.name, {
        permanent: true, direction: "top", offset: [0, -r - 6], className: "hub-label-tip", interactive: false,
      }).openTooltip();
    } else {
      marker.bindTooltip(f.name.split(" ").slice(0, 2).join(" "), {
        permanent: true, direction: "bottom", offset: [0, r + 4], className: `fac-label-tip${carries ? "" : " muted"}`, interactive: false,
      }).openTooltip();
    }
    marker.on("click", () => {
      setSelectedFacility(f.id);
      renderAll();
    });
  });

  // hub identity only - facility stock status (Stable/Warning/Critical) is
  // already shown per-facility in the Facilities list and in each marker's
  // own hover tooltip, so repeating it here as a third always-on color
  // system was redundant and confusing next to the hub-color key
  $("netLegend").innerHTML = HUBS.map(
    (h) => `<span class="leg-item"><span class="leg-swatch" style="background:${h.color}"></span>${h.name}</span>`
  ).join("");

  m.invalidateSize();
}

/** resolve a "var(--token)" CSS custom-property reference to its computed color, since Leaflet/SVG attrs don't accept var() the way inline CSS does */
function cssVar(ref: string): string {
  const match = /^var\((--[\w-]+)\)$/.exec(ref.trim());
  if (!match) return ref;
  const value = getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim();
  return value || ref;
}

/** wire pan/zoom interaction. Call once at startup. */
export function wireNetworkInteractions(): void {
  const m = ensureMap();
  $("netZoomIn").addEventListener("click", () => m.zoomIn());
  $("netZoomOut").addEventListener("click", () => m.zoomOut());
  $("netZoomReset").addEventListener("click", () => initialBounds && m.fitBounds(initialBounds, { padding: [28, 28] }));
}
