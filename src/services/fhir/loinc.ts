/**
 * Small static lookup for common CBC/LFT/metabolic panel tests.
 * Bonus feature per the assignment ("LOINC code lookup for common tests").
 * Matching is done on normalized test name (lowercased, punctuation
 * stripped) against this table and a short list of common synonyms.
 *
 * This is intentionally not exhaustive — a production system would use
 * a full LOINC database with fuzzy/synonym matching. Unmatched tests
 * simply get `text` with no `coding`, which is valid FHIR.
 */
interface LoincEntry {
  code: string;
  display: string;
  synonyms: string[];
}

const LOINC_TABLE: LoincEntry[] = [
  { code: '718-7', display: 'Hemoglobin', synonyms: ['hemoglobin', 'haemoglobin', 'hb', 'hgb'] },
  { code: '4544-3', display: 'Hematocrit', synonyms: ['hematocrit', 'haematocrit', 'hct', 'pcv'] },
  { code: '6690-2', display: 'Leukocytes', synonyms: ['wbc', 'white blood cell count', 'total leucocyte count', 'tlc'] },
  { code: '777-3', display: 'Platelets', synonyms: ['platelet count', 'platelets', 'plt'] },
  { code: '789-8', display: 'Erythrocytes', synonyms: ['rbc', 'red blood cell count'] },
  { code: '2345-7', display: 'Glucose', synonyms: ['glucose', 'blood sugar', 'fasting blood sugar', 'fbs', 'random blood sugar', 'rbs'] },
  { code: '2160-0', display: 'Creatinine', synonyms: ['creatinine', 'serum creatinine'] },
  { code: '3094-0', display: 'Urea Nitrogen', synonyms: ['bun', 'blood urea nitrogen', 'urea'] },
  { code: '1742-6', display: 'Alanine Aminotransferase (ALT)', synonyms: ['alt', 'sgpt', 'alanine aminotransferase'] },
  { code: '1920-8', display: 'Aspartate Aminotransferase (AST)', synonyms: ['ast', 'sgot', 'aspartate aminotransferase'] },
  { code: '1975-2', display: 'Bilirubin Total', synonyms: ['total bilirubin', 'bilirubin total', 'bilirubin'] },
  { code: '2951-2', display: 'Sodium', synonyms: ['sodium', 'na', 'serum sodium'] },
  { code: '2823-3', display: 'Potassium', synonyms: ['potassium', 'k', 'serum potassium'] },
  { code: '2093-3', display: 'Cholesterol Total', synonyms: ['total cholesterol', 'cholesterol total', 'cholesterol'] },
  { code: '2085-9', display: 'HDL Cholesterol', synonyms: ['hdl', 'hdl cholesterol'] },
  { code: '2089-1', display: 'LDL Cholesterol', synonyms: ['ldl', 'ldl cholesterol'] },
  { code: '3016-3', display: 'Thyroid Stimulating Hormone (TSH)', synonyms: ['tsh', 'thyroid stimulating hormone'] },
];

function normalize(name: string): string {
  return name.toLowerCase().replace(/[().]/g, '').replace(/\s+/g, ' ').trim();
}

export function lookupLoinc(testName: string): { code: string; display: string } | null {
  const normalized = normalize(testName);
  for (const entry of LOINC_TABLE) {
    if (entry.synonyms.some((syn) => {
      if (syn.length <= 2) return normalized === syn;
      return normalized === syn || normalized.includes(syn);
    })) {
      return { code: entry.code, display: entry.display };
    }
  }
  return null;
}
