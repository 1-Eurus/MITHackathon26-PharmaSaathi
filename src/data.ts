import type {
  Hub,
  FacilityTypeName,
  FacilityTypeInfo,
  Facility,
  Medicine,
  Supplier,
  SeasonalEntry,
  Disruption,
  DemandSpikeScenario,
} from "./types";

export const HUBS: Hub[] = [
  { id: "greaterNoida", name: "Hub-Greater Noida", district: "Greater Noida", color: "var(--hub-1)", lat: 28.4744, lng: 77.5040 },
  { id: "centralNoida", name: "Hub-Sector 62", district: "Sector 62, Noida", color: "var(--hub-2)", lat: 28.6273, lng: 77.3736 },
  { id: "sector128", name: "Hub-Sector 128", district: "Sector 128, Noida", color: "var(--hub-3)", lat: 28.5355, lng: 77.3910 },
  { id: "sector71", name: "Hub-Sector 71", district: "Sector 71, Noida", color: "var(--hub-4)", lat: 28.5679, lng: 77.3672 },
  { id: "noidaExtension", name: "Hub-Noida Extension", district: "Noida Extension (Greater Noida West)", color: "var(--hub-5)", lat: 28.6099, lng: 77.4123 },
  { id: "sector30", name: "Hub-Sector 30", district: "Sector 30, Noida", color: "var(--hub-6)", lat: 28.5818, lng: 77.3255 },
  { id: "dadri", name: "Hub-Dadri", district: "Dadri", color: "var(--hub-7)", lat: 28.5514, lng: 77.5540 },
];

// facility type -> [dailyUse multiplier, cold-chain capacity, reserve buffer, formulary tier]
export const TYPE: Record<FacilityTypeName, FacilityTypeInfo> = {
  "Medical College & Hospital": { mult: 5.2, cold: "full", buffer: 1.5, tier: 5 },
  "District Hospital": { mult: 2.6, cold: "full", buffer: 1.4, tier: 4 },
  CHC: { mult: 1.3, cold: "full", buffer: 1.2, tier: 3 },
  PHC: { mult: 0.7, cold: "limited", buffer: 1.1, tier: 2 },
  "Sub-Center": { mult: 0.35, cold: "none", buffer: 1.0, tier: 1 },
};
// tier = the facility scale a medicine's minTier must clear to be stocked there;
// a bigger facility's tier always covers every smaller tier's formulary too.

// lat/lng/anchor are filled in by the layout step (see layout.ts); trust is
// filled in once the simulated series exist (see simulate.ts) - both run at
// module load time in main.ts, before anything renders.
export const FACILITIES: Facility[] = [
  { id: "gmch", name: "Government Institute of Medical Sciences (GIMS), Greater Noida", type: "Medical College & Hospital", hub: "greaterNoida", lat: 0, lng: 0, anchor: false, trust: { score: 0, reportingRate: 0, tier: "Monitor" } },
  { id: "dispur", name: "Sharda Hospital, Greater Noida", type: "CHC", hub: "greaterNoida", lat: 0, lng: 0, anchor: false, trust: { score: 0, reportingRate: 0, tier: "Monitor" } },
  { id: "rani", name: "Chi Sector Primary Health Centre", type: "PHC", hub: "greaterNoida", lat: 0, lng: 0, anchor: false, trust: { score: 0, reportingRate: 0, tier: "Monitor" } },
  { id: "boko", name: "Surajpur Sub-Center", type: "Sub-Center", hub: "greaterNoida", lat: 0, lng: 0, anchor: false, trust: { score: 0, reportingRate: 0, tier: "Monitor" } },

  { id: "nalbdh", name: "Fortis Hospital, Sector 62, Noida", type: "District Hospital", hub: "centralNoida", lat: 0, lng: 0, anchor: false, trust: { score: 0, reportingRate: 0, tier: "Monitor" } },
  { id: "tihu", name: "Sector 62 Community Health Centre, Noida", type: "CHC", hub: "centralNoida", lat: 0, lng: 0, anchor: false, trust: { score: 0, reportingRate: 0, tier: "Monitor" } },
  { id: "barkh", name: "Sector 50 Primary Health Centre, Noida", type: "PHC", hub: "centralNoida", lat: 0, lng: 0, anchor: false, trust: { score: 0, reportingRate: 0, tier: "Monitor" } },
  { id: "apollo", name: "Apollo Cradle & Children's Hospital, Sector 51, Noida", type: "CHC", hub: "centralNoida", lat: 0, lng: 0, anchor: false, trust: { score: 0, reportingRate: 0, tier: "Monitor" } },

  { id: "barpdh", name: "Jaypee Hospital, Sector 128, Noida", type: "District Hospital", hub: "sector128", lat: 0, lng: 0, anchor: false, trust: { score: 0, reportingRate: 0, tier: "Monitor" } },
  { id: "sarth", name: "Sector 125 Primary Health Centre, Noida", type: "PHC", hub: "sector128", lat: 0, lng: 0, anchor: false, trust: { score: 0, reportingRate: 0, tier: "Monitor" } },
  { id: "bajali", name: "Felix Hospital, Sector 137, Noida", type: "CHC", hub: "sector128", lat: 0, lng: 0, anchor: false, trust: { score: 0, reportingRate: 0, tier: "Monitor" } },
  { id: "sec126sub", name: "Sector 126 Sub-Center, Noida", type: "Sub-Center", hub: "sector128", lat: 0, lng: 0, anchor: false, trust: { score: 0, reportingRate: 0, tier: "Monitor" } },

  { id: "mangdh", name: "Kailash Hospital, Sector 71, Noida", type: "District Hospital", hub: "sector71", lat: 0, lng: 0, anchor: false, trust: { score: 0, reportingRate: 0, tier: "Monitor" } },
  { id: "sipaj", name: "Prakash Hospital, Sector 71, Noida", type: "CHC", hub: "sector71", lat: 0, lng: 0, anchor: false, trust: { score: 0, reportingRate: 0, tier: "Monitor" } },
  { id: "kalai", name: "Sector 78 Primary Health Centre, Noida", type: "PHC", hub: "sector71", lat: 0, lng: 0, anchor: false, trust: { score: 0, reportingRate: 0, tier: "Monitor" } },
  { id: "motherhood", name: "Motherhood Hospital, Sector 41, Noida", type: "CHC", hub: "sector71", lat: 0, lng: 0, anchor: false, trust: { score: 0, reportingRate: 0, tier: "Monitor" } },

  { id: "mushdh", name: "Yatharth Super Speciality Hospital, Noida Extension", type: "District Hospital", hub: "noidaExtension", lat: 0, lng: 0, anchor: false, trust: { score: 0, reportingRate: 0, tier: "Monitor" } },
  { id: "baksaphc", name: "Greater Noida West Primary Health Centre", type: "PHC", hub: "noidaExtension", lat: 0, lng: 0, anchor: false, trust: { score: 0, reportingRate: 0, tier: "Monitor" } },
  { id: "gores", name: "Metro Hospital, Noida Extension", type: "CHC", hub: "noidaExtension", lat: 0, lng: 0, anchor: false, trust: { score: 0, reportingRate: 0, tier: "Monitor" } },
  { id: "sec4sub", name: "Sector 4 Sub-Center, Greater Noida West", type: "Sub-Center", hub: "noidaExtension", lat: 0, lng: 0, anchor: false, trust: { score: 0, reportingRate: 0, tier: "Monitor" } },

  { id: "morigdh", name: "District Combined Hospital, Sector 30, Noida", type: "District Hospital", hub: "sector30", lat: 0, lng: 0, anchor: false, trust: { score: 0, reportingRate: 0, tier: "Monitor" } },
  { id: "mayong", name: "Sector 30 Primary Health Centre, Noida", type: "PHC", hub: "sector30", lat: 0, lng: 0, anchor: false, trust: { score: 0, reportingRate: 0, tier: "Monitor" } },
  { id: "sec31chc", name: "Sector 31 Community Health Centre, Noida", type: "CHC", hub: "sector30", lat: 0, lng: 0, anchor: false, trust: { score: 0, reportingRate: 0, tier: "Monitor" } },
  { id: "sec21sub", name: "Sector 21 Sub-Center, Noida", type: "Sub-Center", hub: "sector30", lat: 0, lng: 0, anchor: false, trust: { score: 0, reportingRate: 0, tier: "Monitor" } },

  { id: "ntpcdadri", name: "NTPC Hospital, Dadri", type: "District Hospital", hub: "dadri", lat: 0, lng: 0, anchor: false, trust: { score: 0, reportingRate: 0, tier: "Monitor" } },
  { id: "dadrichc", name: "Community Health Centre (CHC), Dadri", type: "CHC", hub: "dadri", lat: 0, lng: 0, anchor: false, trust: { score: 0, reportingRate: 0, tier: "Monitor" } },
  { id: "bilaspur", name: "Bilaspur Primary Health Centre, Dadri", type: "PHC", hub: "dadri", lat: 0, lng: 0, anchor: false, trust: { score: 0, reportingRate: 0, tier: "Monitor" } },
  { id: "jarcha", name: "Jarcha Sub-Center, Dadri", type: "Sub-Center", hub: "dadri", lat: 0, lng: 0, anchor: false, trust: { score: 0, reportingRate: 0, tier: "Monitor" } },
];

/* minTier: the lowest facility tier (see TYPE above) that stocks this line -
   a Sub-Center carries only the tier-1 universal commodities, a Medical College
   carries everything. This is what keeps "how many medicine-facility pairs are
   tracked" from just being facility-count x medicine-count: real facilities
   don't all carry every line on the Essential Drug List. */
export const MEDICINES: Medicine[] = [
  { id: "oxytocin", name: "Oxytocin Injection", unit: "vials", cold: true, base: 9, cycle: 18, category: "Maternal health", ven: "V", minTier: 1 },
  { id: "ors", name: "ORS Sachets", unit: "sachets", cold: false, base: 34, cycle: 20, category: "Rehydration", ven: "E", minTier: 1 },
  { id: "chlorine", name: "Chlorine Tablets (Water Purification)", unit: "strips", cold: false, base: 18, cycle: 26, category: "Public health supplies", ven: "N", minTier: 1 },
  { id: "amox", name: "Amoxicillin 250mg", unit: "strips", cold: false, base: 20, cycle: 24, category: "Antibiotic", ven: "E", minTier: 2 },
  { id: "paracetamol", name: "Paracetamol 500mg", unit: "strips", cold: false, base: 28, cycle: 22, category: "Analgesic/antipyretic", ven: "E", minTier: 2 },
  { id: "tt", name: "Tetanus Toxoid Injection", unit: "vials", cold: true, base: 7, cycle: 28, category: "Immunisation", ven: "V", minTier: 2 },
  { id: "ifa", name: "Iron & Folic Acid (IFA) Tablets", unit: "strips", cold: false, base: 16, cycle: 22, category: "Maternal health", ven: "E", minTier: 2 },
  { id: "doxycycline", name: "Doxycycline 100mg", unit: "strips", cold: false, base: 12, cycle: 20, category: "Antibiotic", ven: "E", minTier: 3 },
  { id: "artesunate", name: "Artesunate Injection", unit: "vials", cold: false, base: 5, cycle: 16, category: "Antimalarial", ven: "V", minTier: 3 },
  { id: "rl", name: "IV Fluids (Ringer Lactate)", unit: "bottles", cold: false, base: 15, cycle: 18, category: "Rehydration", ven: "E", minTier: 3 },
  { id: "albendazole", name: "Albendazole 400mg", unit: "strips", cold: false, base: 9, cycle: 32, category: "Anthelmintic", ven: "E", minTier: 3 },
  { id: "mr", name: "Measles-Rubella (MR) Vaccine", unit: "vials", cold: true, base: 5, cycle: 24, category: "Immunisation", ven: "V", minTier: 3 },
  { id: "insulin", name: "Insulin (Human, Regular)", unit: "vials", cold: true, base: 6, cycle: 26, category: "Chronic care", ven: "V", minTier: 4 },
  { id: "antivenom", name: "Snake Anti-Venom", unit: "vials", cold: true, base: 3, cycle: 30, category: "Emergency", ven: "V", minTier: 4 },
  { id: "multivit", name: "Multivitamin Syrup (Pediatric)", unit: "bottles", cold: false, base: 10, cycle: 40, category: "Supportive care", ven: "N", minTier: 4 },
  { id: "rabies", name: "Anti-Rabies Vaccine", unit: "vials", cold: true, base: 4, cycle: 24, category: "Emergency", ven: "V", minTier: 4 },
  { id: "magsulphate", name: "Magnesium Sulphate Injection", unit: "vials", cold: true, base: 3, cycle: 20, category: "Emergency obstetric care", ven: "V", minTier: 4 },
  { id: "zinc", name: "Zinc Sulphate Tablets", unit: "tablets", cold: false, base: 20, cycle: 24, category: "Rehydration", ven: "E", minTier: 1 },
  { id: "vitA", name: "Vitamin A Solution", unit: "bottles", cold: false, base: 6, cycle: 40, category: "Supportive care", ven: "N", minTier: 2 },
  { id: "bcg", name: "BCG Vaccine", unit: "vials", cold: true, base: 4, cycle: 24, category: "Immunisation", ven: "V", minTier: 2 },
  { id: "hepb", name: "Hepatitis B Vaccine", unit: "vials", cold: true, base: 5, cycle: 24, category: "Immunisation", ven: "V", minTier: 2 },
  { id: "metronidazole", name: "Metronidazole 400mg", unit: "strips", cold: false, base: 14, cycle: 22, category: "Antibiotic", ven: "E", minTier: 2 },
  { id: "ciprofloxacin", name: "Ciprofloxacin 500mg", unit: "strips", cold: false, base: 10, cycle: 24, category: "Antibiotic", ven: "E", minTier: 3 },
  { id: "salbutamol", name: "Salbutamol Inhaler", unit: "inhalers", cold: false, base: 2, cycle: 30, category: "Respiratory", ven: "E", minTier: 3 },
  { id: "calciumgluconate", name: "Calcium Gluconate Injection", unit: "vials", cold: true, base: 2, cycle: 20, category: "Emergency obstetric care", ven: "V", minTier: 4 },
];

export const VEN_LABEL: Record<Medicine["ven"], string> = { V: "Vital", E: "Essential", N: "Non-essential" };
// safety buffer (days) added to lead time when setting the reorder trigger
export const VEN_BUFFER_DAYS: Record<Medicine["ven"], number> = { V: 13, E: 10, N: 6 };

/** whether a given facility stocks a given medicine at all - see minTier note above */
export function facilityCarries(fac: Facility, med: Medicine): boolean {
  return TYPE[fac.type].tier >= med.minTier;
}

/** iterate every medicine-facility combination that's actually stocked */
export function eachCarriedPair(cb: (f: Facility, m: Medicine) => void): void {
  FACILITIES.forEach((f) => MEDICINES.forEach((m) => { if (facilityCarries(f, m)) cb(f, m); }));
}

export const DAYS = 90;
export const TODAY = new Date(2026, 8, 10); // Sep 10, 2026 = day 90

export function dateForDay(d: number): Date {
  const t = new Date(TODAY);
  t.setDate(t.getDate() - (DAYS - d));
  return t;
}
export function fmtDate(dt: Date): string {
  return dt.toLocaleDateString("en-IN", { month: "short", day: "2-digit" });
}
export function fmtDateFull(dt: Date): string {
  return dt.toLocaleDateString("en-IN", { month: "short", day: "2-digit", year: "numeric" });
}

/* scripted disruption: Hub-Sector 62's Oxytocin Injection line loses its upstream
   supplier starting day 54; replenishment delay ramps up instead of arriving on schedule */
export const DISRUPTION: Disruption = { hub: "centralNoida", medicine: "oxytocin", startDay: 54, maxExtraDelay: 15, rampDays: 26 };

/* scripted demand spike: Hub-Sector 128's Doxycycline use climbs well above its
   normal baseline starting day 68 - a water-borne-illness surge distinct from
   the supply-delay disruption above. Replenishment still arrives on schedule
   here; the signal is rising consumption, not a stalled delivery, and it's
   meant to show up while stock is still healthy - a lead-time warning, not
   an already-declining one. */
export const DEMAND_SPIKE: DemandSpikeScenario = { hub: "sector128", medicine: "doxycycline", startDay: 78, rampDays: 12, maxUsageMultiplier: 0.5 };

/* nearby external suppliers a hub can fall back on when internal redistribution
   can't cover a gap - distinct from the facility network above */
export const SUPPLIERS: Supplier[] = [
  { hub: "greaterNoida", name: "UPMSCL Regional Depot, Greater Noida", type: "State medical store", leadTimeDays: 1.5, reliability: 96, note: "Primary state distributor; handles bulk & emergency indents" },
  { hub: "greaterNoida", name: "NCR Pharma Distributors", type: "Private distributor (empanelled)", leadTimeDays: 1, reliability: 88, note: "Fast on antibiotics & ORS; limited cold-chain fleet" },
  { hub: "centralNoida", name: "Sector 62 Cooperative Drug Warehouse", type: "District warehouse", leadTimeDays: 2, reliability: 81, note: "Normal upstream source - currently the disrupted link" },
  { hub: "centralNoida", name: "UPMSCL Regional Depot, Greater Noida", type: "State medical store", leadTimeDays: 2.5, reliability: 96, note: "Can bypass the district link directly if authorised" },
  { hub: "sector128", name: "Noida Expressway Health Suppliers", type: "Private distributor", leadTimeDays: 2, reliability: 79, note: "Variable lead time in monsoon waterlogging" },
  { hub: "sector71", name: "Sector 71 District Drug Store", type: "District warehouse", leadTimeDays: 1.5, reliability: 90, note: "Consistent performer" },
  { hub: "noidaExtension", name: "Greater Noida West Health Supply Unit", type: "District warehouse", leadTimeDays: 2.5, reliability: 84, note: "Serves fast-growing sectors; road access construction-dependent" },
  { hub: "sector30", name: "Sector 30 Central Store", type: "District warehouse", leadTimeDays: 2, reliability: 87, note: "Adequate for routine resupply" },
];

/* seasonal demand outlook - Sept in Delhi-NCR sits at post-monsoon dengue
   season: waterlogging, mosquito breeding, and water-borne disease all move
   together in the same 30-day window */
export const SEASONAL: SeasonalEntry[] = [
  { med: "antivenom", changePct: 40, driver: "Monsoon waterlogging near the Yamuna floodplain and low-lying sectors displaces snakes into settlements - bite reports peak Sep-Oct." },
  { med: "ors", changePct: 40, driver: "Water-borne diarrhoeal disease follows monsoon waterlogging as contaminated sources come back into use." },
  { med: "doxycycline", changePct: 45, driver: "Dengue and leptospirosis exposure both rise sharply as standing water persists post-monsoon." },
  { med: "rl", changePct: 33, driver: "Dehydration and diarrhoeal admissions drive up IV fluid demand alongside ORS." },
  { med: "artesunate", changePct: 22, driver: "Stagnant water at construction sites across fast-growing sectors raises Anopheles breeding; malaria admissions climb through October." },
  { med: "amox", changePct: 15, driver: "Secondary bacterial infection follows the same water-borne disease wave." },
  { med: "chlorine", changePct: 22, driver: "Disrupted piped supply after waterlogging pushes up demand for point-of-use water purification." },
  { med: "tt", changePct: 10, driver: "Wound-care and injury presentations rise with monsoon cleanup and construction-debris activity." },
  { med: "oxytocin", changePct: 4, driver: "No seasonal driver - tracks the district birth-rate baseline." },
  { med: "insulin", changePct: 3, driver: "Chronic-care demand is stable and non-seasonal." },
  { med: "paracetamol", changePct: 2, driver: "Stable baseline demand with no strong seasonal signal this period." },
  { med: "rabies", changePct: 1, driver: "Stray-animal exposure is roughly flat through the season." },
  { med: "multivit", changePct: -8, driver: "Non-essential line deprioritised while dengue-season allocation is active." },
];
