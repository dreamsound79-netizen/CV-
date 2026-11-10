import React, { useState, useMemo } from 'react';
import {
  PharmaceuticalCompound,
  GlobalManufacturer,
  TherapeuticCategory,
  OEBLevel,
  CasIndexEntry,
} from '../types/apic';
import { ALL_MANUFACTURERS, ALL_CATEGORIES, MANUFACTURER_PROFILES } from '../data/globalApiDatabase';
import { buildCasIndex, validateCasChecksum } from '../utils/apicCalculations';
import {
  Search,
  Filter,
  Eye,
  Calculator,
  Download,
  Building2,
  FileSpreadsheet,
  AlertOctagon,
  Layers,
  ChevronDown,
  Sparkles,
  LayoutGrid,
  List,
  Upload,
  Fingerprint,
  CheckCircle2,
  XCircle,
  HelpCircle,
  BookOpen,
  ArrowRight,
  ShieldAlert,
  Globe2,
  Factory,
} from 'lucide-react';

interface DatabaseBrowserProps {
  compounds: PharmaceuticalCompound[];
  onSelectCompound: (compound: PharmaceuticalCompound) => void;
  onSendToCalculator: (compound: PharmaceuticalCompound) => void;
  onOpenImportExport: () => void;
}

export const DatabaseBrowser: React.FC<DatabaseBrowserProps> = ({
  compounds,
  onSelectCompound,
  onSendToCalculator,
  onOpenImportExport,
}) => {
  // Main view mode: Catalog (standard) vs CAS Index
  const [subView, setSubView] = useState<'catalog' | 'cas-index'>('catalog');

  // Search and Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSegment, setSelectedSegment] = useState<string>('All');
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedOeb, setSelectedOeb] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');

  // CAS Index specific state
  const [casPrefixFilter, setCasPrefixFilter] = useState<string>('All');
  const [casTypeFilter, setCasTypeFilter] = useState<'all' | 'api-only' | 'intermediates-only'>('all');
  const [casVerifierInput, setCasVerifierInput] = useState<string>('');

  // Build full CAS index across compounds and intermediates
  const fullCasIndex: CasIndexEntry[] = useMemo(() => {
    return buildCasIndex(compounds);
  }, [compounds]);

  // Real-time CAS Checksum tester result
  const casVerificationResult = useMemo(() => {
    if (!casVerifierInput.trim()) return null;
    const validation = validateCasChecksum(casVerifierInput);
    const matchedEntry = fullCasIndex.find(
      (e) => e.casNumber.toLowerCase() === casVerifierInput.trim().toLowerCase()
    );
    return {
      validation,
      matchedEntry,
    };
  }, [casVerifierInput, fullCasIndex]);

  // Filter logic for Catalog View
  const filteredCompounds = useMemo(() => {
    return compounds.filter((item) => {
      // Search term
      if (searchTerm.trim() !== '') {
        const query = searchTerm.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(query);
        const matchesCas = item.casNumber.toLowerCase().includes(query);
        const matchesChem = item.chemicalName.toLowerCase().includes(query);
        const matchesIntermediates = item.intermediates.some(
          (intComp) =>
            intComp.name.toLowerCase().includes(query) ||
            intComp.code.toLowerCase().includes(query) ||
            (intComp.casNumber && intComp.casNumber.includes(query))
        );
        if (!matchesName && !matchesCas && !matchesChem && !matchesIntermediates) {
          return false;
        }
      }

      // Segment
      if (selectedSegment !== 'All') {
        const matchesSegment = item.primaryManufacturers.some(
          (m) => MANUFACTURER_PROFILES[m]?.segment === selectedSegment
        );
        if (!matchesSegment) return false;
      }

      // Manufacturer
      if (selectedManufacturer !== 'All') {
        if (!item.primaryManufacturers.includes(selectedManufacturer as GlobalManufacturer)) {
          return false;
        }
      }

      // Category
      if (selectedCategory !== 'All') {
        if (item.category !== selectedCategory) {
          return false;
        }
      }

      // OEB
      if (selectedOeb !== 'All') {
        if (item.oeb !== selectedOeb) {
          return false;
        }
      }

      return true;
    });
  }, [compounds, searchTerm, selectedSegment, selectedManufacturer, selectedCategory, selectedOeb]);

  // Filter logic for CAS Index View
  const filteredCasEntries = useMemo(() => {
    return fullCasIndex.filter((entry) => {
      // Type filter
      if (casTypeFilter === 'api-only' && entry.isIntermediate) return false;
      if (casTypeFilter === 'intermediates-only' && !entry.isIntermediate) return false;

      // Prefix filter
      if (casPrefixFilter !== 'All') {
        if (casPrefixFilter === 'INT') {
          if (!entry.casNumber.startsWith('INT-')) return false;
        } else {
          if (!entry.casNumber.startsWith(casPrefixFilter)) return false;
        }
      }

      // Segment
      if (selectedSegment !== 'All') {
        const matchesSegment = entry.primaryManufacturers.some(
          (m) => MANUFACTURER_PROFILES[m]?.segment === selectedSegment
        );
        if (!matchesSegment) return false;
      }

      // Manufacturer
      if (selectedManufacturer !== 'All') {
        if (!entry.primaryManufacturers.includes(selectedManufacturer as GlobalManufacturer)) {
          return false;
        }
      }

      // Category
      if (selectedCategory !== 'All') {
        if (entry.category !== selectedCategory) {
          return false;
        }
      }

      // Search term
      if (searchTerm.trim() !== '') {
        const q = searchTerm.toLowerCase();
        const matchCas = entry.casNumber.toLowerCase().includes(q);
        const matchName = entry.name.toLowerCase().includes(q);
        const matchParent = entry.parentCompoundName.toLowerCase().includes(q);
        const matchCode = entry.intermediateCode?.toLowerCase().includes(q) ?? false;
        if (!matchCas && !matchName && !matchParent && !matchCode) {
          return false;
        }
      }

      return true;
    });
  }, [fullCasIndex, casTypeFilter, casPrefixFilter, selectedSegment, selectedManufacturer, selectedCategory, searchTerm]);

  // Export Catalog to CSV
  const handleExportCsv = () => {
    const headers = [
      'Name',
      'CAS',
      'Category',
      'OEB',
      'PDE_mg_day',
      'PDE_ug_day',
      'Min_Daily_Dose_mg',
      'Max_Daily_Dose_mg',
      'Solubility',
      'Cleanability',
      'Tox_Class',
      'Manufacturers',
      'Intermediates_Count',
    ];

    const rows = filteredCompounds.map((c) => [
      `"${c.name}"`,
      `"${c.casNumber}"`,
      `"${c.category}"`,
      `"${c.oeb}"`,
      c.pdeMgDay,
      c.pdeUgDay,
      c.minDailyDoseMg,
      c.maxDailyDoseMg,
      `"${c.solubilityInWater}"`,
      `"${c.cleanability}"`,
      `"${c.toxicologicalClass}"`,
      `"${c.primaryManufacturers.join('; ')}"`,
      c.intermediates.length,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `APIC_Global_ADE_PDE_Database_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export CAS Index to CSV
  const handleExportCasCsv = () => {
    const headers = [
      'CAS_Number',
      'Valid_Checksum',
      'Substance_Name',
      'Type',
      'Stage',
      'Parent_API',
      'OEB_Level',
      'PDE_mg_day',
      'Therapeutic_Category',
      'Manufacturers',
    ];

    const rows = filteredCasEntries.map((e) => [
      `"${e.casNumber}"`,
      e.isValidChecksum ? 'YES' : 'NO',
      `"${e.name}"`,
      e.isIntermediate ? 'Intermediate' : 'API',
      `"${e.intermediateStage || 'Active Pharmaceutical Ingredient'}"`,
      `"${e.parentCompoundName}"`,
      `"${e.oeb}"`,
      e.pdeMgDay,
      `"${e.category}"`,
      `"${e.primaryManufacturers.join('; ')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `APIC_CAS_Index_Registry_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Quick stats
  const totalIntermediates = useMemo(
    () => compounds.reduce((acc, c) => acc + c.intermediates.length, 0),
    [compounds]
  );
  const hpapiCount = useMemo(
    () => compounds.filter((c) => c.oeb === 'OEB 4' || c.oeb === 'OEB 5').length,
    [compounds]
  );
  const verifiedCasCount = useMemo(
    () => fullCasIndex.filter((e) => e.isValidChecksum).length,
    [fullCasIndex]
  );

  return (
    <div className="space-y-6">
      {/* Top Banner & Context */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 p-6 rounded-2xl border border-slate-700/80 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                Guida APIC / CEFIC Aggiornata
              </span>
              <span className="text-xs text-slate-400">Repertorio Farmaceutico Multicompound & Registro CAS</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight mt-1">
              Database Globale ADE/PDE & Indicizzazione CAS
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl">
              Repertorio completo coprente i cataloghi dei primari produttori farmaceutici globali
              (Teva, Lonza, Pfizer, Novartis, Axplora, Dipharma, Curia, Olon, Sanofi, Cambrex, Cipla, Procos, Aurobindo)
              con <strong>indicizzazione analitica dei codici CAS</strong> per API e intermedi di sintesi.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onOpenImportExport}
              className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-md transition-colors"
              title="Carica un intero database in formato Excel (.xlsx, .xls), SQL (.sql), CSV (.csv) o scarica il singolo file HTML"
            >
              <Upload className="w-4 h-4" />
              <span>Carica DB (Excel/SQL/CSV)</span>
            </button>

            <button
              onClick={subView === 'catalog' ? handleExportCsv : handleExportCasCsv}
              className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors shadow-sm"
              title="Esporta catalogo filtrato in formato CSV"
            >
              <Download className="w-4 h-4 text-teal-400" />
              <span>{subView === 'catalog' ? 'Esporta CSV Catalogo' : 'Esporta Registro CAS'}</span>
            </button>
          </div>
        </div>

        {/* Metric Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-4 border-t border-slate-700/60">
          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400 font-medium">Principi Attivi (API)</span>
            <div className="text-xl font-bold text-teal-400">{compounds.length}</div>
          </div>
          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400 font-medium">Intermedi di Sintesi</span>
            <div className="text-xl font-bold text-indigo-400">+{totalIntermediates}</div>
          </div>
          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400 font-medium">Voci CAS Indicizzate</span>
            <div className="text-xl font-bold text-emerald-400">
              {fullCasIndex.length} <span className="text-xs font-normal text-slate-400">({verifiedCasCount} check OK)</span>
            </div>
          </div>
          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400 font-medium">Produttori Mappati</span>
            <div className="text-xl font-bold text-amber-400">{ALL_MANUFACTURERS.length}</div>
          </div>
        </div>
      </div>

      {/* Sub-View Switch: Catalog vs CAS Index */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setSubView('catalog')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            subView === 'catalog'
              ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
              : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Catalogo Principale API & Dossier ({filteredCompounds.length})</span>
        </button>

        <button
          onClick={() => setSubView('cas-index')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            subView === 'cas-index'
              ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
              : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Fingerprint className="w-4 h-4 text-teal-300" />
          <span>Indicizzazione CAS & Registro Ufficiale ({filteredCasEntries.length})</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-teal-500/20 text-teal-200 border border-teal-500/30">
            Modulo 10
          </span>
        </button>
      </div>

      {/* CAS Registry Dedicated View */}
      {subView === 'cas-index' && (
        <div className="space-y-6">
          {/* CAS Checksum Validation Sandbox */}
          <div className="bg-slate-900/90 border border-teal-500/40 p-5 rounded-2xl shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-300 flex items-center justify-center">
                  <Fingerprint className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">
                    Verificatore & Validatore Ufficiale Checksum CAS (Modulo-10)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Inserisci o incolla qualsiasi numero CAS per calcolare la cifra di controllo ponderata (check digit).
                  </p>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 font-mono bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
                Formula: (Σ d_i × i) mod 10 = Check Digit
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <input
                  type="text"
                  value={casVerifierInput}
                  onChange={(e) => setCasVerifierInput(e.target.value)}
                  placeholder="Es. 103-90-2 (Paracetamolo), 134523-00-5 (Atorvastatina), 50-78-2 (Aspirina)..."
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-teal-300 font-mono focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex items-center space-x-2">
                {casVerificationResult ? (
                  <div
                    className={`flex-1 p-2.5 rounded-xl border flex items-center space-x-2 text-xs ${
                      casVerificationResult.validation.isValid
                        ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200'
                        : 'bg-rose-950/40 border-rose-500/60 text-rose-200'
                    }`}
                  >
                    {casVerificationResult.validation.isValid ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <div className="truncate">
                      <span className="font-bold block">
                        {casVerificationResult.validation.isValid ? 'Checksum CAS Conforme' : 'Checksum Non Conforme'}
                      </span>
                      <span className="text-[10px] text-slate-400 block truncate">
                        {casVerificationResult.validation.reason}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 p-2.5 rounded-xl border border-slate-800 bg-slate-800/60 text-slate-400 text-xs flex items-center space-x-2">
                    <HelpCircle className="w-4 h-4 text-slate-500 shrink-0" />
                    <span>In attesa di numero CAS...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Matched compound in database banner */}
            {casVerificationResult?.matchedEntry && (
              <div className="bg-teal-950/40 border border-teal-500/60 p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                  <span className="text-slate-300">
                    Sostanza trovata nel repertorio: <strong className="text-white">{casVerificationResult.matchedEntry.name}</strong>{' '}
                    (PDE: <span className="text-teal-300 font-mono">{casVerificationResult.matchedEntry.pdeMgDay} mg/die</span>)
                  </span>
                </div>
                <button
                  onClick={() => {
                    const parent = compounds.find((c) => c.id === casVerificationResult.matchedEntry?.parentCompoundId);
                    if (parent) onSendToCalculator(parent);
                  }}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-semibold transition-colors shrink-0"
                >
                  <Calculator className="w-3.5 h-3.5" />
                  <span>Calcola MACO per questo CAS</span>
                </button>
              </div>
            )}
          </div>

          {/* Quick CAS Prefix Filters Bar */}
          <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 shadow-md space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold uppercase tracking-wider flex items-center space-x-1.5">
                <Fingerprint className="w-3.5 h-3.5 text-teal-400" />
                <span>Indicizzazione Rapida per Prefisso Numerico CAS</span>
              </span>
              <span>{filteredCasEntries.length} record visualizzati</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[
                { label: 'Tutti i CAS', value: 'All' },
                { label: '5x-xx-x', value: '5' },
                { label: '6x-xx-x', value: '6' },
                { label: '7x-xx-x', value: '7' },
                { label: '8x-xx-x', value: '8' },
                { label: '9x-xx-x', value: '9' },
                { label: '1xx-xx-x', value: '1' },
                { label: '2xx-xx-x', value: '2' },
                { label: '3xx-xx-x', value: '3' },
                { label: '4xx-xx-x', value: '4' },
                { label: '7xx-xx-x', value: '7' },
                { label: '8xx-xx-x', value: '8' },
                { label: '9xx-xx-x', value: '9' },
                { label: 'Codici INT-*', value: 'INT' },
              ].map((p) => (
                <button
                  key={p.label}
                  onClick={() => setCasPrefixFilter(p.value)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                    casPrefixFilter === p.value
                      ? 'bg-teal-500 text-slate-950 font-bold shadow-md shadow-teal-500/20'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700/60'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-2 pt-2 border-t border-slate-800 text-xs">
              <span className="text-slate-400">Filtra per tipologia:</span>
              <button
                onClick={() => setCasTypeFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-medium ${
                  casTypeFilter === 'all' ? 'bg-teal-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Tutti ({fullCasIndex.length})
              </button>
              <button
                onClick={() => setCasTypeFilter('api-only')}
                className={`px-2.5 py-1 rounded-lg font-medium ${
                  casTypeFilter === 'api-only' ? 'bg-teal-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Solo Principi Attivi (API)
              </button>
              <button
                onClick={() => setCasTypeFilter('intermediates-only')}
                className={`px-2.5 py-1 rounded-lg font-medium ${
                  casTypeFilter === 'intermediates-only' ? 'bg-teal-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Solo Intermedi di Sintesi
              </button>
            </div>
          </div>

          {/* CAS Registry Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-800/80 text-slate-400 uppercase font-semibold text-[11px] border-b border-slate-700/80">
                  <tr>
                    <th className="py-3 px-4">Numero CAS</th>
                    <th className="py-3 px-3">Checksum</th>
                    <th className="py-3 px-4">Nome Sostanza / Codice</th>
                    <th className="py-3 px-3">Tipologia</th>
                    <th className="py-3 px-3">Composto Madre (API)</th>
                    <th className="py-3 px-3">Fascia OEB</th>
                    <th className="py-3 px-3">PDE (mg/die)</th>
                    <th className="py-3 px-3">Produttori</th>
                    <th className="py-3 px-4 text-right">Azioni Rapide</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredCasEntries.map((entry, idx) => {
                    const parentCompound = compounds.find((c) => c.id === entry.parentCompoundId);

                    return (
                      <tr key={`${entry.casNumber}-${entry.name}-${idx}`} className="hover:bg-slate-800/50 transition-colors group">
                        <td className="py-3.5 px-4 font-mono font-bold text-teal-300 text-sm">
                          {entry.casNumber}
                        </td>
                        <td className="py-3.5 px-3">
                          {entry.isValidChecksum ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>Valido</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                              <span>Codice Int.</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-white group-hover:text-teal-300 transition-colors">
                            {entry.name}
                          </div>
                          {entry.intermediateCode && (
                            <div className="text-[10px] text-indigo-300 font-mono">
                              Codice Intermedio: {entry.intermediateCode}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-3">
                          {entry.isIntermediate ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-950/60 text-indigo-300 border border-indigo-800">
                              Intermedio: {entry.intermediateStage || 'Sintesi'}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-teal-950/60 text-teal-300 border border-teal-800">
                              Principio Attivo (API)
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-3">
                          {parentCompound ? (
                            <button
                              onClick={() => onSelectCompound(parentCompound)}
                              className="text-slate-300 hover:text-teal-300 underline font-medium text-left truncate max-w-[140px] block"
                              title={`Apri scheda dossier per ${entry.parentCompoundName}`}
                            >
                              {entry.parentCompoundName}
                            </button>
                          ) : (
                            <span>{entry.parentCompoundName}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              entry.oeb === 'OEB 5' || entry.oeb === 'OEB 4'
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                : entry.oeb === 'OEB 3'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            }`}
                          >
                            {entry.oeb}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 font-mono font-bold text-teal-400">
                          {entry.pdeMgDay}{' '}
                          <span className="text-[10px] font-normal text-slate-400">
                            ({Number((entry.pdeMgDay * 1000).toFixed(2))} µg)
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="text-[11px] text-slate-400 truncate max-w-[120px] block">
                            {entry.primaryManufacturers.slice(0, 2).join(', ')}
                            {entry.primaryManufacturers.length > 2 ? ` (+${entry.primaryManufacturers.length - 2})` : ''}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            {parentCompound && (
                              <button
                                onClick={() => onSendToCalculator(parentCompound)}
                                className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold transition-colors shadow-sm"
                                title="Carica nel Calcolatore MACO"
                              >
                                <Calculator className="w-3.5 h-3.5" />
                                <span>Usa in MACO</span>
                              </button>
                            )}
                            {parentCompound && (
                              <button
                                onClick={() => onSelectCompound(parentCompound)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                                title="Dossier Completo"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Catalog View (Standard Grid / Table) */}
      {subView === 'catalog' && (
        <div className="space-y-6">
          {/* Global Manufacturer Filter Bar with Segments & Profiles */}
          <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 shadow-md space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center space-x-2 font-semibold text-slate-300 uppercase tracking-wider">
                <Building2 className="w-4 h-4 text-teal-400" />
                <span>Repertorio Produttori & Network Globale (28 Produttori)</span>
              </div>
              <span className="text-[11px] text-slate-400">
                Filtra per segmento industriale o seleziona la singola azienda
              </span>
            </div>

            {/* Segment Selector Tabs */}
            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-800/80 text-xs">
              {[
                { label: 'Tutti i Segmenti (28)', value: 'All' },
                { label: 'Big Pharma & Chimica Fine (6)', value: 'Big Pharma & Chimica Fine Globale' },
                { label: 'Leader Indiani API & Export (7)', value: 'Leader Indiani API Complessi & Export' },
                { label: 'Giganti Chimica Fine & Intermedi (5)', value: 'Giganti Chimica Fine & Intermedi Custom' },
                { label: 'CDMO Pure-Play su Commissione (10)', value: 'CDMO Pure-Play & Sintesi su Commissione' },
              ].map((seg) => (
                <button
                  key={seg.label}
                  onClick={() => {
                    setSelectedSegment(seg.value);
                    if (seg.value !== 'All' && selectedManufacturer !== 'All') {
                      if (MANUFACTURER_PROFILES[selectedManufacturer as GlobalManufacturer]?.segment !== seg.value) {
                        setSelectedManufacturer('All');
                      }
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all text-xs ${
                    selectedSegment === seg.value
                      ? 'bg-teal-600 text-white font-bold shadow-md shadow-teal-600/20'
                      : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-750 border border-slate-750'
                  }`}
                >
                  {seg.label}
                </button>
              ))}
            </div>

            {/* Manufacturer Pills for Active Segment */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <button
                onClick={() => setSelectedManufacturer('All')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  selectedManufacturer === 'All'
                    ? 'bg-teal-500 text-slate-950 font-bold shadow-sm'
                    : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-700/60'
                }`}
              >
                Tutti i Produttori
              </button>
              {ALL_MANUFACTURERS.filter(
                (mfg) => selectedSegment === 'All' || MANUFACTURER_PROFILES[mfg]?.segment === selectedSegment
              ).map((mfg) => {
                const profile = MANUFACTURER_PROFILES[mfg];
                return (
                  <button
                    key={mfg}
                    onClick={() => setSelectedManufacturer(mfg)}
                    className={`px-2.5 py-1 rounded-lg text-xs transition-all flex items-center space-x-1 ${
                      selectedManufacturer === mfg
                        ? 'bg-teal-500 text-slate-950 font-bold shadow-md shadow-teal-500/20'
                        : 'bg-slate-800/90 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700/50'
                    }`}
                  >
                    <span>{mfg}</span>
                    {profile && (
                      <span className={`text-[10px] px-1 py-0.2 rounded font-mono ${
                        selectedManufacturer === mfg ? 'bg-slate-900/40 text-slate-900' : 'bg-slate-750 text-slate-400'
                      }`}>
                        {profile.country.split(' ')[0]}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Active Manufacturer Profile Description Card */}
            {selectedManufacturer !== 'All' && MANUFACTURER_PROFILES[selectedManufacturer as GlobalManufacturer] && (
              <div className="bg-slate-850 p-3.5 rounded-xl border border-teal-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs mt-2">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-white text-sm">{selectedManufacturer}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                      {MANUFACTURER_PROFILES[selectedManufacturer as GlobalManufacturer].country}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                      {MANUFACTURER_PROFILES[selectedManufacturer as GlobalManufacturer].segment}
                    </span>
                  </div>
                  <p className="text-slate-300 text-xs">
                    {MANUFACTURER_PROFILES[selectedManufacturer as GlobalManufacturer].description}
                  </p>
                </div>

                <button
                  onClick={() => setSelectedManufacturer('All')}
                  className="px-2.5 py-1 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-750 rounded-lg text-[11px] border border-slate-700 shrink-0 self-start sm:self-auto"
                >
                  Rimuovi Filtro Azienda
                </button>
              </div>
            )}
          </div>

          {/* Search & Secondary Filters */}
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-md">
            {/* Search Bar */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cerca per Nome API, CAS, formula, intermedio o sinonimo..."
                className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-teal-500 transition-colors"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
                >
                  Azzera
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-teal-500 cursor-pointer"
              >
                {ALL_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === 'All' ? 'Tutte le Categorie' : cat}
                  </option>
                ))}
              </select>

              <select
                value={selectedOeb}
                onChange={(e) => setSelectedOeb(e.target.value)}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-teal-500 cursor-pointer"
              >
                <option value="All">Tutte le Fasce OEB</option>
                <option value="OEB 1">OEB 1 (Basso Rischio)</option>
                <option value="OEB 2">OEB 2 (Standard)</option>
                <option value="OEB 3">OEB 3 (Attivo)</option>
                <option value="OEB 4">OEB 4 (Alta Potenza)</option>
                <option value="OEB 5">OEB 5 (Estrema Potenza / Citotossico)</option>
              </select>

              <div className="flex bg-slate-800 border border-slate-700 rounded-xl p-0.5">
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded-lg ${
                    viewMode === 'table' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Vista Tabellare"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg ${
                    viewMode === 'grid' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Vista Schede"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Main Content: Table or Grid */}
          {filteredCompounds.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
              <AlertOctagon className="w-12 h-12 text-slate-500 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-white">Nessun principio attivo trovato</h3>
              <p className="text-xs text-slate-400 mt-1">
                Modifica i filtri o il termine di ricerca per visualizzare i composti del database.
              </p>
            </div>
          ) : viewMode === 'table' ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-800/80 text-slate-400 uppercase font-semibold text-[11px] border-b border-slate-700/80">
                    <tr>
                      <th className="py-3 px-4">Principio Attivo (API)</th>
                      <th className="py-3 px-3">Numero CAS</th>
                      <th className="py-3 px-3">Categoria</th>
                      <th className="py-3 px-3">OEB</th>
                      <th className="py-3 px-3">PDE (mg/die)</th>
                      <th className="py-3 px-3">Dose Min (mg)</th>
                      <th className="py-3 px-3">Pulibilità</th>
                      <th className="py-3 px-3">Intermedi</th>
                      <th className="py-3 px-3">Produttori</th>
                      <th className="py-3 px-4 text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {filteredCompounds.map((compound) => (
                      <tr
                        key={compound.id}
                        className="hover:bg-slate-800/50 transition-colors group"
                      >
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-white group-hover:text-teal-300 transition-colors">
                            {compound.name}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono truncate max-w-[200px]">
                            {compound.chemicalName}
                          </div>
                        </td>
                        <td className="py-3.5 px-3 font-mono font-semibold text-teal-300">
                          {compound.casNumber}
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[11px] bg-slate-800 text-teal-300 border border-slate-700">
                            {compound.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              compound.oeb === 'OEB 5' || compound.oeb === 'OEB 4'
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                : compound.oeb === 'OEB 3'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            }`}
                          >
                            {compound.oeb}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 font-mono font-bold text-teal-400">
                          {compound.pdeMgDay} <span className="text-[10px] font-normal text-slate-400">mg</span>
                          <span className="text-[10px] text-slate-400 block font-normal">
                            ({compound.pdeUgDay} µg)
                          </span>
                        </td>
                        <td className="py-3.5 px-3 font-mono text-slate-200">
                          {compound.minDailyDoseMg} <span className="text-[10px] text-slate-400">mg</span>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="text-[11px] text-slate-300">
                            {compound.cleanability.split('(')[0].trim()}
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          {compound.intermediates.length > 0 ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-950/60 text-indigo-300 border border-indigo-800">
                              <Layers className="w-3 h-3 text-indigo-400" />
                              <span>{compound.intermediates.length}</span>
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px]">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="flex flex-wrap gap-1 max-w-[150px]">
                            {compound.primaryManufacturers.slice(0, 2).map((mfg) => (
                              <span
                                key={mfg}
                                className="px-1.5 py-0.2 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700"
                              >
                                {mfg}
                              </span>
                            ))}
                            {compound.primaryManufacturers.length > 2 && (
                              <span className="text-[10px] text-slate-400">
                                +{compound.primaryManufacturers.length - 2}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              onClick={() => onSelectCompound(compound)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                              title="Visualizza Dossier Tossicologico & Intermedi"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => onSendToCalculator(compound)}
                              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold transition-colors shadow-sm"
                              title="Carica questo composto nel calcolatore MACO"
                            >
                              <Calculator className="w-3.5 h-3.5" />
                              <span>Usa in MACO</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Grid View */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCompounds.map((compound) => (
                <div
                  key={compound.id}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 p-5 rounded-2xl shadow-lg transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-teal-300 border border-slate-700">
                        {compound.category}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                          compound.oeb === 'OEB 5' || compound.oeb === 'OEB 4'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            : compound.oeb === 'OEB 3'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        }`}
                      >
                        {compound.oeb}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-white hover:text-teal-300 transition-colors">
                      {compound.name}
                    </h3>
                    <p className="text-xs text-teal-300 font-mono mt-0.5">CAS: {compound.casNumber}</p>

                    <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-800 text-xs">
                      <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/60">
                        <span className="text-[11px] text-slate-400 block">Limite PDE / ADE</span>
                        <span className="text-sm font-bold text-teal-400 font-mono">
                          {compound.pdeMgDay} mg/d
                        </span>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          ({compound.pdeUgDay} µg/d)
                        </span>
                      </div>

                      <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/60">
                        <span className="text-[11px] text-slate-400 block">Dose Minima</span>
                        <span className="text-sm font-bold text-blue-300 font-mono">
                          {compound.minDailyDoseMg} mg/d
                        </span>
                        <span className="text-[10px] text-slate-400 block truncate">
                          {compound.solubilityInWater}
                        </span>
                      </div>
                    </div>

                    {compound.intermediates.length > 0 && (
                      <div className="mt-3 flex items-center space-x-1.5 text-xs text-indigo-300 bg-indigo-950/40 px-2.5 py-1.5 rounded-lg border border-indigo-900/50">
                        <Layers className="w-3.5 h-3.5" />
                        <span>{compound.intermediates.length} Intermedi sintetici documentati</span>
                      </div>
                    )}

                    <div className="mt-3">
                      <span className="text-[11px] text-slate-400 block mb-1">Produttori Globali:</span>
                      <div className="flex flex-wrap gap-1">
                        {compound.primaryManufacturers.map((mfg) => (
                          <span
                            key={mfg}
                            className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700"
                          >
                            {mfg}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                    <button
                      onClick={() => onSelectCompound(compound)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                    >
                      Dossier Completo
                    </button>
                    <button
                      onClick={() => onSendToCalculator(compound)}
                      className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold transition-colors shadow-sm"
                    >
                      <Calculator className="w-3.5 h-3.5" />
                      <span>Usa in MACO</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
