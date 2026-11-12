import React, { useState, useMemo, useEffect } from 'react';
import {
  PharmaceuticalCompound,
  FacilityMatrixTrain,
  EquipmentSegmentSwabItem,
  RinseVerificationSample,
  ApicChapter4CalculationInput,
  ApicChapter4CalculationResult,
} from '../types/apic';
import {
  executeApicChapter4Calculation,
  evaluateAllMatrixCombinations,
} from '../utils/apicCalculations';
import {
  generateCalculatorExcelXml,
  downloadFile,
} from '../utils/matrixExport';
import {
  Calculator,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Info,
  Printer,
  Sparkles,
  ArrowRight,
  Droplet,
  Layers,
  Scale,
  Edit3,
  Copy,
  Check,
  BookOpen,
  Code,
  Sliders,
  FileText,
  FileSpreadsheet,
  Eye,
  Plus,
  Trash2,
  FlaskConical,
  Beaker,
} from 'lucide-react';

interface ApicCalculatorProps {
  compounds: PharmaceuticalCompound[];
  selectedProductA?: PharmaceuticalCompound;
  onSelectProductA?: (compound: PharmaceuticalCompound) => void;
}

const STORAGE_KEY_MATRICES = 'apic_facility_matrices_multi_v1';

export const ApicCalculator: React.FC<ApicCalculatorProps> = ({
  compounds,
  selectedProductA,
  onSelectProductA,
}) => {
  // Load matrices from localStorage to allow direct import of Worst-Case cases identified in Scheda 1
  const [matrices, setMatrices] = useState<FacilityMatrixTrain[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MATRICES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Could not read matrices from localStorage', e);
    }
    return [];
  });

  // Re-read matrices whenever tab activates
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MATRICES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setMatrices(parsed);
      }
    } catch (e) {
      console.warn('Could not read matrices from localStorage', e);
    }
  }, []);

  // Compute worst-case pairs identified across all matrices in Scheda 1
  const matrixWorstCases = useMemo(() => {
    return matrices
      .map((m) => {
        if (m.products.length < 2) return null;
        const evaluation = evaluateAllMatrixCombinations(m.products, {
          sharedSurfaceAreaM2: m.sharedSurfaceAreaM2,
          swabAreaCm2: m.swabAreaCm2,
          swabRecoveryPercent: m.swabRecoveryPercent,
          rinseVolumeLiters: m.rinseVolumeLiters,
        });
        if (!evaluation.worstCaseCombination) return null;
        return {
          matrixIndex: m.matrixIndex,
          trainId: m.trainId,
          trainName: m.name,
          cleaningClass: m.cleaningClass,
          sharedAreaM2: m.sharedSurfaceAreaM2,
          swabAreaCm2: m.swabAreaCm2,
          swabRecovery: m.swabRecoveryPercent,
          rinseVolL: m.rinseVolumeLiters,
          visualLimitUgCm2: m.visualLimitUgCm2,
          worstCase: evaluation.worstCaseCombination,
          worstResidue: evaluation.worstResidueProduct,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [matrices]);

  // Selected worst-case case from Scheda 1 or custom input
  const [selectedCaseSource, setSelectedCaseSource] = useState<string>('custom');

  // Input states strictly according to APIC Chapter 4.0:
  // 1. Previous Product (Contaminant)
  const [previousProdName, setPreviousProdName] = useState<string>(
    selectedProductA ? selectedProductA.name : 'Atorvastatina Sale di Calcio'
  );
  const [hbelMgDay, setHbelMgDay] = useState<number>(
    selectedProductA ? selectedProductA.pdeMgDay : 0.15
  );
  const [hbelSource, setHbelSource] = useState<ApicChapter4CalculationInput['hbelSource']>(
    'PDE / ADE convalidato'
  );
  const [previousMaterialTddMg, setPreviousMaterialTddMg] = useState<number>(
    selectedProductA ? selectedProductA.minDailyDoseMg : 10.0
  );

  // 2. Next Product (Recipient B)
  const [nextProdName, setNextProdName] = useState<string>(
    'Prodotto B (Formulato Compresse 250 mg)'
  );
  const [nextMaterialMbsKg, setNextMaterialMbsKg] = useState<number>(200.0); // MBS in kg
  const [nextMaterialTddMg, setNextMaterialTddMg] = useState<number>(40.0); // TDDnext in mg/day

  // 3. APIC 4.2.1 Factors: Purging Factor & Safety Factor
  const [purgingFactor, setPurgingFactor] = useState<number>(1.0); // PF (default 1)
  const [purgingJustification, setPurgingJustification] = useState<string>('');
  const [safetyFactorHbel, setSafetyFactorHbel] = useState<number>(1.0); // SF (default 1)
  const [safetyFactorHbelNotes, setSafetyFactorHbelNotes] = useState<string>('');

  // 4. APIC 4.2.2 General Limit (ppm)
  const [generalLimitPpm, setGeneralLimitPpm] = useState<number>(10.0); // 10 ppm default

  // 5. APIC 4.2.3 Therapeutic Macromolecules & Peptides
  const [isMacromoleculeOrPeptide, setIsMacromoleculeOrPeptide] = useState<boolean>(false);
  const [doseSafetyFactor, setDoseSafetyFactor] = useState<number>(1000); // 1000 standard, 10000 parenteral

  // 6. APIC 4.2.6 Chemical Production Factor (1x to 10x)
  const [chemicalProductionFactor, setChemicalProductionFactor] = useState<number>(1.0);
  const [chemicalFactorJustification, setChemicalFactorJustification] = useState<string>('');

  // 7. Equipment Train contact surface & sampling dimensions (4.2.4 & 4.2.5)
  const [trainIdentifier, setTrainIdentifier] = useState<string>('A-Train');
  const [totalSurfaceAreaM2, setTotalSurfaceAreaM2] = useState<number>(25.0);
  const [swabTemplateAreaCm2, setSwabTemplateAreaCm2] = useState<number>(25.0);
  const [swabRecoveryRatePercent, setSwabRecoveryRatePercent] = useState<number>(85.0);
  const [rinseVolumeLiters, setRinseVolumeLiters] = useState<number>(500.0);
  const [visualCleanlinessThresholdUgCm2, setVisualCleanlinessThresholdUgCm2] = useState<number>(4.0);

  // 8. Multi-equipment segmented swab breakdown (Equation 4.2.5-II)
  const [enableSegments, setEnableSegments] = useState<boolean>(false);
  const [segments, setSegments] = useState<EquipmentSegmentSwabItem[]>([
    {
      id: 'seg-1',
      name: 'Reattore Principale R-101',
      areaDm2: 1200, // 12 m²
      material: 'Stainless Steel 316L',
      measuredSwabResidueUgDm2: 15.0,
      expectedMaxResidueUgDm2: 50.0,
    },
    {
      id: 'seg-2',
      name: 'Condensatore e Linea Vapori C-102',
      areaDm2: 500, // 5 m²
      material: 'Hastelloy',
      measuredSwabResidueUgDm2: 8.5,
      expectedMaxResidueUgDm2: 30.0,
    },
    {
      id: 'seg-3',
      name: 'Filtro Nutsche / Essiccatore F-103',
      areaDm2: 800, // 8 m²
      material: 'Glass-Lined / Smaltato',
      measuredSwabResidueUgDm2: 22.0,
      expectedMaxResidueUgDm2: 60.0,
    },
  ]);

  // 9. Rinse Verification Sample (Equation 5)
  const [enableRinseVerification, setEnableRinseVerification] = useState<boolean>(false);
  const [rinseVerification, setRinseVerification] = useState<RinseVerificationSample>({
    rinseVolumeLiters: 500.0,
    sampleImpurityConcMgL: 0.18,
    blankSolventConcMgL: 0.02,
  });

  // Toast / feedback message
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Load a Worst-Case Case identified in Scheda 1
  const handleLoadWorstCaseFromMatrix = (matrixIdxStr: string) => {
    setSelectedCaseSource(matrixIdxStr);
    if (matrixIdxStr === 'custom') return;

    const target = matrixWorstCases.find((m) => String(m.matrixIndex) === matrixIdxStr);
    if (target && target.worstCase) {
      const wc = target.worstCase;
      setTrainIdentifier(target.trainId);
      setPreviousProdName(wc.fromProduct.name);
      setHbelMgDay(wc.fromProduct.pdeMgDay > 0 ? wc.fromProduct.pdeMgDay : wc.fromProduct.pdeUgDay / 1000);
      setHbelSource('PDE / ADE convalidato');
      setPreviousMaterialTddMg(wc.fromProduct.minDailyDoseMg);

      setNextProdName(wc.toProduct.name);
      setNextMaterialMbsKg(wc.toProduct.minBatchSizeKg);
      setNextMaterialTddMg(wc.toProduct.maxDailyDoseMg);

      setTotalSurfaceAreaM2(target.sharedAreaM2);
      setSwabTemplateAreaCm2(target.swabAreaCm2);
      setSwabRecoveryRatePercent(target.swabRecovery);
      setRinseVolumeLiters(target.rinseVolL);
      setVisualCleanlinessThresholdUgCm2(target.visualLimitUgCm2);

      showToast(`Caricato Caso Peggiore da ${target.trainId} (${wc.fromProduct.name} → ${wc.toProduct.name})`);
    }
  };

  // Memoize Calculation Input
  const calcInput: ApicChapter4CalculationInput = useMemo(() => {
    return {
      hbelMgDay: Number(hbelMgDay) > 0 ? Number(hbelMgDay) : 0.001,
      hbelSource,
      nextMaterialMbsKg: Number(nextMaterialMbsKg) > 0 ? Number(nextMaterialMbsKg) : 1,
      nextMaterialTddMg: Number(nextMaterialTddMg) > 0 ? Number(nextMaterialTddMg) : 1,
      purgingFactor: Number(purgingFactor) > 0 ? Number(purgingFactor) : 1,
      safetyFactorHbel: Number(safetyFactorHbel) > 0 ? Number(safetyFactorHbel) : 1,
      generalLimitPpm: Number(generalLimitPpm) > 0 ? Number(generalLimitPpm) : 10,
      previousMaterialTddMg: Number(previousMaterialTddMg) > 0 ? Number(previousMaterialTddMg) : 1,
      doseSafetyFactor: Number(doseSafetyFactor) > 0 ? Number(doseSafetyFactor) : 1000,
      isMacromoleculeOrPeptide,
      chemicalProductionFactor: Number(chemicalProductionFactor) >= 1 ? Number(chemicalProductionFactor) : 1,
      chemicalFactorJustification: chemicalFactorJustification.trim() || undefined,
      totalSurfaceAreaM2: Number(totalSurfaceAreaM2) > 0 ? Number(totalSurfaceAreaM2) : 25,
      swabTemplateAreaCm2: Number(swabTemplateAreaCm2) > 0 ? Number(swabTemplateAreaCm2) : 25,
      swabRecoveryRatePercent: Number(swabRecoveryRatePercent) > 0 ? Number(swabRecoveryRatePercent) : 85,
      rinseVolumeLiters: Number(rinseVolumeLiters) > 0 ? Number(rinseVolumeLiters) : 500,
      visualCleanlinessThresholdUgCm2: Number(visualCleanlinessThresholdUgCm2) > 0 ? Number(visualCleanlinessThresholdUgCm2) : 4.0,
      segments: enableSegments ? segments : undefined,
      rinseVerification: enableRinseVerification ? rinseVerification : undefined,
    };
  }, [
    hbelMgDay,
    hbelSource,
    nextMaterialMbsKg,
    nextMaterialTddMg,
    purgingFactor,
    safetyFactorHbel,
    generalLimitPpm,
    previousMaterialTddMg,
    doseSafetyFactor,
    isMacromoleculeOrPeptide,
    chemicalProductionFactor,
    chemicalFactorJustification,
    totalSurfaceAreaM2,
    swabTemplateAreaCm2,
    swabRecoveryRatePercent,
    rinseVolumeLiters,
    visualCleanlinessThresholdUgCm2,
    enableSegments,
    segments,
    enableRinseVerification,
    rinseVerification,
  ]);

  // Execute Chapter 4 Calculation
  const calcResult: ApicChapter4CalculationResult = useMemo(() => {
    return executeApicChapter4Calculation(calcInput);
  }, [calcInput]);

  // Handler for exporting dynamic Excel workbook with live formulas
  const handleExportDynamicExcel = () => {
    const currentTrain = matrices.find(
      (m) => String(m.matrixIndex) === selectedCaseSource || m.trainId === trainIdentifier
    );
    const trainInfo: Partial<FacilityMatrixTrain> = {
      trainId: trainIdentifier,
      name: currentTrain?.name || `Impianto Convalidato ${trainIdentifier}`,
      cleaningClass: currentTrain?.cleaningClass || 'Class I',
      cleaningSolventNotes: currentTrain?.cleaningSolventNotes || 'Acqua Purificata / Solvente Standard',
      sharedSurfaceAreaM2: Number(totalSurfaceAreaM2) || 25,
      swabAreaCm2: Number(swabTemplateAreaCm2) || 25,
      swabRecoveryPercent: Number(swabRecoveryRatePercent) || 85,
      rinseVolumeLiters: Number(rinseVolumeLiters) || 500,
      visualLimitUgCm2: Number(visualCleanlinessThresholdUgCm2) || 4.0,
      products: [
        {
          id: 'calc-prod-prev-a',
          name: previousProdName || 'Residuo Precedente A',
          casNumber: 'Precedente',
          type: 'API',
          cleanabilityCategory: 2,
          solubilityGroup: 2,
          pdeUgDay: Number(hbelMgDay) * 1000,
          pdeMgDay: Number(hbelMgDay),
          pdeGroup: 2,
          minDailyDoseMg: Number(previousMaterialTddMg) || 10,
          doseGroup: 2,
          minBatchSizeKg: Number(nextMaterialMbsKg) || 250,
          maxDailyDoseMg: Number(nextMaterialTddMg) || 40,
        },
        {
          id: 'calc-prod-next-b',
          name: nextProdName || 'Prodotto Successivo B',
          casNumber: 'Successivo',
          type: 'Finished Product',
          cleanabilityCategory: 2,
          solubilityGroup: 2,
          pdeUgDay: 500,
          pdeMgDay: 0.5,
          pdeGroup: 2,
          minDailyDoseMg: 20,
          doseGroup: 2,
          minBatchSizeKg: Number(nextMaterialMbsKg) || 250,
          maxDailyDoseMg: Number(nextMaterialTddMg) || 40,
        },
      ],
    };

    const xml = generateCalculatorExcelXml(calcInput, calcResult, trainInfo);
    const safeName = (trainIdentifier || 'APIC').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `APIC_Calcolatore_MACO_Dinamico_${safeName}_${new Date().toISOString().slice(0, 10)}.xml`;
    downloadFile(xml, filename, 'application/vnd.ms-excel;charset=utf-8;');
    showToast('Report Excel dinamico scaricato: include formule attive =MIN, =HBEL, =Swab');
  };

  // Copy explicit validation protocol to clipboard
  const [copiedAuditTrail, setCopiedAuditTrail] = useState(false);
  const handleCopyAuditTrail = () => {
    const lines = [
      `================================================================================`,
      `VERBALE DI CONVALIDA DELLA PULIZIA - CRITERI DI ACCETTAZIONE APIC (CAPITOLO 4.0)`,
      `Conforme alla Guida APIC / CEFIC (Revisione 2021) & EMA GMP Annex 15`,
      `Data: ${new Date().toLocaleDateString('it-IT')} ${new Date().toLocaleTimeString('it-IT')}`,
      `Treno d'Impianto: ${trainIdentifier}`,
      `================================================================================`,
      ``,
      `1. INFORMAZIONI GENERALI SUL CAMBIO PRODOTTO (CHANGE-OVER):`,
      `- Sostanza Precedente (Contaminante A): ${previousProdName}`,
      `- HBEL (ADE / PDE): ${hbelMgDay} mg/die (${hbelMgDay * 1000} µg/die) [Fonte: ${hbelSource}]`,
      `- Minima Dose Terapeutica A (TDD_previous): ${previousMaterialTddMg} mg/die`,
      `- Sostanza Successiva (Ricevente B): ${nextProdName}`,
      `- Dimensione Minima Lotto B (MBS_next): ${nextMaterialMbsKg} kg (${nextMaterialMbsKg * 1000000} mg)`,
      `- Dose Massima Giornaliera B (TDD_next): ${nextMaterialTddMg} mg/die`,
      `- Purging Factor (PF): ${purgingFactor}`,
      `- Safety Factor HBEL (SF): ${safetyFactorHbel}`,
      `- Fattore Sintesi Chimica API (Par. 4.2.6): ${chemicalProductionFactor}x`,
      ``,
      `2. CONFRONTO DEI METODI DI CALCOLO APIC (SEZIONE 4.2):`,
      `- 4.2.1 Criterio Dati Tossicologici HBEL: ${calcResult.macoHbelMg} mg (Con Fattore Chimico: ${calcResult.macoHbelWithChemicalFactorMg} mg)`,
      `- 4.2.2 Criterio Limite Generale 10 ppm: ${calcResult.maco10PpmMg} mg`,
      `- 4.2.2 Criterio Limite Generale 100 ppm: ${calcResult.maco100PpmMg} mg`,
      `- 4.2.3 Criterio Dose / Macromolecole (1/1000): ${calcResult.macoDoseMg} mg`,
      `- CRITERIO GOVERNANTE PIÙ RESTRITTIVO: ${calcResult.governingMacoMg} mg (${calcResult.governingCriteria})`,
      ``,
      `3. LIMITI OPERATIVI DI CAMPIONAMENTO & LABORATORIO QC:`,
      `- Superficie Totale di Contatto: ${totalSurfaceAreaM2} m² (${calcResult.totalSurfaceAreaDm2} dm²)`,
      `- Valore Target Superficiale (Eq. 4.2.5-I): ${calcResult.swabTargetValueUgDm2} µg/dm² (${calcResult.swabTargetValueUgCm2} µg/cm²)`,
      `- Limite Analitico Swab (${swabTemplateAreaCm2} cm²): ${calcResult.swabLimitPerTemplateUg} µg/tampone`,
      `- Limite Swab Corretto per Recupero (${swabRecoveryRatePercent}%): ${calcResult.swabLimitWithRecoveryUg} µg/tampone`,
      `- Valore Target Solvente di Risciacquo (${rinseVolumeLiters} L): ${calcResult.rinseTargetValueMgL} mg/L (ppm)`,
      `- Valutazione Visiva "Visibly Clean" (${visualCleanlinessThresholdUgCm2} µg/cm²): ${
        calcResult.isVisualLimitMoreStringent ? 'Ispezione Visiva Più Restrittiva' : 'Campionamento Strumentale Obbligatorio'
      }`,
      ``,
      `4. PASSAGGI DI CALCOLO DETTAGLIATI (AUDIT TRAIL):`,
      ...calcResult.auditSteps.map(
        (s) =>
          `[Passaggio ${s.stepNumber}] ${s.title}\n  Formula: ${s.formulaTemplate}\n  Sostituzione: ${s.formulaSubstituted}\n  Risultato: ${s.resultString}\n`
      ),
      `================================================================================`,
    ].join('\n');

    navigator.clipboard.writeText(lines).then(() => {
      setCopiedAuditTrail(true);
      setTimeout(() => setCopiedAuditTrail(false), 2500);
      showToast('Verbale di calcolo APIC copiato negli appunti');
    });
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-teal-600 text-white px-4 py-2.5 rounded-xl shadow-2xl text-xs font-semibold flex items-center space-x-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-200" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Header: Scheda 2 Focus with Distinctive Emerald/Mint Environment Styling */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-teal-950/30 border-2 border-emerald-500/40 p-6 rounded-2xl shadow-2xl shadow-emerald-950/30 flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30 uppercase tracking-wider flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-950 animate-pulse"></span>
              <span>AMBIENTE: SCHEDA 2 • CALCOLO CRITERI DI ACCETTAZIONE APIC</span>
            </span>
            <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
              Guida APIC Cap. 4.0 • MACO &amp; Limiti Swab/Rinse
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-2 flex items-center space-x-2">
            <span>Calcolatore MACO &amp; Criteri di Accettazione APIC (Par. 4.1 – 4.2.5)</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1.5 max-w-4xl leading-relaxed">
            Esegue tutti i calcoli previsti dalla procedura APIC per i casi peggiori (<strong>Worst-Case</strong>) identificati nella <strong>Scheda 1</strong>: dati tossicologici HBEL (<strong>4.2.1</strong>), limite generale (<strong>4.2.2</strong>), macromolecole e peptidi (<strong>4.2.3</strong>), limiti swab (<strong>4.2.4</strong>) e limiti di risciacquo (<strong>4.2.5</strong>).
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start md:self-auto relative z-10">
          <button
            onClick={handleCopyAuditTrail}
            className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold transition-colors shadow-md"
            title="Copia il verbale matematico completo pronto per allegato GMP"
          >
            {copiedAuditTrail ? <Check className="w-4 h-4 text-emerald-200" /> : <Copy className="w-4 h-4" />}
            <span>{copiedAuditTrail ? 'Copiato!' : 'Copia Verbale APIC'}</span>
          </button>

          <button
            onClick={handleExportDynamicExcel}
            className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/25 hover:scale-[1.02]"
            title="Esporta il modello completo in Microsoft Excel (.xml) con formule attive =MIN, =HBEL, =Swab e celle interattive per simulazioni What-If"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
            <span>Esporta Excel con Formule</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors"
          >
            <Printer className="w-4 h-4 text-teal-400" />
            <span>Stampa Verbale</span>
          </button>
        </div>
      </div>

      {/* QUICK SELECTOR: Connect with Worst-Case cases identified in Scheda 1 */}
      <div className="bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-900 border border-purple-500/50 p-4 rounded-2xl shadow-lg space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Importa Caso Worst-Case Identificato nella Scheda 1 (Matrici Impianto):
            </span>
          </div>
          <span className="text-[11px] text-purple-300">
            {matrixWorstCases.length > 0
              ? `${matrixWorstCases.length} Casi Peggiori pronti per il calcolo dei Criteri di Accettazione`
              : 'Nessun Worst-Case rilevato: aggiungi almeno 2 prodotti in una matrice nella Scheda 1'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleLoadWorstCaseFromMatrix('custom')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
              selectedCaseSource === 'custom'
                ? 'bg-purple-600 text-white border-purple-400 shadow-md'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-700'
            }`}
          >
            Parametri Personalizzati / Manuale
          </button>

          {matrixWorstCases.map((m) => (
            <button
              key={m.matrixIndex}
              onClick={() => handleLoadWorstCaseFromMatrix(String(m.matrixIndex))}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                selectedCaseSource === String(m.matrixIndex)
                  ? 'bg-purple-600 text-white border-purple-400 shadow-md ring-1 ring-purple-400'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-700'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-purple-900 text-purple-200 text-[10px] flex items-center justify-center font-bold">
                {m.matrixIndex}
              </span>
              <span>
                {m.trainId} ({m.worstCase.fromProduct.name} → {m.worstCase.toProduct.name})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* INPUTS ACCORDION / GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Box 1: Preceding Product (A) & HBEL (4.2.1) */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-md space-y-3">
          <div className="flex items-center space-x-2 text-xs font-bold text-teal-400 uppercase tracking-wider mb-1">
            <span className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-300 flex items-center justify-center font-bold">
              1
            </span>
            <span>Prodotto Precedente (A) & HBEL (Par. 4.2.1)</span>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Nome Sostanza Contaminante:</label>
            <input
              type="text"
              value={previousProdName}
              onChange={(e) => setPreviousProdName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-teal-500 font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-400 block mb-1">HBEL (ADE / PDE) [mg/die]:</label>
              <input
                type="number"
                step="any"
                min="0.0001"
                value={hbelMgDay}
                onChange={(e) => setHbelMgDay(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-teal-300 font-mono font-bold focus:outline-none focus:border-teal-500"
              />
              <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                = {(hbelMgDay * 1000).toLocaleString('it-IT')} µg/die
              </span>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Dose Minima A (TDD) [mg]:</label>
              <input
                type="number"
                step="any"
                min="0.01"
                value={previousMaterialTddMg}
                onChange={(e) => setPreviousMaterialTddMg(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-teal-500"
              />
              <span className="text-[10px] text-slate-400 block mt-0.5">Per criterio dose 4.2.3</span>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Origine Dati HBEL (Par. 4.2.1.2):</label>
            <select
              value={hbelSource}
              onChange={(e) => setHbelSource(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-teal-500"
            >
              <option value="PDE / ADE convalidato">1. PDE / ADE Convalidato (Dossier Tossicologico)</option>
              <option value="NOAEL / LOAEL">2. NOAEL / LOAEL con Fattori d&apos;Incertezza F1-F5</option>
              <option value="LD50 estrapolato">3. LD50 estrapolato (NOEL = LD50 * BW / 2000)</option>
              <option value="TTC Dolan (1, 10, 100 µg)">4. Soglia di Preoccupazione Tossicologica (TTC)</option>
            </select>
          </div>

          {/* Purging Factor & Safety Factor */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">
                Purging Factor (PF):
              </label>
              <input
                type="number"
                step="any"
                min="1"
                value={purgingFactor}
                onChange={(e) => setPurgingFactor(parseFloat(e.target.value) || 1)}
                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-teal-500"
              />
              <span className="text-[9px] text-slate-500 block">Default = 1 (R&D evidence)</span>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">
                Safety Factor (SF):
              </label>
              <input
                type="number"
                step="any"
                min="1"
                value={safetyFactorHbel}
                onChange={(e) => setSafetyFactorHbel(parseFloat(e.target.value) || 1)}
                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-teal-500"
              />
              <span className="text-[9px] text-slate-500 block">Default = 1 (Assessed by tox)</span>
            </div>
          </div>
        </div>

        {/* Box 2: Next Product (Recipient B) (4.2.1, 4.2.2, 4.2.3) */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-md space-y-3">
          <div className="flex items-center space-x-2 text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">
            <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center font-bold">
              2
            </span>
            <span>Prodotto Successivo (B) & Criteri 4.2.2 - 4.2.3</span>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Nome Sostanza Ricevente (B):</label>
            <input
              type="text"
              value={nextProdName}
              onChange={(e) => setNextProdName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-400 block mb-1">
                Lotto Minimo B (MBS) [kg]:
              </label>
              <input
                type="number"
                step="any"
                min="0.1"
                value={nextMaterialMbsKg}
                onChange={(e) => setNextMaterialMbsKg(parseFloat(e.target.value) || 1)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-blue-300 font-mono font-bold focus:outline-none focus:border-blue-500"
              />
              <span className="text-[10px] text-slate-500 block mt-0.5">
                = {(nextMaterialMbsKg * 1000000).toLocaleString('it-IT')} mg
              </span>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">
                Dose Massima B (TDD) [mg]:
              </label>
              <input
                type="number"
                step="any"
                min="0.01"
                value={nextMaterialTddMg}
                onChange={(e) => setNextMaterialTddMg(parseFloat(e.target.value) || 1)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-blue-500"
              />
              <span className="text-[10px] text-slate-500 block mt-0.5">Dose max giornaliera B</span>
            </div>
          </div>

          {/* Par. 4.2.2: General Limit selection */}
          <div className="pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-slate-400">Limite Generale (Par. 4.2.2):</label>
              <span className="font-mono text-purple-300 font-bold text-xs">{generalLimitPpm} ppm</span>
            </div>
            <div className="flex items-center space-x-2">
              {[10, 50, 100, 200].map((ppmVal) => (
                <button
                  key={ppmVal}
                  type="button"
                  onClick={() => setGeneralLimitPpm(ppmVal)}
                  className={`px-2 py-1 rounded text-xs font-mono font-semibold transition-colors ${
                    generalLimitPpm === ppmVal
                      ? 'bg-purple-600 text-white font-bold'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {ppmVal} ppm
                </button>
              ))}
            </div>
          </div>

          {/* Par. 4.2.3: Therapeutic Macromolecules and Peptides toggle */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-300 font-semibold block">
                Macromolecola / Peptide (Par. 4.2.3):
              </span>
              <span className="text-[10px] text-slate-500 block">
                Degradazione pH/calore estremi (minimo tra 1/1000 dose e 10 ppm)
              </span>
            </div>
            <input
              type="checkbox"
              checked={isMacromoleculeOrPeptide}
              onChange={(e) => setIsMacromoleculeOrPeptide(e.target.checked)}
              className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 border-slate-700 bg-slate-800"
            />
          </div>
        </div>

        {/* Box 3: Shared Contact Surface & Sampling Dimensions (4.2.4 & 4.2.5) */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-md space-y-3">
          <div className="flex items-center space-x-2 text-xs font-bold text-purple-400 uppercase tracking-wider mb-1">
            <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold">
              3
            </span>
            <span>Impianto Condiviso & Campionamento (4.2.4 - 4.2.5)</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Superficie Totale (m²):</label>
              <input
                type="number"
                step="any"
                min="0.1"
                value={totalSurfaceAreaM2}
                onChange={(e) => setTotalSurfaceAreaM2(parseFloat(e.target.value) || 1)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-purple-500"
              />
              <span className="text-[10px] text-slate-500 block mt-0.5">
                = {totalSurfaceAreaM2 * 100} dm² ({totalSurfaceAreaM2 * 10000} cm²)
              </span>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Dima Swab (cm²):</label>
              <input
                type="number"
                step="any"
                min="1"
                value={swabTemplateAreaCm2}
                onChange={(e) => setSwabTemplateAreaCm2(parseFloat(e.target.value) || 25)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-purple-500"
              />
              <span className="text-[10px] text-slate-500 block mt-0.5">Template standard</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Recupero Swab WF (%):</label>
              <input
                type="number"
                step="any"
                min="10"
                max="100"
                value={swabRecoveryRatePercent}
                onChange={(e) => setSwabRecoveryRatePercent(parseFloat(e.target.value) || 85)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-purple-500"
              />
              <span className="text-[10px] text-slate-500 block mt-0.5">Fattore di recupero</span>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Volume Risciacquo (L):</label>
              <input
                type="number"
                step="any"
                min="1"
                value={rinseVolumeLiters}
                onChange={(e) => setRinseVolumeLiters(parseFloat(e.target.value) || 500)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-purple-500"
              />
              <span className="text-[10px] text-slate-500 block mt-0.5">Volume di lavaggio/rinse</span>
            </div>
          </div>

          {/* Par. 4.2.6: Chemical Production Factor */}
          <div className="pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-slate-300 font-semibold">
                Fattore Sintesi Chimica API (Par. 4.2.6):
              </label>
              <span className="font-mono text-amber-300 font-bold text-xs">{chemicalProductionFactor}x</span>
            </div>
            <div className="flex items-center space-x-2">
              {[1, 2, 5, 10].map((fVal) => (
                <button
                  key={fVal}
                  type="button"
                  onClick={() => setChemicalProductionFactor(fVal)}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition-colors ${
                    chemicalProductionFactor === fVal
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {fVal}x
                </button>
              ))}
            </div>
            <span className="text-[10px] text-slate-500 block mt-1">
              1x per operazioni fisiche (essiccamento/miscelazione); 5-10x per fasi chimiche con purificazione/cristallizzazione.
            </span>
          </div>
        </div>
      </div>

      {/* CORE DISPLAY: THE 3 APIC CALCULATION METHODS (4.2.1, 4.2.2, 4.2.3) SIDE-BY-SIDE */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div>
            <span className="text-xs font-bold text-teal-400 uppercase tracking-wider block">
              Confronto Criteri di Accettazione (APIC Sezione 4.2)
            </span>
            <h2 className="text-xl font-black text-white mt-0.5">
              Calcolo Simultaneo MACO per Ciascun Metodo della Procedura
            </h2>
          </div>
          <div className="px-3.5 py-1.5 rounded-xl bg-teal-950/70 text-teal-300 border border-teal-700/60 font-mono text-xs font-bold">
            Governante: {calcResult.governingCriteria}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 4.2.1: Health-based data (ADE / PDE) */}
          <div
            className={`p-5 rounded-2xl border transition-all ${
              calcResult.governingCriteria === '4.2.1 Dati Tossicologici HBEL (ADE/PDE)'
                ? 'bg-teal-950/40 border-teal-500 shadow-lg ring-1 ring-teal-500/30'
                : 'bg-slate-850/60 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-teal-300 uppercase tracking-wide">
                4.2.1 Dati Tossicologici HBEL
              </span>
              {calcResult.governingCriteria === '4.2.1 Dati Tossicologici HBEL (ADE/PDE)' && (
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-teal-500 text-slate-950">
                  GOVERNANTE
                </span>
              )}
            </div>

            <div className="text-3xl font-black text-white font-mono mt-1">
              {calcResult.macoHbelMg.toLocaleString('it-IT')}{' '}
              <span className="text-sm font-normal text-slate-400">mg</span>
            </div>

            {chemicalProductionFactor > 1 && (
              <div className="mt-1.5 text-xs text-amber-300 font-mono bg-amber-950/40 px-2 py-1 rounded border border-amber-800/40">
                Con Fattore Chimico {chemicalProductionFactor}x (Par. 4.2.6):{' '}
                <strong>{calcResult.macoHbelWithChemicalFactorMg.toLocaleString('it-IT')} mg</strong>
              </div>
            )}

            <div className="mt-3 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] font-mono space-y-1 text-slate-300">
              <div className="text-teal-400 font-bold">MACO = (HBEL × MBS × PF) / (TDD × SF)</div>
              <div className="text-slate-400 truncate">
                ({hbelMgDay} mg × {nextMaterialMbsKg * 1000000} mg × {purgingFactor}) / ({nextMaterialTddMg} mg × {safetyFactorHbel})
              </div>
            </div>

            <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
              Standard primario raccomandato per principi attivi ed intermedi con dati tossicologici validati (ADE/PDE EMA).
            </p>
          </div>

          {/* Card 4.2.2: General Limit (10 ppm / 100 ppm) */}
          <div
            className={`p-5 rounded-2xl border transition-all ${
              calcResult.governingCriteria.includes('4.2.2')
                ? 'bg-purple-950/40 border-purple-500 shadow-lg ring-1 ring-purple-500/30'
                : 'bg-slate-850/60 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-purple-300 uppercase tracking-wide">
                4.2.2 Limite Generale (General Limit)
              </span>
              {calcResult.governingCriteria.includes('4.2.2') && (
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-purple-500 text-slate-950">
                  GOVERNANTE
                </span>
              )}
            </div>

            <div className="text-3xl font-black text-white font-mono mt-1">
              {calcResult.maco10PpmMg.toLocaleString('it-IT')}{' '}
              <span className="text-sm font-normal text-slate-400">mg</span>
              <span className="text-xs text-purple-300 block font-sans font-normal">(a 10 ppm standard)</span>
            </div>

            <div className="mt-1 text-xs text-slate-400 font-mono">
              A 100 ppm (tipico API): <strong className="text-white">{calcResult.maco100PpmMg.toLocaleString('it-IT')} mg</strong>
            </div>

            <div className="mt-3 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] font-mono space-y-1 text-slate-300">
              <div className="text-purple-400 font-bold">MACO = MAXCONC [mg/kg] × MBS [kg]</div>
              <div className="text-slate-400">
                10 mg/kg × {nextMaterialMbsKg} kg = {calcResult.maco10PpmMg} mg (0.001% lotto)
              </div>
            </div>

            <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
              Criterio empirico generale applicabile quando i dati tossicologici sono limitati o come tetto massimo aziendale.
            </p>
          </div>

          {/* Card 4.2.3: Therapeutic Macromolecules and Peptides (1/1000th dose) */}
          <div
            className={`p-5 rounded-2xl border transition-all ${
              calcResult.governingCriteria.includes('4.2.3')
                ? 'bg-blue-950/40 border-blue-500 shadow-lg ring-1 ring-blue-500/30'
                : 'bg-slate-850/60 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-blue-300 uppercase tracking-wide">
                4.2.3 Macromolecole & Peptidi (Dose)
              </span>
              {calcResult.governingCriteria.includes('4.2.3') && (
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-500 text-slate-950">
                  GOVERNANTE
                </span>
              )}
            </div>

            <div className="text-3xl font-black text-white font-mono mt-1">
              {calcResult.macoDoseMg.toLocaleString('it-IT')}{' '}
              <span className="text-sm font-normal text-slate-400">mg</span>
            </div>

            {isMacromoleculeOrPeptide && (
              <div className="mt-1 text-xs text-blue-300 font-mono">
                Minimo combinato con 10 ppm: <strong className="text-white">{calcResult.macoMacromoleculeSelectedMg.toLocaleString('it-IT')} mg</strong>
              </div>
            )}

            <div className="mt-3 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] font-mono space-y-1 text-slate-300">
              <div className="text-blue-400 font-bold">MACO = (TDD_prev × MBS) / (SF × TDD_next)</div>
              <div className="text-slate-400 truncate">
                ({previousMaterialTddMg} mg × {nextMaterialMbsKg * 1000000} mg) / ({doseSafetyFactor} × {nextMaterialTddMg} mg)
              </div>
            </div>

            <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
              Dose 1/1000th adottata per peptidi e macromolecole denaturati da pH o calore, o per prodotti storici.
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 4.2.4 & 4.2.5: SWAB AND RINSE LIMITS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* PARAGRAPH 4.2.4: SWAB LIMITS */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <Scale className="w-5 h-5 text-teal-400" />
              <h3 className="text-base font-bold text-white">4.2.4 Limiti Swab (Tampone Superficiale)</h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">Equazione 4.2.5-I</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-slate-850 p-3 rounded-xl border border-slate-700">
              <span className="text-[11px] text-slate-400 block">Target Superficiale (dm²)</span>
              <span className="text-xl font-black text-white font-mono mt-0.5 block">
                {calcResult.swabTargetValueUgDm2} <span className="text-xs font-normal text-slate-400">µg/dm²</span>
              </span>
            </div>

            <div className="bg-slate-850 p-3 rounded-xl border border-slate-700">
              <span className="text-[11px] text-slate-400 block">Target per cm²</span>
              <span className="text-xl font-black text-teal-400 font-mono mt-0.5 block">
                {calcResult.swabTargetValueUgCm2} <span className="text-xs font-normal text-slate-400">µg/cm²</span>
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-teal-950/30 border border-teal-500/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-teal-300">
                Limite Rilevabile su Dima ({swabTemplateAreaCm2} cm²):
              </span>
              <span className="text-xs text-slate-400 font-mono">Recovery: {swabRecoveryRatePercent}%</span>
            </div>
            <div className="text-2xl font-black text-white font-mono">
              {calcResult.swabLimitWithRecoveryUg}{' '}
              <span className="text-xs font-normal text-slate-400">µg/swab</span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              Valore teorico grezzo (100% recovery): {calcResult.swabLimitPerTemplateUg} µg/swab
            </div>
          </div>

          {/* Equation 4.2.5-II: Segmented Carry Over Toggle */}
          <div className="pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                <Layers className="w-4 h-4 text-purple-400" />
                <span>Calcolo Segmentato Treno Impianto (Eq. 4.2.5-II)</span>
              </span>
              <button
                type="button"
                onClick={() => setEnableSegments(!enableSegments)}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                  enableSegments ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {enableSegments ? 'Attivo' : 'Abilita'}
              </button>
            </div>

            {enableSegments && (
              <div className="mt-3 space-y-3 bg-slate-850 p-3 rounded-xl border border-slate-700 text-xs">
                <span className="text-[11px] text-slate-400 block">
                  CO [µg] = Σ (Ai [dm²] × mi [µg/dm²]) — Verifica criteri AC1 e AC2 per ciascun componente:
                </span>

                <div className="space-y-2">
                  {segments.map((seg, idx) => (
                    <div key={seg.id} className="p-2 bg-slate-900 rounded-lg flex items-center justify-between gap-2">
                      <div>
                        <div className="font-bold text-white">{seg.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {seg.areaDm2} dm² ({seg.material})
                        </div>
                      </div>
                      <div className="flex items-center space-x-1">
                        <input
                          type="number"
                          step="any"
                          value={seg.measuredSwabResidueUgDm2 || 0}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setSegments((prev) =>
                              prev.map((s) => (s.id === seg.id ? { ...s, measuredSwabResidueUgDm2: val } : s))
                            );
                          }}
                          className="w-16 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs font-mono text-white text-right"
                        />
                        <span className="text-[10px] text-slate-400">µg/dm²</span>
                      </div>
                    </div>
                  ))}
                </div>

                {calcResult.totalSwabCarryOverUg !== undefined && (
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-purple-500/40 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Totale Carry Over Misurato (CO):</span>
                      <span className="font-mono font-bold text-white text-sm">
                        {calcResult.totalSwabCarryOverUg.toLocaleString('it-IT')} µg (
                        {(calcResult.totalSwabCarryOverUg / 1000).toFixed(3)} mg)
                      </span>
                    </div>
                    <div>
                      {calcResult.isTotalSwabWithinMaco ? (
                        <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold flex items-center space-x-1">
                          <Check className="w-3 h-3" />
                          <span>CO ≤ MACO (CONFORME)</span>
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold flex items-center space-x-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span>CO &gt; MACO (NON CONFORME)</span>
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* PARAGRAPH 4.2.5: RINSE LIMITS */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <Droplet className="w-5 h-5 text-blue-400" />
              <h3 className="text-base font-bold text-white">4.2.5 Limiti Risciacquo (Rinse Limit)</h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">Volume: {rinseVolumeLiters} L</span>
          </div>

          <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-500/40 space-y-2">
            <span className="text-xs font-bold text-blue-300">
              Valore Target Concentrazione (Target Value):
            </span>
            <div className="text-3xl font-black text-white font-mono">
              {calcResult.rinseTargetValueMgL}{' '}
              <span className="text-sm font-normal text-slate-400">mg/L (ppm)</span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              Target (mg/L) = MACO ({calcResult.governingMacoMg} mg) / Volume ({rinseVolumeLiters} L)
            </div>
          </div>

          {/* Equation 5: Experimental Rinse Verification Toggle */}
          <div className="pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                <FlaskConical className="w-4 h-4 text-blue-400" />
                <span>Verifica Sperimentale Campione Risciacquo (Equazione 5)</span>
              </span>
              <button
                type="button"
                onClick={() => setEnableRinseVerification(!enableRinseVerification)}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                  enableRinseVerification ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {enableRinseVerification ? 'Attivo' : 'Abilita'}
              </button>
            </div>

            {enableRinseVerification && (
              <div className="mt-3 space-y-3 bg-slate-850 p-4 rounded-xl border border-slate-700 text-xs">
                <span className="text-[11px] text-slate-400 block font-mono">
                  CO [mg] = V × (C - Cb) &lt; Target MACO
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Concentrazione Campione C (mg/L):</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={rinseVerification.sampleImpurityConcMgL}
                      onChange={(e) =>
                        setRinseVerification((prev) => ({
                          ...prev,
                          sampleImpurityConcMgL: parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Bianco Solvente Cb (mg/L):</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={rinseVerification.blankSolventConcMgL}
                      onChange={(e) =>
                        setRinseVerification((prev) => ({
                          ...prev,
                          blankSolventConcMgL: parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white font-mono"
                    />
                  </div>
                </div>

                {calcResult.measuredRinseCarryOverMg !== undefined && (
                  <div className="p-3 rounded-lg bg-slate-900 border border-blue-500/40 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Carry Over Totale Risciacquo (CO):</span>
                      <span className="font-mono font-bold text-white text-sm">
                        {calcResult.measuredRinseCarryOverMg.toLocaleString('it-IT')} mg
                      </span>
                    </div>
                    <div>
                      {calcResult.isRinseWithinTarget ? (
                        <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold flex items-center space-x-1">
                          <Check className="w-3 h-3" />
                          <span>CO &lt; TARGET (CONFORME)</span>
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold flex items-center space-x-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span>CO ≥ TARGET (NON CONFORME)</span>
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Paragraph 4.1: Visually Clean Verification Banner */}
          <div className="pt-2 border-t border-slate-800">
            <div className="p-3 rounded-xl bg-slate-850 border border-slate-700 flex items-center space-x-3 text-xs">
              <Eye className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <span className="font-bold text-white block">
                  Paragrafo 4.1: Criterio &quot;Visibly Clean in Dry Conditions&quot;
                </span>
                <span className="text-slate-400 text-[11px] block mt-0.5">
                  Soglia visiva standard: {visualCleanlinessThresholdUgCm2} µg/cm² vs Limite superficiale: {calcResult.swabTargetValueUgCm2} µg/cm².
                  {calcResult.isVisualLimitMoreStringent
                    ? ' Attenzione: Il limite calcolato è inferiore alla soglia visiva; il controllo analitico strumentale (HPLC/LC-MS) è vincolante.'
                    : ' Conforme: Il limite calcolato supera la soglia visiva standard.'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* EXPLICIT MATHEMATICAL AUDIT TRAIL ACCORDION (PARAGRAPHS 4.0 - 4.2.5) */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center space-x-2">
              <FileText className="w-4 h-4 text-teal-400" />
              <span className="text-xs font-bold text-teal-300 uppercase tracking-wider">
                Audit Trail Matematico Esplicito (Guida APIC Sez. 4.0)
              </span>
            </div>
            <h3 className="text-base font-bold text-white mt-0.5">
              Esplicitazione Trasparente con Sostituzione delle Variabili e Unità di Misura
            </h3>
          </div>
          <button
            onClick={handleCopyAuditTrail}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30 text-xs font-semibold self-start sm:self-auto transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copia Tutti i Passaggi</span>
          </button>
        </div>

        <div className="space-y-3">
          {calcResult.auditSteps.map((step) => (
            <div
              key={step.stepNumber}
              className="bg-slate-850 p-4 rounded-xl border border-slate-800 space-y-1.5 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-white flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-teal-300 flex items-center justify-center font-bold text-[10px] border border-slate-700">
                    {step.stepNumber}
                  </span>
                  <span>{step.title}</span>
                </span>
                <span className="font-mono text-teal-300 font-bold">{step.resultString}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800 text-slate-300">
                  <span className="text-slate-500 block text-[9px] uppercase">Formula Template:</span>
                  <span>{step.formulaTemplate}</span>
                </div>
                <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800 text-teal-200">
                  <span className="text-slate-500 block text-[9px] uppercase">Sostituzione Numerica:</span>
                  <span>{step.formulaSubstituted}</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 pt-0.5">{step.explanation}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
