import React, { useState, useMemo } from 'react';
import {
  PharmaceuticalCompound,
  ApicCalculationInput,
  ApicCalculationResult,
  CalculationFormulaMode,
  CustomFormulaConfig,
} from '../types/apic';
import { executeApicCalculation } from '../utils/apicCalculations';
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
} from 'lucide-react';

interface ApicCalculatorProps {
  compounds: PharmaceuticalCompound[];
  selectedProductA: PharmaceuticalCompound;
  onSelectProductA: (compound: PharmaceuticalCompound) => void;
}

export const ApicCalculator: React.FC<ApicCalculatorProps> = ({
  compounds,
  selectedProductA,
  onSelectProductA,
}) => {
  // Equipment Train default state
  const [equipmentName, setEquipmentName] = useState('Linea Sintesi / Impianto Polifunzionale 01');
  const [sharedSurfaceAreaM2, setSharedSurfaceAreaM2] = useState<number>(25.0);
  const [swabAreaCm2, setSwabAreaCm2] = useState<number>(25.0);
  const [swabRecoveryPercent, setSwabRecoveryPercent] = useState<number>(85.0);
  const [rinseVolumeLiters, setRinseVolumeLiters] = useState<number>(500.0);
  const [visualLimitUgCm2, setVisualLimitUgCm2] = useState<number>(4.0);

  // Next Product B parameters
  const [nextProductName, setNextProductName] = useState('Prodotto B (Formulato Orale Compresse)');
  const [nextBatchSizeKg, setNextBatchSizeKg] = useState<number>(250.0);
  const [nextMaxDailyDoseMg, setNextMaxDailyDoseMg] = useState<number>(50.0);
  const [safetyFactorDose, setSafetyFactorDose] = useState<number>(1000); // 1000 for oral, 10000 for injectable

  // Option to pick an intermediate of Product A as the specific contaminant
  const [useIntermediateAsContaminant, setUseIntermediateAsContaminant] = useState<string>('api');

  // Formula Customization state
  const [formulaMode, setFormulaMode] = useState<CalculationFormulaMode>('standard-pde');
  const [additionalSafetyFactor, setAdditionalSafetyFactor] = useState<number>(2.0);
  const [bioavailabilityFactor, setBioavailabilityFactor] = useState<number>(0.8);
  const [customExpression, setCustomExpression] = useState<string>('(PDE * MBS_KG * 1000000) / (MDD * SF_ADD)');
  const [copiedAuditTrail, setCopiedAuditTrail] = useState(false);

  // Active contaminant effective PDE and min dose
  const activeContaminant = useMemo(() => {
    if (useIntermediateAsContaminant === 'api' || !selectedProductA.intermediates.length) {
      return {
        name: selectedProductA.name,
        pdeMgDay: selectedProductA.pdeMgDay,
        minDailyDoseMg: selectedProductA.minDailyDoseMg,
        isIntermediate: false,
      };
    }
    const foundInt = selectedProductA.intermediates.find((i) => i.id === useIntermediateAsContaminant);
    if (foundInt) {
      return {
        name: `${selectedProductA.name} → Intermedio: ${foundInt.code}`,
        pdeMgDay: foundInt.pdeValueMg ?? Number((selectedProductA.pdeMgDay * (foundInt.pdeRatioToApi ?? 1.0)).toFixed(5)),
        minDailyDoseMg: selectedProductA.minDailyDoseMg,
        isIntermediate: true,
      };
    }
    return {
      name: selectedProductA.name,
      pdeMgDay: selectedProductA.pdeMgDay,
      minDailyDoseMg: selectedProductA.minDailyDoseMg,
      isIntermediate: false,
    };
  }, [selectedProductA, useIntermediateAsContaminant]);

  // Execute APIC calculation with user formula configuration
  const calcResult: ApicCalculationResult = useMemo(() => {
    const formulaConfig: CustomFormulaConfig = {
      mode: formulaMode,
      customExpression,
      additionalSafetyFactor: Number(additionalSafetyFactor) || 1,
      bioavailabilityFactor: Number(bioavailabilityFactor) || 1,
      ingestionFactor: 1.0,
      activeModelLabel:
        formulaMode === 'standard-pde'
          ? 'APIC PDE Standard'
          : formulaMode === 'standard-dose'
          ? '1/1000th Dose Criterion'
          : formulaMode === 'standard-10ppm'
          ? '10 ppm Baseline Limit'
          : formulaMode === 'pde-safety-margin'
          ? `PDE con Margine Addizionale (SF_add=${additionalSafetyFactor})`
          : formulaMode === 'bioavailability-adjusted'
          ? `PDE Corretto per Biodisponibilità (F_bio=${bioavailabilityFactor})`
          : 'Formula Matematica Personalizzata',
    };

    const input: ApicCalculationInput = {
      previousCompound: {
        ...selectedProductA,
        name: activeContaminant.name,
        pdeMgDay: activeContaminant.pdeMgDay,
        pdeUgDay: activeContaminant.pdeMgDay * 1000,
        minDailyDoseMg: activeContaminant.minDailyDoseMg,
      },
      nextCompoundName: nextProductName,
      nextCompoundMinBatchSizeKg: Number(nextBatchSizeKg) || 1,
      nextCompoundMaxDailyDoseMg: Number(nextMaxDailyDoseMg) || 1,
      equipment: {
        name: equipmentName,
        sharedSurfaceAreaM2: Number(sharedSurfaceAreaM2) || 1,
        swabAreaCm2: Number(swabAreaCm2) || 25,
        swabRecoveryFactorPercent: Number(swabRecoveryPercent) || 85,
        rinseVolumeLiters: Number(rinseVolumeLiters) || 500,
        visualCleanInspectionLimitUgCm2: Number(visualLimitUgCm2) || 4.0,
      },
      safetyFactorDoseMethod: Number(safetyFactorDose) || 1000,
      targetSwabAreaCm2: Number(swabAreaCm2) || 25,
      swabRecoveryPercent: Number(swabRecoveryPercent) || 85,
      rinseVolumeLiters: Number(rinseVolumeLiters) || 500,
      formulaConfig,
    };

    return executeApicCalculation(input);
  }, [
    selectedProductA,
    activeContaminant,
    nextProductName,
    nextBatchSizeKg,
    nextMaxDailyDoseMg,
    equipmentName,
    sharedSurfaceAreaM2,
    swabAreaCm2,
    swabRecoveryPercent,
    rinseVolumeLiters,
    visualLimitUgCm2,
    safetyFactorDose,
    formulaMode,
    additionalSafetyFactor,
    bioavailabilityFactor,
    customExpression,
  ]);

  // Insert variable tag into custom expression
  const handleInsertVariable = (varName: string) => {
    setCustomExpression((prev) => (prev ? `${prev} * ${varName}` : varName));
  };

  // Copy explicit audit trail to clipboard
  const handleCopyAuditTrail = () => {
    const textLines = [
      `================================================================================`,
      `VERBALE DI CALCOLO APIC CLEANING VALIDATION - AUDIT TRAIL ESPLICITO`,
      `Data: ${new Date().toLocaleDateString('it-IT')} ${new Date().toLocaleTimeString('it-IT')}`,
      `Riferimento Regolatorio: APIC Cleaning Validation Guide (CEFIC) & EMA GMP Annex 15`,
      `================================================================================`,
      ``,
      `1. DATI SOSTANZA CONTAMINANTE (PRODOTTO A):`,
      `- Sostanza: ${activeContaminant.name}`,
      `- Numero CAS: ${selectedProductA.casNumber}`,
      `- Fascia OEB: ${selectedProductA.oeb} (${selectedProductA.toxicologicalClass})`,
      `- Limite Tossicologico PDE / ADE: ${activeContaminant.pdeMgDay} mg/die (${activeContaminant.pdeMgDay * 1000} µg/die)`,
      `- Minima Dose Terapeutica (TDD): ${activeContaminant.minDailyDoseMg} mg/die`,
      `- Solubilità in Acqua: ${selectedProductA.solubilityInWater}`,
      `- Pulibilità: ${selectedProductA.cleanability}`,
      `- Metodo Analitico Raccomandato: ${selectedProductA.recommendedAnalyticalMethod}`,
      ``,
      `2. DATI PRODOTTO SUCCESSIVO RICEVENTE (PRODOTTO B):`,
      `- Denominazione: ${nextProductName}`,
      `- Dimensione Minima Lotto (MBS): ${nextBatchSizeKg} kg`,
      `- Dose Massima Giornaliera (MDD): ${nextMaxDailyDoseMg} mg/die`,
      `- Fattore di Sicurezza Dose (SF): ${safetyFactorDose}`,
      ``,
      `3. DATI TRENO APPARECCHIATURE CONDIVISO & CAMPIONAMENTO:`,
      `- Identificativo Impianto: ${equipmentName}`,
      `- Superficie Totale di Contatto (Shared Area): ${sharedSurfaceAreaM2} m² (${sharedSurfaceAreaM2 * 10000} cm²)`,
      `- Dima Campionamento Swab: ${swabAreaCm2} cm²`,
      `- Fattore di Recupero Analitico Swab: ${swabRecoveryPercent}%`,
      `- Volume Solvente Risciacquo Finale (Rinse): ${rinseVolumeLiters} L`,
      `- Soglia Ispezione Visiva "Visibly Clean": ${visualLimitUgCm2} µg/cm²`,
      ``,
      `4. MODALITÀ DI CALCOLO ATTIVA:`,
      `- Modello: ${calcResult.activeFormulaDescription}`,
      `- Criterio Worst-Case Adottato: ${calcResult.worstCaseCriteria}`,
      `- MACO Selezionato: ${calcResult.macoSelectedMg} mg (${(calcResult.macoSelectedMg / 1000).toFixed(4)} g)`,
      ``,
      `5. PASSAGGI DI CALCOLO ESPLICITI (SOSTITUZIONE MATEMATICA E UNITA'):`,
      ...calcResult.auditSteps.map((step) => {
        return [
          `Passaggio ${step.stepNumber}: ${step.title}`,
          `  Formula: ${step.formulaTemplate}`,
          `  Sostituzione: ${step.formulaSubstituted}`,
          `  Risultato: ${step.resultString}`,
          `  Nota: ${step.explanation}`,
          ``,
        ].join('\n');
      }),
      `6. LIMITI ANALITICI DI RILASCIO PER LABORATORIO QC:`,
      `- Limite Superficiale: ${calcResult.surfaceLimitUgCm2} µg/cm² (${calcResult.surfaceLimitMgM2} mg/m²)`,
      `- Limite Swab Teorico: ${calcResult.swabLimitUgPerSwab} µg/tampone`,
      `- Limite Swab Corretto per Recupero (${swabRecoveryPercent}%): ${calcResult.swabLimitWithRecoveryUgPerSwab} µg/tampone`,
      `- Limite Risciacquo Finale (Rinse Test): ${calcResult.rinseLimitMgL} mg/L (ppm)`,
      `- Correlazione Visiva: ${calcResult.isVisualLimitMoreStringent ? 'Ispezione visiva più restrittiva' : 'Prelievo strumentale analitico obbligatorio'}`,
      ``,
      `7. AVVERTENZE REGOLATORIE APIC:`,
      ...(calcResult.warnings.length > 0 ? calcResult.warnings.map((w) => `* ${w}`) : ['* Nessuna avvertenza critica speciale.']),
      ``,
      `================================================================================`,
    ].join('\n');

    navigator.clipboard.writeText(textLines).then(() => {
      setCopiedAuditTrail(true);
      setTimeout(() => setCopiedAuditTrail(false), 2500);
    });
  };

  // Handle print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
              Guida APIC • Sezioni 4, 6 & Appendice 3
            </span>
            <span className="text-xs text-slate-400">Algoritmo MACO Flessibile & Audit Trail Esplicito</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight mt-1">
            Calcolatore MACO & Limiti Superficiali Swab / Rinse
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl">
            Valutazione simultanea dei criteri APIC con <strong>formule preimpostate modificabili dall&apos;utente</strong> ed
            <strong> esplicitazione trasparente di tutti i passaggi di calcolo</strong> con sostituzione numerica e unità di misura.
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start md:self-auto">
          <button
            onClick={handleCopyAuditTrail}
            className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold transition-colors shadow-md"
            title="Copia l'intero verbale con tutti i passaggi matematici negli appunti per report di convalida Word/Excel"
          >
            {copiedAuditTrail ? <Check className="w-4 h-4 text-emerald-200" /> : <Copy className="w-4 h-4" />}
            <span>{copiedAuditTrail ? 'Copiato negli Appunti!' : 'Copia Verbale Convalida'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4 text-teal-400" />
            <span>Stampa Scheda</span>
          </button>
        </div>
      </div>

      {/* Inputs Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Step 1: Product A (Previous / Contaminant) */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 text-xs font-bold text-teal-400 uppercase tracking-wider mb-3">
              <span className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-300 flex items-center justify-center font-bold">1</span>
              <span>Prodotto A (Precedente / Contaminante)</span>
            </div>

            {/* Select API */}
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Seleziona API dal Database Globale:</label>
                <select
                  value={selectedProductA.id}
                  onChange={(e) => {
                    const found = compounds.find((c) => c.id === e.target.value);
                    if (found) {
                      onSelectProductA(found);
                      setUseIntermediateAsContaminant('api');
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-teal-500 font-medium"
                >
                  {compounds.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} [CAS: {c.casNumber}] ({c.primaryManufacturers.slice(0, 2).join(', ')})
                    </option>
                  ))}
                </select>
              </div>

              {/* Sub-select Intermediate if present */}
              {selectedProductA.intermediates.length > 0 && (
                <div className="bg-indigo-950/40 p-3 rounded-xl border border-indigo-900/60">
                  <label className="text-xs text-indigo-300 font-semibold block mb-1 flex items-center space-x-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    <span>Valuta Intermedio di Sintesi come Contaminante:</span>
                  </label>
                  <select
                    value={useIntermediateAsContaminant}
                    onChange={(e) => setUseIntermediateAsContaminant(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-800 border border-indigo-800 rounded-lg text-xs text-indigo-200 focus:outline-none"
                  >
                    <option value="api">Usa Principio Attivo Finale ({selectedProductA.name})</option>
                    {selectedProductA.intermediates.map((intComp) => (
                      <option key={intComp.id} value={intComp.id}>
                        {intComp.code} ({intComp.stage}) - PDE: {intComp.pdeValueMg ?? (selectedProductA.pdeMgDay * (intComp.pdeRatioToApi ?? 1.0))} mg/die
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Contaminant summary values */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-xs">
                <div className="bg-slate-800/60 p-2.5 rounded-lg">
                  <span className="text-slate-400 block text-[11px]">PDE / ADE Effettivo:</span>
                  <span className="text-base font-bold text-teal-400 font-mono">
                    {activeContaminant.pdeMgDay} mg/die
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    ({Number((activeContaminant.pdeMgDay * 1000).toFixed(2))} µg/die)
                  </span>
                </div>
                <div className="bg-slate-800/60 p-2.5 rounded-lg">
                  <span className="text-slate-400 block text-[11px]">Dose Minima (TDD):</span>
                  <span className="text-base font-bold text-blue-300 font-mono">
                    {activeContaminant.minDailyDoseMg} mg/die
                  </span>
                  <span className="text-[10px] text-slate-400 block">CAS: {selectedProductA.casNumber}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Fascia: <strong className="text-amber-300">{selectedProductA.oeb}</strong></span>
            <span>Tox: <strong className="text-slate-200">{selectedProductA.toxicologicalClass}</strong></span>
          </div>
        </div>

        {/* Step 2: Product B (Next / Receiving Product) */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-md space-y-3">
          <div className="flex items-center space-x-2 text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">
            <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center font-bold">2</span>
            <span>Prodotto B (Successivo / Ricevente)</span>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Nome del Prodotto B Successivo:</label>
            <input
              type="text"
              value={nextProductName}
              onChange={(e) => setNextProductName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">
              Dimensione Lotto Minimo B (MBS in kg):
            </label>
            <input
              type="number"
              min="0.1"
              step="any"
              value={nextBatchSizeKg}
              onChange={(e) => setNextBatchSizeKg(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-blue-500"
            />
            <span className="text-[11px] text-slate-500 block mt-0.5">
              Dimensione lotto minima prodotta ({nextBatchSizeKg * 1000} g)
            </span>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">
              Dose Massima Giornaliera B (MDD in mg/die):
            </label>
            <input
              type="number"
              min="0.01"
              step="any"
              value={nextMaxDailyDoseMg}
              onChange={(e) => setNextMaxDailyDoseMg(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">
              Fattore di Sicurezza Criterio Dose (SF):
            </label>
            <select
              value={safetyFactorDose}
              onChange={(e) => setSafetyFactorDose(parseInt(e.target.value))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="1000">1000 (Forme Farmaceutiche Orali Standard)</option>
              <option value="10000">10000 (Parenterali, Iniettabili o Ristretto Indice)</option>
              <option value="500">500 (API con margine terapeutico ampio)</option>
              <option value="100">100 (Topici / Uso Esterno)</option>
            </select>
          </div>
        </div>

        {/* Step 3: Equipment Train Parameters */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-md space-y-3">
          <div className="flex items-center space-x-2 text-xs font-bold text-purple-400 uppercase tracking-wider mb-2">
            <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold">3</span>
            <span>Impianto Condiviso & Campionamento</span>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Superficie Condivisa Totale (m²):</label>
            <input
              type="number"
              min="0.1"
              step="any"
              value={sharedSurfaceAreaM2}
              onChange={(e) => setSharedSurfaceAreaM2(parseFloat(e.target.value) || 1)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-purple-500"
            />
            <span className="text-[11px] text-slate-500 block mt-0.5">
              Area di contatto prodotto = {sharedSurfaceAreaM2 * 10000} cm²
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Dima Swab (cm²):</label>
              <input
                type="number"
                min="1"
                step="any"
                value={swabAreaCm2}
                onChange={(e) => setSwabAreaCm2(parseFloat(e.target.value) || 25)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Recupero Swab (%):</label>
              <input
                type="number"
                min="10"
                max="100"
                step="any"
                value={swabRecoveryPercent}
                onChange={(e) => setSwabRecoveryPercent(parseFloat(e.target.value) || 85)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Vol. Risciacquo (L):</label>
              <input
                type="number"
                min="10"
                step="any"
                value={rinseVolumeLiters}
                onChange={(e) => setRinseVolumeLiters(parseFloat(e.target.value) || 500)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Soglia Visiva (µg/cm²):</label>
              <input
                type="number"
                min="0.1"
                step="any"
                value={visualLimitUgCm2}
                onChange={(e) => setVisualLimitUgCm2(parseFloat(e.target.value) || 4.0)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Formula Customizer & Mode Selector */}
      <div className="bg-slate-900 border border-teal-500/40 p-6 rounded-2xl shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-300 flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center space-x-2">
                <span>Modalità & Personalizzazione della Formula MACO</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  Modificabile dall&apos;Utente
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Seleziona una formula preimpostata APIC/EMA oppure personalizza i parametri e componi un&apos;espressione su misura.
              </p>
            </div>
          </div>

          <div className="text-xs text-slate-400 font-mono bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700 self-start md:self-auto">
            Modalità attiva: <strong className="text-teal-300">{calcResult.activeFormulaDescription}</strong>
          </div>
        </div>

        {/* Formula Mode Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <button
            onClick={() => setFormulaMode('standard-pde')}
            className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
              formulaMode === 'standard-pde'
                ? 'bg-teal-950/60 border-teal-500 text-teal-200 font-bold shadow-sm ring-1 ring-teal-500/30'
                : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <div className="font-semibold">1. Standard PDE</div>
            <div className="text-[10px] text-slate-400 mt-0.5">(PDE × MBS) / MDD</div>
          </button>

          <button
            onClick={() => setFormulaMode('standard-dose')}
            className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
              formulaMode === 'standard-dose'
                ? 'bg-blue-950/60 border-blue-500 text-blue-200 font-bold shadow-sm ring-1 ring-blue-500/30'
                : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <div className="font-semibold">2. 1/1000th Dose</div>
            <div className="text-[10px] text-slate-400 mt-0.5">(TDD × MBS) / (SF × MDD)</div>
          </button>

          <button
            onClick={() => setFormulaMode('standard-10ppm')}
            className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
              formulaMode === 'standard-10ppm'
                ? 'bg-purple-950/60 border-purple-500 text-purple-200 font-bold shadow-sm ring-1 ring-purple-500/30'
                : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <div className="font-semibold">3. 10 ppm Baseline</div>
            <div className="text-[10px] text-slate-400 mt-0.5">10 mg/kg × MBS</div>
          </button>

          <button
            onClick={() => setFormulaMode('pde-safety-margin')}
            className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
              formulaMode === 'pde-safety-margin'
                ? 'bg-amber-950/60 border-amber-500 text-amber-200 font-bold shadow-sm ring-1 ring-amber-500/30'
                : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <div className="font-semibold">4. PDE + SF Impianto</div>
            <div className="text-[10px] text-slate-400 mt-0.5">(PDE × MBS) / (MDD × SF_add)</div>
          </button>

          <button
            onClick={() => setFormulaMode('bioavailability-adjusted')}
            className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
              formulaMode === 'bioavailability-adjusted'
                ? 'bg-indigo-950/60 border-indigo-500 text-indigo-200 font-bold shadow-sm ring-1 ring-indigo-500/30'
                : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <div className="font-semibold">5. Biodisponibilità</div>
            <div className="text-[10px] text-slate-400 mt-0.5">(PDE × F_bio × MBS) / MDD</div>
          </button>

          <button
            onClick={() => setFormulaMode('custom-expression')}
            className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
              formulaMode === 'custom-expression'
                ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200 font-bold shadow-sm ring-1 ring-emerald-500/30'
                : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <div className="font-semibold flex items-center space-x-1">
              <Edit3 className="w-3 h-3 text-emerald-400" />
              <span>6. Formula Libera</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Espressione matematica libera</div>
          </button>
        </div>

        {/* Mode Specific Controls */}
        {formulaMode === 'pde-safety-margin' && (
          <div className="bg-slate-800/80 p-4 rounded-xl border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <span className="font-bold text-amber-300 block">Fattore di Sicurezza d&apos;Impianto Addizionale (SF_add):</span>
              <span className="text-slate-400 text-[11px]">
                Consente di applicare un margine di cautela aggiuntivo (es. per processi con potenziale degradazione o linee multiprodotto complesse).
              </span>
            </div>
            <div className="flex items-center space-x-2">
              {[2, 3, 5, 10].map((val) => (
                <button
                  key={val}
                  onClick={() => setAdditionalSafetyFactor(val)}
                  className={`px-2.5 py-1 rounded-lg font-mono text-xs font-semibold ${
                    additionalSafetyFactor === val
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {val}x
                </button>
              ))}
              <input
                type="number"
                min="1"
                step="0.1"
                value={additionalSafetyFactor}
                onChange={(e) => setAdditionalSafetyFactor(parseFloat(e.target.value) || 1)}
                className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-center font-bold"
              />
            </div>
          </div>
        )}

        {formulaMode === 'bioavailability-adjusted' && (
          <div className="bg-slate-800/80 p-4 rounded-xl border border-indigo-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <span className="font-bold text-indigo-300 block">Fattore di Correzione Biodisponibilità (F_bio):</span>
              <span className="text-slate-400 text-[11px]">
                Rapporto di assorbimento sistemico (es. 0.8 per forme orali a minore permeabilità, 1.0 standard).
              </span>
            </div>
            <div className="flex items-center space-x-2">
              {[0.5, 0.75, 0.8, 1.0].map((val) => (
                <button
                  key={val}
                  onClick={() => setBioavailabilityFactor(val)}
                  className={`px-2.5 py-1 rounded-lg font-mono text-xs font-semibold ${
                    bioavailabilityFactor === val
                      ? 'bg-indigo-500 text-slate-950 font-bold'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {val}
                </button>
              ))}
              <input
                type="number"
                min="0.01"
                max="5"
                step="0.05"
                value={bioavailabilityFactor}
                onChange={(e) => setBioavailabilityFactor(parseFloat(e.target.value) || 1)}
                className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-center font-bold"
              />
            </div>
          </div>
        )}

        {formulaMode === 'custom-expression' && (
          <div className="bg-slate-800/90 p-4 rounded-xl border border-emerald-500/40 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <span className="font-bold text-emerald-300 flex items-center space-x-1.5">
                <Code className="w-4 h-4" />
                <span>Editor Espressione Matematica MACO [mg]:</span>
              </span>
              <span className="text-slate-400 text-[11px]">
                Supporta +, -, *, /, ^, parentesi () e nomi di variabili
              </span>
            </div>

            {/* Expression input */}
            <div className="relative">
              <input
                type="text"
                value={customExpression}
                onChange={(e) => setCustomExpression(e.target.value)}
                placeholder="(PDE * MBS_KG * 1000000) / (MDD * SF_ADD)"
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-emerald-300 font-mono focus:outline-none focus:border-emerald-500"
              />
              {calcResult.customFormulaError && (
                <div className="text-rose-400 text-xs font-medium mt-1 flex items-center space-x-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{calcResult.customFormulaError}</span>
                </div>
              )}
            </div>

            {/* Variable pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] text-slate-400 font-semibold mr-1">Variabili disponibili:</span>
              {[
                { name: 'PDE', desc: `${activeContaminant.pdeMgDay} mg` },
                { name: 'MBS_KG', desc: `${nextBatchSizeKg} kg` },
                { name: 'MDD', desc: `${nextMaxDailyDoseMg} mg` },
                { name: 'TDD', desc: `${activeContaminant.minDailyDoseMg} mg` },
                { name: 'SF', desc: `${safetyFactorDose}` },
                { name: 'SF_ADD', desc: `${additionalSafetyFactor}` },
                { name: 'F_BIO', desc: `${bioavailabilityFactor}` },
                { name: 'AREA', desc: `${sharedSurfaceAreaM2} m²` },
                { name: 'SWAB', desc: `${swabAreaCm2} cm²` },
                { name: 'REC', desc: `${swabRecoveryPercent / 100}` },
                { name: 'VOL', desc: `${rinseVolumeLiters} L` },
              ].map((v) => (
                <button
                  key={v.name}
                  onClick={() => handleInsertVariable(v.name)}
                  className="px-2 py-0.5 rounded bg-slate-750 hover:bg-emerald-900/60 text-slate-300 hover:text-emerald-300 border border-slate-700 text-[11px] font-mono transition-colors"
                  title={`Inserisci ${v.name} (valore corrente: ${v.desc})`}
                >
                  +{v.name} <span className="text-slate-500 text-[9px]">({v.desc})</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Results Section: 3 APIC Criteria Side-by-Side */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-6">
        <div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-teal-400 uppercase tracking-wider block">
                Valutazione Multi-Criterio APIC (Maximum Allowable Carryover)
              </span>
              <h2 className="text-xl font-bold text-white mt-1">
                Confronto dei 3 Criteri APIC & Selezione del Limite Più Restrittivo
              </h2>
            </div>
            <div className="px-3.5 py-1.5 rounded-xl bg-teal-950/70 text-teal-300 border border-teal-700/60 font-mono text-xs font-bold">
              Criterio Scelto: {calcResult.worstCaseCriteria}
            </div>
          </div>
        </div>

        {/* 3 Criteria Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: PDE / ADE */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              calcResult.worstCaseCriteria === 'PDE / ADE Approach' || (calcResult.isCustomFormulaActive && formulaMode === 'pde-safety-margin')
                ? 'bg-teal-950/40 border-teal-500 shadow-md shadow-teal-500/10'
                : 'bg-slate-800/60 border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-teal-300 uppercase">1. Approccio Tossicologico (PDE)</span>
              {calcResult.worstCaseCriteria === 'PDE / ADE Approach' && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500 text-slate-950">
                  PIÙ RESTRITTIVO
                </span>
              )}
            </div>
            <div className="text-2xl font-black text-white font-mono">
              {calcResult.macoPdeMg.toLocaleString('it-IT')} <span className="text-sm font-normal text-slate-400">mg</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-2 space-y-1 font-mono">
              <div>MACO = (PDE × MBS) / MDD</div>
              <div className="text-slate-500">
                ({activeContaminant.pdeMgDay} mg × {nextBatchSizeKg * 1000000} mg) / {nextMaxDailyDoseMg} mg
              </div>
            </div>
            <p className="text-[11px] text-slate-300 mt-3 pt-2 border-t border-slate-700/60">
              Standard scientifico obbligatorio EMA GMP Annex 15 e Health Based Exposure Limits (HBEL).
            </p>
          </div>

          {/* Card 2: 0.001 Dose */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              calcResult.worstCaseCriteria === '0.001 Dose Criterion'
                ? 'bg-blue-950/40 border-blue-500 shadow-md shadow-blue-500/10'
                : 'bg-slate-800/60 border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-blue-300 uppercase">2. Criterio Posologico (1/1000 Dose)</span>
              {calcResult.worstCaseCriteria === '0.001 Dose Criterion' && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500 text-slate-950">
                  PIÙ RESTRITTIVO
                </span>
              )}
            </div>
            <div className="text-2xl font-black text-white font-mono">
              {calcResult.macoDoseMg.toLocaleString('it-IT')} <span className="text-sm font-normal text-slate-400">mg</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-2 space-y-1 font-mono">
              <div>MACO = (TDD_min × MBS) / (SF × MDD)</div>
              <div className="text-slate-500">
                ({activeContaminant.minDailyDoseMg} × {nextBatchSizeKg * 1000000}) / ({safetyFactorDose} × {nextMaxDailyDoseMg})
              </div>
            </div>
            <p className="text-[11px] text-slate-300 mt-3 pt-2 border-t border-slate-700/60">
              Criterio storico APIC basato sulla minima dose terapeutica giornaliera (TDD).
            </p>
          </div>

          {/* Card 3: 10 ppm */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              calcResult.worstCaseCriteria === '10 ppm General Limit'
                ? 'bg-purple-950/40 border-purple-500 shadow-md shadow-purple-500/10'
                : 'bg-slate-800/60 border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-purple-300 uppercase">3. Criterio Generale 10 ppm</span>
              {calcResult.worstCaseCriteria === '10 ppm General Limit' && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500 text-slate-950">
                  PIÙ RESTRITTIVO
                </span>
              )}
            </div>
            <div className="text-2xl font-black text-white font-mono">
              {calcResult.maco10PpmMg.toLocaleString('it-IT')} <span className="text-sm font-normal text-slate-400">mg</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-2 space-y-1 font-mono">
              <div>MACO = 10 mg/kg × MBS_kg</div>
              <div className="text-slate-500">10 × {nextBatchSizeKg} kg = {calcResult.maco10PpmMg} mg</div>
            </div>
            <p className="text-[11px] text-slate-300 mt-3 pt-2 border-t border-slate-700/60">
              Tetto massimo generale raccomandato dalla guida APIC (10 parti per milione nel lotto B).
            </p>
          </div>
        </div>

        {/* Derived Analytical Limits Grid: Swab, Rinse, Surface */}
        <div className="bg-slate-800/70 p-5 rounded-2xl border border-slate-700 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
            <Scale className="w-4 h-4 text-teal-400" />
            <span>Limiti Operativi per il Laboratorio QC & Convalida</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* MACO Selected */}
            <div className="bg-slate-900/90 p-4 rounded-xl border border-teal-500/40">
              <span className="text-xs text-slate-400 block font-medium">MACO Adottato (Worst-Case)</span>
              <div className="text-2xl font-black text-teal-400 font-mono mt-1">
                {calcResult.macoSelectedMg.toLocaleString('it-IT')} mg
              </div>
              <span className="text-[11px] text-slate-400 font-mono block mt-1">
                {(calcResult.macoSelectedMg / 1000).toFixed(3)} grammi totali
              </span>
            </div>

            {/* Surface Limit */}
            <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-700">
              <span className="text-xs text-slate-400 block font-medium">Limite Superficiale</span>
              <div className="text-2xl font-black text-white font-mono mt-1">
                {calcResult.surfaceLimitUgCm2} <span className="text-xs text-slate-400 font-normal">µg/cm²</span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono block mt-1">
                {calcResult.surfaceLimitMgM2} mg/m²
              </span>
            </div>

            {/* Swab Limit */}
            <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-700">
              <span className="text-xs text-slate-400 block font-medium">
                Limite Swab ({swabAreaCm2} cm²)
              </span>
              <div className="text-2xl font-black text-blue-400 font-mono mt-1">
                {calcResult.swabLimitUgPerSwab} <span className="text-xs text-slate-400 font-normal">µg/tampone</span>
              </div>
              <span className="text-[11px] text-slate-400 block mt-1 font-mono">
                Con Recovery ({swabRecoveryPercent}%): <strong className="text-teal-300">{calcResult.swabLimitWithRecoveryUgPerSwab} µg</strong>
              </span>
            </div>

            {/* Rinse Limit */}
            <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-700">
              <span className="text-xs text-slate-400 block font-medium">
                Limite Risciacquo ({rinseVolumeLiters} L)
              </span>
              <div className="text-2xl font-black text-purple-400 font-mono mt-1">
                {calcResult.rinseLimitMgL} <span className="text-xs text-slate-400 font-normal">ppm (mg/L)</span>
              </div>
              <span className="text-[11px] text-slate-400 block mt-1">
                In {rinseVolumeLiters} litri di solvente/WFI
              </span>
            </div>
          </div>

          {/* Visual Cleanliness Correlation Box */}
          <div
            className={`p-4 rounded-xl border flex items-start space-x-3 ${
              calcResult.isVisualLimitMoreStringent
                ? 'bg-amber-950/30 border-amber-500/50 text-amber-200'
                : 'bg-emerald-950/30 border-emerald-500/50 text-emerald-200'
            }`}
          >
            {calcResult.isVisualLimitMoreStringent ? (
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div className="text-xs space-y-1">
              <span className="font-bold block text-sm">
                Correlazione Limite Chimico vs Ispezione Visiva (Soglia ~{visualLimitUgCm2} µg/cm²):
              </span>
              {calcResult.isVisualLimitMoreStringent ? (
                <p>
                  <strong>Ispezione visiva più restrittiva:</strong> La soglia di rilevamento visivo ({visualLimitUgCm2} µg/cm²)
                  è inferiore al limite calcolato ({calcResult.surfaceLimitUgCm2} µg/cm²). Come stabilito dalla Guida APIC Sez. 4.3,
                  l&apos;apparecchiatura deve essere preliminarmente e obbligatoriamente &quot;Visually Clean&quot; (pulita alla vista).
                </p>
              ) : (
                <p>
                  <strong>ATTENZIONE - Limite Chimico Critico:</strong> Il limite chimico calcolato ({calcResult.surfaceLimitUgCm2} µg/cm²)
                  è INFERIORE alla soglia visiva standard ({visualLimitUgCm2} µg/cm²). Un&apos;ispezione puramente visiva
                  <strong> NON È SUFFICIENTE</strong>: sono tassativi prelievi analitici mediante swab quantitativo ({selectedProductA.recommendedAnalyticalMethod}).
                </p>
              )}
            </div>
          </div>

          {/* Warnings List */}
          {calcResult.warnings.length > 0 && (
            <div className="bg-rose-950/20 border border-rose-500/40 p-4 rounded-xl space-y-2">
              <span className="text-xs font-bold text-rose-300 uppercase tracking-wider flex items-center space-x-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span>Avvertenze di Rischio APIC / Tossicologico ({calcResult.warnings.length})</span>
              </span>
              <ul className="list-disc list-inside text-xs text-rose-200/90 space-y-1">
                {calcResult.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Explicit Calculation Methodology & Mathematical Audit Trail */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                Trasparenza Regolatoria GMP Annex 15
              </span>
              <span className="text-xs text-slate-400">Dimostrazione Matematica e Unità di Misura</span>
            </div>
            <h2 className="text-xl font-bold text-white mt-1 flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-teal-400" />
              <span>Modalità di Calcolo & Passaggi Espliciti (Audit Trail per Convalida)</span>
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl">
              Ogni passaggio numerico è reso esplicito per consentire l&apos;immediata verifica da parte di ispettori GMP,
              auditor esterni e Quality Assurance, con indicazione di formule algebriche, sostituzione dei valori e unità di misura.
            </p>
          </div>

          <button
            onClick={handleCopyAuditTrail}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/40 text-xs font-semibold transition-colors shadow-sm self-start md:self-auto"
          >
            {copiedAuditTrail ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedAuditTrail ? 'Copiato!' : 'Copia Tutti i Passaggi'}</span>
          </button>
        </div>

        {/* Steps List */}
        <div className="space-y-4">
          {calcResult.auditSteps.map((step) => (
            <div
              key={step.stepNumber}
              className="bg-slate-800/60 p-4 rounded-xl border border-slate-750 hover:border-slate-600 transition-all space-y-2.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center space-x-2.5">
                  <div className="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center justify-center font-bold text-xs shrink-0">
                    {step.stepNumber}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-tight">{step.title}</h3>
                    <p className="text-[11px] text-slate-400">{step.explanation}</p>
                  </div>
                </div>

                <div className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-teal-300 font-mono text-xs font-bold text-right shrink-0">
                  {step.resultString}
                </div>
              </div>

              {/* Formula and Substitution details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2 border-t border-slate-700/60 text-xs font-mono">
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 block uppercase tracking-wider mb-0.5">Formula Teorica:</span>
                  <span className="text-blue-300">{step.formulaTemplate}</span>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 block uppercase tracking-wider mb-0.5">Sostituzione Numerica con Valori:</span>
                  <span className="text-teal-300 font-semibold">{step.formulaSubstituted}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
