import React, { useState, useEffect, useMemo } from 'react';
import { PharmaceuticalCompound } from './types/apic';
import { GLOBAL_API_DATABASE } from './data/globalApiDatabase';
import { Navbar } from './components/Navbar';
import { CompoundDetailModal } from './components/CompoundDetailModal';
import { ApicCalculator } from './components/ApicCalculator';
import { FacilityMatrix } from './components/FacilityMatrix';
import { PdeDerivationTool } from './components/PdeDerivationTool';
import { AddCustomCompoundModal } from './components/AddCustomCompoundModal';
import { DatabaseImportExportModal } from './components/DatabaseImportExportModal';
import { ShieldCheck, BookOpen, ExternalLink } from 'lucide-react';

const LOCAL_STORAGE_KEY = 'apic_cleaning_validation_custom_compounds';

export default function App() {
  const [activeTab, setActiveTab] = useState<'matrix' | 'calculator' | 'pde-derivation'>('matrix');
  const [compounds, setCompounds] = useState<PharmaceuticalCompound[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Merge global preloaded with saved custom compounds
          const customOnly = parsed.filter((c: PharmaceuticalCompound) => c.isCustom);
          return [...GLOBAL_API_DATABASE, ...customOnly];
        }
      }
    } catch (e) {
      console.warn('Could not read custom compounds from localStorage', e);
    }
    return GLOBAL_API_DATABASE;
  });

  const [selectedCompoundForDetail, setSelectedCompoundForDetail] = useState<PharmaceuticalCompound | null>(null);
  const [selectedProductA, setSelectedProductA] = useState<PharmaceuticalCompound>(GLOBAL_API_DATABASE[0]);

  // Add custom compound modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [initialPdeForAdd, setInitialPdeForAdd] = useState<number | undefined>(undefined);
  const [initialNoaelForAdd, setInitialNoaelForAdd] = useState<number | undefined>(undefined);
  const [initialFFactorsForAdd, setInitialFFactorsForAdd] = useState<any>(undefined);

  // Import / Export modal state
  const [isImportExportModalOpen, setIsImportExportModalOpen] = useState(false);

  // Save custom compounds to localStorage
  const handleSaveCustomCompound = (newCompound: PharmaceuticalCompound) => {
    setCompounds((prev) => {
      const updated = [newCompound, ...prev];
      try {
        const customOnly = updated.filter((c) => c.isCustom);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(customOnly));
      } catch (err) {
        console.warn('Failed to save to localStorage', err);
      }
      return updated;
    });
  };

  // Bulk import handler
  const handleImportSuccess = (imported: PharmaceuticalCompound[], mode: 'merge' | 'replace') => {
    setCompounds((prev) => {
      let nextList: PharmaceuticalCompound[];
      if (mode === 'replace') {
        nextList = imported;
      } else {
        // Merge: match on CAS or Name
        const map = new Map<string, PharmaceuticalCompound>();
        for (const item of prev) {
          const key = (item.casNumber && item.casNumber !== 'N/A' ? item.casNumber : item.name).toLowerCase();
          map.set(key, item);
        }
        for (const item of imported) {
          const key = (item.casNumber && item.casNumber !== 'N/A' ? item.casNumber : item.name).toLowerCase();
          map.set(key, item);
        }
        nextList = Array.from(map.values());
      }

      try {
        const customOnly = nextList.filter((c) => c.isCustom);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(customOnly));
      } catch (err) {
        console.warn('Failed to persist imported compounds to localStorage', err);
      }
      return nextList;
    });
  };

  const handleSelectForCalculator = (compound: PharmaceuticalCompound) => {
    setSelectedProductA(compound);
    setActiveTab('calculator');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenAddModalWithPde = (pdeMg: number, noael: number, fFactors: any) => {
    setInitialPdeForAdd(pdeMg);
    setInitialNoaelForAdd(noael);
    setInitialFFactorsForAdd(fFactors);
    setIsAddModalOpen(true);
  };

  const totalIntermediatesCount = useMemo(() => {
    return compounds.reduce((acc, c) => acc + c.intermediates.length, 0);
  }, [compounds]);

  // Environment color configurations
  const environmentMeta = useMemo(() => {
    switch (activeTab) {
      case 'matrix':
        return {
          id: 'scheda-1',
          name: 'Ambiente Scheda 1: Matrice Impianto & Incastro Prodotti (Cross-Carryover APIC)',
          badge: 'SCHEDA 1 • WORST-CASE MATRIX',
          guideline: 'Guida APIC Sez. 7.0 & EMA GMP Annex 15',
          tagline: 'Configurazione treni di produzione A-J (Max 10), rating pulibilità a-d e cross-carryover A -> B',
          bgGradient: 'bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(168,85,247,0.18),rgba(2,6,23,1))]',
          barClasses: 'bg-purple-950/40 border-purple-800/60 text-purple-200',
          dotColor: 'bg-purple-400',
          badgeColor: 'bg-purple-500/20 text-purple-200 border-purple-400/40',
        };
      case 'calculator':
        return {
          id: 'scheda-2',
          name: 'Ambiente Scheda 2: Calcolatore MACO & Criteri di Accettazione APIC Par. 4.0',
          badge: 'SCHEDA 2 • ACCETTABILITÀ MACO',
          guideline: 'Guida APIC Cap. 4.0 • Limiti Tossicologici & 10 ppm',
          tagline: 'Calcolo Acceptance Criteria HBEL (4.2.1), Generale (4.2.2), Peptidi (4.2.3), Swab (4.2.4) e Rinse (4.2.5)',
          bgGradient: 'bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(16,185,129,0.18),rgba(2,6,23,1))]',
          barClasses: 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200',
          dotColor: 'bg-emerald-400',
          badgeColor: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40',
        };
      case 'pde-derivation':
        return {
          id: 'pde-derivation',
          name: 'Ambiente Tossicologia: Derivazione ADE/PDE (NOAEL & Fattori di Incertezza F1-F5)',
          badge: 'TOSSICOLOGIA • DERIVAZIONE ADE/PDE',
          guideline: 'Linee Guida EMA / ICH Q3D & APIC',
          tagline: 'Valutazione della dose priva di effetto avverso osservabile e fattori biologici di estrapolazione',
          bgGradient: 'bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(245,158,11,0.18),rgba(2,6,23,1))]',
          barClasses: 'bg-amber-950/40 border-amber-800/60 text-amber-200',
          dotColor: 'bg-amber-400',
          badgeColor: 'bg-amber-500/20 text-amber-200 border-amber-400/40',
        };
    }
  }, [activeTab]);

  return (
    <div className={`min-h-screen text-slate-100 flex flex-col font-sans selection:bg-teal-500 selection:text-slate-950 transition-colors duration-500 ${environmentMeta.bgGradient}`}>
      {/* Top Professional Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAddModal={() => {
          setInitialPdeForAdd(undefined);
          setInitialNoaelForAdd(undefined);
          setInitialFFactorsForAdd(undefined);
          setIsAddModalOpen(true);
        }}
        onOpenImportExport={() => setIsImportExportModalOpen(true)}
        totalCompoundsCount={compounds.length}
        totalIntermediatesCount={totalIntermediatesCount}
      />

      {/* Dynamic Environment Status Bar - Distinctive visual banner for current tab */}
      <div className={`border-b border-t border-slate-800/50 py-1.5 px-4 sm:px-6 lg:px-8 transition-colors duration-300 ${environmentMeta.barClasses} no-print`}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]">
          <div className="flex items-center space-x-2">
            <span className={`inline-block w-2 h-2 rounded-full ${environmentMeta.dotColor} animate-pulse shrink-0`}></span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${environmentMeta.badgeColor}`}>
              {environmentMeta.badge}
            </span>
            <span className="font-bold text-white tracking-tight">{environmentMeta.name}</span>
          </div>
          <div className="text-slate-400 text-[10px] hidden md:block">
            {environmentMeta.tagline}
          </div>
        </div>
      </div>

      {/* Main App Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

        {activeTab === 'calculator' && (
          <ApicCalculator
            compounds={compounds}
            selectedProductA={selectedProductA}
            onSelectProductA={(c) => setSelectedProductA(c)}
          />
        )}

        {activeTab === 'matrix' && (
          <FacilityMatrix
            compounds={compounds}
            onSelectForCalculator={handleSelectForCalculator}
          />
        )}

        {activeTab === 'pde-derivation' && (
          <PdeDerivationTool onOpenAddModalWithPde={handleOpenAddModalWithPde} />
        )}
      </main>

      {/* Compound Toxicological Dossier Modal */}
      <CompoundDetailModal
        compound={selectedCompoundForDetail}
        onClose={() => setSelectedCompoundForDetail(null)}
        onSelectForCalculator={handleSelectForCalculator}
      />

      {/* Add Custom Compound Modal */}
      <AddCustomCompoundModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleSaveCustomCompound}
        initialPde={initialPdeForAdd}
        initialNoael={initialNoaelForAdd}
        initialFFactors={initialFFactorsForAdd}
      />

      {/* Database Import / Export & Standalone HTML Modal */}
      <DatabaseImportExportModal
        isOpen={isImportExportModalOpen}
        onClose={() => setIsImportExportModalOpen(false)}
        compounds={compounds}
        onImportSuccess={handleImportSuccess}
      />

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-6 text-xs text-slate-400 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-teal-400" />
            <span>
              APIC Cleaning Validation Suite • Conforme Guida APIC / CEFIC (2021) & EMA GMP Annex 15
            </span>
          </div>
          <div className="flex items-center space-x-4 text-slate-500">
            <span>Database Globale Precaricato ({compounds.length} API • {totalIntermediatesCount} Intermedi)</span>
            <span>•</span>
            <span className="text-slate-400">Teva • Lonza • Pfizer • Novartis • Axplora • Dipharma • Curia • Olon • Sanofi • Cambrex • Cipla • Procos • Aurobindo</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
