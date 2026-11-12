import React, { useState, useMemo, useEffect } from 'react';
import {
  PharmaceuticalCompound,
  MatrixProductItem,
  FacilityMatrixTrain,
  CleaningClass,
  HardestToCleanCategory,
  SolubilityGroup,
  AdePdeGroup,
  DoseGroup,
} from '../types/apic';
import {
  validateCasChecksum,
  getAdePdeGroup,
  getTherapeuticDoseGroup,
  mapCleanabilityTextToCategory,
  mapSolubilityTextToGroup,
  evaluateAllMatrixCombinations,
} from '../utils/apicCalculations';
import {
  Table as TableIcon,
  Plus,
  Trash2,
  Edit2,
  Search,
  Download,
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
  ChevronRight,
  Settings,
  Printer,
  FileSpreadsheet,
  Share2,
} from 'lucide-react';
import { MatrixExportReportModal } from './MatrixExportReportModal';
import {
  downloadFile,
  generateMatrixCsv,
  generateMatrixExcelXml,
} from '../utils/matrixExport';

interface FacilityMatrixProps {
  compounds: PharmaceuticalCompound[]; // Database globale a supporto
  onSelectForCalculator?: (compound: PharmaceuticalCompound) => void;
}

const STORAGE_KEY_MATRICES = 'apic_facility_matrices_multi_v1';
const MAX_MATRICES = 10;

const DEFAULT_CLEANING_CLASSES: {
  classId: CleaningClass;
  title: string;
  description: string;
  defaultSolvent: string;
}[] = [
  {
    classId: 'Class I',
    title: 'Class I: Water soluble substances',
    description: 'Sostanze idrosolubili lavate prevalentemente con acqua PW/WFI o soluzioni acquose acide/alcaline.',
    defaultSolvent: 'Acqua Purificata (PW / WFI)',
  },
  {
    classId: 'Class II',
    title: 'Class II: Methanol soluble substances',
    description: 'Sostanze solubili in solventi alcolici / metanolo.',
    defaultSolvent: 'Metanolo tecnico / alcolico',
  },
  {
    classId: 'Class III',
    title: 'Class III: Acetone soluble substances',
    description: 'Sostanze solubili in chetoni / acetone.',
    defaultSolvent: 'Acetone puro / rigenerato',
  },
  {
    classId: 'Class IV',
    title: 'Class IV: Special class with defined solubility',
    description: 'Classe speciale per sostanze con profilo di solubilità dedicato / solventi specifici.',
    defaultSolvent: 'Solvente speciale dedicato (es. DMF, DMSO, EtOH)',
  },
];

export const FacilityMatrix: React.FC<FacilityMatrixProps> = ({
  compounds,
  onSelectForCalculator,
}) => {
  // 1. Multi-matrix state: Up to 10 matrices (stored in localStorage)
  const [matrices, setMatrices] = useState<FacilityMatrixTrain[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MATRICES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.slice(0, MAX_MATRICES);
        }
      }
    } catch (e) {
      console.warn('Could not read matrices from localStorage', e);
    }

    // Default: Initial Matrix 1 (STARTS COMPLETELY EMPTY OF PRODUCTS)
    const initialMatrix: FacilityMatrixTrain = {
      id: `matrix-1-${Date.now()}`,
      matrixIndex: 1,
      trainId: 'A-Train',
      name: 'Treno Sintesi Polivalente A-Train',
      cleaningClass: 'Class I',
      cleaningSolventNotes: 'Acqua purificata a 65°C / CIP alcalino',
      sharedSurfaceAreaM2: 25.0,
      swabAreaCm2: 25.0,
      swabRecoveryPercent: 85.0,
      rinseVolumeLiters: 500.0,
      visualLimitUgCm2: 4.0,
      products: [], // Starts EMPTY as requested by QA specialist!
    };
    return [initialMatrix];
  });

  // Active matrix index in view (0 to matrices.length - 1)
  const [activeMatrixIndex, setActiveMatrixIndex] = useState<number>(0);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_MATRICES, JSON.stringify(matrices));
    } catch (e) {
      console.warn('Failed to save matrices to localStorage', e);
    }
  }, [matrices]);

  // Current active matrix object
  const activeMatrix = matrices[activeMatrixIndex] || matrices[0];

  // Toast / feedback message
  const [toastInfo, setToastInfo] = useState<{ message: string; type: 'success' | 'warning' | 'info' } | null>(null);
  const showToast = (msg: string, type: 'success' | 'warning' | 'info' = 'success') => {
    setToastInfo({ message: msg, type });
    setTimeout(() => setToastInfo(null), 3500);
  };

  // Custom in-app Confirmation Dialog state (avoids iframe blocking of native confirm/alert)
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    type: 'delete-matrix' | 'delete-product' | 'clear-matrix';
    title: string;
    message: string;
    details?: string;
    confirmButtonText: string;
    matrixIndexToDelete?: number;
    productIdToDelete?: string;
    productNameToDelete?: string;
  }>({
    isOpen: false,
    type: 'delete-matrix',
    title: '',
    message: '',
    confirmButtonText: 'Elimina',
  });

  // Modal states
  const [isAddEditProductModalOpen, setIsAddEditProductModalOpen] = useState(false);
  const [isDbImportModalOpen, setIsDbImportModalOpen] = useState(false);
  const [isEditTrainModalOpen, setIsEditTrainModalOpen] = useState(false);
  const [isExportReportModalOpen, setIsExportReportModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<MatrixProductItem | null>(null);

  // Train Edit Form State
  const [trainFormTrainId, setTrainFormTrainId] = useState(activeMatrix.trainId);
  const [trainFormName, setTrainFormName] = useState(activeMatrix.name);
  const [trainFormClass, setTrainFormClass] = useState<CleaningClass>(activeMatrix.cleaningClass);
  const [trainFormSolvent, setTrainFormSolvent] = useState(activeMatrix.cleaningSolventNotes || '');
  const [trainFormArea, setTrainFormArea] = useState(activeMatrix.sharedSurfaceAreaM2);
  const [trainFormSwabArea, setTrainFormSwabArea] = useState(activeMatrix.swabAreaCm2);
  const [trainFormRecovery, setTrainFormRecovery] = useState(activeMatrix.swabRecoveryPercent);
  const [trainFormRinseVol, setTrainFormRinseVol] = useState(activeMatrix.rinseVolumeLiters);
  const [trainFormVisualLimit, setTrainFormVisualLimit] = useState(activeMatrix.visualLimitUgCm2);

  // Sync edit train form when active matrix changes
  useEffect(() => {
    if (activeMatrix) {
      setTrainFormTrainId(activeMatrix.trainId);
      setTrainFormName(activeMatrix.name);
      setTrainFormClass(activeMatrix.cleaningClass);
      setTrainFormSolvent(activeMatrix.cleaningSolventNotes || '');
      setTrainFormArea(activeMatrix.sharedSurfaceAreaM2);
      setTrainFormSwabArea(activeMatrix.swabAreaCm2);
      setTrainFormRecovery(activeMatrix.swabRecoveryPercent);
      setTrainFormRinseVol(activeMatrix.rinseVolumeLiters);
      setTrainFormVisualLimit(activeMatrix.visualLimitUgCm2);
    }
  }, [activeMatrixIndex, activeMatrix]);

  // Product Form State (with APIC criteria a, b, c, d)
  const [prodFormName, setProdFormName] = useState('');
  const [prodFormCode, setProdFormCode] = useState('');
  const [prodFormCas, setProdFormCas] = useState('');
  const [prodFormType, setProdFormType] = useState<MatrixProductItem['type']>('API');
  const [prodFormStage, setProdFormStage] = useState('Principio Attivo (API)');
  // Criterion a: Hardest to clean (1 Easy, 2 Medium, 3 Difficult)
  const [prodFormCleanCat, setProdFormCleanCat] = useState<HardestToCleanCategory>(2);
  const [prodFormCleanRationale, setProdFormCleanRationale] = useState('');
  // Criterion b: Solubility in used solvent (1, 2, 3)
  const [prodFormSolGroup, setProdFormSolGroup] = useState<SolubilityGroup>(2);
  const [prodFormSolDesc, setProdFormSolDesc] = useState('');
  // Criterion c: ADE / PDE in µg/day
  const [prodFormPdeUg, setProdFormPdeUg] = useState<number>(100);
  const [prodFormPdeGroup, setProdFormPdeGroup] = useState<AdePdeGroup>(2);
  // Criterion d: Smallest therapeutic dose (TDD in mg)
  const [prodFormMinDoseMg, setProdFormMinDoseMg] = useState<number>(10);
  const [prodFormDoseGroup, setProdFormDoseGroup] = useState<DoseGroup>(3);
  // Next product parameters: Max Daily Dose (MDD) & Min Batch Size (MBS)
  const [prodFormMaxDoseMg, setProdFormMaxDoseMg] = useState<number>(40);
  const [prodFormBatchSizeKg, setProdFormBatchSizeKg] = useState<number>(250);
  const [prodFormNotes, setProdFormNotes] = useState('');

  // Quick molecule search state inside the product compilation modal
  const [modalQuickSearch, setModalQuickSearch] = useState('');

  // Support DB search query inside import modal
  const [dbSearchTerm, setDbSearchTerm] = useState('');

  // Auto-update PDE group when µg value changes
  const handlePdeUgChange = (val: number) => {
    setProdFormPdeUg(val);
    setProdFormPdeGroup(getAdePdeGroup(val));
  };

  // Auto-update Dose group when mg value changes
  const handleMinDoseChange = (val: number) => {
    setProdFormMinDoseMg(val);
    setProdFormDoseGroup(getTherapeuticDoseGroup(val));
  };

  // CAS validation state in form
  const casValidation = useMemo(() => {
    if (!prodFormCas.trim()) return null;
    return validateCasChecksum(prodFormCas);
  }, [prodFormCas]);

  // Handler to add a new matrix (up to 10)
  const handleAddMatrix = () => {
    if (matrices.length >= MAX_MATRICES) {
      showToast(`Limite massimo raggiunto: è possibile gestire al massimo ${MAX_MATRICES} matrici impianto.`, 'warning');
      return;
    }

    const nextIdx = matrices.length + 1;
    const trainLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    const letter = trainLetters[matrices.length] || `Train-${nextIdx}`;
    const defaultClasses: CleaningClass[] = ['Class I', 'Class II', 'Class III', 'Class IV'];
    const chosenClass = defaultClasses[(nextIdx - 1) % defaultClasses.length];

    const newMatrix: FacilityMatrixTrain = {
      id: `matrix-${nextIdx}-${Date.now()}`,
      matrixIndex: nextIdx,
      trainId: `${letter}-Train`,
      name: `Treno ${letter}-Train (${chosenClass})`,
      cleaningClass: chosenClass,
      cleaningSolventNotes: chosenClass === 'Class I' ? 'Acqua Purificata WFI' : chosenClass === 'Class II' ? 'Metanolo' : 'Solvente di classe',
      sharedSurfaceAreaM2: 25.0,
      swabAreaCm2: 25.0,
      swabRecoveryPercent: 85.0,
      rinseVolumeLiters: 500.0,
      visualLimitUgCm2: 4.0,
      products: [],
    };

    setMatrices((prev) => [...prev, newMatrix]);
    setActiveMatrixIndex(matrices.length); // Switch to the newly created matrix
    showToast(`Creata nuova Matrice ${nextIdx} (${newMatrix.trainId} • ${newMatrix.cleaningClass})`);
  };

  // Open in-app dialog to confirm matrix deletion
  const promptDeleteMatrix = (idxToDelete: number) => {
    if (matrices.length <= 1) {
      showToast("Non è possibile eliminare l'unica matrice attiva. Deve esserci almeno una matrice impianto.", 'warning');
      return;
    }

    const target = matrices[idxToDelete];
    setDeleteConfirmation({
      isOpen: true,
      type: 'delete-matrix',
      title: `Elimina Matrice ${target.matrixIndex} (${target.trainId})`,
      message: `Confermi l'eliminazione definitiva della Matrice ${target.matrixIndex} (${target.trainId} • ${target.cleaningClass})?`,
      details:
        target.products.length > 0
          ? `Verranno rimossi tutti i ${target.products.length} prodotti associati e le relative combinazioni worst-case calcolate.`
          : `Verrà rimossa la configurazione del treno d'impianto.`,
      confirmButtonText: 'Elimina Matrice',
      matrixIndexToDelete: idxToDelete,
    });
  };

  const handleDeleteMatrix = (idxToDelete: number) => {
    promptDeleteMatrix(idxToDelete);
  };

  // Duplicate active matrix
  const handleDuplicateMatrix = () => {
    if (matrices.length >= MAX_MATRICES) {
      showToast(`Limite massimo di ${MAX_MATRICES} matrici raggiunto.`, 'warning');
      return;
    }
    const current = activeMatrix;
    const newIdx = matrices.length + 1;
    const duplicated: FacilityMatrixTrain = {
      ...current,
      id: `matrix-${newIdx}-${Date.now()}`,
      matrixIndex: newIdx,
      trainId: `${current.trainId}-Copia`,
      name: `${current.name} (Copia)`,
      products: current.products.map((p) => ({ ...p, id: `prod-${Date.now()}-${Math.random().toString(36).substr(2, 4)}` })),
    };

    setMatrices((prev) => [...prev, duplicated]);
    setActiveMatrixIndex(matrices.length);
    showToast(`Matrice ${current.matrixIndex} duplicata come Matrice ${newIdx}`);
  };

  // Save Train Configuration
  const handleSaveTrainConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setMatrices((prev) =>
      prev.map((m, idx) => {
        if (idx !== activeMatrixIndex) return m;
        return {
          ...m,
          trainId: trainFormTrainId.trim() || `Train-${m.matrixIndex}`,
          name: trainFormName.trim() || `Treno ${trainFormTrainId}`,
          cleaningClass: trainFormClass,
          cleaningSolventNotes: trainFormSolvent.trim(),
          sharedSurfaceAreaM2: Number(trainFormArea) > 0 ? Number(trainFormArea) : 25,
          swabAreaCm2: Number(trainFormSwabArea) > 0 ? Number(trainFormSwabArea) : 25,
          swabRecoveryPercent: Number(trainFormRecovery) > 0 ? Number(trainFormRecovery) : 85,
          rinseVolumeLiters: Number(trainFormRinseVol) > 0 ? Number(trainFormRinseVol) : 500,
          visualLimitUgCm2: Number(trainFormVisualLimit) > 0 ? Number(trainFormVisualLimit) : 4.0,
        };
      })
    );
    setIsEditTrainModalOpen(false);
    showToast('Parametri del treno d\'impianto aggiornati');
  };

  // Open modal to add fresh product to active matrix
  const handleOpenAddProductModal = () => {
    setEditingProduct(null);
    setProdFormName('');
    setProdFormCode(`PRD-${String(activeMatrix.products.length + 1).padStart(2, '0')}`);
    setProdFormCas('');
    setProdFormType('API');
    setProdFormStage('Principio Attivo (API)');
    setProdFormCleanCat(2);
    setProdFormCleanRationale('Valutazione basata su interviste condotte con operatori di reparto.');
    setProdFormSolGroup(2);
    setProdFormSolDesc(`Solubilità moderata nel solvente di pulizia (${activeMatrix.cleaningClass}).`);
    setProdFormPdeUg(100);
    setProdFormPdeGroup(2);
    setProdFormMinDoseMg(10);
    setProdFormDoseGroup(3);
    setProdFormMaxDoseMg(40);
    setProdFormBatchSizeKg(250);
    setProdFormNotes('');
    setIsAddEditProductModalOpen(true);
  };

  // Open modal to edit existing product
  const handleOpenEditProductModal = (prod: MatrixProductItem) => {
    setEditingProduct(prod);
    setProdFormName(prod.name);
    setProdFormCode(prod.code || '');
    setProdFormCas(prod.casNumber);
    setProdFormType(prod.type);
    setProdFormStage(prod.stage || '');
    setProdFormCleanCat(prod.cleanabilityCategory);
    setProdFormCleanRationale(prod.cleanabilityRationale || '');
    setProdFormSolGroup(prod.solubilityGroup);
    setProdFormSolDesc(prod.solubilityDescription || '');
    setProdFormPdeUg(prod.pdeUgDay);
    setProdFormPdeGroup(prod.pdeGroup);
    setProdFormMinDoseMg(prod.minDailyDoseMg);
    setProdFormDoseGroup(prod.doseGroup);
    setProdFormMaxDoseMg(prod.maxDailyDoseMg);
    setProdFormBatchSizeKg(prod.minBatchSizeKg);
    setProdFormNotes(prod.notes || '');
    setIsAddEditProductModalOpen(true);
  };

  // Save product into active matrix
  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodFormName.trim()) {
      showToast('Inserire il nome del prodotto o intermedio prima di salvare.', 'warning');
      return;
    }

    const pdeUg = Number(prodFormPdeUg) > 0 ? Number(prodFormPdeUg) : 0.1;
    const pdeMg = pdeUg / 1000;
    const minDose = Number(prodFormMinDoseMg) > 0 ? Number(prodFormMinDoseMg) : 1;

    const newItem: MatrixProductItem = {
      id: editingProduct ? editingProduct.id : `prod-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: prodFormName.trim(),
      code: prodFormCode.trim() || undefined,
      casNumber: prodFormCas.trim() || 'N/A',
      type: prodFormType,
      stage: prodFormStage,
      cleanabilityCategory: prodFormCleanCat,
      cleanabilityRationale: prodFormCleanRationale.trim() || undefined,
      solubilityGroup: prodFormSolGroup,
      solubilityDescription: prodFormSolDesc.trim() || undefined,
      pdeUgDay: pdeUg,
      pdeMgDay: pdeMg,
      pdeGroup: prodFormPdeGroup,
      minDailyDoseMg: minDose,
      doseGroup: prodFormDoseGroup,
      maxDailyDoseMg: Number(prodFormMaxDoseMg) > 0 ? Number(prodFormMaxDoseMg) : 1,
      minBatchSizeKg: Number(prodFormBatchSizeKg) > 0 ? Number(prodFormBatchSizeKg) : 1,
      notes: prodFormNotes.trim() || undefined,
      isFromDatabase: editingProduct?.isFromDatabase ?? false,
    };

    setMatrices((prev) =>
      prev.map((m, idx) => {
        if (idx !== activeMatrixIndex) return m;
        const exists = m.products.some((p) => p.id === newItem.id);
        const updatedProducts = exists
          ? m.products.map((p) => (p.id === newItem.id ? newItem : p))
          : [...m.products, newItem];
        return { ...m, products: updatedProducts };
      })
    );

    setIsAddEditProductModalOpen(false);
    showToast(editingProduct ? `Prodotto "${newItem.name}" aggiornato` : `Prodotto "${newItem.name}" aggiunto alla matrice`);
  };

  // Open in-app dialog to confirm product deletion
  const promptDeleteProduct = (id: string, name: string) => {
    setDeleteConfirmation({
      isOpen: true,
      type: 'delete-product',
      title: 'Rimuovi Prodotto dalla Matrice',
      message: `Rimuovere il prodotto "${name}" dalla Matrice ${activeMatrix.matrixIndex} (${activeMatrix.trainId})?`,
      details: 'La combinazione worst-case (caso peggiore) e i limiti MACO verranno ricalcolati immediatamente.',
      confirmButtonText: 'Rimuovi Prodotto',
      productIdToDelete: id,
      productNameToDelete: name,
    });
  };

  const handleDeleteProduct = (id: string, name: string) => {
    promptDeleteProduct(id, name);
  };

  // Open in-app dialog to confirm clearing products from active matrix
  const promptClearActiveMatrixProducts = () => {
    if (activeMatrix.products.length === 0) {
      showToast('La matrice corrente è già vuota.', 'info');
      return;
    }
    setDeleteConfirmation({
      isOpen: true,
      type: 'clear-matrix',
      title: `Svuota Matrice ${activeMatrix.matrixIndex}`,
      message: `Svuotare tutti i ${activeMatrix.products.length} prodotti della Matrice ${activeMatrix.matrixIndex} (${activeMatrix.trainId})?`,
      details: 'Tutti i prodotti inseriti verranno rimossi. Potrai aggiungerne di nuovi da zero o dal catalogo.',
      confirmButtonText: 'Svuota Tutti i Prodotti',
    });
  };

  const handleClearActiveMatrixProducts = () => {
    promptClearActiveMatrixProducts();
  };

  // Central delete execution handler (safely invoked from the confirmation dialog)
  const handleExecuteDelete = () => {
    if (deleteConfirmation.type === 'delete-matrix' && deleteConfirmation.matrixIndexToDelete !== undefined) {
      const idxToDelete = deleteConfirmation.matrixIndexToDelete;
      const target = matrices[idxToDelete];
      setMatrices((prev) => {
        const filtered = prev.filter((_, i) => i !== idxToDelete);
        return filtered.map((m, i) => ({ ...m, matrixIndex: i + 1 }));
      });
      setActiveMatrixIndex((prev) => (prev >= idxToDelete ? Math.max(0, prev - 1) : prev));
      showToast(`Matrice ${target.matrixIndex} (${target.trainId}) rimossa.`);
    } else if (deleteConfirmation.type === 'delete-product' && deleteConfirmation.productIdToDelete) {
      const id = deleteConfirmation.productIdToDelete;
      const name = deleteConfirmation.productNameToDelete || 'Prodotto';
      setMatrices((prev) =>
        prev.map((m, idx) => {
          if (idx !== activeMatrixIndex) return m;
          return { ...m, products: m.products.filter((p) => p.id !== id) };
        })
      );
      showToast(`Prodotto "${name}" rimosso dalla matrice.`);
    } else if (deleteConfirmation.type === 'clear-matrix') {
      setMatrices((prev) =>
        prev.map((m, idx) => {
          if (idx !== activeMatrixIndex) return m;
          return { ...m, products: [] };
        })
      );
      showToast(`Matrice ${activeMatrix.matrixIndex} svuotata con successo.`);
    }
    setDeleteConfirmation((prev) => ({ ...prev, isOpen: false }));
  };

  // Import support data from global database (fills Add Product form or adds directly)
  const handleImportFromDatabase = (
    compound: PharmaceuticalCompound,
    intermediate?: any,
    mode: 'fill-form' | 'direct-add' = 'fill-form'
  ) => {
    const isInter = !!intermediate;
    const effectivePdeMg = isInter
      ? intermediate.pdeValueMg ?? Number((compound.pdeMgDay * (intermediate.pdeRatioToApi ?? 1.0)).toFixed(4))
      : compound.pdeMgDay;
    const pdeUg = effectivePdeMg * 1000;
    const pdeGrp = getAdePdeGroup(pdeUg);
    const minDose = compound.minDailyDoseMg;
    const doseGrp = getTherapeuticDoseGroup(minDose);
    const cleanCat = mapCleanabilityTextToCategory(isInter ? intermediate.cleanability : compound.cleanability);
    const solGrp = mapSolubilityTextToGroup(compound.solubilityInWater);

    const name = isInter ? `${compound.name} → Intermedio: ${intermediate.code}` : compound.name;
    const code = isInter ? intermediate.code : compound.casNumber;
    const cas = isInter ? intermediate.casNumber || 'N/A' : compound.casNumber;
    const rationale = `Valore da profilo industriale: ${isInter ? intermediate.cleanability : compound.cleanability}`;
    const solDesc = `USP 24 Grp ${solGrp}: ${compound.solubilityInWater}`;

    if (mode === 'fill-form' || isAddEditProductModalOpen) {
      setProdFormName(name);
      setProdFormCode(code || '');
      setProdFormCas(cas);
      setProdFormType(isInter ? 'Intermediate' : 'API');
      setProdFormStage(isInter ? intermediate.stage : 'Principio Attivo (API)');
      setProdFormCleanCat(cleanCat);
      setProdFormSolGroup(solGrp);
      setProdFormSolDesc(solDesc);
      setProdFormPdeUg(pdeUg);
      setProdFormPdeGroup(pdeGrp);
      setProdFormMinDoseMg(minDose);
      setProdFormDoseGroup(doseGrp);
      setProdFormBatchSizeKg(250);
      setProdFormMaxDoseMg(compound.maxDailyDoseMg);
      setIsDbImportModalOpen(false);
      setIsAddEditProductModalOpen(true);
      showToast(`Dati di "${name}" caricati nel modulo. Puoi modificarli o salvare.`);
      return;
    }

    const newItem: MatrixProductItem = {
      id: `imported-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name,
      code,
      casNumber: cas,
      type: isInter ? 'Intermediate' : 'API',
      stage: isInter ? intermediate.stage : 'Principio Attivo (API)',
      cleanabilityCategory: cleanCat,
      cleanabilityRationale: rationale,
      solubilityGroup: solGrp,
      solubilityDescription: solDesc,
      pdeUgDay: pdeUg,
      pdeMgDay: effectivePdeMg,
      pdeGroup: pdeGrp,
      minDailyDoseMg: minDose,
      doseGroup: doseGrp,
      maxDailyDoseMg: compound.maxDailyDoseMg,
      minBatchSizeKg: 250,
      notes: `Importato come supporto dal Database Globale (Fonte: ${compound.monographReference || 'APIC'})`,
      isFromDatabase: true,
    };

    setMatrices((prev) =>
      prev.map((m, idx) => {
        if (idx !== activeMatrixIndex) return m;
        return { ...m, products: [...m.products, newItem] };
      })
    );

    setIsDbImportModalOpen(false);
    showToast(`Dati di "${newItem.name}" inseriti nella matrice`);
  };

  // Optional Demo Loader for active matrix (illustrative only)
  const handleLoadSampleDemo = () => {
    const demo: MatrixProductItem[] = [
      {
        id: 'demo-1',
        name: 'Atorvastatina Sale di Calcio',
        code: 'API-ATV-01',
        casNumber: '344423-98-9',
        type: 'API',
        stage: 'Principio Attivo (API)',
        cleanabilityCategory: 2, // Medium
        cleanabilityRationale: 'Solubilità moderata in metanolo; richiede lavaggio CIP a 60°C.',
        solubilityGroup: 2,
        solubilityDescription: 'Soluble / Sparingly soluble in solvente polare',
        pdeUgDay: 150,
        pdeMgDay: 0.15,
        pdeGroup: 2, // 100 - 500 µg
        minDailyDoseMg: 10,
        doseGroup: 3, // 10 - 99 mg
        maxDailyDoseMg: 80,
        minBatchSizeKg: 200,
        isFromDatabase: true,
      },
      {
        id: 'demo-2',
        name: 'Intermedio Sintetico ATS-4 Acetonide',
        code: 'INT-ATS4-02',
        casNumber: '125971-94-0',
        type: 'Intermediate',
        stage: 'Penultimate Intermediate',
        cleanabilityCategory: 3, // Difficult
        cleanabilityRationale: 'Residuo ceroso e tenace sulle pale dell\'agitatore R-102.',
        solubilityGroup: 3,
        solubilityDescription: 'Praticamente insolubile in acqua; solubile solo a caldo',
        pdeUgDay: 150,
        pdeMgDay: 0.15,
        pdeGroup: 2,
        minDailyDoseMg: 10,
        doseGroup: 3,
        maxDailyDoseMg: 80,
        minBatchSizeKg: 120,
        isFromDatabase: true,
      },
      {
        id: 'demo-3',
        name: 'Omeprazolo Base',
        code: 'API-OMP-03',
        casNumber: '73590-58-6',
        type: 'API',
        stage: 'Principio Attivo (API)',
        cleanabilityCategory: 3, // Difficult
        cleanabilityRationale: 'Instabile in ambiente acido, forma polimeri scuri se scaldato a secco.',
        solubilityGroup: 3,
        solubilityDescription: 'Poco solubile / degradabile',
        pdeUgDay: 200,
        pdeMgDay: 0.2,
        pdeGroup: 2,
        minDailyDoseMg: 10,
        doseGroup: 3,
        maxDailyDoseMg: 40,
        minBatchSizeKg: 180,
        isFromDatabase: true,
      },
      {
        id: 'demo-4',
        name: 'Paracetamolo Fine Sintesi',
        code: 'API-PCT-04',
        casNumber: '103-90-2',
        type: 'API',
        stage: 'Principio Attivo (API)',
        cleanabilityCategory: 1, // Easy
        cleanabilityRationale: 'Facilmente rimosso con normale risciacquo idrico a 45°C.',
        solubilityGroup: 1,
        solubilityDescription: 'Freely soluble',
        pdeUgDay: 3500,
        pdeMgDay: 3.5,
        pdeGroup: 1, // > 500 µg
        minDailyDoseMg: 500,
        doseGroup: 2, // 100 - 1000 mg
        maxDailyDoseMg: 4000,
        minBatchSizeKg: 600,
        isFromDatabase: true,
      },
    ];

    setMatrices((prev) =>
      prev.map((m, idx) => {
        if (idx !== activeMatrixIndex) return m;
        return { ...m, products: demo };
      })
    );
    showToast(`Caricato esempio dimostrativo nella Matrice ${activeMatrix.matrixIndex}`);
  };

  // Evaluate All Combinations in active matrix
  const matrixEvaluation = useMemo(() => {
    return evaluateAllMatrixCombinations(activeMatrix.products, {
      sharedSurfaceAreaM2: activeMatrix.sharedSurfaceAreaM2,
      swabAreaCm2: activeMatrix.swabAreaCm2,
      swabRecoveryPercent: activeMatrix.swabRecoveryPercent,
      rinseVolumeLiters: activeMatrix.rinseVolumeLiters,
    });
  }, [activeMatrix]);

  // Regulatory Audit Trail Export Functions (Compliant with APIC Sez. 7.0 & EMA GMP Annex 15)
  const exportMatrixToPdf = () => {
    setIsExportReportModalOpen(true);
  };

  const exportMatrixToCsv = () => {
    if (activeMatrix.products.length === 0) {
      showToast('Aggiungere almeno un prodotto prima di esportare.');
      return;
    }
    const csv = generateMatrixCsv(activeMatrix, matrices.length);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `APIC_AuditTrail_Matrice_${activeMatrix.trainId}_${activeMatrix.cleaningClass.replace(/\s+/g, '_')}_${dateStr}.csv`;
    downloadFile(csv, filename, 'text/csv;charset=utf-8;');
    showToast('Report CSV per Audit Trail scaricato.');
  };

  const exportMatrixToExcel = () => {
    if (activeMatrix.products.length === 0) {
      showToast('Aggiungere almeno un prodotto prima di esportare.');
      return;
    }
    const xml = generateMatrixExcelXml(activeMatrix, matrices.length);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `APIC_AuditTrail_Matrice_${activeMatrix.trainId}_Excel_${dateStr}.xml`;
    downloadFile(xml, filename, 'application/vnd.ms-excel;charset=utf-8;');
    showToast('Report Excel dinamico scaricato: include formule attive =MIN, =HBEL, =Swab e celle interattive.');
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastInfo && (
        <div
          className={`fixed bottom-6 right-6 z-50 text-white px-4 py-2.5 rounded-xl shadow-2xl text-xs font-semibold flex items-center space-x-2 animate-bounce border ${
            toastInfo.type === 'warning'
              ? 'bg-amber-600 border-amber-400'
              : toastInfo.type === 'info'
              ? 'bg-blue-600 border-blue-400'
              : 'bg-emerald-600 border-emerald-400'
          }`}
        >
          {toastInfo.type === 'warning' ? (
            <AlertTriangle className="w-4 h-4 text-amber-100" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-100" />
          )}
          <span>{toastInfo.message}</span>
        </div>
      )}

      {/* Primary Header: Scheda 1 Focus with Distinctive Indigo/Purple Environment Styling */}
      <div className="bg-gradient-to-r from-purple-950/40 via-slate-900 to-indigo-950/30 border-2 border-purple-500/40 p-6 rounded-2xl shadow-2xl shadow-purple-950/30 flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-black bg-purple-500 text-white shadow-md shadow-purple-500/30 uppercase tracking-wider flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
              <span>AMBIENTE: SCHEDA 1 • MATRICE IMPIANTO &amp; INCASTRO PRODOTTI</span>
            </span>
            <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Guida APIC Cap. 7 • Multi-Matrix (Max 10)
            </span>
            <span className="text-xs text-purple-300/80 font-medium">
              Costruttore Autonomo QA Specialist
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-2 flex items-center space-x-2">
            <span>Matrice Impianto &amp; Incastro Prodotti (Cross-Carryover APIC)</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1.5 max-w-4xl leading-relaxed">
            In ogni matrice inserisci i prodotti e intermedi che condividono lo stesso impianto (<strong>Treno Impianti</strong>) e la medesima <strong>Cleaning Class (I - II - III - IV)</strong>.
            L&apos;applicazione valuta <strong>tutte le combinazioni possibili ($A \rightarrow B$)</strong> identificando la più sfavorevole (<strong>Worst Case da validare</strong>) in base ai criteri <strong>a</strong> (pulibilità), <strong>b</strong> (solubilità USP 24), <strong>c</strong> (ADE/PDE) e <strong>d</strong> (dose minima).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto relative z-10">
          <button
            onClick={handleOpenAddProductModal}
            className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-lg shadow-purple-600/30 hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" />
            <span>Aggiungi Prodotto / Intermedio</span>
          </button>

          <button
            onClick={() => setIsDbImportModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/40 text-xs font-semibold transition-colors shadow-sm"
            title="Recupera valori dal Database Globale ADE/PDE a supporto"
          >
            <Database className="w-4 h-4 text-purple-400" />
            <span>Supporto da DB</span>
          </button>

          {activeMatrix.products.length > 0 && (
            <button
              onClick={() => setIsExportReportModalOpen(true)}
              className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-600 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-purple-700/25 border border-purple-400/30 hover:scale-[1.02]"
              title="Esporta il report completo della matrice corrente in PDF, Excel, Google Sheets o CSV"
            >
              <Share2 className="w-4 h-4 text-white" />
              <span>Esporta Report (PDF/Excel/Sheets/CSV)</span>
            </button>
          )}
        </div>
      </div>

      {/* MATRIX SELECTOR BAR: Up to 10 matrices */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Selettore Matrici Impianto ({matrices.length}/{MAX_MATRICES}):
            </span>
            <span className="text-[11px] text-slate-400">
              Ogni matrice aggrega prodotti con stesso impianto e cleaning class
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleDuplicateMatrix}
              disabled={matrices.length >= MAX_MATRICES}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] border border-slate-700 disabled:opacity-40 transition-colors"
              title="Duplica la matrice corrente"
            >
              <Copy className="w-3 h-3 text-blue-400" />
              <span>Duplica</span>
            </button>

            {matrices.length > 1 && (
              <button
                type="button"
                onClick={() => promptDeleteMatrix(activeMatrixIndex)}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-rose-100 text-[11px] border border-rose-500/40 transition-colors shadow-sm"
                title={`Elimina la Matrice ${activeMatrix.matrixIndex} (${activeMatrix.trainId})`}
              >
                <Trash2 className="w-3 h-3 text-rose-400" />
                <span>Elimina Matrice {activeMatrix.matrixIndex}</span>
              </button>
            )}

            <button
              onClick={handleAddMatrix}
              disabled={matrices.length >= MAX_MATRICES}
              className="flex items-center space-x-1 px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold shadow transition-colors disabled:opacity-40"
              title="Aggiungi una nuova matrice impianto (fino a 10)"
            >
              <Plus className="w-3 h-3" />
              <span>+ Nuova Matrice ({matrices.length}/{MAX_MATRICES})</span>
            </button>
          </div>
        </div>

        {/* Matrix Tab Chips with direct delete icons */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 no-scrollbar">
          {matrices.map((m, idx) => {
            const isActive = idx === activeMatrixIndex;
            const count = m.products.length;
            return (
              <div
                key={m.id}
                onClick={() => setActiveMatrixIndex(idx)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-purple-950/60 border-purple-500 text-white shadow-md shadow-purple-950/40 ring-1 ring-purple-500/50'
                    : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isActive ? 'bg-purple-500 text-slate-950' : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {m.matrixIndex}
                </span>
                <span className="font-bold">{m.trainId}</span>
                <span className="text-slate-500">•</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] ${
                    m.cleaningClass === 'Class I'
                      ? 'bg-blue-500/20 text-blue-300'
                      : m.cleaningClass === 'Class II'
                      ? 'bg-amber-500/20 text-amber-300'
                      : m.cleaningClass === 'Class III'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-rose-500/20 text-rose-300'
                  }`}
                >
                  {m.cleaningClass}
                </span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-900 text-slate-400 font-mono">
                  {count} prod.
                </span>
                {matrices.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      promptDeleteMatrix(idx);
                    }}
                    className="p-1 -mr-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-950/50 transition-colors"
                    title={`Elimina Matrice ${m.matrixIndex} (${m.trainId})`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Active Matrix Parameter Summary & Edit Button */}
        <div className="bg-slate-850/60 border border-slate-800 p-3.5 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 flex-1">
            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-semibold">Treno Impianto</span>
              <span className="font-bold text-white text-sm">{activeMatrix.trainId}</span>
              <span className="text-[10px] text-slate-400 block truncate">{activeMatrix.name}</span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-semibold">Cleaning Class (APIC)</span>
              <span className="font-bold text-purple-300">{activeMatrix.cleaningClass}</span>
              <span className="text-[10px] text-slate-400 block truncate">
                {activeMatrix.cleaningSolventNotes || 'Solvente standard'}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-semibold">Superficie Condivisa</span>
              <span className="font-bold font-mono text-white">{activeMatrix.sharedSurfaceAreaM2} m²</span>
              <span className="text-[10px] text-slate-400 block">Area a contatto</span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-semibold">Swab / Recupero</span>
              <span className="font-bold font-mono text-teal-400">{activeMatrix.swabAreaCm2} cm²</span>
              <span className="text-[10px] text-slate-400 block font-mono">Recovery: {activeMatrix.swabRecoveryPercent}%</span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-semibold">Volume Risciacquo</span>
              <span className="font-bold font-mono text-blue-400">{activeMatrix.rinseVolumeLiters} L</span>
              <span className="text-[10px] text-slate-400 block font-mono">Visivo: {activeMatrix.visualLimitUgCm2} µg/cm²</span>
            </div>
          </div>

          <button
            onClick={() => setIsEditTrainModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/30 text-xs font-semibold transition-colors self-start md:self-center shrink-0"
          >
            <Settings className="w-3.5 h-3.5 text-purple-400" />
            <span>Configura Parametri Treno</span>
          </button>
        </div>
      </div>

      {/* APIC Chapter 7 Rules Legend Reminder */}
      <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl text-xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-300 flex items-center space-x-2">
            <Info className="w-4 h-4 text-purple-400" />
            <span>Guida APIC Capitolo 7: Criteri per l&apos;Identificazione del Caso Peggiore (Worst-Case)</span>
          </span>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Tutte le sostanze nella matrice devono condividere lo stesso treno e solvente di lavaggio
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-[11px]">
          <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/60">
            <span className="font-bold text-amber-300 block">a) Hardest to clean</span>
            <span className="text-slate-300">Cat 1 = Easy • Cat 2 = Medium • Cat 3 = Difficult</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Esperienza operatori di produzione</span>
          </div>
          <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/60">
            <span className="font-bold text-blue-300 block">b) Solubilità (USP 24)</span>
            <span className="text-slate-300">Grp 1 (&lt;10 parti) • Grp 2 (10-100) • Grp 3 (&gt;100 parti)</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Solubilità nel solvente di pulizia</span>
          </div>
          <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/60">
            <span className="font-bold text-teal-300 block">c) Limite ADE / PDE</span>
            <span className="text-slate-300">Grp 1 (&gt;500µg) • Grp 2 • Grp 3 • Grp 4 • Grp 5 (&lt;1µg)</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Tossicità HBEL / Potenza farmacologica</span>
          </div>
          <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/60">
            <span className="font-bold text-emerald-300 block">d) Dose Terapeutica Minima</span>
            <span className="text-slate-300">Grp 1 (&gt;1000mg) • Grp 2 • Grp 3 • Grp 4 • Grp 5 (&lt;1mg)</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Smallest therapeutic dose (TDD)</span>
          </div>
        </div>
      </div>

      {/* EMPTY STATE: Shown when the QA specialist hasn't added products to the current matrix */}
      {activeMatrix.products.length === 0 ? (
        <div className="bg-slate-900 border-2 border-dashed border-slate-800 rounded-2xl p-10 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-purple-950/40 text-purple-400 border border-purple-800/50 mx-auto flex items-center justify-center shadow-lg">
            <TableIcon className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto">
            <h2 className="text-lg font-bold text-white tracking-tight">
              Matrice {activeMatrix.matrixIndex} ({activeMatrix.trainId}) è Vuota
            </h2>
            <p className="text-xs text-slate-400 mt-1.5">
              Il QA specialist deve costruire da zero la propria matrice aggiungendo i principi attivi (API) e intermedi di sintesi appartenenti a <strong>{activeMatrix.trainId}</strong> con cleaning class <strong>{activeMatrix.cleaningClass}</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={handleOpenAddProductModal}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-colors shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Aggiungi Prodotto / Intermedio da Zero</span>
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
        /* POPULATED STATE */
        <div className="space-y-6">
          {/* SECTION 1: Products Table with Exact APIC Criteria a, b, c, d */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden space-y-4 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold text-xs border border-purple-500/30">
                  {activeMatrix.products.length}
                </span>
                <h2 className="text-base font-bold text-white tracking-tight">
                  Prodotti ed Intermedi in Matrice ({activeMatrix.products.length}) • {activeMatrix.trainId}
                </h2>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleOpenAddProductModal}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Aggiungi Prodotto</span>
                </button>
                <button
                  onClick={() => setIsDbImportModalOpen(true)}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/40 text-xs font-semibold transition-colors"
                >
                  <Database className="w-3.5 h-3.5 text-teal-400" />
                  <span>Supporto DB</span>
                </button>
                <button
                  onClick={handleClearActiveMatrixProducts}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-700 transition-colors"
                  title="Svuota prodotti da questa matrice"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-800/80 text-slate-400 uppercase font-semibold text-[11px] border-b border-slate-700/80">
                  <tr>
                    <th className="py-2.5 px-3">Prodotto / Codice</th>
                    <th className="py-2.5 px-3">Tipo</th>
                    <th className="py-2.5 px-3">CAS</th>
                    <th className="py-2.5 px-3">a) Hardest to clean</th>
                    <th className="py-2.5 px-3">b) Solubilità</th>
                    <th className="py-2.5 px-3">c) ADE / PDE</th>
                    <th className="py-2.5 px-3">d) Min Dose (TDD)</th>
                    <th className="py-2.5 px-3">MBS B (kg)</th>
                    <th className="py-2.5 px-3">MDD B (mg)</th>
                    <th className="py-2.5 px-3 text-right">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {activeMatrix.products.map((prod) => (
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
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            prod.cleanabilityCategory === 3
                              ? 'bg-rose-950/60 text-rose-300 border border-rose-800'
                              : prod.cleanabilityCategory === 2
                              ? 'bg-amber-950/60 text-amber-300 border border-amber-800'
                              : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800'
                          }`}
                        >
                          Cat {prod.cleanabilityCategory} ({prod.cleanabilityCategory === 1 ? 'Easy' : prod.cleanabilityCategory === 2 ? 'Medium' : 'Difficult'})
                        </span>
                        {prod.cleanabilityRationale && (
                          <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[140px]" title={prod.cleanabilityRationale}>
                            {prod.cleanabilityRationale}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            prod.solubilityGroup === 3
                              ? 'bg-rose-950/60 text-rose-300 border border-rose-800'
                              : prod.solubilityGroup === 2
                              ? 'bg-amber-950/60 text-amber-300 border border-amber-800'
                              : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800'
                          }`}
                        >
                          Grp {prod.solubilityGroup}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-mono font-bold text-teal-400">
                          {prod.pdeUgDay} <span className="text-[10px] font-normal text-slate-400">µg</span>
                        </div>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                            prod.pdeGroup >= 4 ? 'text-rose-400' : prod.pdeGroup === 3 ? 'text-amber-400' : 'text-slate-400'
                          }`}
                        >
                          Gruppo {prod.pdeGroup} ({prod.pdeGroup === 1 ? '>500µg' : prod.pdeGroup === 2 ? '100-500µg' : prod.pdeGroup === 3 ? '10-99µg' : prod.pdeGroup === 4 ? '1-9µg' : '<1µg'})
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-mono text-white font-semibold">
                          {prod.minDailyDoseMg} <span className="text-[10px] font-normal text-slate-400">mg</span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          Gruppo {prod.doseGroup} ({prod.doseGroup === 1 ? '>1000mg' : prod.doseGroup === 2 ? '100-1000' : prod.doseGroup === 3 ? '10-99' : prod.doseGroup === 4 ? '1-9' : '<1mg'})
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono font-semibold text-blue-300">{prod.minBatchSizeKg} kg</td>
                      <td className="py-3 px-3 font-mono text-slate-300">{prod.maxDailyDoseMg} mg</td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => handleOpenEditProductModal(prod)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                            title="Modifica parametri"
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

          {/* SECTION 2: Worst-Case Identification Cards */}
          {matrixEvaluation.worstCaseCombination && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Worst Case Transition Card */}
              <div className="bg-gradient-to-br from-rose-950/60 via-slate-900 to-slate-900 border-2 border-rose-500/80 p-5 rounded-2xl shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ShieldAlert className="w-5 h-5 text-rose-400" />
                    <span className="text-xs font-bold text-rose-300 uppercase tracking-wider">
                      Combinazione Più Sfavorevole (Worst-Case da Validare)
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded text-xs font-black bg-rose-500 text-slate-950">
                    CASO PEGGIORE
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-black text-white">
                    {matrixEvaluation.worstCaseCombination.fromProduct.name} → {matrixEvaluation.worstCaseCombination.toProduct.name}
                  </h3>
                  <p className="text-xs text-rose-200 mt-1">
                    Questa transizione rappresenta il rischio massimo di cross-carryover tra tutti i prodotti del treno {activeMatrix.trainId}.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
                  <div className="bg-slate-900/90 p-2.5 rounded-xl border border-rose-900/60">
                    <span className="text-slate-400 block text-[10px]">MACO Minimo</span>
                    <span className="font-black text-white font-mono text-sm">
                      {matrixEvaluation.worstCaseCombination.macoSelectedMg.toLocaleString('it-IT')} mg
                    </span>
                    <span className="text-[10px] text-teal-400 block font-semibold">
                      ({matrixEvaluation.worstCaseCombination.governingCriteria})
                    </span>
                  </div>

                  <div className="bg-slate-900/90 p-2.5 rounded-xl border border-rose-900/60">
                    <span className="text-slate-400 block text-[10px]">Limite Swab ({activeMatrix.swabAreaCm2} cm²)</span>
                    <span className="font-black text-teal-400 font-mono text-sm">
                      {matrixEvaluation.worstCaseCombination.swabLimitUgPerSwab} µg
                    </span>
                    <span className="text-[10px] text-slate-400 block">Recupero {activeMatrix.swabRecoveryPercent}%</span>
                  </div>

                  <div className="bg-slate-900/90 p-2.5 rounded-xl border border-rose-900/60">
                    <span className="text-slate-400 block text-[10px]">Limite Risciacquo ({activeMatrix.rinseVolumeLiters} L)</span>
                    <span className="font-black text-purple-300 font-mono text-sm">
                      {matrixEvaluation.worstCaseCombination.rinseLimitMgL} ppm
                    </span>
                    <span className="text-[10px] text-slate-400 block">mg/L solvente</span>
                  </div>
                </div>

                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-300">
                  <span className="font-bold text-rose-300 block mb-0.5">Razionale Convalida APIC:</span>
                  <span>{matrixEvaluation.worstCaseCombination.scientificRationale}</span>
                </div>
              </div>

              {/* Worst Residue Substance Card */}
              {matrixEvaluation.worstResidueProduct && (
                <div className="bg-gradient-to-br from-purple-950/40 via-slate-900 to-slate-900 border border-purple-500/50 p-5 rounded-2xl shadow-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Sparkles className="w-5 h-5 text-purple-400" />
                      <span className="text-xs font-bold text-purple-300 uppercase tracking-wider">
                        Sostanza Residua Più Critica (Marker di Pulizia)
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      Criteri a/b/c/d
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-black text-white">
                      {matrixEvaluation.worstResidueProduct.name}
                    </h3>
                    <p className="text-xs text-slate-300 mt-1">
                      Composto della matrice che presenta il profilo combinato più sfavorevole tra difficoltà di pulizia e tossicità.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                    <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">a) Pulibilità</span>
                      <span className="font-bold text-amber-300">
                        Cat {matrixEvaluation.worstResidueProduct.cleanabilityCategory}
                      </span>
                    </div>

                    <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">b) Solubilità</span>
                      <span className="font-bold text-blue-300">
                        Grp {matrixEvaluation.worstResidueProduct.solubilityGroup}
                      </span>
                    </div>

                    <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">c) ADE/PDE</span>
                      <span className="font-bold text-teal-400 font-mono">
                        {matrixEvaluation.worstResidueProduct.pdeUgDay} µg
                      </span>
                    </div>

                    <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">d) TDD Min</span>
                      <span className="font-bold text-white font-mono">
                        {matrixEvaluation.worstResidueProduct.minDailyDoseMg} mg
                      </span>
                    </div>
                  </div>

                  {matrixEvaluation.mostVulnerableRecipient && (
                    <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-300">
                      <span className="font-bold text-purple-300 block mb-0.5">Prodotto Ricevente Più Vulnerabile (B):</span>
                      <span>
                        <strong>{matrixEvaluation.mostVulnerableRecipient.name}</strong> (Min Batch Size: {matrixEvaluation.mostVulnerableRecipient.minBatchSizeKg} kg, Max Daily Dose: {matrixEvaluation.mostVulnerableRecipient.maxDailyDoseMg} mg/die)
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* SECTION 3: 2D Cross-Contamination Matrix Grid (Incastro A -> B) */}
          {activeMatrix.products.length >= 2 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      Griglia Bidimensionale Incastro Prodotti
                    </span>
                    <span className="text-xs text-slate-400">Precedente A ↓ vs Successivo B →</span>
                  </div>
                  <h2 className="text-lg font-bold text-white mt-1">
                    Matrice di Incastro Cross-Carryover MACO [mg] • {activeMatrix.trainId}
                  </h2>
                </div>

                <div className="text-xs text-slate-400">
                  Totale combinazioni valutate: <strong>{activeMatrix.products.length * (activeMatrix.products.length - 1)}</strong>
                </div>
              </div>

              {/* 2D Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-center text-xs text-slate-300 border-collapse">
                  <thead>
                    <tr className="bg-slate-800/90 text-[11px] text-slate-300 border-b border-slate-700">
                      <th className="p-3 text-left font-bold text-teal-300 min-w-[200px] border-r border-slate-700">
                        Precedente A ↓ / Successivo B →
                      </th>
                      {activeMatrix.products.map((p) => (
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
                    {activeMatrix.products.map((prodA) => (
                      <tr key={prodA.id} className="hover:bg-slate-800/40 transition-colors">
                        {/* Row header: Product A */}
                        <td className="p-3 text-left bg-slate-850 border-r border-slate-700">
                          <div className="font-bold text-white">{prodA.name}</div>
                          <div className="text-[10px] text-teal-300 font-mono">
                            PDE: {prodA.pdeUgDay} µg | TDD: {prodA.minDailyDoseMg} mg | Cat {prodA.cleanabilityCategory}
                          </div>
                        </td>

                        {/* Transition Cells */}
                        {activeMatrix.products.map((prodB) => {
                          if (prodA.id === prodB.id) {
                            return (
                              <td
                                key={prodB.id}
                                className="p-3 bg-slate-900/60 text-slate-500 font-mono text-[11px] border-r border-slate-800"
                              >
                                Stessa Campagna
                                <span className="block text-[9px] text-slate-600">(Campagna Chiusa)</span>
                              </td>
                            );
                          }

                          const combo = matrixEvaluation.combinations.find(
                            (c) => c.fromProduct.id === prodA.id && c.toProduct.id === prodB.id
                          );

                          if (!combo) return <td key={prodB.id} className="p-3 border-r border-slate-800">-</td>;

                          const isWorst = combo.isWorstCase;

                          return (
                            <td
                              key={prodB.id}
                              className={`p-2.5 transition-all border-r border-slate-800 ${
                                isWorst
                                  ? 'bg-rose-950/50 border-2 border-rose-500/80 shadow-md font-bold'
                                  : 'hover:bg-slate-800/60'
                              }`}
                            >
                              {isWorst && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-500 text-slate-950 block mb-1">
                                  WORST CASE
                                </span>
                              )}
                              <div className="font-mono text-sm font-bold text-white">
                                {combo.macoSelectedMg.toLocaleString('it-IT')} <span className="text-[10px] text-slate-400 font-normal">mg</span>
                              </div>
                              <div className="text-[10px] text-teal-300 font-mono mt-0.5">
                                Swab: <strong>{combo.swabLimitUgPerSwab} µg</strong>
                              </div>
                              <div className="text-[10px] text-purple-300 font-mono">
                                Rinse: {combo.rinseLimitMgL} ppm
                              </div>
                              <div className="text-[9px] text-slate-400 mt-0.5">
                                ({combo.governingCriteria})
                              </div>
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
              <span>Aggiungi almeno 2 prodotti alla matrice per visualizzare la griglia di incastro cross-contamination e identificare la combinazione più sfavorevole.</span>
            </div>
          )}

          {/* SECTION 4: Ranked Combinations Table */}
          {matrixEvaluation.combinations.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-full bg-teal-500/20 text-teal-300 flex items-center justify-center font-bold text-xs">
                    {matrixEvaluation.combinations.length}
                  </span>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Classifica Completa Combinazioni Ordinate per Severità di Convalida
                  </h3>
                </div>
                <span className="text-[11px] text-slate-400">
                  Ordinamento dal caso più sfavorevole (Worst-Case) al meno restrittivo
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-800/80 text-slate-400 uppercase font-semibold text-[11px] border-b border-slate-700/80">
                    <tr>
                      <th className="py-2.5 px-3">Transizione (A → B)</th>
                      <th className="py-2.5 px-3">a) Cleanability A</th>
                      <th className="py-2.5 px-3">b) Solubilità A</th>
                      <th className="py-2.5 px-3">c) PDE A</th>
                      <th className="py-2.5 px-3">d) TDD A</th>
                      <th className="py-2.5 px-3">MBS B</th>
                      <th className="py-2.5 px-3">MACO Limite</th>
                      <th className="py-2.5 px-3">Limite Swab</th>
                      <th className="py-2.5 px-3">Limite Rinse</th>
                      <th className="py-2.5 px-3">Razionale Convalida</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {[...matrixEvaluation.combinations]
                      .sort((a, b) => a.macoSelectedMg - b.macoSelectedMg)
                      .map((c, i) => (
                        <tr
                          key={`${c.fromProduct.id}-${c.toProduct.id}`}
                          className={`hover:bg-slate-800/40 transition-colors ${
                            c.isWorstCase ? 'bg-rose-950/30 font-semibold' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3">
                            <div className="flex items-center space-x-1.5">
                              {c.isWorstCase && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-rose-500 text-slate-950">
                                  #1 WORST
                                </span>
                              )}
                              <span className="font-bold text-white">{c.fromProduct.name}</span>
                              <ArrowRight className="w-3 h-3 text-slate-500" />
                              <span className="text-slate-300">{c.toProduct.name}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] ${
                                c.fromProduct.cleanabilityCategory === 3
                                  ? 'text-rose-300 bg-rose-950/50'
                                  : 'text-slate-300'
                              }`}
                            >
                              Cat {c.fromProduct.cleanabilityCategory}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="text-slate-300">Grp {c.fromProduct.solubilityGroup}</span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-teal-400">
                            {c.fromProduct.pdeUgDay} µg
                          </td>
                          <td className="py-2.5 px-3 font-mono">{c.fromProduct.minDailyDoseMg} mg</td>
                          <td className="py-2.5 px-3 font-mono text-blue-300">{c.toProduct.minBatchSizeKg} kg</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-white">
                            {c.macoSelectedMg.toLocaleString('it-IT')} mg
                            <span className="text-[10px] text-slate-400 block font-normal">({c.governingCriteria})</span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-teal-300">{c.swabLimitUgPerSwab} µg</td>
                          <td className="py-2.5 px-3 font-mono text-purple-300">{c.rinseLimitMgL} ppm</td>
                          <td className="py-2.5 px-3 text-[11px] text-slate-300 max-w-xs truncate" title={c.scientificRationale}>
                            {c.scientificRationale}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: Add / Edit Product in Matrix (Rationalized, Streamlined APIC Criteria) */}
      {isAddEditProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl text-slate-100 overflow-hidden my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-850">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                  <span>
                    {editingProduct
                      ? `Modifica Prodotto • ${activeMatrix.trainId}`
                      : `Aggiungi Prodotto alla Matrice • ${activeMatrix.trainId} (${activeMatrix.cleaningClass})`}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Definisci i parametri di pulibilità, solubilità e tossicologia per identificare il worst-case.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddEditProductModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              {/* QUICK DATABASE AUTOFILL / LOOKUP BAR */}
              <div className="bg-gradient-to-r from-purple-950/50 via-slate-850 to-indigo-950/40 border border-purple-500/40 p-3.5 rounded-xl space-y-2 shadow-inner">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <Database className="w-4 h-4 text-purple-300 shrink-0" />
                    <span className="font-bold text-white text-xs">
                      Precompilazione Rapida da Database Tossicologico (Supporto QA)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsDbImportModalOpen(true)}
                    className="self-start sm:self-auto px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-200 border border-purple-500/40 text-[11px] font-semibold transition-all flex items-center space-x-1"
                  >
                    <Search className="w-3 h-3 text-purple-300" />
                    <span>Sfoglia Catalogo Completo</span>
                  </button>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={modalQuickSearch}
                    onChange={(e) => setModalQuickSearch(e.target.value)}
                    placeholder="Digita per cercare molecola nota (es. Atorvastatina, Ibuprofene, Pfizer, Lonza, Teva...)"
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-purple-400"
                  />
                  {modalQuickSearch.trim().length > 1 && (
                    <div className="mt-1.5 bg-slate-900 border border-purple-500/50 rounded-lg shadow-xl overflow-hidden divide-y divide-slate-800 max-h-44 overflow-y-auto z-20">
                      {compounds
                        .filter(
                          (c) =>
                            c.name.toLowerCase().includes(modalQuickSearch.toLowerCase().trim()) ||
                            c.casNumber.toLowerCase().includes(modalQuickSearch.toLowerCase().trim()) ||
                            c.primaryManufacturers.some((m) =>
                              m.toLowerCase().includes(modalQuickSearch.toLowerCase().trim())
                            )
                        )
                        .slice(0, 5)
                        .map((c) => (
                          <div
                            key={c.id}
                            className="p-2 hover:bg-purple-950/40 flex items-center justify-between text-xs transition-colors"
                          >
                            <div>
                              <span className="font-bold text-white">{c.name}</span>
                              <span className="ml-2 font-mono text-[10px] text-teal-300">CAS: {c.casNumber}</span>
                              <span className="ml-2 text-[10px] text-slate-400">
                                PDE: <strong className="text-purple-300 font-mono">{c.pdeUgDay} µg</strong> • TDD:{' '}
                                <strong className="text-emerald-300 font-mono">{c.minDailyDoseMg} mg</strong>
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                handleImportFromDatabase(c, undefined, 'fill-form');
                                setModalQuickSearch('');
                              }}
                              className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-[11px] font-bold shadow-sm transition-colors"
                            >
                              Precompila
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 1: Identificazione Sostanza (Streamlined, no duplication) */}
              <div className="bg-slate-850 p-4 rounded-xl border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-purple-300 uppercase tracking-wider block">
                  1. Identificazione Sostanza
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-300 block mb-1 font-semibold">Nome Prodotto / Intermedio *:</label>
                    <input
                      type="text"
                      required
                      value={prodFormName}
                      onChange={(e) => setProdFormName(e.target.value)}
                      placeholder="es. Atorvastatina Calcio / Intermedio Grezzo ATS-4"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-medium focus:outline-none focus:border-purple-400"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 block mb-1 font-semibold">Numero CAS (con check Modulo-10):</label>
                    <input
                      type="text"
                      value={prodFormCas}
                      onChange={(e) => setProdFormCas(e.target.value)}
                      placeholder="es. 134523-00-5 o codice interno"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-purple-400"
                    />
                    {casValidation && (
                      <div className="mt-1 text-[10px]">
                        {casValidation.isValid ? (
                          <span className="text-emerald-400 flex items-center space-x-1 font-semibold">
                            <Check className="w-3 h-3" />
                            <span>CAS Modulo-10 Ufficiale Valido</span>
                          </span>
                        ) : (
                          <span className="text-amber-400">Codice interno o CAS senza check-digit</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-slate-300 block mb-1 font-semibold">Tipologia Sostanza:</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setProdFormType('API');
                          setProdFormStage('Principio Attivo (API)');
                        }}
                        className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all border ${
                          prodFormType === 'API'
                            ? 'bg-purple-600 text-white border-purple-400 shadow-md'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                        }`}
                      >
                        Principio Attivo (API)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setProdFormType('Intermediate');
                          setProdFormStage('Intermedio di Sintesi');
                        }}
                        className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all border ${
                          prodFormType === 'Intermediate'
                            ? 'bg-indigo-600 text-white border-indigo-400 shadow-md'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                        }`}
                      >
                        Intermedio di Sintesi
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-300 block mb-1 font-semibold">
                      {prodFormType === 'Intermediate' ? 'Stadio / Codice Intermedio:' : 'Codice Interno / Sigla:'}
                    </label>
                    <input
                      type="text"
                      value={prodFormType === 'Intermediate' ? prodFormStage : prodFormCode}
                      onChange={(e) => {
                        if (prodFormType === 'Intermediate') {
                          setProdFormStage(e.target.value);
                        } else {
                          setProdFormCode(e.target.value);
                        }
                      }}
                      placeholder={prodFormType === 'Intermediate' ? 'es. Penultimo grezzo / INT-02' : 'es. PRD-01 / API-LOT'}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-purple-400"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: Criteri APIC a, b, c, d in clear 2x2 grid */}
              <div className="bg-slate-850 p-4 rounded-xl border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-amber-300 uppercase tracking-wider block">
                  2. Criteri APIC di Pulibilità e Tossicità (a, b, c, d)
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* CRITERION A: HARDEST TO CLEAN */}
                  <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-2">
                    <label className="text-slate-200 block font-semibold text-xs">
                      a) Esperienza di Produzione (Hardest to Clean):
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setProdFormCleanCat(1);
                          setProdFormCleanRationale('Pulizia agevole con sola acqua o normale risciacquo standard.');
                        }}
                        className={`py-1.5 px-2 rounded-lg text-center font-bold text-[11px] border transition-all ${
                          prodFormCleanCat === 1
                            ? 'bg-emerald-600/30 border-emerald-400 text-emerald-200 ring-1 ring-emerald-400'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        1 = Facile
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setProdFormCleanCat(2);
                          setProdFormCleanRationale('Richiede ciclo CIP standard con detergente neutro/alcalino.');
                        }}
                        className={`py-1.5 px-2 rounded-lg text-center font-bold text-[11px] border transition-all ${
                          prodFormCleanCat === 2
                            ? 'bg-amber-600/30 border-amber-400 text-amber-200 ring-1 ring-amber-400'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        2 = Medio
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setProdFormCleanCat(3);
                          setProdFormCleanRationale('Residuo tenace / incrostazione / richiede riflusso prolungato di solvente.');
                        }}
                        className={`py-1.5 px-2 rounded-lg text-center font-bold text-[11px] border transition-all ${
                          prodFormCleanCat === 3
                            ? 'bg-rose-600/30 border-rose-400 text-rose-200 ring-1 ring-rose-400'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        3 = Difficile
                      </button>
                    </div>
                    <input
                      type="text"
                      value={prodFormCleanRationale}
                      onChange={(e) => setProdFormCleanRationale(e.target.value)}
                      placeholder="Razionale scientifico da interviste operatori..."
                      className="w-full mt-1 px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-300 text-[11px] focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  {/* CRITERION B: SOLUBILITY */}
                  <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-slate-200 block font-semibold text-xs">
                        b) Solubilità nel Solvente (USP 24):
                      </label>
                      <span className="text-[10px] text-purple-300 font-mono">
                        {activeMatrix.cleaningClass}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setProdFormSolGroup(1);
                          setProdFormSolDesc('Molto/facilmente solubile (<10 parti di solvente per parte di soluto)');
                        }}
                        className={`py-1.5 px-2 rounded-lg text-center font-bold text-[11px] border transition-all ${
                          prodFormSolGroup === 1
                            ? 'bg-blue-600/30 border-blue-400 text-blue-200 ring-1 ring-blue-400'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Grp 1: Solubile
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setProdFormSolGroup(2);
                          setProdFormSolDesc('Solubile / poco solubile (10-100 parti di solvente per parte di soluto)');
                        }}
                        className={`py-1.5 px-2 rounded-lg text-center font-bold text-[11px] border transition-all ${
                          prodFormSolGroup === 2
                            ? 'bg-amber-600/30 border-amber-400 text-amber-200 ring-1 ring-amber-400'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Grp 2: Moderato
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setProdFormSolGroup(3);
                          setProdFormSolDesc('Scarsamente / praticamente insolubile (>100 parti di solvente per parte di soluto)');
                        }}
                        className={`py-1.5 px-2 rounded-lg text-center font-bold text-[11px] border transition-all ${
                          prodFormSolGroup === 3
                            ? 'bg-rose-600/30 border-rose-400 text-rose-200 ring-1 ring-rose-400'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Grp 3: Insolubile
                      </button>
                    </div>
                    <input
                      type="text"
                      value={prodFormSolDesc}
                      onChange={(e) => setProdFormSolDesc(e.target.value)}
                      placeholder="Descrizione solubilità nel solvente della matrice..."
                      className="w-full mt-1 px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-300 text-[11px] focus:outline-none focus:border-blue-400"
                    />
                  </div>

                  {/* CRITERION C: ADE / PDE */}
                  <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-slate-200 block font-semibold text-xs">
                        c) Limite Tossicologico ADE o PDE:
                      </label>
                      <span className="text-[10px] text-teal-300 font-mono">
                        = {(prodFormPdeUg / 1000).toFixed(4)} mg/die
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        step="any"
                        min="0.0001"
                        value={prodFormPdeUg}
                        onChange={(e) => handlePdeUgChange(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono font-bold focus:outline-none focus:border-teal-400"
                      />
                      <span className="text-slate-400 font-mono text-xs">µg/die</span>
                    </div>
                    <div className="flex items-center justify-between pt-0.5">
                      <span className="text-[11px] text-slate-400">Classificazione APIC:</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-950/60 text-teal-300 border border-teal-800">
                        Gruppo {prodFormPdeGroup} (
                        {prodFormPdeGroup === 1
                          ? '> 500 µg'
                          : prodFormPdeGroup === 2
                          ? '100 - 500 µg'
                          : prodFormPdeGroup === 3
                          ? '10 - 99 µg'
                          : prodFormPdeGroup === 4
                          ? '1 - 9 µg'
                          : '< 1 µg'}
                        )
                      </span>
                    </div>
                  </div>

                  {/* CRITERION D: SMALLEST DOSE (TDD) */}
                  <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-slate-200 block font-semibold text-xs">
                        d) Dose Minima Terapeutica (TDD):
                      </label>
                      <span className="text-[10px] text-emerald-300 font-mono">mg/die</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        step="any"
                        min="0.001"
                        value={prodFormMinDoseMg}
                        onChange={(e) => handleMinDoseChange(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono font-bold focus:outline-none focus:border-emerald-400"
                      />
                      <span className="text-slate-400 font-mono text-xs">mg</span>
                    </div>
                    <div className="flex items-center justify-between pt-0.5">
                      <span className="text-[11px] text-slate-400">Classificazione APIC:</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-800">
                        Gruppo {prodFormDoseGroup} (
                        {prodFormDoseGroup === 1
                          ? '> 1 000 mg'
                          : prodFormDoseGroup === 2
                          ? '100 - 1 000 mg'
                          : prodFormDoseGroup === 3
                          ? '10 - 99 mg'
                          : prodFormDoseGroup === 4
                          ? '1 - 9 mg'
                          : '< 1 mg'}
                        )
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 3: Parametri quando il Prodotto funge da Successivo (B) */}
              <div className="bg-slate-850 p-4 rounded-xl border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-300 uppercase tracking-wider block">
                    3. Parametri quando il Prodotto funge da Successivo (B)
                  </span>
                  <span className="text-[10px] text-slate-400">Necessari per il calcolo carryover MACO</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-300 block mb-1">
                      Dimensione Minima Lotto B (<strong>MBS</strong> in kg):
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      value={prodFormBatchSizeKg}
                      onChange={(e) => setProdFormBatchSizeKg(parseFloat(e.target.value) || 1)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-blue-400"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 block mb-1">
                      Dose Massima Giornaliera B (<strong>MDD</strong> in mg/die):
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.1"
                      value={prodFormMaxDoseMg}
                      onChange={(e) => setProdFormMaxDoseMg(parseFloat(e.target.value) || 1)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-blue-400"
                    />
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddEditProductModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-lg shadow-purple-600/30 transition-all hover:scale-[1.01]"
                >
                  {editingProduct ? 'Salva Modifiche' : 'Aggiungi alla Matrice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Database Support Search Modal */}
      {isDbImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl text-slate-100 overflow-hidden my-8">
            <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-850">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <Database className="w-4 h-4 text-teal-400" />
                  <span>Supporto Tossicologico: Cerca nel Database Globale</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Seleziona una molecola o intermedio per importare PDE, CAS, dose e pulibilità nella Matrice {activeMatrix.matrixIndex} ({activeMatrix.trainId})
                </p>
              </div>
              <button
                onClick={() => setIsDbImportModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Cerca per nome API, CAS, produttore o intermedio..."
                  value={dbSearchTerm}
                  onChange={(e) => setDbSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="max-h-96 overflow-y-auto space-y-2 divide-y divide-slate-800 text-xs">
                {compounds
                  .filter((c) => {
                    const q = dbSearchTerm.toLowerCase();
                    return (
                      !q ||
                      c.name.toLowerCase().includes(q) ||
                      c.chemicalName.toLowerCase().includes(q) ||
                      c.casNumber.toLowerCase().includes(q) ||
                      c.primaryManufacturers.some((m) => m.toLowerCase().includes(q)) ||
                      c.intermediates.some((i) => i.code.toLowerCase().includes(q) || i.name.toLowerCase().includes(q))
                    );
                  })
                  .slice(0, 15)
                  .map((compound) => (
                    <div key={compound.id} className="pt-2 pb-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-white text-sm">{compound.name}</span>
                          <span className="ml-2 font-mono text-[11px] text-teal-300">CAS: {compound.casNumber}</span>
                          <span className="ml-2 px-1.5 py-0.2 rounded text-[10px] bg-slate-800 text-amber-300">
                            {compound.category}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1.5">
                          <button
                            onClick={() => handleImportFromDatabase(compound, undefined, 'fill-form')}
                            className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                            title="Carica tutti i valori nel modulo di inserimento per poterli controllare o personalizzare"
                          >
                            Compila nel Modulo
                          </button>
                          <button
                            onClick={() => handleImportFromDatabase(compound, undefined, 'direct-add')}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition-colors"
                            title="Aggiungi subito alla matrice attiva con i valori predefiniti"
                          >
                            Aggiungi Diretto
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 text-[11px] text-slate-400">
                        <span>PDE: <strong className="text-white font-mono">{compound.pdeUgDay} µg/die</strong></span>
                        <span>•</span>
                        <span>Dose Min: <strong className="text-white font-mono">{compound.minDailyDoseMg} mg</strong></span>
                        <span>•</span>
                        <span>Produttori: {compound.primaryManufacturers.join(', ')}</span>
                      </div>

                      {/* Intermediates */}
                      {compound.intermediates.length > 0 && (
                        <div className="pl-4 pt-1 space-y-1">
                          <span className="text-[10px] text-indigo-300 font-semibold block">
                            Intermedi di Sintesi Disponibili:
                          </span>
                          {compound.intermediates.map((inter) => (
                            <div
                              key={inter.id}
                              className="flex items-center justify-between p-1.5 bg-slate-800/60 rounded-lg text-[11px]"
                            >
                              <div className="flex items-center space-x-2">
                                <span className="font-mono text-indigo-300 font-bold">{inter.code}</span>
                                <span className="text-slate-300">{inter.name}</span>
                                <span className="text-[10px] text-slate-500">({inter.stage})</span>
                              </div>
                              <div className="flex items-center space-x-1.5">
                                <button
                                  onClick={() => handleImportFromDatabase(compound, inter, 'fill-form')}
                                  className="px-2 py-0.5 bg-purple-700 hover:bg-purple-600 text-white rounded text-[10px] font-semibold transition-colors"
                                  title="Carica l'intermedio nel modulo per rivederlo"
                                >
                                  Compila Modulo
                                </button>
                                <button
                                  onClick={() => handleImportFromDatabase(compound, inter, 'direct-add')}
                                  className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-medium border border-slate-700 transition-colors"
                                  title="Aggiungi subito l'intermedio alla matrice attiva"
                                >
                                  Aggiungi
                                </button>
                              </div>
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

      {/* MODAL 3: Configure Active Equipment Train Parameters */}
      {isEditTrainModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl text-slate-100 overflow-hidden my-8">
            <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-850">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Settings className="w-4 h-4 text-purple-400" />
                <span>Configurazione Treno Impianto & Cleaning Class (Matrice {activeMatrix.matrixIndex})</span>
              </h3>
              <button
                onClick={() => setIsEditTrainModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTrainConfig} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Identificativo Treno *:</label>
                  <input
                    type="text"
                    required
                    value={trainFormTrainId}
                    onChange={(e) => setTrainFormTrainId(e.target.value)}
                    placeholder="es. A-Train, B-Train, C-Train"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-bold focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Cleaning Class (APIC Capitolo 7):</label>
                  <select
                    value={trainFormClass}
                    onChange={(e) => {
                      const nextClass = e.target.value as CleaningClass;
                      setTrainFormClass(nextClass);
                      const def = DEFAULT_CLEANING_CLASSES.find((c) => c.classId === nextClass);
                      if (def) setTrainFormSolvent(def.defaultSolvent);
                    }}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-bold focus:outline-none focus:border-purple-500"
                  >
                    <option value="Class I">Class I (Water soluble substances)</option>
                    <option value="Class II">Class II (Methanol soluble substances)</option>
                    <option value="Class III">Class III (Acetone soluble substances)</option>
                    <option value="Class IV">Class IV (Separate class for special substances)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Denominazione Linea / Reparto:</label>
                <input
                  type="text"
                  value={trainFormName}
                  onChange={(e) => setTrainFormName(e.target.value)}
                  placeholder="es. Linea Sintesi Polifunzionale Reattori R-101 / R-105"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Note Solvente di Pulizia Convalidato:</label>
                <input
                  type="text"
                  value={trainFormSolvent}
                  onChange={(e) => setTrainFormSolvent(e.target.value)}
                  placeholder="es. Acqua Purificata WFI a 65°C / Metanolo tecnico"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <div>
                  <label className="text-slate-300 block mb-1">Superficie (m²):</label>
                  <input
                    type="number"
                    step="any"
                    min="0.1"
                    value={trainFormArea}
                    onChange={(e) => setTrainFormArea(parseFloat(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">Dima Swab (cm²):</label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    value={trainFormSwabArea}
                    onChange={(e) => setTrainFormSwabArea(parseFloat(e.target.value) || 25)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">Recupero (%):</label>
                  <input
                    type="number"
                    step="any"
                    min="10"
                    max="100"
                    value={trainFormRecovery}
                    onChange={(e) => setTrainFormRecovery(parseFloat(e.target.value) || 85)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">Volume Rinse (L):</label>
                  <input
                    type="number"
                    step="any"
                    min="10"
                    value={trainFormRinseVol}
                    onChange={(e) => setTrainFormRinseVol(parseFloat(e.target.value) || 500)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                {matrices.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditTrainModalOpen(false);
                      promptDeleteMatrix(activeMatrixIndex);
                    }}
                    className="px-3 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/40 text-xs font-semibold flex items-center space-x-1.5 transition-colors"
                    title={`Elimina la Matrice ${activeMatrix.matrixIndex}`}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>Elimina Matrice</span>
                  </button>
                ) : (
                  <div></div>
                )}
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsEditTrainModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition-colors"
                  >
                    Salva Parametri Treno
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Matrix Report Export Modal (PDF / Excel / Google Sheets / CSV) */}
      <MatrixExportReportModal
        isOpen={isExportReportModalOpen}
        onClose={() => setIsExportReportModalOpen(false)}
        matrix={activeMatrix}
        totalMatricesCount={matrices.length}
      />

      {/* MODAL 5: Central In-App Delete Confirmation Modal (solves sandbox iframe blocking) */}
      {deleteConfirmation.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-slate-900 border-2 border-rose-500/50 rounded-2xl shadow-2xl p-6 text-slate-100 space-y-4">
            <div className="flex items-start space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-white tracking-tight">
                  {deleteConfirmation.title}
                </h3>
                <p className="text-xs text-slate-300 mt-1 font-medium leading-relaxed">
                  {deleteConfirmation.message}
                </p>
                {deleteConfirmation.details && (
                  <p className="text-[11px] text-slate-400 mt-2.5 bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                    {deleteConfirmation.details}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteConfirmation((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleExecuteDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/30 transition-colors flex items-center space-x-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deleteConfirmation.confirmButtonText}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
