import React, { useState, useMemo, useEffect } from 'react';
import {
  PharmaceuticalCompound,
  CleanabilityRating,
  OEBLevel,
  MatrixProductItem,
} from '../types/apic';
import { calculateWorstCaseScore, calculateMACOByPDE, validateCasChecksum } from '../utils/apicCalculations';
import {
  Table as TableIcon,
  Plus,
  Trash2,
  Edit2,
  Search,
  Download,
  Printer,
  Sparkles,
  Layers,
  ArrowRight,
  Database,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ShieldAlert,
  Info,
  Scale,
  Calculator,
  Check,
  X,
  Copy,
} from 'lucide-react';

interface FacilityMatrixProps {
  compounds: PharmaceuticalCompound[]; // Database globale a supporto
  onSelectForCalculator: (compound: PharmaceuticalCompound) => void;
}

const MATRIX_STORAGE_KEY = 'apic_facility_matrix_v2';
const TRAIN_STORAGE_KEY = 'apic_facility_train_config_v2';

export const FacilityMatrix: React.FC<FacilityMatrixProps> = ({
  compounds,
  onSelectForCalculator,
}) => {
  // Train equipment parameters (persisted in localStorage)
  const [trainName, setTrainName] = useState<string>(() => {
    return localStorage.getItem(`${TRAIN_STORAGE_KEY}_name`) || 'Treno Polifunzionale Sintesi R-101 / R-104';
  });
  const [sharedSurfaceAreaM2, setSharedSurfaceAreaM2] = useState<number>(() => {
    const val = localStorage.getItem(`${TRAIN_STORAGE_KEY}_area`);
    return val ? parseFloat(val) : 25.0;
  });
  const [swabAreaCm2, setSwabAreaCm2] = useState<number>(25.0);
  const [swabRecoveryPercent, setSwabRecoveryPercent] = useState<number>(85.0);
  const [rinseVolumeLiters, setRinseVolumeLiters] = useState<number>(500.0);
  const [visualLimitUgCm2, setVisualLimitUgCm2] = useState<number>(4.0);

  // Products belonging to the QA specialist's matrix
  // INITIALIZES COMPLETELY EMPTY as requested by the QA specialist!
  const [matrixProducts, setMatrixProducts] = useState<MatrixProductItem[]>(() => {
    try {
      const saved = localStorage.getItem(MATRIX_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Could not read matrix from localStorage', e);
    }
    return []; // Starts EMPTY by default!
  });

  // Save to localStorage whenever matrix changes
  useEffect(() => {
    try {
      localStorage.setItem(MATRIX_STORAGE_KEY, JSON.stringify(matrixProducts));
      localStorage.setItem(`${TRAIN_STORAGE_KEY}_name`, trainName);
      localStorage.setItem(`${TRAIN_STORAGE_KEY}_area`, sharedSurfaceAreaM2.toString());
    } catch (e) {
      console.warn('Could not save matrix to localStorage', e);
    }
  }, [matrixProducts, trainName, sharedSurfaceAreaM2]);

  // Modal states
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [isDbImportModalOpen, setIsDbImportModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<MatrixProductItem | null>(null);

  // Form state for creating / editing a matrix product
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formCas, setFormCas] = useState('');
  const [formType, setFormType] = useState<MatrixProductItem['type']>('API');
  const [formStage, setFormStage] = useState('Active Pharmaceutical Ingredient');
  const [formPde, setFormPde] = useState<number>(0.1);
  const [formMinDose, setFormMinDose] = useState<number>(10);
  const [formMaxDose, setFormMaxDose] = useState<number>(50);
  const [formBatchSize, setFormBatchSize] = useState<number>(250);
  const [formCleanability, setFormCleanability] = useState<CleanabilityRating>('Moderate (Detergent/CIP)');
  const [formSolubility, setFormSolubility] = useState<MatrixProductItem['solubilityInWater']>('Slightly Soluble');
  const [formOeb, setFormOeb] = useState<OEBLevel>('OEB 3');
  const [formToxClass, setFormToxClass] = useState('Non-potent');
  const [formNotes, setFormNotes] = useState('');

  // Support DB search state inside import modal
  const [dbSearchTerm, setDbSearchTerm] = useState('');

  // Toast / feedback state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Open modal to add fresh product
  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setFormName('');
    setFormCode(`PRD-${String(matrixProducts.length + 1).padStart(2, '0')}`);
    setFormCas('');
    setFormType('API');
    setFormStage('Principio Attivo (API)');
    setFormPde(0.1);
    setFormMinDose(10);
    setFormMaxDose(50);
    setFormBatchSize(250);
    setFormCleanability('Moderate (Detergent/CIP)');
    setFormSolubility('Slightly Soluble');
    setFormOeb('OEB 3');
    setFormToxClass('Non-potent');
    setFormNotes('');
    setIsAddEditModalOpen(true);
  };

  // Open modal to edit existing product
  const handleOpenEditModal = (prod: MatrixProductItem) => {
    setEditingProduct(prod);
    setFormName(prod.name);
    setFormCode(prod.code || '');
    setFormCas(prod.casNumber);
    setFormType(prod.type);
    setFormStage(prod.stage || '');
    setFormPde(prod.pdeMgDay);
    setFormMinDose(prod.minDailyDoseMg);
    setFormMaxDose(prod.maxDailyDoseMg);
    setFormBatchSize(prod.minBatchSizeKg);
    setFormCleanability(prod.cleanability);
    setFormSolubility(prod.solubilityInWater);
    setFormOeb(prod.oeb);
    setFormToxClass(prod.toxicologicalClass);
    setFormNotes(prod.notes || '');
    setIsAddEditModalOpen(true);
  };

  // Save product from form
  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert('Inserire il nome del prodotto');
      return;
    }

    const newItem: MatrixProductItem = {
      id: editingProduct ? editingProduct.id : `prod-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: formName.trim(),
      code: formCode.trim() || undefined,
      casNumber: formCas.trim() || 'N/A',
      type: formType,
      stage: formStage,
      pdeMgDay: Number(formPde) > 0 ? Number(formPde) : 0.01,
      minDailyDoseMg: Number(formMinDose) > 0 ? Number(formMinDose) : 1,
      maxDailyDoseMg: Number(formMaxDose) > 0 ? Number(formMaxDose) : 1,
      minBatchSizeKg: Number(formBatchSize) > 0 ? Number(formBatchSize) : 1,
      cleanability: formCleanability,
      solubilityInWater: formSolubility,
      oeb: formOeb,
      toxicologicalClass: formToxClass,
      notes: formNotes.trim() || undefined,
      isFromDatabase: editingProduct?.isFromDatabase ?? false,
    };

    if (editingProduct) {
      setMatrixProducts((prev) => prev.map((p) => (p.id === editingProduct.id ? newItem : p)));
      showToast(`Prodotto "${newItem.name}" aggiornato nella matrice`);
    } else {
      setMatrixProducts((prev) => [...prev, newItem]);
      showToast(`Prodotto "${newItem.name}" aggiunto alla matrice`);
    }

    setIsAddEditModalOpen(false);
  };

  // Delete product from matrix
  const handleDeleteProduct = (id: string, name: string) => {
    if (confirm(`Rimuovere il prodotto "${name}" dalla matrice dell'impianto?`)) {
      setMatrixProducts((prev) => prev.filter((p) => p.id !== id));
      showToast(`Prodotto rimosso dalla matrice`);
    }
  };

  // Clear entire matrix
  const handleClearMatrix = () => {
    if (confirm('Sei sicuro di voler svuotare completamente la matrice dell\'impianto?')) {
      setMatrixProducts([]);
      showToast('Matrice impianto azzerata');
    }
  };

  // Import from support database
  const handleImportFromDatabase = (compound: PharmaceuticalCompound, intermediate?: any) => {
    const isInter = !!intermediate;
    const effectivePde = isInter
      ? intermediate.pdeValueMg ?? Number((compound.pdeMgDay * (intermediate.pdeRatioToApi ?? 1.0)).toFixed(4))
      : compound.pdeMgDay;

    const newItem: MatrixProductItem = {
      id: `imported-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: isInter ? `${compound.name} → Intermedio: ${intermediate.code}` : compound.name,
      code: isInter ? intermediate.code : compound.casNumber,
      casNumber: isInter ? intermediate.casNumber || 'N/A' : compound.casNumber,
      type: isInter ? 'Intermediate' : 'API',
      stage: isInter ? intermediate.stage : 'Principio Attivo (API)',
      pdeMgDay: effectivePde,
      minDailyDoseMg: compound.minDailyDoseMg,
      maxDailyDoseMg: compound.maxDailyDoseMg,
      minBatchSizeKg: 250, // default batch size for facility
      cleanability: isInter ? intermediate.cleanability : compound.cleanability,
      solubilityInWater: compound.solubilityInWater,
      oeb: compound.oeb,
      toxicologicalClass: compound.toxicologicalClass,
      notes: `Importato dal Database Globale di Supporto (Fonte: ${compound.monographReference || 'APIC/EMA'})`,
      isFromDatabase: true,
    };

    setMatrixProducts((prev) => [...prev, newItem]);
    setIsDbImportModalOpen(false);
    showToast(`Dati di "${newItem.name}" importati nella matrice`);
  };

  // Load illustrative synthesis train demo (only when explicitly requested by user)
  const handleLoadSampleDemo = () => {
    const demoItems: MatrixProductItem[] = [
      {
        id: 'demo-atorva',
        name: 'Atorvastatina Sale di Calcio',
        code: 'API-ATV-01',
        casNumber: '344423-98-9',
        type: 'API',
        stage: 'Principio Attivo (API)',
        pdeMgDay: 0.15,
        minDailyDoseMg: 10,
        maxDailyDoseMg: 80,
        minBatchSizeKg: 150,
        cleanability: 'Moderate (Detergent/CIP)',
        solubilityInWater: 'Very Slightly Soluble',
        oeb: 'OEB 3',
        toxicologicalClass: 'Non-potent',
      },
      {
        id: 'demo-ats4',
        name: 'Intermedio Sintetico ATS-4 Acetonide',
        code: 'INT-ATS4-02',
        casNumber: '125971-94-0',
        type: 'Intermediate',
        stage: 'Penultimate Intermediate',
        pdeMgDay: 0.15,
        minDailyDoseMg: 10,
        maxDailyDoseMg: 80,
        minBatchSizeKg: 100,
        cleanability: 'Moderate (Detergent/CIP)',
        solubilityInWater: 'Practically Insoluble',
        oeb: 'OEB 3',
        toxicologicalClass: 'Non-potent',
      },
      {
        id: 'demo-omeprazole',
        name: 'Omeprazolo Base / Gastroprotettore',
        code: 'API-OMP-03',
        casNumber: '73590-58-6',
        type: 'API',
        stage: 'Principio Attivo (API)',
        pdeMgDay: 0.2,
        minDailyDoseMg: 10,
        maxDailyDoseMg: 40,
        minBatchSizeKg: 300,
        cleanability: 'Difficult (Hot Alkaline/Acid)',
        solubilityInWater: 'Very Slightly Soluble',
        oeb: 'OEB 2',
        toxicologicalClass: 'Non-potent',
      },
      {
        id: 'demo-paracetamol',
        name: 'Paracetamolo Fine Sintesi',
        code: 'API-PCT-04',
        casNumber: '103-90-2',
        type: 'API',
        stage: 'Principio Attivo (API)',
        pdeMgDay: 3.5,
        minDailyDoseMg: 500,
        maxDailyDoseMg: 4000,
        minBatchSizeKg: 500,
        cleanability: 'Easy (Water/Mild)',
        solubilityInWater: 'Sparingly Soluble',
        oeb: 'OEB 1',
        toxicologicalClass: 'Non-potent',
      },
    ];

    setMatrixProducts(demoItems);
    showToast('Caricato esempio linea sintesi polifunzionale');
  };

  // Calculate Worst-Case Ranking among matrix products
  const rankedItems = useMemo(() => {
    if (matrixProducts.length === 0) return [];
    const scored = matrixProducts.map((p) => {
      // Create a temporary compound object for worst case scoring
      const pseudoCompound: PharmaceuticalCompound = {
        id: p.id,
        name: p.name,
        chemicalName: p.name,
        casNumber: p.casNumber,
        molecularFormula: '',
        molecularWeight: 300,
        category: 'Cardiovascular',
        primaryManufacturers: ['Teva'],
        oeb: p.oeb,
        pdeMgDay: p.pdeMgDay,
        pdeUgDay: p.pdeMgDay * 1000,
        minDailyDoseMg: p.minDailyDoseMg,
        maxDailyDoseMg: p.maxDailyDoseMg,
        routeOfAdministration: 'Oral',
        solubilityInWater: p.solubilityInWater,
        cleanability: p.cleanability,
        toxicologicalClass: p.toxicologicalClass as any,
        recommendedAnalyticalMethod: 'HPLC-UV',
        defaultSwabRecoveryPercent: 85,
        suggestedCipCleaningAgent: '0.2M NaOH',
        intermediates: [],
      };
      const evaluation = calculateWorstCaseScore(pseudoCompound);
      return {
        product: p,
        score: evaluation.score,
        reason: evaluation.rankReason,
      };
    });

    return scored.sort((a, b) => b.score - a.score);
  }, [matrixProducts]);

  const worstCaseCandidate = rankedItems[0] || null;

  // Calculate 2D Cross-Contamination Matrix (Incastro A -> B)
  const crossMatrix: {
    rows: {
      productA: MatrixProductItem;
      cells: { isSelf: boolean; macoMg: number; swabUg: number; rinsePpm: number }[];
    }[];
    minMaco: number;
    worstPair: { a: MatrixProductItem; b: MatrixProductItem } | null;
  } | null = useMemo(() => {
    if (matrixProducts.length < 2) return null;

    let minMaco = Infinity;
    let worstPair: { a: MatrixProductItem; b: MatrixProductItem } | null = null;

    const rows = matrixProducts.map((prodA) => {
      const cells = matrixProducts.map((prodB) => {
        if (prodA.id === prodB.id) {
          return {
            isSelf: true,
            macoMg: 0,
            swabUg: 0,
            rinsePpm: 0,
          };
        }

        // MACO = (PDE_A * MBS_B * 1,000,000) / MDD_B
        const macoMg = calculateMACOByPDE(prodA.pdeMgDay, prodB.minBatchSizeKg, prodB.maxDailyDoseMg);

        // Surface Limit [µg/cm²] = (MACO mg * 1000) / (Area m² * 10000 cm²/m²)
        const surfaceUgCm2 = sharedSurfaceAreaM2 > 0 ? (macoMg * 1000) / (sharedSurfaceAreaM2 * 10000) : 0;
        const swabUg = Number((surfaceUgCm2 * swabAreaCm2 * (swabRecoveryPercent / 100)).toFixed(3));
        const rinsePpm = rinseVolumeLiters > 0 ? Number((macoMg / rinseVolumeLiters).toFixed(2)) : 0;

        if (macoMg < minMaco) {
          minMaco = macoMg;
          worstPair = { a: prodA, b: prodB };
        }

        return {
          isSelf: false,
          macoMg,
          swabUg,
          rinsePpm,
        };
      });

      return {
        productA: prodA,
        cells,
      };
    });

    return {
      rows,
      minMaco,
      worstPair,
    };
  }, [matrixProducts, sharedSurfaceAreaM2, swabAreaCm2, swabRecoveryPercent, rinseVolumeLiters]);

  // Send cross pair into ApicCalculator
  const handleSendPairToCalculator = (prodA: MatrixProductItem, prodB: MatrixProductItem) => {
    const pseudoA: PharmaceuticalCompound = {
      id: prodA.id,
      name: prodA.name,
      chemicalName: prodA.name,
      casNumber: prodA.casNumber,
      molecularFormula: '',
      molecularWeight: 300,
      category: 'Cardiovascular',
      primaryManufacturers: ['Teva'],
      oeb: prodA.oeb,
      pdeMgDay: prodA.pdeMgDay,
      pdeUgDay: prodA.pdeMgDay * 1000,
      minDailyDoseMg: prodA.minDailyDoseMg,
      maxDailyDoseMg: prodA.maxDailyDoseMg,
      routeOfAdministration: 'Oral',
      solubilityInWater: prodA.solubilityInWater,
      cleanability: prodA.cleanability,
      toxicologicalClass: prodA.toxicologicalClass as any,
      recommendedAnalyticalMethod: 'HPLC-UV',
      defaultSwabRecoveryPercent: swabRecoveryPercent,
      suggestedCipCleaningAgent: '0.2M NaOH',
      intermediates: [],
    };

    onSelectForCalculator(pseudoA);
  };

  // Export Matrix to CSV
  const handleExportMatrixCsv = () => {
    if (matrixProducts.length === 0) return;

    let csv = `MATRICE IMPIANTO CLEANING VALIDATION - ${trainName}\n`;
    csv += `Superficie Condivisa: ${sharedSurfaceAreaM2} m2; Dima Swab: ${swabAreaCm2} cm2; Recupero: ${swabRecoveryPercent}%\n\n`;

    csv += `1. ELENCO PRODOTTI DELLA LINEA\n`;
    csv += `Nome,Codice,CAS,Tipo,PDE (mg/die),Min Dose A (mg),Max Dose B (mg),Min Batch Size B (kg),Pulibilita,Solubilita,OEB\n`;
    matrixProducts.forEach((p) => {
      csv += `"${p.name}","${p.code || ''}","${p.casNumber}","${p.type}",${p.pdeMgDay},${p.minDailyDoseMg},${p.maxDailyDoseMg},${p.minBatchSizeKg},"${p.cleanability}","${p.solubilityInWater}","${p.oeb}"\n`;
    });

    if (crossMatrix) {
      csv += `\n2. MATRICE DI INCASTRO MACO [mg] (Righe = Precedente A -> Colonne = Successivo B)\n`;
      csv += `Precedente A / Successivo B,` + matrixProducts.map((p) => `"${p.name}"`).join(',') + '\n';
      crossMatrix.rows.forEach((row, i) => {
        csv += `"${row.productA.name}",` + row.cells.map((c) => (c.isSelf ? 'STESSO PRODOTTO' : c.macoMg)).join(',') + '\n';
      });
    }

    const encodedUri = encodeURI('data:text/csv;charset=utf-8,' + csv);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Matrice_Impianto_${trainName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Matrice esportata in formato CSV');
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

      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
              Guida APIC • Sezione 7 (Matrixing & Grouping Approach)
            </span>
            <span className="text-xs text-slate-400">Ambiente di Lavoro QA Specialist</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight mt-1">
            Costruttore Matrice Impianto & Incastro Prodotti (Cross-Contamination)
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl">
            Crea da zero la matrice per il tuo treno polivalente inserendo i tuoi <strong>principi attivi (API)</strong> e
            <strong> intermedi di sintesi</strong>. Il Database Globale ADE/PDE è a disposizione come supporto per recuperare dati tossicologici.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <button
            onClick={handleOpenAddModal}
            className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-colors shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>Aggiungi Prodotto / Intermedio</span>
          </button>

          <button
            onClick={() => setIsDbImportModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/40 text-xs font-semibold transition-colors shadow-sm"
            title="Recupera valori da molecole o intermedi del database globale precaricato"
          >
            <Database className="w-4 h-4 text-teal-400" />
            <span>Recupera da DB di Supporto</span>
          </button>

          {matrixProducts.length > 0 && (
            <button
              onClick={handleExportMatrixCsv}
              className="flex items-center space-x-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors"
              title="Esporta matrice in formato CSV"
            >
              <Download className="w-4 h-4 text-teal-400" />
              <span className="hidden sm:inline">Esporta CSV</span>
            </button>
          )}

          {matrixProducts.length > 0 && (
            <button
              onClick={handleClearMatrix}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-700/50 transition-colors"
              title="Svuota completamente la matrice"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Equipment Train Parameters Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-md space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <span className="font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
            <Scale className="w-4 h-4 text-purple-400" />
            <span>Parametri Operativi del Treno d&apos;Impianto Condiviso:</span>
          </span>
          <span className="text-slate-400 text-[11px]">
            Modifica i parametri geometrici e di campionamento applicati alla matrice
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Nome Treno / Linea:</label>
            <input
              type="text"
              value={trainName}
              onChange={(e) => setTrainName(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-purple-500 font-medium"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Superficie Condivisa (m²):</label>
            <input
              type="number"
              min="0.1"
              step="any"
              value={sharedSurfaceAreaM2}
              onChange={(e) => setSharedSurfaceAreaM2(parseFloat(e.target.value) || 1)}
              className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Dima Swab (cm²):</label>
            <input
              type="number"
              min="1"
              step="any"
              value={swabAreaCm2}
              onChange={(e) => setSwabAreaCm2(parseFloat(e.target.value) || 25)}
              className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Recupero Swab (%):</label>
            <input
              type="number"
              min="10"
              max="100"
              step="any"
              value={swabRecoveryPercent}
              onChange={(e) => setSwabRecoveryPercent(parseFloat(e.target.value) || 85)}
              className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Volume Risciacquo (L):</label>
            <input
              type="number"
              min="10"
              step="any"
              value={rinseVolumeLiters}
              onChange={(e) => setRinseVolumeLiters(parseFloat(e.target.value) || 500)}
              className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>
      </div>

      {/* EMPTY STATE: Shown when QA specialist hasn't added products yet */}
      {matrixProducts.length === 0 ? (
        <div className="bg-slate-900 border-2 border-dashed border-slate-800 rounded-2xl p-10 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/80 text-teal-400 border border-slate-700 mx-auto flex items-center justify-center shadow-lg">
            <TableIcon className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto">
            <h2 className="text-lg font-bold text-white tracking-tight">La Matrice dell&apos;Impianto è Vuota</h2>
            <p className="text-xs text-slate-400 mt-1.5">
              Il QA Specialist deve costruire la propria matrice con i prodotti e intermedi della propria linea produttiva.
              Aggiungi il tuo primo prodotto da zero oppure importalo come supporto dal database.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={handleOpenAddModal}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-colors shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Aggiungi Tuo Prodotto / Intermedio</span>
            </button>

            <button
              onClick={() => setIsDbImportModalOpen(true)}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/40 text-xs font-semibold transition-colors shadow-sm"
            >
              <Database className="w-4 h-4 text-teal-400" />
              <span>Recupera Dati dal Database Globale</span>
            </button>

            <button
              onClick={handleLoadSampleDemo}
              className="flex items-center space-x-2 px-3.5 py-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-300 border border-slate-800 text-xs transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Carica Esempio Linea Sintesi (Demo)</span>
            </button>
          </div>
        </div>
      ) : (
        /* MATRIX POPULATED VIEW */
        <div className="space-y-6">
          {/* Section 1: Facility Products Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden space-y-4 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <span className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-300 flex items-center justify-center font-bold text-xs">
                  {matrixProducts.length}
                </span>
                <h2 className="text-base font-bold text-white tracking-tight">
                  Prodotti ed Intermedi Assegnati alla Linea ({matrixProducts.length})
                </h2>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleOpenAddModal}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nuovo</span>
                </button>
                <button
                  onClick={() => setIsDbImportModalOpen(true)}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/40 text-xs font-semibold transition-colors"
                >
                  <Database className="w-3.5 h-3.5 text-teal-400" />
                  <span>Importa da DB</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-800/80 text-slate-400 uppercase font-semibold text-[11px] border-b border-slate-700/80">
                  <tr>
                    <th className="py-2.5 px-3">Prodotto / Codice</th>
                    <th className="py-2.5 px-3">Tipologia</th>
                    <th className="py-2.5 px-3">CAS</th>
                    <th className="py-2.5 px-3">PDE (mg/die)</th>
                    <th className="py-2.5 px-3">Min Dose A (mg)</th>
                    <th className="py-2.5 px-3">Max Dose B (mg)</th>
                    <th className="py-2.5 px-3">MBS B (kg)</th>
                    <th className="py-2.5 px-3">Pulibilità</th>
                    <th className="py-2.5 px-3">OEB</th>
                    <th className="py-2.5 px-3 text-right">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {matrixProducts.map((prod) => (
                    <tr key={prod.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-bold text-white">{prod.name}</div>
                        {prod.code && <div className="text-[10px] text-slate-400 font-mono">{prod.code}</div>}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            prod.type === 'Intermediate'
                              ? 'bg-indigo-950/60 text-indigo-300 border border-indigo-800'
                              : 'bg-teal-950/60 text-teal-300 border border-teal-800'
                          }`}
                        >
                          {prod.type === 'Intermediate' ? `Intermedio (${prod.stage || 'Sintesi'})` : 'API'}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-teal-300 font-semibold">{prod.casNumber}</td>
                      <td className="py-3 px-3 font-mono font-bold text-teal-400">
                        {prod.pdeMgDay} <span className="text-[10px] font-normal text-slate-400">mg</span>
                      </td>
                      <td className="py-3 px-3 font-mono">{prod.minDailyDoseMg} mg</td>
                      <td className="py-3 px-3 font-mono">{prod.maxDailyDoseMg} mg</td>
                      <td className="py-3 px-3 font-mono font-semibold text-blue-300">{prod.minBatchSizeKg} kg</td>
                      <td className="py-3 px-3">
                        <span className="text-[11px] text-slate-300">{prod.cleanability.split('(')[0].trim()}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-amber-300 border border-slate-700">
                          {prod.oeb}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => handleOpenEditModal(prod)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                            title="Modifica parametri di questo prodotto"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(prod.id, prod.name)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 transition-colors"
                            title="Rimuovi dalla matrice"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: APIC Worst-Case Cleaning Marker Ranking */}
          {worstCaseCandidate && (
            <div className="bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-900 border border-purple-500/50 p-6 rounded-2xl shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-purple-300 uppercase tracking-wider block">
                      Valutazione Convalida a Raggruppamento (Grouping Approach - APIC Sez. 7)
                    </span>
                    <h3 className="text-lg font-black text-white tracking-tight mt-0.5">
                      Cleaning Validation Marker Identificato: {worstCaseCandidate.product.name}
                    </h3>
                  </div>
                </div>

                <div className="px-3.5 py-1.5 rounded-xl bg-purple-900/40 text-purple-200 border border-purple-600/50 font-mono text-xs font-bold self-start sm:self-auto">
                  Punteggio Rischio: {worstCaseCandidate.score}/100
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Tipo Sostanza</span>
                  <span className="font-bold text-white">{worstCaseCandidate.product.type}</span>
                  <span className="text-[10px] text-slate-400 block font-mono">CAS: {worstCaseCandidate.product.casNumber}</span>
                </div>
                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Limite Tossicologico PDE</span>
                  <span className="font-bold text-teal-400 font-mono">{worstCaseCandidate.product.pdeMgDay} mg/die</span>
                  <span className="text-[10px] text-slate-400 block font-mono">({worstCaseCandidate.product.pdeMgDay * 1000} µg)</span>
                </div>
                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Pulibilità & Solubilità</span>
                  <span className="font-bold text-amber-300">{worstCaseCandidate.product.cleanability.split('(')[0]}</span>
                  <span className="text-[10px] text-slate-400 block truncate">{worstCaseCandidate.product.solubilityInWater}</span>
                </div>
                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Giustificazione Regolatoria</span>
                  <p className="text-[11px] text-slate-300 mt-0.5 line-clamp-2">{worstCaseCandidate.reason}</p>
                </div>
              </div>
            </div>
          )}

          {/* Section 3: 2D Product Cross-Contamination Matrix (Incastro A -> B) */}
          {crossMatrix && matrixProducts.length >= 2 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      Matrice Bidimensionale Cross-Contamination
                    </span>
                    <span className="text-xs text-slate-400">Incastro Prodotto Precedente (A) → Successivo (B)</span>
                  </div>
                  <h2 className="text-lg font-bold text-white mt-1">
                    Griglia di Compatibilità & Limiti MACO per Ciascuna Sequenza di Produzione
                  </h2>
                </div>

                {crossMatrix.worstPair && (
                  <div className="bg-rose-950/40 border border-rose-500/50 p-2.5 rounded-xl text-xs text-rose-200 flex items-center space-x-2">
                    <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                    <div>
                      <span className="font-bold block">Incastro Peggiore Assoluto:</span>
                      <span className="font-mono text-[11px]">
                        {crossMatrix.worstPair.a.name} → {crossMatrix.worstPair.b.name} (MACO: {crossMatrix.minMaco.toLocaleString('it-IT')} mg)
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* 2D Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-center text-xs text-slate-300 border-collapse">
                  <thead>
                    <tr className="bg-slate-800/90 text-[11px] text-slate-300 border-b border-slate-700">
                      <th className="p-3 text-left font-bold text-teal-300 min-w-[200px] border-r border-slate-700">
                        Precedente A ↓ / Successivo B →
                      </th>
                      {matrixProducts.map((p) => (
                        <th key={p.id} className="p-3 font-bold text-white min-w-[150px] border-r border-slate-700/60">
                          <div className="truncate">{p.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            MBS: {p.minBatchSizeKg} kg | MDD: {p.maxDailyDoseMg} mg
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {crossMatrix.rows.map((row) => (
                      <tr key={row.productA.id} className="hover:bg-slate-800/40 transition-colors">
                        {/* Row header: Product A */}
                        <td className="p-3 text-left bg-slate-850 border-r border-slate-700">
                          <div className="font-bold text-white">{row.productA.name}</div>
                          <div className="text-[10px] text-teal-300 font-mono">
                            PDE: {row.productA.pdeMgDay} mg/die | TDD: {row.productA.minDailyDoseMg} mg
                          </div>
                        </td>

                        {/* Cells: Transition A -> B */}
                        {row.cells.map((cell, colIdx) => {
                          const prodB = matrixProducts[colIdx];
                          const isWorst = !cell.isSelf && cell.macoMg === crossMatrix.minMaco;

                          if (cell.isSelf) {
                            return (
                              <td
                                key={colIdx}
                                className="p-3 bg-slate-900/60 text-slate-500 font-mono text-[11px] border-r border-slate-800"
                              >
                                Stesso Prodotto
                                <span className="block text-[9px] text-slate-600">(Campagna)</span>
                              </td>
                            );
                          }

                          return (
                            <td
                              key={colIdx}
                              className={`p-2.5 transition-all border-r border-slate-800 group relative ${
                                isWorst
                                  ? 'bg-rose-950/40 border-2 border-rose-500/80 shadow-md font-bold'
                                  : 'hover:bg-slate-800/60'
                              }`}
                            >
                              {isWorst && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-500 text-slate-950 block mb-1">
                                  WORST-CASE
                                </span>
                              )}
                              <div className="font-mono text-sm font-bold text-white">
                                {cell.macoMg.toLocaleString('it-IT')} <span className="text-[10px] text-slate-400 font-normal">mg</span>
                              </div>
                              <div className="text-[10px] text-teal-300 font-mono mt-0.5">
                                Swab: <strong>{cell.swabUg} µg</strong>
                              </div>
                              <div className="text-[10px] text-purple-300 font-mono">
                                Rinse: {cell.rinsePpm} ppm
                              </div>

                              <button
                                onClick={() => handleSendPairToCalculator(row.productA, prodB)}
                                className="mt-1.5 opacity-0 group-hover:opacity-100 px-2 py-0.5 rounded bg-teal-600 hover:bg-teal-500 text-white text-[10px] font-semibold transition-all inline-flex items-center space-x-1"
                                title="Verifica dettagli in Calcolatore MACO"
                              >
                                <span>Calcola</span>
                                <ArrowRight className="w-2.5 h-2.5" />
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 text-center text-xs text-slate-400">
              <Info className="w-6 h-6 text-teal-400 mx-auto mb-2" />
              <span>Aggiungi almeno 2 prodotti alla linea per visualizzare la matrice d&apos;incastro cross-carryover bidimensionale.</span>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: Add / Edit Product in Matrix */}
      {isAddEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl text-slate-100 overflow-hidden my-8">
            <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-850">
              <h3 className="text-base font-bold text-white">
                {editingProduct ? 'Modifica Prodotto nella Matrice' : 'Aggiungi Nuovo Prodotto / Intermedio da Zero'}
              </h3>
              <button
                onClick={() => setIsAddEditModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-300 block mb-1">Nome Prodotto / Intermedio *:</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Es. Atorvastatina Compresse 20mg"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-teal-500 font-medium"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 block mb-1">Codice Interno Stabilimento:</label>
                  <input
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder="Es. PRD-ATV-01"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-300 block mb-1">Tipologia Sostanza:</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-teal-500"
                  >
                    <option value="API">Principio Attivo (API)</option>
                    <option value="Intermediate">Intermedio di Sintesi</option>
                    <option value="Finished Product">Prodotto Finito Formulato</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-300 block mb-1">Stadio / Dettaglio:</label>
                  <input
                    type="text"
                    value={formStage}
                    onChange={(e) => setFormStage(e.target.value)}
                    placeholder="Es. Penultimate Intermediate"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 block mb-1">Numero CAS:</label>
                  <input
                    type="text"
                    value={formCas}
                    onChange={(e) => setFormCas(e.target.value)}
                    placeholder="Es. 103-90-2"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-teal-300 font-mono focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              {/* Toxicological & Dosing Parameters */}
              <div className="bg-slate-850 p-4 rounded-xl border border-slate-750 space-y-3">
                <span className="text-xs font-bold text-teal-400 uppercase tracking-wider block">
                  Parametri Tossicologici & Posologici
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-300 block mb-1">PDE / ADE (mg/die) *:</label>
                    <input
                      type="number"
                      required
                      min="0.0001"
                      step="any"
                      value={formPde}
                      onChange={(e) => setFormPde(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-teal-300 font-mono focus:outline-none focus:border-teal-500 font-bold"
                    />
                    <span className="text-[10px] text-slate-500 block mt-0.5">({formPde * 1000} µg/die)</span>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-300 block mb-1">Dose Minima A (mg) *:</label>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="any"
                      value={formMinDose}
                      onChange={(e) => setFormMinDose(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-teal-500"
                    />
                    <span className="text-[10px] text-slate-500 block mt-0.5">TDD (come contaminante)</span>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-300 block mb-1">Dose Max B (mg) *:</label>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="any"
                      value={formMaxDose}
                      onChange={(e) => setFormMaxDose(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-teal-500"
                    />
                    <span className="text-[10px] text-slate-500 block mt-0.5">MDD (come ricevente)</span>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-300 block mb-1">Min Batch Size B (kg) *:</label>
                    <input
                      type="number"
                      required
                      min="0.1"
                      step="any"
                      value={formBatchSize}
                      onChange={(e) => setFormBatchSize(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-blue-300 font-mono focus:outline-none focus:border-teal-500 font-bold"
                    />
                    <span className="text-[10px] text-slate-500 block mt-0.5">MBS lotto minimo B</span>
                  </div>
                </div>
              </div>

              {/* Physical & Chemical properties */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-300 block mb-1">Pulibilità (Cleanability):</label>
                  <select
                    value={formCleanability}
                    onChange={(e) => setFormCleanability(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-teal-500"
                  >
                    <option value="Easy (Water/Mild)">Facile (Acqua / Detergente blando)</option>
                    <option value="Moderate (Detergent/CIP)">Moderata (CIP standard alcalino)</option>
                    <option value="Difficult (Hot Alkaline/Acid)">Difficile (Alcalino caldo / Acido)</option>
                    <option value="Very Difficult (Solvent Reflux/Boil-out)">Molto Difficile (Riflusso solvente)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-300 block mb-1">Solubilità in Acqua:</label>
                  <select
                    value={formSolubility}
                    onChange={(e) => setFormSolubility(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-teal-500"
                  >
                    <option value="Freely Soluble">Molto Solubile (Freely Soluble)</option>
                    <option value="Soluble">Solubile</option>
                    <option value="Sparingly Soluble">Moderatamente Solubile</option>
                    <option value="Slightly Soluble">Poco Solubile (Slightly Soluble)</option>
                    <option value="Very Slightly Soluble">Molto Poco Solubile</option>
                    <option value="Practically Insoluble">Praticamente Insolubile</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-300 block mb-1">Fascia OEB & Pericolo:</label>
                  <select
                    value={formOeb}
                    onChange={(e) => setFormOeb(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-teal-500"
                  >
                    <option value="OEB 1">OEB 1 (Basso Rischio / &gt;100 µg/m³)</option>
                    <option value="OEB 2">OEB 2 (Standard / 10-100 µg/m³)</option>
                    <option value="OEB 3">OEB 3 (Attivo / 1-10 µg/m³)</option>
                    <option value="OEB 4">OEB 4 (Alta Potenza / 0.1-1 µg/m³)</option>
                    <option value="OEB 5">OEB 5 (Citotossico HPAPI / &lt;0.1 µg/m³)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Note Tecniche QA / Agente CIP Consigliato:</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Es. Trattamento con NaOH 0.5M a 65°C, tempo di contatto 45 minuti."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsAddEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-md"
                >
                  {editingProduct ? 'Salva Modifiche' : 'Inserisci nella Matrice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Import from Support Database */}
      {isDbImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl text-slate-100 overflow-hidden my-8">
            <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-850">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <Database className="w-4 h-4 text-teal-400" />
                  <span>Recupera Dati dal Database Globale di Supporto</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Cerca una molecola o intermedio per importarne i parametri tossicologici nella tua matrice.
                </p>
              </div>
              <button
                onClick={() => setIsDbImportModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={dbSearchTerm}
                  onChange={(e) => setDbSearchTerm(e.target.value)}
                  placeholder="Cerca per nome API, CAS (es. 103-90-2), intermedio o produttore..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="space-y-3">
                {compounds
                  .filter((c) => {
                    if (!dbSearchTerm.trim()) return true;
                    const q = dbSearchTerm.toLowerCase();
                    return (
                      c.name.toLowerCase().includes(q) ||
                      c.casNumber.toLowerCase().includes(q) ||
                      c.intermediates.some((i) => i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q))
                    );
                  })
                  .slice(0, 20)
                  .map((comp) => (
                    <div
                      key={comp.id}
                      className="bg-slate-800/70 p-3.5 rounded-xl border border-slate-750 hover:border-slate-650 transition-all space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-bold text-white text-xs">{comp.name}</div>
                          <div className="text-[11px] text-teal-300 font-mono">
                            CAS: {comp.casNumber} | PDE: {comp.pdeMgDay} mg/die | {comp.category}
                          </div>
                        </div>

                        <button
                          onClick={() => handleImportFromDatabase(comp)}
                          className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shrink-0 transition-colors shadow-sm"
                        >
                          Importa API nella Matrice
                        </button>
                      </div>

                      {/* Intermediates if present */}
                      {comp.intermediates.length > 0 && (
                        <div className="pl-3 border-l-2 border-indigo-700/60 pt-1 space-y-1.5">
                          <span className="text-[10px] text-indigo-300 font-semibold block">
                            Intermedi sintetici disponibili per questa molecola:
                          </span>
                          {comp.intermediates.map((inter) => (
                            <div key={inter.id} className="flex items-center justify-between text-[11px] bg-slate-850 p-2 rounded-lg">
                              <div>
                                <span className="font-semibold text-white">{inter.name} ({inter.code})</span>
                                <span className="text-slate-400 block text-[10px] font-mono">
                                  Stadio: {inter.stage} | PDE: {inter.pdeValueMg ?? (comp.pdeMgDay * (inter.pdeRatioToApi ?? 1))} mg/die
                                </span>
                              </div>
                              <button
                                onClick={() => handleImportFromDatabase(comp, inter)}
                                className="px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-medium shrink-0 transition-colors"
                              >
                                Importa Intermedio
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
