import {
  ApicCalculationInput,
  ApicCalculationResult,
  PharmaceuticalCompound,
  CleanabilityRating,
  CasIndexEntry,
  CalculationAuditStep,
  CustomFormulaConfig,
  HardestToCleanCategory,
  SolubilityGroup,
  AdePdeGroup,
  DoseGroup,
  MatrixProductItem,
  ApicChapter4CalculationInput,
  ApicChapter4CalculationResult,
  EquipmentSegmentSwabItem,
  RinseVerificationSample,
} from '../types/apic';

/**
 * Validates a CAS Registry Number using official CAS Modulo-10 checksum algorithm.
 * Format: [2 to 7 digits]-[2 digits]-[1 digit]
 * Digits before check digit are weighted by position from right to left (1, 2, 3...)
 * Check digit = (sum of digit * position) % 10
 */
export function validateCasChecksum(cas: string): {
  isValid: boolean;
  isCasFormat: boolean;
  checkDigit?: number;
  calculatedCheckDigit?: number;
  reason?: string;
} {
  if (!cas || typeof cas !== 'string') {
    return { isValid: false, isCasFormat: false, reason: 'Numero CAS assente o vuoto' };
  }

  const trimmed = cas.trim();
  const casPattern = /^(\d{2,7})-(\d{2})-(\d{1})$/;
  const match = trimmed.match(casPattern);

  if (!match) {
    return {
      isValid: false,
      isCasFormat: false,
      reason: 'Formato non conforme allo standard CAS (deve essere NNNNNN-NN-N o codice interno)',
    };
  }

  const prefix = match[1];
  const middle = match[2];
  const checkDigitStr = match[3];

  const digitsBeforeCheck = (prefix + middle).split('').map((d) => parseInt(d, 10));
  const expectedCheckDigit = parseInt(checkDigitStr, 10);

  // Position weights from right to left (1 for rightmost before check digit, 2 for next, etc.)
  let sum = 0;
  const n = digitsBeforeCheck.length;
  for (let i = 0; i < n; i++) {
    const weight = n - i; // weight from right to left
    sum += digitsBeforeCheck[i] * weight;
  }

  const calculatedCheckDigit = sum % 10;
  const isValid = calculatedCheckDigit === expectedCheckDigit;

  return {
    isValid,
    isCasFormat: true,
    checkDigit: expectedCheckDigit,
    calculatedCheckDigit,
    reason: isValid
      ? 'Numero CAS conforme con checksum modulo-10 verificato'
      : `Checksum non valido: check digit atteso ${calculatedCheckDigit}, riscontrato ${expectedCheckDigit}`,
  };
}

/**
 * Builds a comprehensive, searchable CAS Index across all APIs and their synthesis intermediates.
 */
export function buildCasIndex(compounds: PharmaceuticalCompound[]): CasIndexEntry[] {
  const indexEntries: CasIndexEntry[] = [];
  const seenKeys = new Set<string>();

  for (const comp of compounds) {
    // 1. Parent Compound (API)
    const apiCas = comp.casNumber?.trim() || 'N/A';
    const apiValidation = validateCasChecksum(apiCas);
    const apiKey = `api:${comp.id}:${apiCas}`;

    if (!seenKeys.has(apiKey)) {
      seenKeys.add(apiKey);
      indexEntries.push({
        casNumber: apiCas,
        isValidChecksum: apiValidation.isValid,
        name: comp.name,
        isIntermediate: false,
        parentCompoundId: comp.id,
        parentCompoundName: comp.name,
        oeb: comp.oeb,
        pdeMgDay: comp.pdeMgDay,
        category: comp.category,
        primaryManufacturers: comp.primaryManufacturers,
      });
    }

    // 2. Intermediates
    if (comp.intermediates && Array.isArray(comp.intermediates)) {
      for (const inter of comp.intermediates) {
        const interCas = inter.casNumber?.trim() || `INT-${inter.code}`;
        const interValidation = inter.casNumber ? validateCasChecksum(inter.casNumber) : { isValid: false };
        const interKey = `int:${comp.id}:${inter.id || inter.code}:${interCas}`;

        if (!seenKeys.has(interKey)) {
          seenKeys.add(interKey);
          const effectivePde =
            inter.pdeValueMg ??
            Number((comp.pdeMgDay * (inter.pdeRatioToApi ?? 1.0)).toFixed(5));

          indexEntries.push({
            casNumber: interCas,
            isValidChecksum: interValidation.isValid,
            name: `${inter.name} (${inter.code})`,
            isIntermediate: true,
            intermediateCode: inter.code,
            intermediateStage: inter.stage,
            parentCompoundId: comp.id,
            parentCompoundName: comp.name,
            oeb: comp.oeb,
            pdeMgDay: effectivePde,
            category: comp.category,
            primaryManufacturers: comp.primaryManufacturers,
          });
        }
      }
    }
  }

  // Sort: valid CAS numbers first numerically/alphabetically, then internal codes
  return indexEntries.sort((a, b) => {
    if (a.isValidChecksum && !b.isValidChecksum) return -1;
    if (!a.isValidChecksum && b.isValidChecksum) return 1;
    return a.casNumber.localeCompare(b.casNumber, undefined, { numeric: true });
  });
}

/**
 * Safe, robust mathematical expression evaluator for customizable MACO formulas.
 * Supports +, -, *, /, ^, parentheses, decimal numbers, and case-insensitive variable context.
 */
export function evaluateCustomExpression(
  expression: string,
  context: Record<string, number>
): { result: number; error?: string } {
  if (!expression || !expression.trim()) {
    return { result: 0, error: 'Espressione vuota' };
  }

  try {
    // Normalize context keys to uppercase
    const upperContext: Record<string, number> = {};
    for (const [k, v] of Object.entries(context)) {
      upperContext[k.toUpperCase()] = v;
    }

    // Tokenize
    const tokens: string[] = [];
    let i = 0;
    const str = expression.trim();

    while (i < str.length) {
      const ch = str[i];

      if (/\s/.test(ch)) {
        i++;
        continue;
      }

      if ('+-*/()^'.includes(ch)) {
        tokens.push(ch);
        i++;
        continue;
      }

      // Numbers (including scientific notation e.g. 1e6 or decimal 0.05)
      if (/[0-9.]/.test(ch)) {
        let numStr = '';
        while (i < str.length && /[0-9.eE]/.test(str[i])) {
          numStr += str[i];
          i++;
        }
        const parsed = parseFloat(numStr);
        if (isNaN(parsed)) {
          return { result: 0, error: `Numero non valido: "${numStr}"` };
        }
        tokens.push(parsed.toString());
        continue;
      }

      // Variable names (e.g. PDE, MBS_KG, MDD, TDD, SF, SF_ADD)
      if (/[a-zA-Z_]/.test(ch)) {
        let varName = '';
        while (i < str.length && /[a-zA-Z0-9_]/.test(str[i])) {
          varName += str[i];
          i++;
        }
        const upperVar = varName.toUpperCase();
        if (upperVar in upperContext) {
          tokens.push(upperContext[upperVar].toString());
        } else {
          return {
            result: 0,
            error: `Variabile sconosciuta: "${varName}". Variabili disponibili: ${Object.keys(upperContext).join(', ')}`,
          };
        }
        continue;
      }

      return { result: 0, error: `Carattere non consentito: "${ch}"` };
    }

    // Shunting-yard algorithm to evaluate RPN
    const precedence: Record<string, number> = {
      '+': 1,
      '-': 1,
      '*': 2,
      '/': 2,
      '^': 3,
    };

    const outputQueue: string[] = [];
    const opStack: string[] = [];

    for (let tIdx = 0; tIdx < tokens.length; tIdx++) {
      const token = tokens[tIdx];

      // Unary minus handling (e.g. at start or after an operator/open parenthesis)
      if (
        token === '-' &&
        (tIdx === 0 || tokens[tIdx - 1] === '(' || '+-*/^'.includes(tokens[tIdx - 1]))
      ) {
        // Next token must be number
        if (tIdx + 1 < tokens.length && !isNaN(Number(tokens[tIdx + 1]))) {
          tIdx++;
          outputQueue.push((-Number(tokens[tIdx])).toString());
          continue;
        }
      }

      if (!isNaN(Number(token))) {
        outputQueue.push(token);
      } else if ('+-*/^'.includes(token)) {
        while (
          opStack.length > 0 &&
          opStack[opStack.length - 1] !== '(' &&
          (precedence[opStack[opStack.length - 1]] > precedence[token] ||
            (precedence[opStack[opStack.length - 1]] === precedence[token] && token !== '^'))
        ) {
          outputQueue.push(opStack.pop()!);
        }
        opStack.push(token);
      } else if (token === '(') {
        opStack.push(token);
      } else if (token === ')') {
        while (opStack.length > 0 && opStack[opStack.length - 1] !== '(') {
          outputQueue.push(opStack.pop()!);
        }
        if (opStack.length === 0) {
          return { result: 0, error: 'Parentesi non bilanciate' };
        }
        opStack.pop(); // Pop '('
      }
    }

    while (opStack.length > 0) {
      const op = opStack.pop()!;
      if (op === '(' || op === ')') {
        return { result: 0, error: 'Parentesi non bilanciate' };
      }
      outputQueue.push(op);
    }

    // Evaluate RPN
    const evalStack: number[] = [];
    for (const token of outputQueue) {
      if (!isNaN(Number(token))) {
        evalStack.push(Number(token));
      } else {
        if (evalStack.length < 2) {
          return { result: 0, error: `Sintassi formula errata nei pressi dell'operatore "${token}"` };
        }
        const b = evalStack.pop()!;
        const a = evalStack.pop()!;
        let res = 0;
        switch (token) {
          case '+':
            res = a + b;
            break;
          case '-':
            res = a - b;
            break;
          case '*':
            res = a * b;
            break;
          case '/':
            if (b === 0) {
              return { result: 0, error: 'Divisione per zero nella formula' };
            }
            res = a / b;
            break;
          case '^':
            res = Math.pow(a, b);
            break;
        }
        evalStack.push(res);
      }
    }

    if (evalStack.length !== 1) {
      return { result: 0, error: 'Sintassi formula non valida (troppi argomenti)' };
    }

    const finalVal = evalStack[0];
    if (!isFinite(finalVal) || isNaN(finalVal)) {
      return { result: 0, error: 'Il calcolo ha generato un valore non numerico (NaN o infinito)' };
    }

    return { result: Number(finalVal.toFixed(4)) };
  } catch (err: any) {
    return { result: 0, error: `Errore di valutazione: ${err?.message || 'sintassi errata'}` };
  }
}

/**
 * Calculates Permitted Daily Exposure (PDE / ADE) based on EMA/ICH/APIC formula:
 * PDE = (NOAEL * Body Weight) / (F1 * F2 * F3 * F4 * F5)
 */
export function calculatePDE(
  noaelMgKgDay: number,
  bodyWeightKg = 50,
  f1 = 5,
  f2 = 10,
  f3 = 1,
  f4 = 1,
  f5 = 1
): { pdeMgDay: number; pdeUgDay: number } {
  const compositeFactor = f1 * f2 * f3 * f4 * f5;
  if (compositeFactor <= 0 || noaelMgKgDay <= 0) {
    return { pdeMgDay: 0, pdeUgDay: 0 };
  }
  const pdeMgDay = (noaelMgKgDay * bodyWeightKg) / compositeFactor;
  const pdeUgDay = pdeMgDay * 1000;
  return {
    pdeMgDay: Number(pdeMgDay.toFixed(6)),
    pdeUgDay: Number(pdeUgDay.toFixed(3)),
  };
}

/**
 * MACO based on Toxicological PDE / ADE:
 * MACO [mg] = (PDE [mg/day] * MBS [kg] * 1,000,000 mg/kg) / MDD [mg/day]
 */
export function calculateMACOByPDE(
  pdeMgDay: number,
  minBatchSizeKg: number,
  maxDailyDoseMg: number
): number {
  if (maxDailyDoseMg <= 0 || minBatchSizeKg <= 0 || pdeMgDay <= 0) {
    return 0;
  }
  const numberOfDoses = (minBatchSizeKg * 1_000_000) / maxDailyDoseMg;
  const macoMg = pdeMgDay * numberOfDoses;
  return Number(macoMg.toFixed(2));
}

/**
 * MACO based on 0.001 (1/1000th) of Minimum Therapeutic Daily Dose:
 * MACO [mg] = (TDD_min [mg/day] * MBS [kg] * 1,000,000 mg/kg) / (Safety Factor * MDD [mg/day])
 */
export function calculateMACOByDose(
  minDailyDoseMg: number,
  minBatchSizeKg: number,
  maxDailyDoseMg: number,
  safetyFactor = 1000
): number {
  if (maxDailyDoseMg <= 0 || minBatchSizeKg <= 0 || minDailyDoseMg <= 0 || safetyFactor <= 0) {
    return 0;
  }
  const macoMg = (minDailyDoseMg * minBatchSizeKg * 1_000_000) / (safetyFactor * maxDailyDoseMg);
  return Number(macoMg.toFixed(2));
}

/**
 * MACO based on 10 ppm general limit:
 * 10 mg of previous substance per 1 kg of next product
 * MACO [mg] = 10 mg/kg * MBS [kg]
 */
export function calculateMACOBy10Ppm(minBatchSizeKg: number): number {
  if (minBatchSizeKg <= 0) return 0;
  const macoMg = 10 * minBatchSizeKg;
  return Number(macoMg.toFixed(2));
}

/**
 * Builds an explicit, step-by-step mathematical calculation audit trail
 * ready for validation reports, GMP inspectors, and quality assurance auditing.
 */
export function buildExplicitAuditTrail(params: {
  formulaMode: string;
  formulaDescription: string;
  pdeMgDay: number;
  minDailyDoseMg: number;
  batchSizeKg: number;
  maxDailyDoseMg: number;
  safetyFactorDose: number;
  additionalSafetyFactor?: number;
  bioavailabilityFactor?: number;
  macoSelectedMg: number;
  sharedSurfaceAreaM2: number;
  swabAreaCm2: number;
  swabRecoveryPercent: number;
  rinseVolumeLiters: number;
  surfaceLimitUgCm2: number;
  swabLimitWithRecoveryUgPerSwab: number;
  rinseLimitMgL: number;
  visualThresholdUgCm2: number;
  customFormulaExpr?: string;
}): CalculationAuditStep[] {
  const {
    formulaMode,
    formulaDescription,
    pdeMgDay,
    minDailyDoseMg,
    batchSizeKg,
    maxDailyDoseMg,
    safetyFactorDose,
    additionalSafetyFactor = 1,
    bioavailabilityFactor = 1,
    macoSelectedMg,
    sharedSurfaceAreaM2,
    swabAreaCm2,
    swabRecoveryPercent,
    rinseVolumeLiters,
    surfaceLimitUgCm2,
    swabLimitWithRecoveryUgPerSwab,
    rinseLimitMgL,
    visualThresholdUgCm2,
    customFormulaExpr,
  } = params;

  const steps: CalculationAuditStep[] = [];
  const numberOfDoses = maxDailyDoseMg > 0 ? (batchSizeKg * 1_000_000) / maxDailyDoseMg : 0;
  const recoveryFactor = swabRecoveryPercent / 100;

  // Step 1: Definition of the active calculation formula
  let step1Template = 'MACO = (PDE [mg/die] × MBS [kg] × 1.000.000 mg/kg) / MDD [mg/die]';
  let step1Substituted = `MACO = (${pdeMgDay} mg/die × ${batchSizeKg} kg × 1.000.000) / ${maxDailyDoseMg} mg/die`;

  if (formulaMode === 'standard-dose') {
    step1Template = 'MACO = (TDD_min [mg/die] × MBS [kg] × 1.000.000 mg/kg) / (SF × MDD [mg/die])';
    step1Substituted = `MACO = (${minDailyDoseMg} mg/die × ${batchSizeKg} kg × 1.000.000) / (${safetyFactorDose} × ${maxDailyDoseMg} mg/die)`;
  } else if (formulaMode === 'standard-10ppm') {
    step1Template = 'MACO = 10 mg/kg × MBS [kg]';
    step1Substituted = `MACO = 10 mg/kg × ${batchSizeKg} kg`;
  } else if (formulaMode === 'pde-safety-margin') {
    step1Template = 'MACO = (PDE [mg/die] × MBS [kg] × 1.000.000) / (MDD [mg/die] × SF_add)';
    step1Substituted = `MACO = (${pdeMgDay} mg/die × ${batchSizeKg} kg × 1.000.000) / (${maxDailyDoseMg} mg/die × ${additionalSafetyFactor})`;
  } else if (formulaMode === 'bioavailability-adjusted') {
    step1Template = 'MACO = (PDE [mg/die] × F_bio × MBS [kg] × 1.000.000) / MDD [mg/die]';
    step1Substituted = `MACO = (${pdeMgDay} mg/die × ${bioavailabilityFactor} × ${batchSizeKg} kg × 1.000.000) / ${maxDailyDoseMg} mg/die`;
  } else if (formulaMode === 'custom-expression') {
    step1Template = customFormulaExpr || 'Espressione personalizzata';
    step1Substituted = `Valutazione con PDE=${pdeMgDay}, MBS=${batchSizeKg}, MDD=${maxDailyDoseMg}, SF_ADD=${additionalSafetyFactor}`;
  }

  steps.push({
    stepNumber: 1,
    title: 'Definizione della Formula e Modello di Calcolo',
    formulaTemplate: step1Template,
    formulaSubstituted: step1Substituted,
    resultString: `${formulaDescription}`,
    explanation:
      'Impostazione della base regolatoria del calcolo (Guida APIC Sez. 4 / Linea Guida EMA HBEL / ICH Q3C/Q3D). L\'operatore può modificare i fattori o la formula preservando l\'audit trail.',
  });

  // Step 2: Number of maximum therapeutic daily doses in next batch
  steps.push({
    stepNumber: 2,
    title: 'Determinazione Numero di Dosi Massime nel Batch Successivo (N_dosi)',
    formulaTemplate: 'N_dosi = (MBS [kg] × 1.000.000 mg/kg) / MDD_prodottoB [mg/die]',
    formulaSubstituted: `N_dosi = (${batchSizeKg} × 1.000.000) / ${maxDailyDoseMg}`,
    resultString: `${numberOfDoses.toLocaleString('it-IT')} dosi terapeutiche giornaliere`,
    explanation:
      'Calcola quante unità posologiche massime giornaliere del prodotto successivo B sono contenute nella dimensione minima di lotto (MBS).',
  });

  // Step 3: Maximum Allowable Carryover (MACO) in entire batch
  steps.push({
    stepNumber: 3,
    title: 'Calcolo Quantità Massima Trasferibile (MACO Totale Impianto)',
    formulaTemplate: step1Template,
    formulaSubstituted: step1Substituted,
    resultString: `${macoSelectedMg.toLocaleString('it-IT')} mg (${(macoSelectedMg / 1000).toFixed(4)} g)`,
    explanation:
      'Quantità massima assoluta di residuo del composto A consentita nell\'intero batch B senza superare l\'esposizione giornaliera ammessa o il criterio di sicurezza.',
  });

  // Step 4: Shared Surface Area Limit (mg/m² and µg/cm²)
  const surfaceMgM2 = sharedSurfaceAreaM2 > 0 ? (macoSelectedMg / sharedSurfaceAreaM2).toFixed(4) : '0';
  steps.push({
    stepNumber: 4,
    title: 'Ripartizione Superficiale su Treno di Apparecchiature Condiviso',
    formulaTemplate: 'Limite_Superficie [µg/cm²] = (MACO [mg] × 1.000 µg/mg) / (Area_Condivisa [m²] × 10.000 cm²/m²)',
    formulaSubstituted: `Limite_Superficie = (${macoSelectedMg} × 1.000) / (${sharedSurfaceAreaM2} × 10.000)`,
    resultString: `${surfaceLimitUgCm2.toFixed(4)} µg/cm² (${surfaceMgM2} mg/m²)`,
    explanation:
      'Distribuzione uniforme della contaminazione massima ammessa sull\'intera superficie a contatto con il prodotto (Total Shared Contact Surface Area).',
  });

  // Step 5: Swab Sampling Analytical Limit & Recovery Correction
  const theoreticalSwabUg = (surfaceLimitUgCm2 * swabAreaCm2).toFixed(3);
  steps.push({
    stepNumber: 5,
    title: 'Calcolo Limite di Campionamento Swab con Correzione del Recovery Analitico',
    formulaTemplate: 'Limite_Swab_Rilevabile [µg/swab] = Limite_Superficie [µg/cm²] × Area_Swab [cm²] × Recovery_%',
    formulaSubstituted: `Limite_Swab_Rilevabile = ${surfaceLimitUgCm2.toFixed(4)} × ${swabAreaCm2} × ${recoveryFactor}`,
    resultString: `${swabLimitWithRecoveryUgPerSwab.toFixed(3)} µg/swab (Teorico grezzo: ${theoreticalSwabUg} µg/swab)`,
    explanation:
      `Valore soglia da applicare all'analisi cromatografica (HPLC/LC-MS) del tampone (swab test da ${swabAreaCm2} cm²), corretto per il fattore di recupero analitico convalidato (${swabRecoveryPercent}%).`,
  });

  // Step 6: Final Rinse Sampling Limit (mg/L or ppm)
  steps.push({
    stepNumber: 6,
    title: 'Calcolo Limite Concentrazione nel Liquido di Risciacquo Finale (Rinse Test)',
    formulaTemplate: 'Limite_Rinse [mg/L - ppm] = MACO [mg] / Volume_Risciacquo [L]',
    formulaSubstituted: `Limite_Rinse = ${macoSelectedMg} mg / ${rinseVolumeLiters} L`,
    resultString: `${rinseLimitMgL.toFixed(4)} mg/L (ppm)`,
    explanation:
      'Concentrazione massima accettabile nell\'aliquota di solvente/acqua di risciacquo finale WFI/PW nel caso in cui il residuo si sciolga uniformemente nel volume totale.',
  });

  // Step 7: Visual Cleanliness Verification & Risk Check
  const visualComparison =
    surfaceLimitUgCm2 < visualThresholdUgCm2
      ? `ATTENZIONE: Il limite calcolato (${surfaceLimitUgCm2.toFixed(4)} µg/cm²) è INFERIORE alla soglia visiva standard (${visualThresholdUgCm2} µg/cm²). L'ispezione visiva da sola NON è sufficiente; è obbligatorio il campionamento strumentale analitico convalidato.`
      : `CONFORME: Il limite calcolato (${surfaceLimitUgCm2.toFixed(4)} µg/cm²) è superiore alla soglia di visibilità (${visualThresholdUgCm2} µg/cm²). L'ispezione visiva "visibly clean" è un criterio di supporto primario valido.`;

  steps.push({
    stepNumber: 7,
    title: 'Valutazione di Robustezza: Ispezione Visiva e Criterio "Visibly Clean"',
    formulaTemplate: 'Confronto Limite_Superficie [µg/cm²] vs Soglia_Visiva_Ispezione [4 µg/cm²]',
    formulaSubstituted: `${surfaceLimitUgCm2.toFixed(4)} µg/cm² vs ${visualThresholdUgCm2} µg/cm²`,
    resultString: surfaceLimitUgCm2 < visualThresholdUgCm2 ? 'Analisi Strumentale Obbligatoria' : 'Ispezione Visiva Idonea',
    explanation: visualComparison,
  });

  return steps;
}

/**
 * Full APIC Cleaning Validation calculation evaluating presets, custom editable formulas,
 * shared surface area swab & rinse limits, and transparent calculation audit steps.
 */
export function executeApicCalculation(input: ApicCalculationInput): ApicCalculationResult {
  const {
    previousCompound,
    nextCompoundMinBatchSizeKg,
    nextCompoundMaxDailyDoseMg,
    equipment,
    safetyFactorDoseMethod,
    formulaConfig,
  } = input;

  const swabArea = input.targetSwabAreaCm2 ?? equipment.swabAreaCm2 ?? 25;
  const swabRecovery = (input.swabRecoveryPercent ?? equipment.swabRecoveryFactorPercent ?? 85) / 100;
  const rinseVolume = input.rinseVolumeLiters ?? equipment.rinseVolumeLiters ?? 500;
  const totalSharedAreaM2 = equipment.sharedSurfaceAreaM2;
  const totalSharedAreaCm2 = totalSharedAreaM2 * 10_000;

  // 1. Calculate standard preset MACOs
  const macoPdeMg = calculateMACOByPDE(
    previousCompound.pdeMgDay,
    nextCompoundMinBatchSizeKg,
    nextCompoundMaxDailyDoseMg
  );

  const macoDoseMg = calculateMACOByDose(
    previousCompound.minDailyDoseMg,
    nextCompoundMinBatchSizeKg,
    nextCompoundMaxDailyDoseMg,
    safetyFactorDoseMethod
  );

  const maco10PpmMg = calculateMACOBy10Ppm(nextCompoundMinBatchSizeKg);

  // 2. Custom formula processing
  let macoCustomMg: number | undefined = undefined;
  let customFormulaError: string | undefined = undefined;
  let isCustomFormulaActive = false;
  let activeFormulaDescription = 'Criterio Tossicologico Standard PDE / ADE (APIC Sez. 4.1.1)';

  const activeMode = formulaConfig?.mode || 'standard-pde';

  if (activeMode === 'custom-expression') {
    isCustomFormulaActive = true;
    const context: Record<string, number> = {
      PDE: previousCompound.pdeMgDay,
      MBS_KG: nextCompoundMinBatchSizeKg,
      MDD: nextCompoundMaxDailyDoseMg,
      TDD: previousCompound.minDailyDoseMg,
      TDD_MIN: previousCompound.minDailyDoseMg,
      SF: safetyFactorDoseMethod,
      SF_ADD: formulaConfig?.additionalSafetyFactor || 1,
      F_BIO: formulaConfig?.bioavailabilityFactor || 1,
      AREA: totalSharedAreaM2,
      AREA_M2: totalSharedAreaM2,
      SWAB: swabArea,
      SWAB_CM2: swabArea,
      REC: swabRecovery,
      VOL: rinseVolume,
      VOL_L: rinseVolume,
    };

    const evalResult = evaluateCustomExpression(
      formulaConfig?.customExpression || '(PDE * MBS_KG * 1000000) / MDD',
      context
    );

    if (evalResult.error) {
      customFormulaError = evalResult.error;
      macoCustomMg = macoPdeMg; // fallback
    } else {
      macoCustomMg = evalResult.result;
    }
    activeFormulaDescription = `Formula Personalizzata Utente: ${formulaConfig?.customExpression || ''}`;
  } else if (activeMode === 'pde-safety-margin') {
    const sfAdd = formulaConfig?.additionalSafetyFactor || 2;
    macoCustomMg = Number((macoPdeMg / sfAdd).toFixed(2));
    isCustomFormulaActive = true;
    activeFormulaDescription = `PDE con Margine Addizionale di Sicurezza Impianto (SF_add = ${sfAdd})`;
  } else if (activeMode === 'bioavailability-adjusted') {
    const fBio = formulaConfig?.bioavailabilityFactor || 1.0;
    macoCustomMg = Number((macoPdeMg * fBio).toFixed(2));
    isCustomFormulaActive = true;
    activeFormulaDescription = `PDE Corretto per Fattore Biodisponibilità / Assorbimento (F_bio = ${fBio})`;
  } else if (activeMode === 'standard-dose') {
    activeFormulaDescription = `Criterio 1/1000 Dose Terapeutica Minima (SF = ${safetyFactorDoseMethod})`;
  } else if (activeMode === 'standard-10ppm') {
    activeFormulaDescription = 'Criterio Generale Baseline 10 ppm (10 mg/kg)';
  }

  // 3. Select active MACO
  let macoSelectedMg = macoPdeMg;
  let worstCaseCriteria: ApicCalculationResult['worstCaseCriteria'] = 'PDE / ADE Approach';

  if (activeMode === 'custom-expression' || activeMode === 'pde-safety-margin' || activeMode === 'bioavailability-adjusted') {
    macoSelectedMg = macoCustomMg !== undefined && macoCustomMg > 0 ? macoCustomMg : macoPdeMg;
    worstCaseCriteria = 'Formula Personalizzata / Modificata';
  } else if (activeMode === 'standard-dose') {
    macoSelectedMg = macoDoseMg > 0 ? macoDoseMg : macoPdeMg;
    worstCaseCriteria = '0.001 Dose Criterion';
  } else if (activeMode === 'standard-10ppm') {
    macoSelectedMg = maco10PpmMg;
    worstCaseCriteria = '10 ppm General Limit';
  } else {
    // standard-pde default: APIC guidelines recommend evaluating all 3 and choosing lowest
    const validMacos = [
      { value: macoPdeMg, name: 'PDE / ADE Approach' as const },
      { value: macoDoseMg, name: '0.001 Dose Criterion' as const },
      { value: maco10PpmMg, name: '10 ppm General Limit' as const },
    ].filter((item) => item.value > 0);

    if (validMacos.length > 0) {
      validMacos.sort((a, b) => a.value - b.value);
      macoSelectedMg = validMacos[0].value;
      worstCaseCriteria = validMacos[0].name;
    }
  }

  // 4. Surface Limits
  const surfaceLimitMgM2 = totalSharedAreaM2 > 0 ? Number((macoSelectedMg / totalSharedAreaM2).toFixed(4)) : 0;
  const surfaceLimitUgCm2 = totalSharedAreaCm2 > 0 ? Number(((macoSelectedMg * 1_000) / totalSharedAreaCm2).toFixed(4)) : 0;

  // 5. Swab Limit (µg/swab)
  const swabLimitUgPerSwab = Number((surfaceLimitUgCm2 * swabArea).toFixed(3));
  const swabLimitWithRecoveryUgPerSwab = Number((swabLimitUgPerSwab * swabRecovery).toFixed(3));

  // 6. Rinse Limit (mg/L or ppm)
  const rinseLimitMgL = rinseVolume > 0 ? Number((macoSelectedMg / rinseVolume).toFixed(4)) : 0;

  // 7. Visual Cleanliness Inspection comparison
  const visualThresholdUgCm2 = equipment.visualCleanInspectionLimitUgCm2 || 4.0;
  const isVisualLimitMoreStringent = visualThresholdUgCm2 < surfaceLimitUgCm2;

  // 8. Build explicit audit trail
  const auditSteps = buildExplicitAuditTrail({
    formulaMode: activeMode,
    formulaDescription: activeFormulaDescription,
    pdeMgDay: previousCompound.pdeMgDay,
    minDailyDoseMg: previousCompound.minDailyDoseMg,
    batchSizeKg: nextCompoundMinBatchSizeKg,
    maxDailyDoseMg: nextCompoundMaxDailyDoseMg,
    safetyFactorDose: safetyFactorDoseMethod,
    additionalSafetyFactor: formulaConfig?.additionalSafetyFactor,
    bioavailabilityFactor: formulaConfig?.bioavailabilityFactor,
    macoSelectedMg,
    sharedSurfaceAreaM2: totalSharedAreaM2,
    swabAreaCm2: swabArea,
    swabRecoveryPercent: input.swabRecoveryPercent ?? equipment.swabRecoveryFactorPercent ?? 85,
    rinseVolumeLiters: rinseVolume,
    surfaceLimitUgCm2,
    swabLimitWithRecoveryUgPerSwab,
    rinseLimitMgL,
    visualThresholdUgCm2,
    customFormulaExpr: formulaConfig?.customExpression,
  });

  // 9. Safety / Regulatory warnings according to APIC Guide
  const warnings: string[] = [];

  if (previousCompound.oeb === 'OEB 4' || previousCompound.oeb === 'OEB 5') {
    warnings.push(
      `HPAPI Alert: Il composto è classificato ${previousCompound.oeb} (${previousCompound.toxicologicalClass}). L'ispezione visiva non è sufficiente; è obbligatorio un metodo analitico convalidato (${previousCompound.recommendedAnalyticalMethod}).`
    );
  }

  if (
    previousCompound.toxicologicalClass?.includes('Genotoxic') ||
    previousCompound.toxicologicalClass?.includes('Cytotoxic')
  ) {
    warnings.push(
      `ICH M7 / Cytotoxic Alert: Valutazione tossicologica rigorosa richiesta. Il limite generale 10 ppm non deve mai superare la soglia basata su PDE tossicologico.`
    );
  }

  if (macoPdeMg < maco10PpmMg && worstCaseCriteria !== 'PDE / ADE Approach' && !isCustomFormulaActive) {
    warnings.push(
      `Avvertenza Scientifica EMA: Il MACO basato su PDE (${macoPdeMg} mg) è più restrittivo del criterio 10 ppm. Secondo EMA GMP Annex 15, il PDE deve essere lo standard primario.`
    );
  }

  if (surfaceLimitUgCm2 < 1.0) {
    warnings.push(
      `Limite superficiale critico molto basso (${surfaceLimitUgCm2} µg/cm²). La tecnica di swab e il fattore di recupero analitico (${(swabRecovery * 100).toFixed(0)}%) devono essere rigorosamente qualificati.`
    );
  }

  if (cleanabilityScore(previousCompound.cleanability) >= 3) {
    warnings.push(
      `Criticità di pulibilità: Composto classificato '${previousCompound.cleanability}'. Il CIP standard potrebbe richiedere: ${previousCompound.suggestedCipCleaningAgent}.`
    );
  }

  return {
    macoPdeMg,
    macoDoseMg,
    maco10PpmMg,
    macoCustomMg,
    worstCaseCriteria,
    macoSelectedMg,
    surfaceLimitMgM2,
    surfaceLimitUgCm2,
    swabLimitUgPerSwab,
    swabLimitWithRecoveryUgPerSwab,
    rinseLimitMgL,
    isVisualLimitMoreStringent,
    visualLimitEffectiveUgCm2: visualThresholdUgCm2,
    auditSteps,
    activeFormulaDescription,
    isCustomFormulaActive,
    customFormulaError,
    warnings,
  };
}

/**
 * Numerical score for cleanability (1 = easy, 4 = very difficult)
 */
export function cleanabilityScore(rating: CleanabilityRating): number {
  switch (rating) {
    case 'Easy (Water/Mild)':
      return 1;
    case 'Moderate (Detergent/CIP)':
      return 2;
    case 'Difficult (Hot Alkaline/Acid)':
      return 3;
    case 'Very Difficult (Solvent Reflux/Boil-out)':
      return 4;
    default:
      return 2;
  }
}

export function getAdePdeGroup(pdeUgDay: number): AdePdeGroup {
  if (pdeUgDay > 500) return 1;
  if (pdeUgDay >= 100) return 2;
  if (pdeUgDay >= 10) return 3;
  if (pdeUgDay >= 1) return 4;
  return 5;
}

export function getTherapeuticDoseGroup(minDoseMg: number): DoseGroup {
  if (minDoseMg > 1000) return 1;
  if (minDoseMg >= 100) return 2;
  if (minDoseMg >= 10) return 3;
  if (minDoseMg >= 1) return 4;
  return 5;
}

export function mapSolubilityTextToGroup(solubilityText: string): SolubilityGroup {
  const lower = (solubilityText || '').toLowerCase();
  if (lower.includes('freely') || lower.includes('very soluble') || lower.includes('molto solubile')) {
    return 1;
  }
  if (
    lower.includes('sparingly') ||
    lower.includes('moderately') ||
    lower.includes('poco solubile') ||
    (lower.includes('soluble') && !lower.includes('slightly') && !lower.includes('insoluble'))
  ) {
    return 2;
  }
  return 3;
}

export function mapCleanabilityTextToCategory(cleanText: string): HardestToCleanCategory {
  const lower = (cleanText || '').toLowerCase();
  if (lower.includes('easy') || lower.includes('facile') || lower.includes('water')) {
    return 1;
  }
  if (
    lower.includes('difficult') ||
    lower.includes('difficile') ||
    lower.includes('reflux') ||
    lower.includes('boil') ||
    lower.includes('hot alkaline')
  ) {
    return 3;
  }
  return 2;
}

/**
 * Evaluates all combinations between products in an APIC facility matrix (A -> B transitions).
 * Determines the worst case (più sfavorevole) to validate based on APIC Chapter 7 criteria:
 * a) Hardest to clean (Category 1-3)
 * b) Solubility in cleaning solvent (Group 1-3)
 * c) ADE / PDE concept (Group 1-5)
 * d) Smallest therapeutic dose (Group 1-5)
 */
export interface MatrixCombinationResult {
  fromProduct: MatrixProductItem;
  toProduct: MatrixProductItem;
  macoPdeMg: number;
  macoDoseMg: number;
  maco10PpmMg: number;
  macoSelectedMg: number;
  governingCriteria: 'PDE / ADE' | 'Dose 0.001' | '10 ppm';
  swabLimitUgPerSwab: number;
  rinseLimitMgL: number;
  severityScore: number;
  isWorstCase: boolean;
  scientificRationale: string;
}

export function evaluateAllMatrixCombinations(
  products: MatrixProductItem[],
  trainParams: {
    sharedSurfaceAreaM2: number;
    swabAreaCm2: number;
    swabRecoveryPercent: number;
    rinseVolumeLiters: number;
  }
): {
  combinations: MatrixCombinationResult[];
  worstCaseCombination: MatrixCombinationResult | null;
  worstResidueProduct: MatrixProductItem | null;
  mostVulnerableRecipient: MatrixProductItem | null;
} {
  if (!products || products.length < 2) {
    return {
      combinations: [],
      worstCaseCombination: null,
      worstResidueProduct: products && products.length === 1 ? products[0] : null,
      mostVulnerableRecipient: null,
    };
  }

  const { sharedSurfaceAreaM2, swabAreaCm2, swabRecoveryPercent, rinseVolumeLiters } = trainParams;
  const recoveryFactor = (swabRecoveryPercent || 85) / 100;
  const totalSharedAreaCm2 = (sharedSurfaceAreaM2 || 25) * 10000;

  const combinations: MatrixCombinationResult[] = [];
  let minMacoOverall = Infinity;
  let maxSeverityScore = -Infinity;
  let worstCombinationCandidate: MatrixCombinationResult | null = null;

  // Track worst single residue (hardest to clean & most toxic/potent)
  let worstResidueProduct: MatrixProductItem | null = null;
  let highestResidueScore = -Infinity;

  for (const prod of products) {
    // Residue difficulty score:
    // cleanabilityCategory (1-3, weight 3) + solubilityGroup (1-3, weight 2.5) + pdeGroup (1-5, weight 4) + doseGroup (1-5, weight 2)
    const residueScore =
      prod.cleanabilityCategory * 3 +
      prod.solubilityGroup * 2.5 +
      prod.pdeGroup * 4 +
      prod.doseGroup * 2;

    if (residueScore > highestResidueScore) {
      highestResidueScore = residueScore;
      worstResidueProduct = prod;
    }
  }

  // Track most vulnerable recipient (lowest MBS & highest MDD)
  let mostVulnerableRecipient: MatrixProductItem | null = null;
  let highestVulnerability = -Infinity;

  for (const prod of products) {
    const vuln = prod.minBatchSizeKg > 0 ? (prod.maxDailyDoseMg || 1) / prod.minBatchSizeKg : 0;
    if (vuln > highestVulnerability) {
      highestVulnerability = vuln;
      mostVulnerableRecipient = prod;
    }
  }

  // Evaluate every cross pair A -> B (where A != B)
  for (const prodA of products) {
    for (const prodB of products) {
      if (prodA.id === prodB.id) continue;

      const pdeMg = prodA.pdeMgDay > 0 ? prodA.pdeMgDay : prodA.pdeUgDay / 1000;
      const macoPde = calculateMACOByPDE(pdeMg, prodB.minBatchSizeKg, prodB.maxDailyDoseMg);
      const macoDose = calculateMACOByDose(
        prodA.minDailyDoseMg,
        prodB.minBatchSizeKg,
        prodB.maxDailyDoseMg,
        1000
      );
      const maco10Ppm = calculateMACOBy10Ppm(prodB.minBatchSizeKg);

      // Governing MACO: APIC recommends taking the lowest valid value
      const valid = [
        { val: macoPde, name: 'PDE / ADE' as const },
        { val: macoDose, name: 'Dose 0.001' as const },
        { val: maco10Ppm, name: '10 ppm' as const },
      ].filter((x) => x.val > 0);

      valid.sort((a, b) => a.val - b.val);
      const selected = valid[0] || { val: macoPde, name: 'PDE / ADE' as const };
      const macoSelectedMg = selected.val;
      const governingCriteria = selected.name;

      // Surface, Swab and Rinse limits
      const surfaceUgCm2 = totalSharedAreaCm2 > 0 ? (macoSelectedMg * 1000) / totalSharedAreaCm2 : 0;
      const swabLimitUgPerSwab = Number((surfaceUgCm2 * swabAreaCm2 * recoveryFactor).toFixed(3));
      const rinseLimitMgL = rinseVolumeLiters > 0 ? Number((macoSelectedMg / rinseVolumeLiters).toFixed(4)) : 0;

      // APIC Worst-Case severity score for transition A -> B
      // Lower MACO = higher severity. Harder to clean = higher severity.
      // Score from 0 to 100
      const macoFactor = macoSelectedMg > 0 ? Math.min(50, 500 / macoSelectedMg) : 50;
      const cleanFactor = (prodA.cleanabilityCategory / 3) * 20;
      const solFactor = (prodA.solubilityGroup / 3) * 15;
      const pdeFactor = (prodA.pdeGroup / 5) * 15;
      const severityScore = Number((macoFactor + cleanFactor + solFactor + pdeFactor).toFixed(1));

      // Scientific rationale according to APIC Chapter 7
      const rationaleParts: string[] = [];
      if (prodA.cleanabilityCategory === 3) rationaleParts.push('Pulibilità Difficile (Cat 3)');
      if (prodA.solubilityGroup === 3) rationaleParts.push('Scarsa Solubilità (USP Grp 3)');
      if (prodA.pdeGroup >= 4) rationaleParts.push(`Alta Tossicità (PDE Grp ${prodA.pdeGroup})`);
      if (selected.val === macoPde) rationaleParts.push(`Governato da limite HBEL tossicologico (${macoPde.toFixed(2)} mg)`);
      else rationaleParts.push(`Governato da criterio dose (${macoDose.toFixed(2)} mg)`);

      const combinationResult: MatrixCombinationResult = {
        fromProduct: prodA,
        toProduct: prodB,
        macoPdeMg: macoPde,
        macoDoseMg: macoDose,
        maco10PpmMg: maco10Ppm,
        macoSelectedMg,
        governingCriteria,
        swabLimitUgPerSwab,
        rinseLimitMgL,
        severityScore,
        isWorstCase: false,
        scientificRationale: rationaleParts.join(' • '),
      };

      combinations.push(combinationResult);

      // Track most critical combination
      // APIC Chapter 7: The worst-case is the one with highest cleaning challenge & lowest acceptance limit
      if (macoSelectedMg < minMacoOverall || (macoSelectedMg === minMacoOverall && severityScore > maxSeverityScore)) {
        minMacoOverall = macoSelectedMg;
        maxSeverityScore = severityScore;
        worstCombinationCandidate = combinationResult;
      }
    }
  }

  if (worstCombinationCandidate) {
    worstCombinationCandidate.isWorstCase = true;
  }

  return {
    combinations,
    worstCaseCombination: worstCombinationCandidate,
    worstResidueProduct,
    mostVulnerableRecipient,
  };
}

/**
 * Calculates a worst-case risk score for a single compound (legacy compatibility).
 */
export function calculateWorstCaseScore(compound: PharmaceuticalCompound): {
  score: number;
  rankReason: string;
} {
  let pdeScore = 20;
  if (compound.pdeMgDay <= 0.001) pdeScore = 100;
  else if (compound.pdeMgDay <= 0.005) pdeScore = 90;
  else if (compound.pdeMgDay <= 0.01) pdeScore = 80;
  else if (compound.pdeMgDay <= 0.05) pdeScore = 70;
  else if (compound.pdeMgDay <= 0.1) pdeScore = 55;
  else if (compound.pdeMgDay <= 0.5) pdeScore = 40;
  else if (compound.pdeMgDay <= 1.0) pdeScore = 30;
  else pdeScore = 15;

  const cleanScore = cleanabilityScore(compound.cleanability) * 25;

  let solScore = 20;
  switch (compound.solubilityInWater) {
    case 'Practically Insoluble':
      solScore = 100;
      break;
    case 'Very Slightly Soluble':
      solScore = 85;
      break;
    case 'Slightly Soluble':
      solScore = 70;
      break;
    case 'Sparingly Soluble':
      solScore = 50;
      break;
    case 'Soluble':
      solScore = 25;
      break;
    case 'Freely Soluble':
      solScore = 10;
      break;
  }

  const compositeScore = Number((pdeScore * 0.45 + cleanScore * 0.35 + solScore * 0.2).toFixed(1));

  let reason = '';
  if (pdeScore >= 80 && cleanScore >= 75) {
    reason = 'Critical Worst-Case: Alta tossicità / PDE ridotto associato a pulibilità difficoltosa.';
  } else if (pdeScore >= 80) {
    reason = 'Toxicological Worst-Case: PDE estremamente basso / elevata potenza farmacologica.';
  } else if (cleanScore >= 75) {
    reason = 'Cleaning Challenge Worst-Case: Residuo insolubile che richiede CIP aggressivo o riflusso solvente.';
  } else {
    reason = 'Profilo di rischio intermedio nel treno multi-prodotto.';
  }

  return { score: compositeScore, rankReason: reason };
}

/**
 * Executes comprehensive Cleaning Validation Acceptance Criteria calculations strictly according to
 * APIC Guidance Chapter 4.0:
 * - 4.1 Introduction & Visual limit check
 * - 4.2.1 Health-Based Data (HBEL / ADE / PDE with Purging Factor PF & Safety Factor SF)
 * - 4.2.2 General Limits (10 ppm, 100 ppm, custom MAXCONC ppm)
 * - 4.2.3 Therapeutic Macromolecules & Peptides (1/1000th dose combined with 10 ppm)
 * - 4.2.4 Swab Limits (Equation 4.2.5-I & Equation 4.2.5-II segmented carry over)
 * - 4.2.5 Rinse Limits (Target value mg/L & Equation 5 carry over)
 * - 4.2.6 Chemical production factor (5-10x for chemical synthesis vs 1x for physical finishing)
 */
export function executeApicChapter4Calculation(
  input: ApicChapter4CalculationInput
): ApicChapter4CalculationResult {
  const {
    hbelMgDay,
    hbelSource,
    nextMaterialMbsKg,
    nextMaterialTddMg,
    purgingFactor = 1,
    safetyFactorHbel = 1,
    generalLimitPpm = 10,
    previousMaterialTddMg,
    doseSafetyFactor = 1000,
    isMacromoleculeOrPeptide = false,
    chemicalProductionFactor = 1,
    chemicalFactorJustification,
    totalSurfaceAreaM2,
    swabTemplateAreaCm2,
    swabRecoveryRatePercent = 85,
    rinseVolumeLiters,
    visualCleanlinessThresholdUgCm2 = 4.0,
    segments,
    rinseVerification,
  } = input;

  const mbsMg = (nextMaterialMbsKg || 1) * 1_000_000; // MBS in mg
  const recoveryFraction = (swabRecoveryRatePercent || 85) / 100;
  const totalSurfaceAreaDm2 = (totalSurfaceAreaM2 || 1) * 100; // 1 m² = 100 dm²
  const totalSurfaceAreaCm2 = (totalSurfaceAreaM2 || 1) * 10_000; // 1 m² = 10,000 cm²

  // 1. Paragraph 4.2.1: MACO by Health-Based Exposure Limit (HBEL)
  // MACO = (HBEL_previous * MBS_next * PF) / (TDD_next * SF)
  let macoHbelMg = 0;
  if (nextMaterialTddMg > 0 && safetyFactorHbel > 0 && hbelMgDay > 0) {
    macoHbelMg = Number(
      (((hbelMgDay * mbsMg * (purgingFactor || 1)) / (nextMaterialTddMg * (safetyFactorHbel || 1)))).toFixed(2)
    );
  }

  // Paragraph 4.2.6: Chemical production factor (5 - 10x for chemical synthesis)
  const chemFactor = Math.max(1, chemicalProductionFactor || 1);
  const macoHbelWithChemicalFactorMg = Number((macoHbelMg * chemFactor).toFixed(2));
  const effectiveHbelMaco = chemFactor > 1 ? macoHbelWithChemicalFactorMg : macoHbelMg;

  // 2. Paragraph 4.2.2: MACO by General Limit
  // MACO = MAXCONC * MBS
  // 10 ppm = 10 mg/kg * MBS_kg (or 0.001% of MBS)
  const maco10PpmMg = Number((10 * (nextMaterialMbsKg || 0)).toFixed(2));
  // 100 ppm = 100 mg/kg * MBS_kg (or 0.01% of MBS, very frequent in APIs per 4.2.2)
  const maco100PpmMg = Number((100 * (nextMaterialMbsKg || 0)).toFixed(2));
  // Custom MAXCONC ppm
  const macoCustomPpmMg = Number(((generalLimitPpm || 10) * (nextMaterialMbsKg || 0)).toFixed(2));

  // 3. Paragraph 4.2.3: MACO by 1/1000th Therapeutic Dose / Therapeutic Macromolecules & Peptides
  // MACO = (TDD_previous * MBS_next) / (SF * TDD_next)
  let macoDoseMg = 0;
  if (nextMaterialTddMg > 0 && doseSafetyFactor > 0 && previousMaterialTddMg > 0) {
    macoDoseMg = Number(
      ((previousMaterialTddMg * mbsMg) / (doseSafetyFactor * nextMaterialTddMg)).toFixed(2)
    );
  }

  // If therapeutic macromolecule or peptide (Section 4.2.3):
  // "both the limit based upon 1/1000th of the therapeutic dose and the general limit of 10 ppm are calculated and the lowest value is being used"
  const macoMacromoleculeSelectedMg = Math.min(macoDoseMg > 0 ? macoDoseMg : Infinity, maco10PpmMg);

  // 4. Comparison & Governing MACO Selection (lowest value among valid criteria)
  type GovCriteria = ApicChapter4CalculationResult['governingCriteria'];
  const candidates: { val: number; name: GovCriteria }[] = [];

  if (effectiveHbelMaco > 0) {
    candidates.push({ val: effectiveHbelMaco, name: '4.2.1 Dati Tossicologici HBEL (ADE/PDE)' });
  }
  if (maco10PpmMg > 0) {
    candidates.push({ val: maco10PpmMg, name: '4.2.2 Limite Generale (10 ppm)' });
  }
  if (macoDoseMg > 0) {
    candidates.push({ val: macoDoseMg, name: '4.2.3 Criterio Dose / Macromolecole (1/1000)' });
  }

  candidates.sort((a, b) => a.val - b.val);
  const governing = candidates[0] || {
    val: effectiveHbelMaco || maco10PpmMg || 100,
    name: '4.2.1 Dati Tossicologici HBEL (ADE/PDE)' as GovCriteria,
  };

  const governingMacoMg = governing.val;
  const governingCriteria = governing.name;
  const governingMacoUg = governingMacoMg * 1000;

  // 5. Paragraph 4.2.4: Swab Limits (Equation 4.2.5-I)
  // Target value [µg/dm²] = MACO [µg] / Total surface [dm²]
  const swabTargetValueUgDm2 = totalSurfaceAreaDm2 > 0 ? Number((governingMacoUg / totalSurfaceAreaDm2).toFixed(3)) : 0;
  // Target value [µg/cm²] = Target [µg/dm²] / 100 = MACO [mg] * 1000 / (Total surface [m²] * 10,000)
  const swabTargetValueUgCm2 = Number((swabTargetValueUgDm2 / 100).toFixed(4));
  // Swab Limit per test template: Swab Limit [µg/swab] = Target [µg/cm²] * Swab Area [cm²]
  const swabLimitPerTemplateUg = Number((swabTargetValueUgCm2 * (swabTemplateAreaCm2 || 25)).toFixed(3));
  // With analytical recovery correction (WF):
  const swabLimitWithRecoveryUg = Number((swabLimitPerTemplateUg * recoveryFraction).toFixed(3));

  // Equation 4.2.5-II: Multi-equipment train segmented carry over
  // CO [µg] = Sum(Ai [dm²] * mi [µg/dm²])
  let totalSwabCarryOverUg: number | undefined = undefined;
  let isTotalSwabWithinMaco: boolean | undefined = undefined;

  if (segments && segments.length > 0) {
    let sumCoUg = 0;
    for (const seg of segments) {
      if (seg.measuredSwabResidueUgDm2 !== undefined) {
        sumCoUg += seg.areaDm2 * seg.measuredSwabResidueUgDm2;
      }
    }
    totalSwabCarryOverUg = Number(sumCoUg.toFixed(2));
    isTotalSwabWithinMaco = totalSwabCarryOverUg <= governingMacoUg;
  }

  // 6. Paragraph 4.2.5: Rinse Limits
  // Target value (mg/L or ppm) = MACO (mg) / Volume of rinse or boil (L)
  const rinseTargetValueMgL = rinseVolumeLiters > 0 ? Number((governingMacoMg / rinseVolumeLiters).toFixed(4)) : 0;

  // Equation 5: Measured Carry Over in Rinse
  // CO [mg] = V * (C - Cb)
  let measuredRinseCarryOverMg: number | undefined = undefined;
  let isRinseWithinTarget: boolean | undefined = undefined;

  if (rinseVerification) {
    const netConc = Math.max(0, rinseVerification.sampleImpurityConcMgL - rinseVerification.blankSolventConcMgL);
    measuredRinseCarryOverMg = Number((rinseVerification.rinseVolumeLiters * netConc).toFixed(4));
    isRinseWithinTarget = measuredRinseCarryOverMg < governingMacoMg;
  }

  // 7. Paragraph 4.1: Visually Clean Inspection Check
  const isVisualLimitMoreStringent = visualCleanlinessThresholdUgCm2 < swabTargetValueUgCm2;

  // 8. Generate Explicit Mathematical Audit Trail Steps
  const auditSteps: CalculationAuditStep[] = [
    {
      stepNumber: 1,
      title: 'Paragrafo 4.2.1: Criterio Dati Tossicologici HBEL (ADE/PDE)',
      formulaTemplate: 'MACO = (HBEL_previous × MBS_next × PF) / (TDD_next × SF)',
      formulaSubstituted: `MACO = (${hbelMgDay} mg/die × ${mbsMg.toLocaleString('it-IT')} mg × ${purgingFactor}) / (${nextMaterialTddMg} mg/die × ${safetyFactorHbel})`,
      resultString: `${macoHbelMg.toLocaleString('it-IT')} mg (${(macoHbelMg / 1000).toFixed(4)} g)${
        chemFactor > 1 ? ` → Con Fattore Chimico ${chemFactor}x (Par. 4.2.6): ${macoHbelWithChemicalFactorMg.toLocaleString('it-IT')} mg` : ''
      }`,
      explanation:
        'Principio primario EMA GMP Annex 15 e APIC. Calcola il massimo residuo trasferibile consentito nel lotto successivo in base all\'esposizione giornaliera ammessa.',
    },
    {
      stepNumber: 2,
      title: 'Paragrafo 4.2.2: Criterio Limite Generale (General Limit 10 ppm / 100 ppm)',
      formulaTemplate: 'MACO = MAXCONC [mg/kg] × MBS [kg]',
      formulaSubstituted: `10 ppm = 10 mg/kg × ${nextMaterialMbsKg} kg | 100 ppm = 100 mg/kg × ${nextMaterialMbsKg} kg`,
      resultString: `10 ppm: ${maco10PpmMg.toLocaleString('it-IT')} mg | 100 ppm: ${maco100PpmMg.toLocaleString('it-IT')} mg`,
      explanation:
        'Limite empirico generale raccomandato dalla guida APIC (10 ppm standard precauzionale; 100 ppm frequentemente adottato per intermedi e API non potenti).',
    },
    {
      stepNumber: 3,
      title: 'Paragrafo 4.2.3: Criterio Macromolecole Terapeutiche e Peptidi (Dose 1/1000)',
      formulaTemplate: 'MACO = (TDD_previous × MBS_next) / (SF × TDD_next)',
      formulaSubstituted: `MACO = (${previousMaterialTddMg} mg/die × ${mbsMg.toLocaleString('it-IT')} mg) / (${doseSafetyFactor} × ${nextMaterialTddMg} mg/die)`,
      resultString: `Dose 1/1000: ${macoDoseMg.toLocaleString('it-IT')} mg${
        isMacromoleculeOrPeptide
          ? ` → Minimo con 10 ppm (Par. 4.2.3): ${macoMacromoleculeSelectedMg.toLocaleString('it-IT')} mg`
          : ''
      }`,
      explanation:
        'Applicabile quando HBEL dell\'attivo intatto non è richiesto a causa della degradazione/denaturazione da calore/pH estremi (Guida EMA/CHMP/CVMP/SWP/169430/2012).',
    },
    {
      stepNumber: 4,
      title: 'Selezione del Criterio Governatore Più Restrittivo',
      formulaTemplate: 'MACO_governante = min(MACO_HBEL, MACO_10ppm, MACO_Dose)',
      formulaSubstituted: `min(${effectiveHbelMaco} mg, ${maco10PpmMg} mg, ${macoDoseMg} mg)`,
      resultString: `${governingMacoMg.toLocaleString('it-IT')} mg (${governingCriteria})`,
      explanation:
        'Come stabilito dalla Guida APIC Sezione 4.0, viene adottato il limite più restrittivo tra i metodi applicabili per garantire la massima sicurezza del paziente.',
    },
    {
      stepNumber: 5,
      title: 'Paragrafo 4.2.4: Calcolo Limiti Swab (Equation 4.2.5-I)',
      formulaTemplate: 'Target [µg/dm²] = MACO [µg] / Total_Surface [dm²] | Limite_Swab = Target [µg/cm²] × Area_Swab × WF',
      formulaSubstituted: `Target = ${governingMacoUg.toLocaleString('it-IT')} µg / ${totalSurfaceAreaDm2} dm² = ${swabTargetValueUgDm2} µg/dm² (${swabTargetValueUgCm2} µg/cm²) | Swab = ${swabTargetValueUgCm2} × ${swabTemplateAreaCm2} × ${recoveryFraction}`,
      resultString: `Target Superficiale: ${swabTargetValueUgCm2} µg/cm² | Limite Rilevabile su Tampone (${swabTemplateAreaCm2} cm²): ${swabLimitWithRecoveryUg} µg/swab`,
      explanation:
        `Ripartizione uniforme della contaminazione ammessa sull'intera superficie condivisa, corretta per il fattore di recupero analitico (${swabRecoveryRatePercent}%).`,
    },
    {
      stepNumber: 6,
      title: 'Paragrafo 4.2.5: Calcolo Limite Risciacquo Finale (Rinse Target Value)',
      formulaTemplate: 'Target_Value [mg/L] = MACO [mg] / Volume_Rinse [L]',
      formulaSubstituted: `Target_Value = ${governingMacoMg} mg / ${rinseVolumeLiters} L`,
      resultString: `${rinseTargetValueMgL} mg/L (ppm)`,
      explanation:
        'Concentrazione massima ammessa nel volume di risciacquo finale, assumendo la dissoluzione uniforme del residuo residuo (Rinse Test).',
    },
    {
      stepNumber: 7,
      title: 'Paragrafo 4.1: Ispezione Visiva & Criterio "Visibly Clean"',
      formulaTemplate: 'Verifica: Limite_Superficie [µg/cm²] vs Soglia_Visiva [4.0 µg/cm²]',
      formulaSubstituted: `${swabTargetValueUgCm2} µg/cm² vs ${visualCleanlinessThresholdUgCm2} µg/cm²`,
      resultString: isVisualLimitMoreStringent ? 'Ispezione Visiva Più Restrittiva' : 'Campionamento Strumentale Obbligatorio',
      explanation:
        swabTargetValueUgCm2 < visualCleanlinessThresholdUgCm2
          ? 'Il limite superficiale calcolato è INFERIORE alla soglia visiva standard. L\'ispezione visiva da sola NON basta; è obbligatoria la quantificazione analitica strumentale.'
          : 'Il limite superficiale calcolato è superiore alla soglia visiva. Il criterio "visibly clean in dry conditions" è soddisfatto come barriera preventiva primaria.',
    },
  ];

  // 9. Warnings & Regulatory Checks
  const warnings: string[] = [];
  if (effectiveHbelMaco < maco10PpmMg && governingCriteria !== '4.2.1 Dati Tossicologici HBEL (ADE/PDE)') {
    warnings.push(
      'Nota Regolatoria EMA: Il limite basato su HBEL/PDE è più restrittivo di 10 ppm. Secondo EMA GMP Annex 15, l\'approccio tossicologico deve prevalere.'
    );
  }
  if (swabTargetValueUgCm2 < 1.0) {
    warnings.push(
      `Limite analitico superficiale molto basso (${swabTargetValueUgCm2} µg/cm²). Il metodo cromatografico deve avere un LOQ adeguato (inferiore al 50% della specifica).`
    );
  }
  if (chemFactor > 1 && !chemicalFactorJustification) {
    warnings.push(
      'Paragrafo 4.2.6: È stato applicato un fattore chimico di riduzione carryover senza aver inserito la giustificazione documentata firmata da un chimico competente.'
    );
  }

  return {
    macoHbelMg,
    macoHbelWithChemicalFactorMg,
    maco10PpmMg,
    maco100PpmMg,
    macoCustomPpmMg,
    macoDoseMg,
    macoMacromoleculeSelectedMg,
    governingCriteria,
    governingMacoMg,
    totalSurfaceAreaDm2,
    swabTargetValueUgDm2,
    swabTargetValueUgCm2,
    swabLimitPerTemplateUg,
    swabLimitWithRecoveryUg,
    totalSwabCarryOverUg,
    isTotalSwabWithinMaco,
    rinseTargetValueMgL,
    measuredRinseCarryOverMg,
    isRinseWithinTarget,
    isVisualLimitMoreStringent,
    visualCleanlinessThresholdUgCm2,
    auditSteps,
    warnings,
  };
}



