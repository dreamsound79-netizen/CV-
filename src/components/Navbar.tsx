import React from 'react';
import { ShieldCheck, Database, Calculator, Table, Activity, PlusCircle, Sparkles } from 'lucide-react';

interface NavbarProps {
  activeTab: 'matrix' | 'calculator' | 'pde-derivation';
  setActiveTab: (tab: 'matrix' | 'calculator' | 'pde-derivation') => void;
  onOpenAddModal: () => void;
  onOpenImportExport: () => void;
  totalCompoundsCount: number;
  totalIntermediatesCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenAddModal,
  onOpenImportExport,
  totalCompoundsCount,
  totalIntermediatesCount,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Guideline Tagline */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-blue-600 flex items-center justify-center shadow-md shadow-teal-500/20 text-white font-bold">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight text-white">APIC Cleaning Validation Suite</span>
                <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  Guida APIC / EMA GMP
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Database Globale ADE/PDE • Calcolo MACO & Limiti Swab/Rinse • Valutazione Worst-Case
              </p>
            </div>
          </div>

          {/* Quick Stats Pill */}
          <div className="hidden lg:flex items-center space-x-2 bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-700/60 text-xs">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-slate-300 font-medium">Repertorio Globale:</span>
            <span className="text-teal-400 font-bold">{totalCompoundsCount} API</span>
            <span className="text-slate-500">•</span>
            <span className="text-indigo-400 font-bold">+{totalIntermediatesCount} Intermedi</span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={onOpenImportExport}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/40 text-xs font-semibold transition-colors shadow-sm"
              title="Carica intero database in formato Excel (.xlsx), SQL dump (.sql) o CSV (.csv)"
            >
              <Database className="w-3.5 h-3.5 text-teal-400" />
              <span className="hidden sm:inline">Carica / Esporta Database</span>
              <span className="sm:hidden">Carica DB</span>
            </button>

            <button
              onClick={onOpenAddModal}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold transition-colors shadow-sm"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Nuovo Composto</span>
              <span className="sm:hidden">Nuovo</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs - Distinctive Environment Colors */}
        <div className="flex space-x-1 sm:space-x-2 border-t border-slate-800/70 pt-1 overflow-x-auto no-scrollbar">
          {/* TAB 1: Matrice Impianto - Purple / Indigo Environment */}
          <button
            onClick={() => setActiveTab('matrix')}
            className={`flex items-center space-x-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'matrix'
                ? 'border-purple-400 text-purple-200 bg-gradient-to-t from-purple-950/80 to-slate-900/90 shadow-md shadow-purple-900/30 font-bold'
                : 'border-transparent text-slate-400 hover:text-purple-300 hover:bg-slate-800/40'
            }`}
          >
            <Table className={`w-4 h-4 ${activeTab === 'matrix' ? 'text-purple-300 animate-pulse' : 'text-purple-400/70'}`} />
            <span className="flex items-center space-x-1.5">
              <span>Scheda 1: Matrice Impianto &amp; Incastro Prodotti</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${
                activeTab === 'matrix'
                  ? 'bg-purple-500/30 text-purple-200 border-purple-400/50'
                  : 'bg-slate-800 text-purple-400 border-purple-500/20'
              }`}>
                Max 10 Matrici
              </span>
            </span>
          </button>

          {/* TAB 2: Calcolatore MACO - Emerald / Mint Environment */}
          <button
            onClick={() => setActiveTab('calculator')}
            className={`flex items-center space-x-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'calculator'
                ? 'border-emerald-400 text-emerald-200 bg-gradient-to-t from-emerald-950/80 to-slate-900/90 shadow-md shadow-emerald-900/30 font-bold'
                : 'border-transparent text-slate-400 hover:text-emerald-300 hover:bg-slate-800/40'
            }`}
          >
            <Calculator className={`w-4 h-4 ${activeTab === 'calculator' ? 'text-emerald-300 animate-pulse' : 'text-emerald-400/70'}`} />
            <span className="flex items-center space-x-1.5">
              <span>Scheda 2: Calcolatore MACO (Par. 4.0 APIC)</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${
                activeTab === 'calculator'
                  ? 'bg-emerald-500/30 text-emerald-200 border-emerald-400/50'
                  : 'bg-slate-800 text-emerald-400 border-emerald-500/20'
              }`}>
                Criteri di Accettazione
              </span>
            </span>
          </button>

          {/* TAB 3: Derivazione Tossicologica - Amber / Gold Environment */}
          <button
            onClick={() => setActiveTab('pde-derivation')}
            className={`flex items-center space-x-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'pde-derivation'
                ? 'border-amber-400 text-amber-200 bg-gradient-to-t from-amber-950/80 to-slate-900/90 shadow-md shadow-amber-900/30 font-bold'
                : 'border-transparent text-slate-400 hover:text-amber-300 hover:bg-slate-800/40'
            }`}
          >
            <Activity className={`w-4 h-4 ${activeTab === 'pde-derivation' ? 'text-amber-300 animate-pulse' : 'text-amber-400/70'}`} />
            <span className="flex items-center space-x-1.5">
              <span>Derivazione Tossicologica ADE/PDE</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${
                activeTab === 'pde-derivation'
                  ? 'bg-amber-500/30 text-amber-200 border-amber-400/50'
                  : 'bg-slate-800 text-amber-400 border-amber-500/20'
              }`}>
                Fattori F1-F5
              </span>
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
