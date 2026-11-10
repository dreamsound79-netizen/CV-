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
