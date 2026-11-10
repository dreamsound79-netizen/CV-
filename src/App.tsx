import React, { useState, useEffect, useMemo } from 'react';
import { PharmaceuticalCompound } from './types/apic';
import { GLOBAL_API_DATABASE } from './data/globalApiDatabase';
import { Navbar } from './components/Navbar';
import { DatabaseBrowser } from './components/DatabaseBrowser';
import { CompoundDetailModal } from './components/CompoundDetailModal';
import { ApicCalculator } from './components/ApicCalculator';
import { FacilityMatrix } from './components/FacilityMatrix';
import { PdeDerivationTool } from './components/PdeDerivationTool';
import { AddCustomCompoundModal } from './components/AddCustomCompoundModal';
import { DatabaseImportExportModal } from './components/DatabaseImportExportModal';
import { ShieldCheck, BookOpen, ExternalLink } from 'lucide-react';

const LOCAL_STORAGE_KEY = 'apic_cleaning_validation_custom_compounds';

export default function App() {
  const [activeTab, setActiveTab] = useState<'database' | 'calculator' | 'matrix' | 'pde-derivation'>('matrix');
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-teal-500 selection:text-slate-950">
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

      {/* Main App Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === 'database' && (
          <DatabaseBrowser
            compounds={compounds}
            onSelectCompound={(c) => setSelectedCompoundForDetail(c)}
            onSendToCalculator={handleSelectForCalculator}
            onOpenImportExport={() => setIsImportExportModalOpen(true)}
          />
        )}

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
