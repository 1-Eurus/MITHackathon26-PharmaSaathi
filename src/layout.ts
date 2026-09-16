import { HUBS, FACILITIES, TYPE } from "./data";

/* ============================================================
   LAYOUT: place facilities around their hub on the real map.
   Call once at startup, before anything reads Facility.lat / .lng / .anchor.
   ============================================================ */

// ~1 lng degree is narrower than 1 lat degree this close to the equator's
// mid-latitudes; scale lng offsets by 1/cos(lat) so the spread of facilities
// around a hub reads as a roughly even circle on screen, not an ellipse.
const LAT_SPREAD_DEG = 0.036; // roughly a 4km radius around each hub for the smaller facilities
const ANCHOR_OFFSET_DEG = 0.01; // the anchor hospital sits close to the hub but not exactly on top of it -
                                 // two markers at the identical point look like one dot on the map

export function layoutFacilities(): void {
  FACILITIES.forEach((f) => {
    const hub = HUBS.find((h) => h.id === f.hub)!;
    const isAnchor = TYPE[f.type].mult >= 2.0; // hospital-scale facility anchors the hub
    if (isAnchor) {
      f.lat = hub.lat + ANCHOR_OFFSET_DEG; // due north of the hub marker
      f.lng = hub.lng;
      f.anchor = true;
    }
  });
  HUBS.forEach((h) => {
    const spokes = FACILITIES.filter((f) => f.hub === h.id && !f.anchor);
    const n = spokes.length;
    const lngScale = 1 / Math.cos((h.lat * Math.PI) / 180);
    spokes.forEach((f, i) => {
      // start spokes at the south (angle 90°) so they fan out away from the
      // anchor's north offset above, minimizing overlap between the two
      const angle = (Math.PI * 2 * (i / n)) + Math.PI / 2 + (h.lng > 77.42 ? 0.3 : -0.3);
      f.lat = h.lat + Math.sin(angle) * LAT_SPREAD_DEG;
      f.lng = h.lng + Math.cos(angle) * LAT_SPREAD_DEG * lngScale;
      f.anchor = false;
    });
  });
}
