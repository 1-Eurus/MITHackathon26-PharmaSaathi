import { computeSignals, computeRedistribution, computeDemandSignals, computeProactiveRedistribution } from "../simulate";
import { scrubDay } from "../state";
import { renderStats, renderAlert, renderScrubber } from "./topbar";
import { renderVenFilter, renderPills } from "./medicines";
import { renderFacilityList, syncFacilityListHeight } from "./facilityList";
import { renderNetwork } from "./network";
import { renderDetail } from "./detail";
import { renderSignals, renderDemandSignals, renderRedistribution, renderSeasonal, renderExpiry, syncExpiryHeight, renderTrust, renderSuppliers } from "./panels";

export function renderAll(): void {
  const signals = computeSignals(scrubDay);
  const demandSignals = computeDemandSignals(scrubDay);
  renderScrubber();
  renderStats(signals);
  renderAlert(signals);
  renderVenFilter();
  renderPills();
  renderFacilityList();
  renderNetwork(signals);
  renderDetail();
  renderSignals(signals);
  renderDemandSignals(demandSignals, computeProactiveRedistribution(scrubDay, demandSignals));
  renderRedistribution(computeRedistribution(scrubDay, signals));
  renderSeasonal();
  renderExpiry(scrubDay);
  renderTrust();
  renderSuppliers();
  syncFacilityListHeight();
  syncExpiryHeight();
}
