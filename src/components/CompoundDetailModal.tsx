import React from 'react';
import { PharmaceuticalCompound, IntermediateCompound } from '../types/apic';
import { X, ShieldAlert, CheckCircle2, AlertTriangle, Droplet, Layers, Beaker, FileText, ArrowRight } from 'lucide-react';

interface CompoundDetailModalProps {
  compound: PharmaceuticalCompound | null;
  onClose: () => void;
  onSelectForCalculator: (compound: PharmaceuticalCompound) => void;
}

export const CompoundDetailModal: React.FC<CompoundDetailModalProps> = ({
  compound,
  onClose,
  onSelectForCalculator,
}) => {
  if (!compound) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl text-slate-100 overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-start justify-between p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/80">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                {compound.category}
              </span>
              <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${
                compound.oeb === 'OEB 5' || compound.oeb === 'OEB 4'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : compound.oeb === 'OEB 3'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              }`}>
                {compound.oeb}
              </span>
              <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                CAS: {compound.casNumber}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">{compound.name}</h2>
            <p className="text-xs text-slate-400 mt-1 font-mono break-all">{compound.chemicalName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60">
              <span className="text-xs text-slate-400 block font-medium">Limite PDE / ADE</span>
              <span className="text-xl font-bold text-teal-400">{compound.pdeMgDay} mg/die</span>
              <span className="text-xs text-slate-400 block mt-0.5 font-mono">({compound.pdeUgDay} µg/die)</span>
            </div>

            <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60">
              <span className="text-xs text-slate-400 block font-medium">Dose Min / Max</span>
              <span className="text-xl font-bold text-blue-400">{compound.minDailyDoseMg} / {compound.maxDailyDoseMg} mg</span>
              <span className="text-xs text-slate-400 block mt-0.5">Via {compound.routeOfAdministration}</span>
            </div>

            <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60">
              <span className="text-xs text-slate-400 block font-medium">Solubilità in Acqua</span>
              <span className="text-base font-semibold text-slate-200">{compound.solubilityInWater}</span>
              <span className="text-xs text-slate-400 block mt-0.5">Test a 20°C</span>
            </div>

            <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60">
              <span className="text-xs text-slate-400 block font-medium">Pulibilità (Cleanability)</span>
              <span className={`text-sm font-bold block ${
                compound.cleanability.includes('Very Difficult') || compound.cleanability.includes('Difficult')
                  ? 'text-rose-400'
                  : compound.cleanability.includes('Moderate')
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}>
                {compound.cleanability}
              </span>
            </div>
          </div>

          {/* Chemical & Physical Specifications */}
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center space-x-2">
              <Beaker className="w-4 h-4 text-teal-400" />
              <span>Dati Molecolari & Produttori Principali</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block">Formula Molecolare:</span>
                <span className="text-slate-200 font-mono font-semibold">{compound.molecularFormula}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Peso Molecolare (MW):</span>
                <span className="text-slate-200 font-mono font-semibold">{compound.molecularWeight} g/mol</span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-slate-400 block mb-1">Cataloghi Produttori Globali Collegati:</span>
                <div className="flex flex-wrap gap-1.5">
                  {compound.primaryManufacturers.map((mfg) => (
                    <span
                      key={mfg}
                      className="px-2 py-0.5 rounded bg-indigo-950/70 text-indigo-300 border border-indigo-700/50 font-medium"
                    >
                      {mfg}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Toxicological Assessment & Derivation */}
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60 space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>Dossier Tossicologico & Fattori di Modifica (EMA / APIC)</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block">Classe Tossicologica:</span>
                <span className="font-semibold text-slate-200">{compound.toxicologicalClass}</span>
              </div>
              <div>
                <span className="text-slate-400 block">NOAEL (Punto di Partenza):</span>
                <span className="font-semibold text-teal-300">
                  {compound.noaelMgKgDay ? `${compound.noaelMgKgDay} mg/kg/die` : 'Non riportato nel compendio'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Riferimento Monografia:</span>
                <span className="font-semibold text-slate-300">{compound.monographReference || 'Guida APIC'}</span>
              </div>
            </div>

            {compound.fFactors && (
              <div className="mt-2 pt-2 border-t border-slate-700/50">
                <span className="text-xs text-slate-400 block mb-1.5">Fattori di Modifica EMA applicati:</span>
                <div className="grid grid-cols-5 gap-2 text-center text-xs">
                  <div className="bg-slate-900/80 p-2 rounded border border-slate-700">
                    <span className="block text-slate-400 font-mono">F1 (Specie)</span>
                    <span className="font-bold text-white">{compound.fFactors.f1}</span>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded border border-slate-700">
                    <span className="block text-slate-400 font-mono">F2 (Individuo)</span>
                    <span className="font-bold text-white">{compound.fFactors.f2}</span>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded border border-slate-700">
                    <span className="block text-slate-400 font-mono">F3 (Durata)</span>
                    <span className="font-bold text-white">{compound.fFactors.f3}</span>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded border border-slate-700">
                    <span className="block text-slate-400 font-mono">F4 (Severità)</span>
                    <span className="font-bold text-white">{compound.fFactors.f4}</span>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded border border-slate-700">
                    <span className="block text-slate-400 font-mono">F5 (LOAEL)</span>
                    <span className="font-bold text-white">{compound.fFactors.f5}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Intermediates Tree (Repertorio Intermedi di Sintesi) */}
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center space-x-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>Intermedi di Sintesi e Precursori ({compound.intermediates.length})</span>
            </h3>

            {compound.intermediates.length === 0 ? (
              <p className="text-xs text-slate-400 italic">
                Nessun intermedio isolato registrato per questo API o processo monocatena/fermentativo diretto.
              </p>
            ) : (
              <div className="space-y-3">
                {compound.intermediates.map((intCompound) => (
                  <div
                    key={intCompound.id}
                    className="bg-slate-900/80 border border-slate-700 p-3.5 rounded-lg text-xs space-y-1.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-indigo-300">{intCompound.code}</span>
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[11px]">
                          {intCompound.stage}
                        </span>
                        {intCompound.casNumber && (
                          <span className="text-slate-400 font-mono text-[11px]">
                            CAS: {intCompound.casNumber}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-400">PDE Stimato:</span>
                        <span className="font-bold text-teal-300 font-mono">
                          {intCompound.pdeValueMg ? `${intCompound.pdeValueMg} mg/die` : 'ND'}
                        </span>
                      </div>
                    </div>
                    <p className="text-slate-300 font-medium">{intCompound.name}</p>
                    {intCompound.notes && (
                      <p className="text-slate-400 text-[11px] italic bg-slate-800/40 p-1.5 rounded">
                        {intCompound.notes}
                      </p>
                    )}
                    <div className="flex items-center space-x-2 text-[11px] text-slate-400 pt-1">
                      <span>Pulibilità intermedio:</span>
                      <span className="font-semibold text-amber-300">{intCompound.cleanability}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cleaning Validation Parameters (CIP, Swab, Analytical Method) */}
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center space-x-2">
              <Droplet className="w-4 h-4 text-teal-400" />
              <span>Parametri di Pulizia CIP & Convalida Analitica</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="sm:col-span-2">
                <span className="text-slate-400 block mb-1">Agente di Pulizia CIP Raccomandato:</span>
                <span className="text-slate-200 font-medium bg-slate-900/80 p-2 rounded border border-slate-700 block">
                  {compound.suggestedCipCleaningAgent}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">Metodo Analitico Rilevamento:</span>
                <span className="px-2.5 py-1 rounded bg-teal-950/80 text-teal-300 border border-teal-700/60 font-bold inline-block">
                  {compound.recommendedAnalyticalMethod}
                </span>
                <span className="text-slate-400 block mt-2">
                  Recupero Swab medio default: <strong className="text-white">{compound.defaultSwabRecoveryPercent}%</strong>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
          >
            Chiudi
          </button>

          <button
            onClick={() => {
              onSelectForCalculator(compound);
              onClose();
            }}
            className="flex items-center space-x-2 px-5 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-md transition-colors"
          >
            <span>Carica nel Calcolatore MACO come Contaminante (Prodotto A)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
