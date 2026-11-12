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

export type CleaningClass =
  | 'Class I' // water soluble substances
  | 'Class II' // methanol soluble substances
  | 'Class III' // acetone soluble substances
  | 'Class IV'; // separate class for special substances with defined solubility

export type HardestToCleanCategory = 1 | 2 | 3; // 1 = Easy, 2 = Medium, 3 = Difficult
export type SolubilityGroup = 1 | 2 | 3; // USP 24: 1 = Very/Freely soluble, 2 = Soluble/Sparingly, 3 = Slightly/Practically insoluble
export type AdePdeGroup = 1 | 2 | 3 | 4 | 5; // 1: >500 µg, 2: 100-500 µg, 3: 10-99 µg, 4: 1-9 µg, 5: <1 µg
export type DoseGroup = 1 | 2 | 3 | 4 | 5; // 1: >1000 mg, 2: 100-1000 mg, 3: 10-99 mg, 4: 1-9 mg, 5: <1 mg

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
  // APIC Criterion a: Hardest to clean experience from production
  cleanabilityCategory: HardestToCleanCategory; // 1 = Easy, 2 = Medium, 3 = Difficult
  cleanabilityRationale?: string; // Subjective operator/supervisor interview rationale supported by science
  // APIC Criterion b: Solubility in used solvent (USP 24)
  solubilityGroup: SolubilityGroup; // 1 = Very/Freely soluble, 2 = Soluble/Sparingly, 3 = Insoluble/Practically insoluble
  solubilityDescription?: string; // e.g. "Freely soluble in methanol (<10 parts)"
  // APIC Criterion c: Lowest Acceptable Daily Exposure (ADE) or Permitted Daily Exposure (PDE)
  pdeUgDay: number; // ADE / PDE in µg/day
  pdeMgDay: number; // ADE / PDE in mg/day (pdeUgDay / 1000)
  pdeGroup: AdePdeGroup; // Group 1 to 5
  // APIC Criterion d: Smallest therapeutic dose
  minDailyDoseMg: number; // Smallest therapeutic dose (TDD) in mg
  doseGroup: DoseGroup; // Group 1 to 5
  // Next product parameters (when this product is next in sequence B)
  maxDailyDoseMg: number; // MDD of next product (mg/day)
  minBatchSizeKg: number; // MBS of next product (kg)
  oeb?: OEBLevel;
  toxicologicalClass?: string;
  notes?: string;
  isFromDatabase?: boolean;
}

export interface FacilityMatrixTrain {
  id: string;
  matrixIndex: number; // 1 to 10
  trainId: string; // e.g. "A-Train", "B-Train", "C-Train", etc.
  name: string;
  cleaningClass: CleaningClass;
  cleaningSolventNotes?: string; // e.g. "Acqua purificata a 65°C", "Metanolo di lavaggio", "Acetone tecnico"
  sharedSurfaceAreaM2: number;
  swabAreaCm2: number;
  swabRecoveryPercent: number;
  rinseVolumeLiters: number;
  visualLimitUgCm2: number;
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

export interface EquipmentSegmentSwabItem {
  id: string;
  name: string; // e.g. "Reattore R-101 (Acciaio Inox 316L)", "Condensatore C-102", "Filtro Nutsche"
  areaDm2: number; // Ai in dm²
  material: 'Stainless Steel 316L' | 'Glass-Lined / Smaltato' | 'Hastelloy' | 'PTFE / Teflon' | 'EPDM / Silicone';
  measuredSwabResidueUgDm2?: number; // mi in µg/dm²
  expectedMaxResidueUgDm2?: number; // Maximum expected residue for this specific part
}

export interface RinseVerificationSample {
  rinseVolumeLiters: number; // V in L
  sampleImpurityConcMgL: number; // C in mg/L
  blankSolventConcMgL: number; // Cb in mg/L
}

export interface ApicChapter4CalculationInput {
  // 4.2.1 Health-based data
  hbelMgDay: number; // HBEL previous in mg/day (or ADE/PDE)
  hbelSource: 'PDE / ADE convalidato' | 'NOAEL / LOAEL' | 'LD50 estrapolato' | 'TTC Dolan (1, 10, 100 µg)';
  nextMaterialMbsKg: number; // MBSnext in kg
  nextMaterialTddMg: number; // TDDnext in mg/day
  purgingFactor: number; // PF (default 1)
  safetyFactorHbel: number; // SF (default 1)

  // 4.2.2 General limit
  generalLimitPpm: number; // MAXCONC in ppm (default 10 ppm, 100 ppm, or custom 5-500)

  // 4.2.3 Therapeutic macromolecules & peptides / dose criterion
  previousMaterialTddMg: number; // TDDprevious in mg/day
  doseSafetyFactor: number; // SF: 1000 standard, 10000 parenteral
  isMacromoleculeOrPeptide: boolean;

  // 4.2.6 Chemical production factor
  chemicalProductionFactor: number; // 1x (standard / finished / physical) up to 10x (chemical synthesis)
  chemicalFactorJustification?: string;

  // Equipment & sampling parameters (4.2.4 & 4.2.5)
  totalSurfaceAreaM2: number; // Total shared contact surface in m²
  swabTemplateAreaCm2: number; // e.g. 25 cm²
  swabRecoveryRatePercent: number; // e.g. 85%
  rinseVolumeLiters: number; // e.g. 500 L
  visualCleanlinessThresholdUgCm2: number; // Standard 4.0 µg/cm²

  // Optional multi-equipment segmentation for Equation 4.2.5-II
  segments?: EquipmentSegmentSwabItem[];

  // Optional rinse verification test for Equation 5
  rinseVerification?: RinseVerificationSample;
}

export interface ApicChapter4CalculationResult {
  // 4.2.1 HBEL MACO
  macoHbelMg: number;
  macoHbelWithChemicalFactorMg: number;
  // 4.2.2 General limit MACO
  maco10PpmMg: number;
  maco100PpmMg: number;
  macoCustomPpmMg: number;
  // 4.2.3 Therapeutic macromolecules / dose criterion MACO
  macoDoseMg: number;
  macoMacromoleculeSelectedMg: number;
  // Governing criteria
  governingCriteria:
    | '4.2.1 Dati Tossicologici HBEL (ADE/PDE)'
    | '4.2.2 Limite Generale (10 ppm)'
    | '4.2.2 Limite Generale (100 ppm)'
    | '4.2.3 Criterio Dose / Macromolecole (1/1000)';
  governingMacoMg: number;
  // 4.2.4 Swab limits
  totalSurfaceAreaDm2: number;
  swabTargetValueUgDm2: number;
  swabTargetValueUgCm2: number;
  swabLimitPerTemplateUg: number;
  swabLimitWithRecoveryUg: number;
  totalSwabCarryOverUg?: number;
  isTotalSwabWithinMaco?: boolean;
  // 4.2.5 Rinse limits
  rinseTargetValueMgL: number;
  measuredRinseCarryOverMg?: number;
  isRinseWithinTarget?: boolean;
  // 4.1 Visual clean check
  isVisualLimitMoreStringent: boolean;
  visualCleanlinessThresholdUgCm2: number;
  // Detailed audit trail steps
  auditSteps: CalculationAuditStep[];
  warnings: string[];
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

