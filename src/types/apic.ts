export type TherapeuticCategory =
  | 'Cardiovascular'
  | 'Oncology / Cytotoxic'
  | 'Central Nervous System'
  | 'Antimicrobial / Antibiotic'
  | 'Immunosuppressant / Immunomodulator'
  | 'Endocrine & Metabolic'
  | 'Respiratory'
  | 'Gastrointestinal'
  | 'Antiviral'
  | 'Anti-inflammatory / Analgesic'
  | 'Steroids & Hormones'
  | 'Anesthetic & Neuromuscular';

export type ManufacturerSegment =
  | 'Big Pharma & Chimica Fine Globale'
  | 'Leader Indiani API Complessi & Export'
  | 'Giganti Chimica Fine & Intermedi Custom'
  | 'CDMO Pure-Play & Sintesi su Commissione';

export type GlobalManufacturer =
  | 'Teva'
  | 'Lonza'
  | 'Pfizer'
  | 'Novartis'
  | 'Axplora'
  | 'Dipharma'
  | 'Curia'
  | 'Olon'
  | 'Sanofi'
  | 'Cambrex'
  | 'Cipla'
  | 'Procos'
  | 'Aurobindo'
  | 'Bayer'
  | 'BASF'
  | "Divi's Laboratories"
  | "Dr. Reddy's"
  | 'Sun Pharma'
  | 'Laurus Labs'
  | 'Lupin'
  | 'Apeloa Pharmaceutical'
  | 'Zhejiang Hengkang'
  | 'Shandong Chenghui'
  | 'Hangzhou Leap Chem'
  | 'Kono Chem'
  | 'Catalent'
  | 'CordenPharma'
  | 'Seqens';

export type OEBLevel = 'OEB 1' | 'OEB 2' | 'OEB 3' | 'OEB 4' | 'OEB 5'; // Occupational Exposure Band

export type CleanabilityRating = 'Easy (Water/Mild)' | 'Moderate (Detergent/CIP)' | 'Difficult (Hot Alkaline/Acid)' | 'Very Difficult (Solvent Reflux/Boil-out)';

export interface IntermediateCompound {
  id: string;
  code: string; // e.g. "ATS-4", "Stage 2 Penultimate"
  name: string;
  chemicalName?: string;
  casNumber?: string;
  stage: 'Starting Material' | 'Early Intermediate' | 'Advanced Intermediate' | 'Penultimate' | 'Impurity / Degradant';
  pdeRatioToApi?: number; // Estimated relative toxicity factor (e.g. 0.5x or 1x or 2x of API)
  pdeValueMg?: number; // mg/day
  cleanability: CleanabilityRating;
  notes?: string;
}

export interface PharmaceuticalCompound {
  id: string;
  name: string; // INN or commercial active name
  chemicalName: string;
  casNumber: string;
  molecularFormula: string;
  molecularWeight: number;
  category: TherapeuticCategory;
  primaryManufacturers: GlobalManufacturer[];
  oeb: OEBLevel;
  pdeMgDay: number; // Permitted Daily Exposure in mg/day
  pdeUgDay: number; // Permitted Daily Exposure in µg/day (pdeMgDay * 1000)
  minDailyDoseMg: number; // Minimum Therapeutic Daily Dose (mg/day)
  maxDailyDoseMg: number; // Maximum Daily Dose (mg/day)
  routeOfAdministration: 'Oral' | 'Parenteral' | 'Inhalation' | 'Topical' | 'Ophthalmic';
  solubilityInWater: 'Freely Soluble' | 'Soluble' | 'Sparingly Soluble' | 'Slightly Soluble' | 'Very Slightly Soluble' | 'Practically Insoluble';
  cleanability: CleanabilityRating;
  toxicologicalClass: 'Non-potent' | 'Cytotoxic' | 'Genotoxic / Mutagenic Alert' | 'Sensitiser' | 'Hormonal / Teratogenic' | 'High Potency (HPAPI)';
  noaelMgKgDay?: number; // No Observed Adverse Effect Level (mg/kg/day)
  fFactors?: {
    f1: number; // Interspecies extrapolation
    f2: number; // Interindividual variability (usually 10)
    f3: number; // Subchronic to chronic duration
    f4: number; // Severe toxicity / teratogenicity / carcinogenicity
    f5: number; // LOAEL to NOAEL extrapolation if NOAEL not established
  };
  recommendedAnalyticalMethod: 'HPLC-UV' | 'LC-MS/MS' | 'UPLC-PDA' | 'TOC' | 'Conductivity' | 'GC-MS';
  defaultSwabRecoveryPercent: number; // e.g. 85%
  suggestedCipCleaningAgent: string; // e.g. "0.5M NaOH at 65°C followed by WFI rinse"
  intermediates: IntermediateCompound[];
  monographReference?: string; // e.g. "EMA/CHMP/CVMP/SWP/169430/2012, APIC Guide 2021"
  isCustom?: boolean;
}

export interface EquipmentTrainConfig {
  name: string;
  sharedSurfaceAreaM2: number; // in m² (e.g. 25 m²)
  swabAreaCm2: number; // standard swab template, e.g. 25 cm² or 100 cm²
  swabRecoveryFactorPercent: number; // e.g. 80% (0.80)
  rinseVolumeLiters: number; // e.g. 500 Liters
  visualCleanInspectionLimitUgCm2: number; // Standard visual limit e.g. 4 µg/cm² or 100 µg/swab
}

export interface MatrixProductItem {
  id: string;
  name: string;
  code?: string;
  casNumber: string;
  type: 'API' | 'Intermediate' | 'Finished Product';
  stage?: string;
  pdeMgDay: number;
  minDailyDoseMg: number; // Min daily dose when product is previous (A)
  maxDailyDoseMg: number; // Max daily dose when product is next (B)
  minBatchSizeKg: number; // Min batch size when product is next (B)
  cleanability: CleanabilityRating;
  solubilityInWater: 'Freely Soluble' | 'Soluble' | 'Sparingly Soluble' | 'Slightly Soluble' | 'Very Slightly Soluble' | 'Practically Insoluble';
  oeb: OEBLevel;
  toxicologicalClass: string;
  notes?: string;
  isFromDatabase?: boolean;
}

export interface FacilityMatrixTrain {
  id: string;
  name: string;
  sharedSurfaceAreaM2: number;
  swabAreaCm2: number;
  swabRecoveryPercent: number;
  rinseVolumeLiters: number;
  visualLimitUgCm2: number;
  safetyFactor: number;
  products: MatrixProductItem[];
}

export type CalculationFormulaMode =
  | 'standard-pde'
  | 'standard-dose'
  | 'standard-10ppm'
  | 'pde-safety-margin'
  | 'bioavailability-adjusted'
  | 'custom-expression';

export interface CalculationAuditStep {
  stepNumber: number;
  title: string;
  formulaTemplate: string;
  formulaSubstituted: string;
  resultString: string;
  explanation: string;
}

export interface CustomFormulaConfig {
  mode: CalculationFormulaMode;
  customExpression: string; // e.g. "(PDE * MBS_KG * 1000000) / (MDD * SF_ADD)"
  additionalSafetyFactor: number; // e.g. 1, 2, 5, 10
  bioavailabilityFactor: number; // e.g. 1.0
  ingestionFactor: number; // e.g. 1.0
  activeModelLabel: string;
}

export interface CasIndexEntry {
  casNumber: string;
  isValidChecksum: boolean;
  name: string;
  isIntermediate: boolean;
  intermediateCode?: string;
  intermediateStage?: string;
  parentCompoundId: string;
  parentCompoundName: string;
  oeb: OEBLevel;
  pdeMgDay: number;
  category: TherapeuticCategory;
  primaryManufacturers: GlobalManufacturer[];
}

export interface ApicCalculationInput {
  previousCompound: PharmaceuticalCompound;
  nextCompoundName: string;
  nextCompoundMinBatchSizeKg: number; // MBS in kg (Minimum Batch Size of product B)
  nextCompoundMaxDailyDoseMg: number; // MDD of product B in mg/day
  equipment: EquipmentTrainConfig;
  safetyFactorDoseMethod: number; // Standard APIC factor: 1000 for oral, 10000 for injectables/parenteral
  targetSwabAreaCm2?: number;
  swabRecoveryPercent?: number;
  rinseVolumeLiters?: number;
  formulaConfig?: CustomFormulaConfig;
}

export interface ApicCalculationResult {
  // MACO values in mg
  macoPdeMg: number;
  macoDoseMg: number;
  maco10PpmMg: number;
  macoCustomMg?: number;
  // Selected limit
  worstCaseCriteria: 'PDE / ADE Approach' | '0.001 Dose Criterion' | '10 ppm General Limit' | 'Formula Personalizzata / Modificata';
  macoSelectedMg: number;
  // Surface and sample limits
  surfaceLimitMgM2: number;
  surfaceLimitUgCm2: number;
  // Swab limit
  swabLimitUgPerSwab: number;
  swabLimitWithRecoveryUgPerSwab: number;
  // Rinse limit
  rinseLimitMgL: number; // mg/L or ppm
  // Visual limit check
  isVisualLimitMoreStringent: boolean;
  visualLimitEffectiveUgCm2: number;
  // Transparent calculation steps & methodology
  auditSteps: CalculationAuditStep[];
  activeFormulaDescription: string;
  isCustomFormulaActive: boolean;
  customFormulaError?: string;
  // Notes and APIC warning checks
  warnings: string[];
}
