import React, { useState, useMemo } from 'react';
import { calculatePDE } from '../utils/apicCalculations';
import {
  Activity,
  HelpCircle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Sliders,
} from 'lucide-react';

interface PdeDerivationToolProps {
  onOpenAddModalWithPde: (pdeMg: number, noael: number, fFactors: any) => void;
}

export const PdeDerivationTool: React.FC<PdeDerivationToolProps> = ({
  onOpenAddModalWithPde,
}) => {
  const [noael, setNoael] = useState<number>(2.5); // mg/kg/day
  const [bodyWeight, setBodyWeight] = useState<number>(50); // kg standard EMA
  const [f1, setF1] = useState<number>(5); // Interspecies: 5 for rat
  const [f2, setF2] = useState<number>(10); // Human variability
  const [f3, setF3] = useState<number>(1); // Subchronic to chronic: 1 for chronic > 1 year
  const [f4, setF4] = useState<number>(1); // Teratogenicity/carcinogenicity
  const [f5, setF5] = useState<number>(1); // LOAEL to NOAEL

  const result = useMemo(() => {
    return calculatePDE(Number(noael) || 0, Number(bodyWeight) || 50, f1, f2, f3, f4, f5);
  }, [noael, bodyWeight, f1, f2, f3, f4, f5]);

  const compositeFactor = f1 * f2 * f3 * f4 * f5;

  // Suggested OEB band based on calculated PDE
  const suggestedOeb = useMemo(() => {
    if (result.pdeUgDay <= 1) return 'OEB 5 (Estrema Potenza / Citotossico)';
    if (result.pdeUgDay <= 10) return 'OEB 4 (Alta Potenza / HPAPI)';
    if (result.pdeUgDay <= 100) return 'OEB 3 (Attivo Farmaceutico Intermedio)';
    if (result.pdeUgDay <= 1000) return 'OEB 2 (Basso Rischio)';
    return 'OEB 1 (Standard / Non-potente)';
  }, [result]);

  return (
    <div className="space-y-6">
      {/* Header: Warm Amber / Gold Environment Styling */}
      <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-orange-950/30 border-2 border-amber-500/40 p-6 rounded-2xl shadow-2xl shadow-amber-950/30 flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30 uppercase tracking-wider flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-950 animate-pulse"></span>
              <span>AMBIENTE: DERIVAZIONE TOSSICOLOGICA NOAEL/PDE &amp; FATTORI F1-F5</span>
            </span>
            <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Linee Guida EMA / ICH Q3D &amp; APIC
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-2">
            Strumento di Derivazione Tossicologica ADE / PDE
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1.5 max-w-2xl leading-relaxed">
            Calcolo del Permitted Daily Exposure (PDE) o Acceptable Daily Exposure (ADE) a partire dal valore sperimentale
            NOAEL/LOAEL e dai cinque fattori di correzione biologica F1, F2, F3, F4, F5.
          </p>
        </div>
      </div>

      {/* Main Derivation Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls Column */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-md space-y-5">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-amber-400" />
            <span>Parametri Sperimentali & Fattori di Modifica (F1 - F5)</span>
          </h2>

          {/* Starting point: NOAEL and Body Weight */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-800/50 p-4 rounded-xl border border-slate-700/60">
            <div>
              <label className="text-xs text-slate-300 font-semibold block mb-1">
                Punto di Partenza: NOAEL (mg/kg/die)
              </label>
              <input
                type="number"
                min="0.0001"
                step="any"
                value={noael}
                onChange={(e) => setNoael(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-teal-300 font-mono font-bold focus:outline-none focus:border-amber-500"
              />
              <span className="text-[11px] text-slate-400 block mt-1">
                No-Observed-Adverse-Effect-Level dallo studio tossicologico più sensibile.
              </span>
            </div>

            <div>
              <label className="text-xs text-slate-300 font-semibold block mb-1">
                Peso Corporeo Standard (kg)
              </label>
              <input
                type="number"
                min="10"
                max="100"
                value={bodyWeight}
                onChange={(e) => setBodyWeight(parseFloat(e.target.value) || 50)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-amber-500"
              />
              <span className="text-[11px] text-slate-400 block mt-1">
                Standard EMA GMP Annex 15 = <strong>50 kg</strong> per adulto.
              </span>
            </div>
          </div>

          {/* F-Factors Selectors */}
          <div className="space-y-4">
            {/* F1: Interspecies */}
            <div className="bg-slate-800/40 p-3.5 rounded-xl border border-slate-700/60">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-200">
                  F1: Estrapolazione Interspecie (Animale → Uomo)
                </label>
                <span className="text-xs font-mono font-bold text-teal-400 bg-slate-900 px-2 py-0.5 rounded">
                  F1 = {f1}
                </span>
              </div>
              <select
                value={f1}
                onChange={(e) => setF1(parseFloat(e.target.value))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none"
              >
                <option value="2">2 (Cane o Scimmia grande)</option>
                <option value="3">3 (Scimmia rhesus / primate non umano)</option>
                <option value="5">5 (Ratto - studio convenzionale standard)</option>
                <option value="12">12 (Topo)</option>
                <option value="10">10 (Altre specie o dati limitati)</option>
                <option value="1">1 (Dati umani diretti)</option>
              </select>
            </div>

            {/* F2: Individual variability */}
            <div className="bg-slate-800/40 p-3.5 rounded-xl border border-slate-700/60">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-200">
                  F2: Variabilità Interindividuale Umana
                </label>
                <span className="text-xs font-mono font-bold text-teal-400 bg-slate-900 px-2 py-0.5 rounded">
                  F2 = {f2}
                </span>
              </div>
              <select
                value={f2}
                onChange={(e) => setF2(parseFloat(e.target.value))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none"
              >
                <option value="10">10 (Valore standard armonizzato per la popolazione generale)</option>
                <option value="5">5 (Popolazione omogenea documentata)</option>
                <option value="1">1 (Nessuna variabilità documentata)</option>
              </select>
            </div>

            {/* F3: Study duration */}
            <div className="bg-slate-800/40 p-3.5 rounded-xl border border-slate-700/60">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-200">
                  F3: Durata dell&apos;Esposizione nello Studio
                </label>
                <span className="text-xs font-mono font-bold text-teal-400 bg-slate-900 px-2 py-0.5 rounded">
                  F3 = {f3}
                </span>
              </div>
              <select
                value={f3}
                onChange={(e) => setF3(parseFloat(e.target.value))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none"
              >
                <option value="1">1 (Studio cronico &gt; 1 anno per roditori o &gt; 2 anni)</option>
                <option value="2">2 (Studio subcronico 6 mesi nei roditori)</option>
                <option value="5">5 (Studio subcronico 3 mesi nei roditori)</option>
                <option value="10">10 (Studio sub-acuto o breve durata &lt; 4 settimane)</option>
              </select>
            </div>

            {/* F4: Severity */}
            <div className="bg-slate-800/40 p-3.5 rounded-xl border border-slate-700/60">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-200">
                  F4: Severità della Tossicità (Teratogenicità / Cancerogenicità non genotossica)
                </label>
                <span className="text-xs font-mono font-bold text-teal-400 bg-slate-900 px-2 py-0.5 rounded">
                  F4 = {f4}
                </span>
              </div>
              <select
                value={f4}
                onChange={(e) => setF4(parseFloat(e.target.value))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none"
              >
                <option value="1">1 (Nessuna tossicità severa irreversibile)</option>
                <option value="2">2 (Tossicità moderata o tossicità fetale non teratogena)</option>
                <option value="5">5 (Teratogenicità documentata con tossicità materna)</option>
                <option value="10">10 (Teratogenicità senza tossicità materna o cancerogenicità non-genotossica)</option>
              </select>
            </div>

            {/* F5: LOAEL factor */}
            <div className="bg-slate-800/40 p-3.5 rounded-xl border border-slate-700/60">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-200">
                  F5: Fattore Variabile NOAEL vs LOAEL
                </label>
                <span className="text-xs font-mono font-bold text-teal-400 bg-slate-900 px-2 py-0.5 rounded">
                  F5 = {f5}
                </span>
              </div>
              <select
                value={f5}
                onChange={(e) => setF5(parseFloat(e.target.value))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none"
              >
                <option value="1">1 (NOAEL chiaramente stabilito nello studio)</option>
                <option value="2">2 (LOAEL con effetti molto lievi)</option>
                <option value="5">5 (LOAEL con effetti moderati)</option>
                <option value="10">10 (Solo LOAEL disponibile con effetti severi)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Output & Formula Panel */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-md space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
              <Activity className="w-4 h-4 text-teal-400" />
              <span>Risultato PDE Calcolato</span>
            </h2>

            {/* PDE Big Display */}
            <div className="bg-teal-950/40 border border-teal-500/50 p-5 rounded-2xl text-center space-y-1">
              <span className="text-xs font-bold text-teal-300 uppercase tracking-wider">
                Permitted Daily Exposure (PDE)
              </span>
              <div className="text-3xl font-black text-white font-mono">
                {result.pdeMgDay} <span className="text-base font-normal text-teal-300">mg/die</span>
              </div>
              <div className="text-sm font-mono text-teal-400 font-bold">
                ({result.pdeUgDay} µg/die)
              </div>
            </div>

            {/* Formula Breakdown */}
            <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60 text-xs font-mono space-y-2">
              <div className="text-slate-400 text-[11px] font-sans font-bold uppercase">
                Formula EMA / APIC:
              </div>
              <div className="text-white">PDE = (NOAEL × BW) / (F1 × F2 × F3 × F4 × F5)</div>
              <div className="text-slate-400 pt-1 border-t border-slate-700 text-[11px]">
                Numeratore: {noael} × {bodyWeight} = <strong className="text-slate-200">{(noael * bodyWeight).toFixed(3)}</strong>
              </div>
              <div className="text-slate-400 text-[11px]">
                Denominatore: {f1} × {f2} × {f3} × {f4} × {f5} = <strong className="text-slate-200">{compositeFactor}</strong>
              </div>
            </div>

            {/* Suggested OEB Band */}
            <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60 text-xs space-y-1">
              <span className="text-slate-400 block font-medium">Fascia di Contenimento Suggerita:</span>
              <span className="text-sm font-bold text-teal-300 block">{suggestedOeb}</span>
            </div>
          </div>

          <button
            onClick={() =>
              onOpenAddModalWithPde(result.pdeMgDay, noael, { f1, f2, f3, f4, f5 })
            }
            className="w-full flex items-center justify-center space-x-2 py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-lg transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            <span>Salva come Nuovo Composto nel Database</span>
          </button>
        </div>
      </div>
    </div>
  );
};
