import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePDE,
  calculateMACOByPDE,
  calculateMACOByDose,
  calculateMACOBy10Ppm,
  executeApicCalculation,
  calculateWorstCaseScore,
  validateCasChecksum,
  buildCasIndex,
  evaluateCustomExpression,
  getAdePdeGroup,
  getTherapeuticDoseGroup,
  evaluateAllMatrixCombinations,
  executeApicChapter4Calculation,
} from './apicCalculations';
import { PharmaceuticalCompound } from '../types/apic';

test('PDE formula calculates correctly with standard factors', () => {
  const result = calculatePDE(10, 50, 5, 10, 1, 1, 1);
  assert.equal(result.pdeMgDay, 10);
  assert.equal(result.pdeUgDay, 10000);
});

test('PDE formula calculates low-potency compound with multiple safety factors', () => {
  const result = calculatePDE(0.5, 50, 12, 10, 5, 2, 1);
  assert.ok(Math.abs(result.pdeMgDay - 0.020833) < 0.001);
  assert.ok(Math.abs(result.pdeUgDay - 20.833) < 0.01);
});

test('MACO by PDE correctly computes carryover across batches', () => {
  const maco = calculateMACOByPDE(0.1, 500, 100);
  assert.equal(maco, 500000);
});

test('MACO by 10 ppm general limit', () => {
  const maco10ppm = calculateMACOBy10Ppm(250);
  assert.equal(maco10ppm, 2500);
});

test('MACO by Dose 1/1000th factor', () => {
  const macoDose = calculateMACOByDose(20, 100, 50, 1000);
  assert.equal(macoDose, 40000);
});

test('CAS Checksum validator validates authentic CAS numbers and detects invalid ones', () => {
  // Paracetamol: 103-90-2 -> Valid
  const res1 = validateCasChecksum('103-90-2');
  assert.equal(res1.isValid, true);
  assert.equal(res1.isCasFormat, true);
  assert.equal(res1.checkDigit, 2);

  // Aspirin: 50-78-2 -> Valid
  const res2 = validateCasChecksum('50-78-2');
  assert.equal(res2.isValid, true);
  assert.equal(res2.checkDigit, 2);

  // Water: 7732-18-5 -> Valid
  const res3 = validateCasChecksum('7732-18-5');
  assert.equal(res3.isValid, true);
  assert.equal(res3.checkDigit, 5);

  // Atorvastatin: 134523-00-5 -> Valid
  const res4 = validateCasChecksum('134523-00-5');
  assert.equal(res4.isValid, true);

  // Invalid check digit: 103-90-5 (should be 2)
  const resInvalid = validateCasChecksum('103-90-5');
  assert.equal(resInvalid.isValid, false);
  assert.equal(resInvalid.isCasFormat, true);
  assert.equal(resInvalid.calculatedCheckDigit, 2);

  // Non-CAS format internal code: 'INT-ATV-04'
  const resInternal = validateCasChecksum('INT-ATV-04');
  assert.equal(resInternal.isValid, false);
  assert.equal(resInternal.isCasFormat, false);
});

test('buildCasIndex indexes both parent APIs and synthesis intermediates', () => {
  const mockApi: PharmaceuticalCompound = {
    id: 'api-1',
    name: 'Atorvastatin Calcium',
    chemicalName: 'Atorvastatin',
    casNumber: '134523-00-5',
    molecularFormula: 'C66H68CaF2N4O10',
    molecularWeight: 1155.34,
    category: 'Cardiovascular',
    primaryManufacturers: ['Teva', 'Pfizer'],
    oeb: 'OEB 3',
    pdeMgDay: 0.15,
    pdeUgDay: 150,
    minDailyDoseMg: 10,
    maxDailyDoseMg: 80,
    routeOfAdministration: 'Oral',
    solubilityInWater: 'Very Slightly Soluble',
    cleanability: 'Moderate (Detergent/CIP)',
    toxicologicalClass: 'Non-potent',
    recommendedAnalyticalMethod: 'HPLC-UV',
    defaultSwabRecoveryPercent: 88,
    suggestedCipCleaningAgent: '0.2M NaOH',
    intermediates: [
      {
        id: 'int-1',
        code: 'ATS-4',
        name: 'Atorvastatin Diketone Precursor',
        casNumber: '125971-96-2',
        stage: 'Penultimate',
        pdeRatioToApi: 1.0,
        cleanability: 'Moderate (Detergent/CIP)',
      },
      {
        id: 'int-2',
        code: 'INT-START',
        name: 'Early Synthesis Pyrrole Ring',
        stage: 'Starting Material',
        cleanability: 'Easy (Water/Mild)',
      },
    ],
  };

  const index = buildCasIndex([mockApi]);
  assert.equal(index.length, 3); // 1 parent API + 2 intermediates

  const parentEntry = index.find((e) => !e.isIntermediate);
  assert.ok(parentEntry);
  assert.equal(parentEntry?.casNumber, '134523-00-5');
  assert.equal(parentEntry?.isValidChecksum, true);

  const penultimateEntry = index.find((e) => e.intermediateCode === 'ATS-4');
  assert.ok(penultimateEntry);
  assert.equal(penultimateEntry?.casNumber, '125971-96-2');

  const startEntry = index.find((e) => e.intermediateCode === 'INT-START');
  assert.ok(startEntry);
  assert.equal(startEntry?.casNumber, 'INT-INT-START');
});

test('evaluateCustomExpression parses variables and arithmetic accurately', () => {
  const context = {
    PDE: 0.05,
    MBS_KG: 200,
    MDD: 10,
    SF_ADD: 2,
  };

  // Standard PDE formula: (0.05 * 200 * 1000000) / 10 = 1,000,000
  const eval1 = evaluateCustomExpression('(PDE * MBS_KG * 1000000) / MDD', context);
  assert.equal(eval1.error, undefined);
  assert.equal(eval1.result, 1000000);

  // Additional safety factor: ((0.05 * 200 * 1000000) / MDD) / SF_ADD = 500,000
  const eval2 = evaluateCustomExpression('((PDE * MBS_KG * 1000000) / MDD) / SF_ADD', context);
  assert.equal(eval2.error, undefined);
  assert.equal(eval2.result, 500000);

  // Unknown variable error
  const eval3 = evaluateCustomExpression('PDE * UNKNOWN_VAR', context);
  assert.ok(eval3.error);
  assert.ok(eval3.error.includes('UNKNOWN_VAR'));

  // Division by zero error
  const eval4 = evaluateCustomExpression('100 / 0', context);
  assert.ok(eval4.error);
  assert.ok(eval4.error.includes('Divisione per zero'));
});

test('executeApicCalculation produces explicit audit trail steps and supports custom formula', () => {
  const dummyApi: PharmaceuticalCompound = {
    id: 'test-1',
    name: 'Test API Active',
    chemicalName: 'Test chemical',
    casNumber: '103-90-2',
    molecularFormula: 'C8H9NO2',
    molecularWeight: 151.16,
    category: 'Anti-inflammatory / Analgesic',
    primaryManufacturers: ['Sanofi'],
    oeb: 'OEB 1',
    pdeMgDay: 2.5,
    pdeUgDay: 2500,
    minDailyDoseMg: 500,
    maxDailyDoseMg: 4000,
    routeOfAdministration: 'Oral',
    solubilityInWater: 'Soluble',
    cleanability: 'Easy (Water/Mild)',
    toxicologicalClass: 'Non-potent',
    recommendedAnalyticalMethod: 'HPLC-UV',
    defaultSwabRecoveryPercent: 90,
    suggestedCipCleaningAgent: 'PW at 60C',
    intermediates: [],
  };

  // Run with custom formula mode
  const result = executeApicCalculation({
    previousCompound: dummyApi,
    nextCompoundName: 'Next Product B',
    nextCompoundMinBatchSizeKg: 500,
    nextCompoundMaxDailyDoseMg: 50,
    equipment: {
      name: 'Train A',
      sharedSurfaceAreaM2: 25,
      swabAreaCm2: 25,
      swabRecoveryFactorPercent: 85,
      rinseVolumeLiters: 500,
      visualCleanInspectionLimitUgCm2: 4.0,
    },
    safetyFactorDoseMethod: 1000,
    formulaConfig: {
      mode: 'pde-safety-margin',
      customExpression: '(PDE * MBS_KG * 1000000) / (MDD * SF_ADD)',
      additionalSafetyFactor: 5,
      bioavailabilityFactor: 1.0,
      ingestionFactor: 1.0,
      activeModelLabel: 'PDE con Margine Addizionale SF_add=5',
    },
  });

  // Check audit steps
  assert.ok(result.auditSteps.length >= 7);
  assert.ok(result.auditSteps[0].formulaTemplate.includes('MACO'));
  assert.ok(result.auditSteps[0].formulaSubstituted.includes('5'));
  assert.equal(result.isCustomFormulaActive, true);
  assert.ok(result.macoSelectedMg > 0);
  assert.ok(result.surfaceLimitUgCm2 > 0);
  assert.ok(result.swabLimitWithRecoveryUgPerSwab > 0);
});

test('APIC Chapter 7 ADE/PDE groups and Dose groups are classified accurately', () => {
  // Test ADE/PDE groups (1: >500µg, 2: 100-500µg, 3: 10-99µg, 4: 1-9µg, 5: <1µg)
  assert.equal(getAdePdeGroup(1000), 1);
  assert.equal(getAdePdeGroup(501), 1);
  assert.equal(getAdePdeGroup(500), 2);
  assert.equal(getAdePdeGroup(150), 2);
  assert.equal(getAdePdeGroup(99), 3);
  assert.equal(getAdePdeGroup(10), 3);
  assert.equal(getAdePdeGroup(9), 4);
  assert.equal(getAdePdeGroup(1), 4);
  assert.equal(getAdePdeGroup(0.5), 5);

  // Test Smallest Therapeutic Dose groups (1: >1000mg, 2: 100-1000mg, 3: 10-99mg, 4: 1-9mg, 5: <1mg)
  assert.equal(getTherapeuticDoseGroup(2000), 1);
  assert.equal(getTherapeuticDoseGroup(1000), 2);
  assert.equal(getTherapeuticDoseGroup(500), 2);
  assert.equal(getTherapeuticDoseGroup(99), 3);
  assert.equal(getTherapeuticDoseGroup(10), 3);
  assert.equal(getTherapeuticDoseGroup(9), 4);
  assert.equal(getTherapeuticDoseGroup(1), 4);
  assert.equal(getTherapeuticDoseGroup(0.2), 5);
});

test('evaluateAllMatrixCombinations evaluates all A -> B pairs and identifies the worst-case', () => {
  const prodA: any = {
    id: 'p1',
    name: 'Product A (Toxic & Hard to clean)',
    cleanabilityCategory: 3, // Difficult
    solubilityGroup: 3, // Insoluble
    pdeUgDay: 5, // Grp 4 (1-9 µg)
    pdeMgDay: 0.005,
    pdeGroup: 4,
    minDailyDoseMg: 2, // Grp 4 (1-9 mg)
    doseGroup: 4,
    minBatchSizeKg: 100,
    maxDailyDoseMg: 50,
  };

  const prodB: any = {
    id: 'p2',
    name: 'Product B (Easy to clean & High Batch Size)',
    cleanabilityCategory: 1, // Easy
    solubilityGroup: 1, // Soluble
    pdeUgDay: 1000, // Grp 1 (>500 µg)
    pdeMgDay: 1.0,
    pdeGroup: 1,
    minDailyDoseMg: 500, // Grp 2
    doseGroup: 2,
    minBatchSizeKg: 50, // Smaller batch size = more stringent MACO
    maxDailyDoseMg: 100, // Higher daily dose = more stringent MACO
  };

  const prodC: any = {
    id: 'p3',
    name: 'Product C (Intermediate)',
    cleanabilityCategory: 2,
    solubilityGroup: 2,
    pdeUgDay: 200,
    pdeMgDay: 0.2,
    pdeGroup: 2,
    minDailyDoseMg: 50,
    doseGroup: 3,
    minBatchSizeKg: 300,
    maxDailyDoseMg: 20,
  };

  const evaluation = evaluateAllMatrixCombinations([prodA, prodB, prodC], {
    sharedSurfaceAreaM2: 25,
    swabAreaCm2: 25,
    swabRecoveryPercent: 85,
    rinseVolumeLiters: 500,
  });

  // 3 products -> 3 * 2 = 6 combinations
  assert.equal(evaluation.combinations.length, 6);

  // Worst-case combination should have isWorstCase = true
  assert.ok(evaluation.worstCaseCombination);
  assert.equal(evaluation.worstCaseCombination?.isWorstCase, true);

  // Transition prodA -> prodB has the lowest MACO:
  // MACO(A->B) PDE = (0.005 * 50 * 1000000) / 100 = 2500 mg
  // MACO(A->B) Dose = (2 * 50 * 1000000) / (1000 * 100) = 1000 mg
  // MACO(A->B) 10ppm = 10 * 50 = 500 mg (most stringent)
  assert.equal(evaluation.worstCaseCombination?.fromProduct.id, 'p1');
  assert.equal(evaluation.worstCaseCombination?.toProduct.id, 'p2');
  assert.equal(evaluation.worstCaseCombination?.macoSelectedMg, 500);
  assert.equal(evaluation.worstCaseCombination?.governingCriteria, '10 ppm');

  // Verify worst residue identification (Product A has highest cleanability + toxicity challenge)
  assert.equal(evaluation.worstResidueProduct?.id, 'p1');
});

test('APIC Chapter 4.0: Example 3 Page 21 HBEL & General Limit & Swab/Rinse calculations', () => {
  // Test scenario matching APIC Guide 2021 Example 3 (Par. 4.2.1 / 4.2.5)
  // HBEL = 2 ug/day = 0.002 mg/day
  // Next product TDD = 250 mg/day
  // MBS = 50 kg -> 50,000,000 mg
  // Shared Surface = 25 m2 = 2500 dm2
  // Swab area = 25 cm2 (5x5 cm), Recovery WF = 85%
  // Rinse volume = 500 L
  const result = executeApicChapter4Calculation({
    hbelMgDay: 0.002, // 2 ug/day
    hbelSource: 'PDE / ADE convalidato',
    nextMaterialMbsKg: 50,
    nextMaterialTddMg: 250,
    purgingFactor: 1,
    safetyFactorHbel: 1,
    generalLimitPpm: 10,
    previousMaterialTddMg: 10,
    doseSafetyFactor: 1000,
    isMacromoleculeOrPeptide: false,
    chemicalProductionFactor: 1,
    totalSurfaceAreaM2: 25,
    swabTemplateAreaCm2: 25,
    swabRecoveryRatePercent: 85,
    rinseVolumeLiters: 500,
    visualCleanlinessThresholdUgCm2: 4.0,
  });

  // HBEL MACO: (0.002 mg * 50,000,000 mg * 1) / (250 mg * 1) = 400 mg
  assert.equal(result.macoHbelMg, 400);

  // General Limit 10 ppm: 10 * 50 = 500 mg
  assert.equal(result.maco10PpmMg, 500);

  // General Limit 100 ppm: 100 * 50 = 5000 mg
  assert.equal(result.maco100PpmMg, 5000);

  // Governing MACO: min(400, 500) = 400 mg (HBEL criterion)
  assert.equal(result.governingMacoMg, 400);
  assert.equal(result.governingCriteria, '4.2.1 Dati Tossicologici HBEL (ADE/PDE)');

  // Swab Target (Equation 4.2.5-I):
  // MACO = 400 mg = 400,000 ug
  // Surface = 25 m2 = 2,500 dm2 = 250,000 cm2
  // Target [ug/dm2] = 400,000 / 2,500 = 160 ug/dm2
  // Target [ug/cm2] = 160 / 100 = 1.6 ug/cm2
  assert.equal(result.swabTargetValueUgDm2, 160);
  assert.equal(result.swabTargetValueUgCm2, 1.6);

  // Swab Limit per test template (25 cm2): 1.6 * 25 = 40 ug
  assert.equal(result.swabLimitPerTemplateUg, 40);
  // With 85% analytical recovery: 40 * 0.85 = 34 ug
  assert.equal(result.swabLimitWithRecoveryUg, 34);

  // Rinse Target: 400 mg / 500 L = 0.8 mg/L (ppm)
  assert.equal(result.rinseTargetValueMgL, 0.8);

  // Visually clean comparison (Par. 4.1):
  // Swab target limit (1.6 ug/cm2) is lower than visual threshold (4.0 ug/cm2),
  // so visual inspection is NOT more stringent than the analytical limit; analytical testing is required.
  assert.equal(result.isVisualLimitMoreStringent, false);
});

test('APIC Chapter 4.0: Chemical synthesis reduction factor (Par. 4.2.6) and Purging Factor', () => {
  // If chemical synthesis involves reactive workup, PF=5 and Chemical Factor = 5x
  const result = executeApicChapter4Calculation({
    hbelMgDay: 0.01, // 10 ug/day
    hbelSource: 'PDE / ADE convalidato',
    nextMaterialMbsKg: 100,
    nextMaterialTddMg: 100,
    purgingFactor: 5,
    safetyFactorHbel: 1,
    generalLimitPpm: 10,
    previousMaterialTddMg: 50,
    doseSafetyFactor: 1000,
    isMacromoleculeOrPeptide: false,
    chemicalProductionFactor: 5,
    chemicalFactorJustification: '3 successive crystallization and distillation steps',
    totalSurfaceAreaM2: 50,
    swabTemplateAreaCm2: 25,
    swabRecoveryRatePercent: 85,
    rinseVolumeLiters: 1000,
    visualCleanlinessThresholdUgCm2: 4.0,
  });

  // Base HBEL MACO: (0.010 mg * 100,000,000 mg * 5) / (100 mg * 1) = 50,000 mg
  assert.equal(result.macoHbelMg, 50000);
  // With chemical factor 5x: 50,000 * 5 = 250,000 mg
  assert.equal(result.macoHbelWithChemicalFactorMg, 250000);
});

test('APIC Chapter 4.0: Therapeutic macromolecules and peptides (Par. 4.2.3)', () => {
  // Therapeutic macromolecules: dose 1/1000th combined with 10 ppm cap
  const result = executeApicChapter4Calculation({
    hbelMgDay: 0,
    hbelSource: 'PDE / ADE convalidato',
    nextMaterialMbsKg: 20, // 20 kg
    nextMaterialTddMg: 10,
    purgingFactor: 1,
    safetyFactorHbel: 1,
    generalLimitPpm: 10,
    previousMaterialTddMg: 50,
    doseSafetyFactor: 1000, // 1/1000th dose
    isMacromoleculeOrPeptide: true,
    chemicalProductionFactor: 1,
    totalSurfaceAreaM2: 20,
    swabTemplateAreaCm2: 25,
    swabRecoveryRatePercent: 85,
    rinseVolumeLiters: 500,
    visualCleanlinessThresholdUgCm2: 4.0,
  });

  // Dose MACO: (50 * 20,000,000) / (1000 * 10) = 100,000 mg
  assert.equal(result.macoDoseMg, 100000);

  // 10 ppm cap: 10 * 20 = 200 mg
  assert.equal(result.maco10PpmMg, 200);

  // For macromolecules, 10 ppm cap governs when dose MACO is higher:
  assert.equal(result.macoMacromoleculeSelectedMg, 200);
  assert.equal(result.governingMacoMg, 200);
});

test('APIC Chapter 4.0: Segmented Equipment Swab (Equation 4.2.5-II) and Rinse Verification (Equation 5)', () => {
  const result = executeApicChapter4Calculation({
    hbelMgDay: 0.001, // 1 ug/day
    hbelSource: 'PDE / ADE convalidato',
    nextMaterialMbsKg: 100,
    nextMaterialTddMg: 50,
    purgingFactor: 1,
    safetyFactorHbel: 1,
    generalLimitPpm: 10,
    previousMaterialTddMg: 10,
    doseSafetyFactor: 1000,
    isMacromoleculeOrPeptide: false,
    chemicalProductionFactor: 1,
    totalSurfaceAreaM2: 30, // 3000 dm2
    swabTemplateAreaCm2: 25,
    swabRecoveryRatePercent: 85,
    rinseVolumeLiters: 1000,
    visualCleanlinessThresholdUgCm2: 4.0,
    segments: [
      { id: '1', name: 'Reactor R-01', material: 'Stainless Steel 316L', areaDm2: 1200, measuredSwabResidueUgDm2: 15 },
      { id: '2', name: 'Centrifuge C-01', material: 'Stainless Steel 316L', areaDm2: 800, measuredSwabResidueUgDm2: 20 },
      { id: '3', name: 'Dryer D-01', material: 'Hastelloy', areaDm2: 1000, measuredSwabResidueUgDm2: 10 },
    ],
    rinseVerification: {
      rinseVolumeLiters: 1000,
      sampleImpurityConcMgL: 0.8,
      blankSolventConcMgL: 0.1,
    },
  });

  // MACO = (0.001 mg * 100,000,000 mg) / 50 mg = 2000 mg = 2,000,000 ug
  // Eq 4.2.5-II: Total Carryover = (1200 * 15) + (800 * 20) + (1000 * 10)
  // = 18,000 + 16,000 + 10,000 = 44,000 ug
  assert.equal(result.totalSwabCarryOverUg, 44000);
  assert.equal(result.isTotalSwabWithinMaco, true);

  // Eq 5: Rinse verification Carryover = V * (C - C_blank) = 1000 * (0.8 - 0.1) = 700 mg
  // Rinse Target = 2000 mg / 1000 L = 2.0 mg/L -> Target carryover allowed is 2000 mg
  // Since 700 mg < 2000 mg -> isRinseWithinTarget is true
  assert.equal(result.measuredRinseCarryOverMg, 700);
  assert.equal(result.isRinseWithinTarget, true);
});

