// Mirrors src/data.ts FACILITIES / MEDICINES (id, name, and the columns the
// SQL schema's foreign keys need). Kept in sync by hand - if you add or
// rename a facility/medicine in src/data.ts, update it here too, then delete
// server/data/pharmasaathi.db so it reseeds (see server/db.ts).

export interface CatalogFacility {
  id: string;
  name: string;
  hub: string;
}

export interface CatalogMedicine {
  id: string;
  name: string;
  ven: "V" | "E" | "N";
  category: string;
}

export const FACILITIES: CatalogFacility[] = [
  { id: "gmch", name: "Government Institute of Medical Sciences (GIMS), Greater Noida", hub: "greaterNoida" },
  { id: "dispur", name: "Sharda Hospital, Greater Noida", hub: "greaterNoida" },
  { id: "rani", name: "Chi Sector Primary Health Centre", hub: "greaterNoida" },
  { id: "boko", name: "Surajpur Sub-Center", hub: "greaterNoida" },
  { id: "nalbdh", name: "Fortis Hospital, Sector 62, Noida", hub: "centralNoida" },
  { id: "tihu", name: "Sector 62 Community Health Centre, Noida", hub: "centralNoida" },
  { id: "barkh", name: "Sector 50 Primary Health Centre, Noida", hub: "centralNoida" },
  { id: "apollo", name: "Apollo Cradle & Children's Hospital, Sector 51, Noida", hub: "centralNoida" },
  { id: "barpdh", name: "Jaypee Hospital, Sector 128, Noida", hub: "sector128" },
  { id: "sarth", name: "Sector 125 Primary Health Centre, Noida", hub: "sector128" },
  { id: "bajali", name: "Felix Hospital, Sector 137, Noida", hub: "sector128" },
  { id: "sec126sub", name: "Sector 126 Sub-Center, Noida", hub: "sector128" },
  { id: "mangdh", name: "Kailash Hospital, Sector 71, Noida", hub: "sector71" },
  { id: "sipaj", name: "Prakash Hospital, Sector 71, Noida", hub: "sector71" },
  { id: "kalai", name: "Sector 78 Primary Health Centre, Noida", hub: "sector71" },
  { id: "motherhood", name: "Motherhood Hospital, Sector 41, Noida", hub: "sector71" },
  { id: "mushdh", name: "Yatharth Super Speciality Hospital, Noida Extension", hub: "noidaExtension" },
  { id: "baksaphc", name: "Greater Noida West Primary Health Centre", hub: "noidaExtension" },
  { id: "gores", name: "Metro Hospital, Noida Extension", hub: "noidaExtension" },
  { id: "sec4sub", name: "Sector 4 Sub-Center, Greater Noida West", hub: "noidaExtension" },
  { id: "morigdh", name: "District Combined Hospital, Sector 30, Noida", hub: "sector30" },
  { id: "mayong", name: "Sector 30 Primary Health Centre, Noida", hub: "sector30" },
  { id: "sec31chc", name: "Sector 31 Community Health Centre, Noida", hub: "sector30" },
  { id: "sec21sub", name: "Sector 21 Sub-Center, Noida", hub: "sector30" },
  { id: "ntpcdadri", name: "NTPC Hospital, Dadri", hub: "dadri" },
  { id: "dadrichc", name: "Community Health Centre (CHC), Dadri", hub: "dadri" },
  { id: "bilaspur", name: "Bilaspur Primary Health Centre, Dadri", hub: "dadri" },
  { id: "jarcha", name: "Jarcha Sub-Center, Dadri", hub: "dadri" },
];

export const MEDICINES: CatalogMedicine[] = [
  { id: "oxytocin", name: "Oxytocin Injection", ven: "V", category: "Maternal health" },
  { id: "ors", name: "ORS Sachets", ven: "E", category: "Rehydration" },
  { id: "chlorine", name: "Chlorine Tablets (Water Purification)", ven: "N", category: "Public health supplies" },
  { id: "amox", name: "Amoxicillin 250mg", ven: "E", category: "Antibiotic" },
  { id: "paracetamol", name: "Paracetamol 500mg", ven: "E", category: "Analgesic/antipyretic" },
  { id: "tt", name: "Tetanus Toxoid Injection", ven: "V", category: "Immunisation" },
  { id: "ifa", name: "Iron & Folic Acid (IFA) Tablets", ven: "E", category: "Maternal health" },
  { id: "doxycycline", name: "Doxycycline 100mg", ven: "E", category: "Antibiotic" },
  { id: "artesunate", name: "Artesunate Injection", ven: "V", category: "Antimalarial" },
  { id: "rl", name: "IV Fluids (Ringer Lactate)", ven: "E", category: "Rehydration" },
  { id: "albendazole", name: "Albendazole 400mg", ven: "E", category: "Anthelmintic" },
  { id: "mr", name: "Measles-Rubella (MR) Vaccine", ven: "V", category: "Immunisation" },
  { id: "insulin", name: "Insulin (Human, Regular)", ven: "V", category: "Chronic care" },
  { id: "antivenom", name: "Snake Anti-Venom", ven: "V", category: "Emergency" },
  { id: "multivit", name: "Multivitamin Syrup (Pediatric)", ven: "N", category: "Supportive care" },
  { id: "rabies", name: "Anti-Rabies Vaccine", ven: "V", category: "Emergency" },
  { id: "magsulphate", name: "Magnesium Sulphate Injection", ven: "V", category: "Emergency obstetric care" },
  { id: "zinc", name: "Zinc Sulphate Tablets", ven: "E", category: "Rehydration" },
  { id: "vitA", name: "Vitamin A Solution", ven: "N", category: "Supportive care" },
  { id: "bcg", name: "BCG Vaccine", ven: "V", category: "Immunisation" },
  { id: "hepb", name: "Hepatitis B Vaccine", ven: "V", category: "Immunisation" },
  { id: "metronidazole", name: "Metronidazole 400mg", ven: "E", category: "Antibiotic" },
  { id: "ciprofloxacin", name: "Ciprofloxacin 500mg", ven: "E", category: "Antibiotic" },
  { id: "salbutamol", name: "Salbutamol Inhaler", ven: "E", category: "Respiratory" },
  { id: "calciumgluconate", name: "Calcium Gluconate Injection", ven: "V", category: "Emergency obstetric care" },
];
