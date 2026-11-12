import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateMatrixCsv,
  generateMatrixTsvForGoogleSheets,
  generateMatrixExcelXml,
  generateCalculatorExcelXml,
} from './matrixExport';
import { executeApicChapter4Calculation } from './apicCalculations';
import { FacilityMatrixTrain, ApicChapter4CalculationInput } from '../types/apic';

const mockMatrix: FacilityMatrixTrain = {
  id: 'train-1',
  matrixIndex: 1,
  trainId: 'A-Train',
  name: 'Treno Sintesi API Polivalente 1',
  cleaningClass: 'Class I',
  cleaningSolventNotes: 'Acqua Purificata 65°C',
  sharedSurfaceAreaM2: 25,
  swabAreaCm2: 25,
  swabRecoveryPercent: 85,
  rinseVolumeLiters: 500,
  visualLimitUgCm2: 4.0,
  products: [
    {
      id: 'p1',
      name: 'Atorvastatin Intermediate 04',
      code: 'ATV-INT-04',
      casNumber: '134523-00-5',
      type: 'Intermediate',
      cleanabilityCategory: 3,
      cleanabilityRationale: 'Residuo vischioso su pareti reattore',
      solubilityGroup: 3,
      solubilityDescription: 'Acqua PW',
      pdeUgDay: 5,
      pdeMgDay: 0.005,
      pdeGroup: 4,
      minDailyDoseMg: 2,
      doseGroup: 3,
      minBatchSizeKg: 100,
      maxDailyDoseMg: 80,
    },
    {
      id: 'p2',
      name: 'Rosuvastatin Calcium',
      code: 'RSV-API-01',
      casNumber: '147098-20-2',
      type: 'API',
      cleanabilityCategory: 2,
      cleanabilityRationale: 'Facilmente asportabile con lavaggio basico',
      solubilityGroup: 2,
      solubilityDescription: 'Acqua PW',
      pdeUgDay: 15,
      pdeMgDay: 0.015,
      pdeGroup: 3,
      minDailyDoseMg: 5,
      doseGroup: 3,
      minBatchSizeKg: 50,
      maxDailyDoseMg: 40,
    },
  ],
};

test('generateMatrixCsv includes UTF-8 BOM, matrix metadata, products, and worst-case transition', () => {
  const csv = generateMatrixCsv(mockMatrix, 1);
  assert.ok(csv.startsWith('\uFEFF')); // UTF-8 BOM
  assert.ok(csv.includes('A-Train'));
  assert.ok(csv.includes('Class I'));
  assert.ok(csv.includes('Atorvastatin Intermediate 04'));
  assert.ok(csv.includes('134523-00-5'));
  assert.ok(csv.includes('Cat 3'));
  assert.ok(csv.includes('Grp 3'));
  assert.ok(csv.includes('Residuo vischioso su pareti reattore'));
  assert.ok(csv.includes('Rosuvastatin Calcium'));
  assert.ok(csv.includes('AUDIT TRAIL'));
  assert.ok(csv.includes('WORST CASE'));
});

test('generateMatrixTsvForGoogleSheets contains tab characters and structured sections for instant paste', () => {
  const tsv = generateMatrixTsvForGoogleSheets(mockMatrix, 1);
  assert.ok(tsv.includes('\t'));
  assert.ok(tsv.includes('A-Train'));
  assert.ok(tsv.includes('Atorvastatin Intermediate 04'));
  assert.ok(tsv.includes('Rosuvastatin Calcium'));
  assert.ok(tsv.includes('--- SINTESI WORST-CASE IDENTIFICATI ---'));
  assert.ok(tsv.includes('--- TABELLA PRODOTTI E RATING APIC ---'));
  assert.ok(tsv.includes('--- MATRICE DELLE COMBINAZIONI CROSS-CARRYOVER (A -> B) ---'));
});

test('generateMatrixExcelXml produces dynamic XML Spreadsheet with live formulas and worksheets', () => {
  const xml = generateMatrixExcelXml(mockMatrix, 1);
  assert.ok(xml.includes('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.ok(xml.includes('<Workbook'));
  assert.ok(xml.includes('ss:Name="Matrice &amp; Transizioni"'));
  assert.ok(xml.includes('ss:Name="Prodotti &amp; Criteri APIC"'));
  assert.ok(xml.includes('ss:Name="Calcolatore MACO Cap 4.0"'));
  assert.ok(xml.includes('ss:Formula="=(RC[-4]/1000)*RC[-2]/RC[-1]"')); // MACO HBEL formula
  assert.ok(xml.includes('ss:Formula="=MIN(RC[-3],RC[-2],RC[-1])"')); // Governing MACO formula
  assert.ok(xml.includes('ss:Formula="=(RC[-1]*R5C2/(R4C2*10000))*(R6C2/100)*1000"')); // Swab formula
  assert.ok(xml.includes('Atorvastatin Intermediate 04'));
  assert.ok(xml.includes('Rosuvastatin Calcium'));
  assert.ok(xml.includes('WORST CASE'));
});

test('generateCalculatorExcelXml creates standalone dynamic Excel workbook with formulas from Calculator input', () => {
  const calcInput: ApicChapter4CalculationInput = {
    hbelMgDay: 0.15,
    hbelSource: 'PDE / ADE convalidato',
    nextMaterialMbsKg: 250,
    nextMaterialTddMg: 40,
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
  };
  const calcResult = executeApicChapter4Calculation(calcInput);
  const xml = generateCalculatorExcelXml(calcInput, calcResult, {
    trainId: 'A-Train',
    name: 'Linea Convalidata',
  });

  assert.ok(xml.includes('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.ok(xml.includes('<Workbook'));
  assert.ok(xml.includes('ss:Name="Calcolatore MACO Cap 4.0"'));
  assert.ok(xml.includes('ss:Formula="=(R13C2*R15C2*R20C2)/(R21C2*R16C2)"')); // HBEL calculation
  assert.ok(xml.includes('ss:Formula="=(R14C2/1000)*R20C2/R21C2"')); // Dose calculation
  assert.ok(xml.includes('ss:Formula="=MIN(R25C2,R26C2,R27C2)"')); // Governing MACO
  assert.ok(xml.includes('ss:Formula="=(R28C2*R5C2/(R4C2*10000))*(R6C2/100)*1000"')); // Swab limit formula
  assert.ok(xml.includes('ss:Formula="=R28C2/R7C2"')); // Rinse limit formula
  assert.ok(xml.includes('A-Train'));
});
