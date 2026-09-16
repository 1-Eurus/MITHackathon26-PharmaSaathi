import "leaflet/dist/leaflet.css";
import "./style.css";
import { $ } from "./dom";
import { DAYS } from "./data";
import { layoutFacilities } from "./layout";
import { buildSeries, buildTrust } from "./simulate";
import { scrubDay, playing, setScrubDay, setPlaying, playTimer, setPlayTimer, setMedSearch, setFacSearch } from "./state";
import { renderAll } from "./render/index";
import { wireNetworkInteractions } from "./render/network";
import { renderPills } from "./render/medicines";
import { renderFacilityList, syncFacilityListHeight } from "./render/facilityList";
import { syncExpiryHeight } from "./render/panels";
import { wireInvoiceModal, replayPersistedReceipts } from "./invoice";
import { wireDatabaseModal } from "./database";

function stopPlay(): void {
  setPlaying(false);
  if (playTimer) clearInterval(playTimer);
  setPlayTimer(null);
  $("playIcon").innerHTML = '<path d="M8 5v14l11-7z"/>';
  $("playBtn").setAttribute("aria-label", "Play");
}
function startPlay(): void {
  if (scrubDay >= DAYS) setScrubDay(0);
  setPlaying(true);
  $("playIcon").innerHTML = '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>';
  $("playBtn").setAttribute("aria-label", "Pause");
  setPlayTimer(
    setInterval(() => {
      setScrubDay(scrubDay + 1);
      if (scrubDay >= DAYS) {
        setScrubDay(DAYS);
        stopPlay();
      }
      renderAll();
    }, 260)
  );
}

async function boot(): Promise<void> {
  /* BOOTSTRAP - build the simulated world once, before anything renders */
  layoutFacilities();
  buildSeries();
  buildTrust();
  await replayPersistedReceipts(); // re-apply any invoices confirmed in a previous session (no-op if the backend isn't running)

  /* CONTROLS */
  $<HTMLInputElement>("scrubRange").addEventListener("input", (e) => {
    setScrubDay(parseInt((e.target as HTMLInputElement).value, 10));
    stopPlay();
    renderAll();
  });
  $("jumpToday").addEventListener("click", () => {
    setScrubDay(DAYS);
    stopPlay();
    renderAll();
  });

  $<HTMLInputElement>("medSearchInput").addEventListener("input", (e) => {
    setMedSearch((e.target as HTMLInputElement).value);
    renderPills();
  });
  $<HTMLInputElement>("facSearchInput").addEventListener("input", (e) => {
    setFacSearch((e.target as HTMLInputElement).value);
    renderFacilityList();
  });

  wireNetworkInteractions();
  wireInvoiceModal();
  wireDatabaseModal();
  $("playBtn").addEventListener("click", () => (playing ? stopPlay() : startPlay()));

  let resizeTimer: ReturnType<typeof setTimeout> | null = null;
  window.addEventListener("resize", () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      syncFacilityListHeight();
      syncExpiryHeight();
    }, 120);
  });

  renderAll();
}

boot();
