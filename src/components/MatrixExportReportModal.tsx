import React, { useState } from 'react';
import {
  FacilityMatrixTrain,
  MatrixProductItem,
} from '../types/apic';
import { evaluateAllMatrixCombinations } from '../utils/apicCalculations';
import {
  generateMatrixCsv,
  generateMatrixTsvForGoogleSheets,
  generateMatrixExcelXml,
  downloadFile,
} from '../utils/matrixExport';
import {
  X,
  FileText,
  Printer,
  Download,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Layers,
  FileSpreadsheet,
  Share2,
} from 'lucide-react';

interface MatrixExportReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  matrix: FacilityMatrixTrain;
  totalMatricesCount: number;
}

export const MatrixExportReportModal: React.FC<MatrixExportReportModalProps> = ({
  isOpen,
  onClose,
  matrix,
  totalMatricesCount,
}) => {
  const [activeFormat, setActiveFormat] = useState<'pdf' | 'excel' | 'sheets' | 'csv'>('pdf');
  const [copiedSheets, setCopiedSheets] = useState(false);
  const [copiedCsv, setCopiedCsv] = useState(false);
  const [reportSignDate, setReportSignDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  if (!isOpen) return null;

  const evaluation = evaluateAllMatrixCombinations(matrix.products, {
    sharedSurfaceAreaM2: matrix.sharedSurfaceAreaM2,
    swabAreaCm2: matrix.swabAreaCm2,
    swabRecoveryPercent: matrix.swabRecoveryPercent,
    rinseVolumeLiters: matrix.rinseVolumeLiters,
  });

  const currentDateFormatted = new Date().toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadCsv = () => {
    const csv = generateMatrixCsv(matrix, totalMatricesCount);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `APIC_Matrice_${matrix.trainId}_${matrix.cleaningClass.replace(/\s+/g, '_')}_${dateStr}.csv`;
    downloadFile(csv, filename, 'text/csv;charset=utf-8;');
  };

  const handleDownloadExcel = () => {
    const xml = generateMatrixExcelXml(matrix, totalMatricesCount);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `APIC_Matrice_${matrix.trainId}_Excel_${dateStr}.xml`;
    downloadFile(xml, filename, 'application/vnd.ms-excel;charset=utf-8;');
  };

  const handleCopyForGoogleSheets = () => {
    const tsv = generateMatrixTsvForGoogleSheets(matrix, totalMatricesCount);
    navigator.clipboard.writeText(tsv).then(() => {
      setCopiedSheets(true);
      setTimeout(() => setCopiedSheets(false), 3000);
    });
  };

  const handleCopyRawCsv = () => {
    const csv = generateMatrixCsv(matrix, totalMatricesCount);
    navigator.clipboard.writeText(csv).then(() => {
      setCopiedCsv(true);
      setTimeout(() => setCopiedCsv(false), 3000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      {/* Container */}
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden text-slate-100">
        
        {/* Top Header - No print */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 no-print">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center font-bold">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-black text-white">
                  Esporta Report Matrice Impianto & Worst-Case
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {matrix.trainId}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Genera report PDF / Stampa GMP, esporta in Excel, CSV o copia per Google Sheets
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Format Selector Bar - No print */}
        <div className="px-4 py-3 bg-slate-800/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 no-print">
          <div className="flex items-center space-x-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-700/70 text-xs">
            <button
              onClick={() => setActiveFormat('pdf')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                activeFormat === 'pdf'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Report PDF / Stampa GMP</span>
            </button>

            <button
              onClick={() => setActiveFormat('excel')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                activeFormat === 'excel'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Excel Dinamico con Formule (.xml)</span>
            </button>

            <button
              onClick={() => setActiveFormat('sheets')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                activeFormat === 'sheets'
                  ? 'bg-teal-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Google Sheets (TSV / Import)</span>
            </button>

            <button
              onClick={() => setActiveFormat('csv')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                activeFormat === 'csv'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>CSV Standard (UTF-8 BOM)</span>
            </button>
          </div>

          {/* Quick Action Button for the selected format */}
          <div className="flex items-center space-x-2">
            {activeFormat === 'pdf' && (
              <button
                onClick={handlePrint}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md shadow-purple-600/20"
              >
                <Printer className="w-4 h-4" />
                <span>Stampa / Salva come PDF</span>
              </button>
            )}

            {activeFormat === 'excel' && (
              <button
                onClick={handleDownloadExcel}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 hover:scale-[1.02]"
              >
                <Download className="w-4 h-4" />
                <span>Scarica Excel Dinamico (.xml)</span>
              </button>
            )}

            {activeFormat === 'sheets' && (
              <button
                onClick={handleCopyForGoogleSheets}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-all shadow-md shadow-teal-600/20"
              >
                {copiedSheets ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedSheets ? 'Copiato per Google Sheets!' : 'Copia per Google Sheets'}</span>
              </button>
            )}

            {activeFormat === 'csv' && (
              <button
                onClick={handleDownloadCsv}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/20"
              >
                <Download className="w-4 h-4" />
                <span>Scarica File CSV</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal Body / Report Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* Active Format Specific Instructions Header (No Print) */}
          <div className="no-print bg-slate-950/50 border border-slate-800 p-3.5 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {activeFormat === 'pdf' && (
              <div className="flex items-center space-x-2 text-slate-300">
                <Printer className="w-4 h-4 text-purple-400 shrink-0" />
                <span>
                  <strong>Report PDF:</strong> Utilizza il pulsante <strong>&quot;Stampa / Salva come PDF&quot;</strong> per stampare o salvare direttamente in PDF con layout GMP approvato.
                </span>
              </div>
            )}

            {activeFormat === 'excel' && (
              <div className="flex items-center space-x-2 text-slate-300">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  <strong>File Excel Dinamico (.xml):</strong> Include formule matematiche native (<code>=MIN(...)</code>, <code>=HBEL</code>, <code>=Swab Limit</code>, <code>=Rinse Limit</code>) e celle di input modificabili per simulazioni What-If istantanee in Microsoft Excel / LibreOffice.
                </span>
              </div>
            )}

            {activeFormat === 'sheets' && (
              <div className="flex items-center space-x-2 text-slate-300">
                <Share2 className="w-4 h-4 text-teal-400 shrink-0" />
                <span>
                  <strong>Google Sheets:</strong> Clicca &quot;Copia per Google Sheets&quot; e incolla direttamente con <strong>Ctrl+V</strong> in un nuovo foglio.
                </span>
              </div>
            )}

            {activeFormat === 'csv' && (
              <div className="flex items-center space-x-2 text-slate-300">
                <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                <span>
                  <strong>CSV Standard:</strong> Dotato di marcatore UTF-8 BOM e delimitatore &quot;;&quot; per compatibilità diretta con Excel europeo.
                </span>
              </div>
            )}

            {activeFormat === 'sheets' && (
              <a
                href="https://sheets.new"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-teal-950/60 hover:bg-teal-900/60 text-teal-300 border border-teal-500/30 font-semibold transition-colors shrink-0"
              >
                <span>Apri sheets.new</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          {/* PRINTABLE GMP REPORT VIEW (Rendered for both screen preview and @media print) */}
          <div
            id="gmp-matrix-printable-report"
            className="bg-white text-slate-900 p-6 sm:p-8 rounded-xl shadow-lg border border-slate-200 text-xs font-sans print:p-0 print:border-none print:shadow-none"
          >
            {/* Header Documento GMP */}
            <div className="border-b-2 border-slate-900 pb-4 mb-4 flex justify-between items-start">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-purple-700 flex items-center space-x-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 inline text-purple-600" />
                  <span>Dossier Convalida Pulizia • Audit Trail Regolatorio (21 CFR Part 11 &amp; EU GMP Annex 11/15)</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
                  RAPPORTO MATRICE IMPIANTO &amp; AUDIT TRAIL WORST-CASE
                </h1>
                <p className="text-xs text-slate-600 mt-0.5">
                  Conforme a <strong>Guida APIC/CEFIC (2021) Sez. 7.0</strong> &amp; <strong>EMA GMP Annex 15 (Qualification and Validation)</strong>
                </p>
              </div>

              <div className="text-right text-[11px] text-slate-700 space-y-0.5 bg-slate-50 p-2 rounded border border-slate-200">
                <div><strong>Audit Trail ID:</strong> <span className="font-mono text-purple-900">AT-APIC-{matrix.trainId}-{new Date().toISOString().slice(0, 10).replace(/-/g, '')}</span></div>
                <div><strong>Data Emissione:</strong> {currentDateFormatted}</div>
                <div><strong>Doc Ref:</strong> CV-MAT-0{matrix.matrixIndex}-{matrix.trainId}</div>
                <div><strong>Stato:</strong> Convalidato QA Specialist</div>
              </div>
            </div>

            {/* Metadati Treno Impianto & Cleaning Class */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200 mb-5">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Identificativo Treno:</span>
                <span className="font-bold text-slate-900 text-sm">{matrix.trainId}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Denominazione:</span>
                <span className="font-semibold text-slate-800">{matrix.name}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Cleaning Class:</span>
                <span className="font-bold text-purple-700">{matrix.cleaningClass}</span>
                <span className="text-[10px] text-slate-500 block">{matrix.cleaningSolventNotes || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Superficie Condivisa:</span>
                <span className="font-bold text-slate-900">{matrix.sharedSurfaceAreaM2} m²</span>
                <span className="text-[10px] text-slate-500 block">({matrix.sharedSurfaceAreaM2 * 100} dm²)</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Dima Swab:</span>
                <span className="font-medium text-slate-800">{matrix.swabAreaCm2} cm²</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Recupero Analitico (WF):</span>
                <span className="font-medium text-slate-800">{matrix.swabRecoveryPercent}%</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Volume Risciacquo:</span>
                <span className="font-medium text-slate-800">{matrix.rinseVolumeLiters} L</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Soglia Visiva Standard:</span>
                <span className="font-medium text-slate-800">{matrix.visualLimitUgCm2} µg/cm²</span>
              </div>
            </div>

            {/* SEZIONE 1: WORST-CASE IDENTIFICATI (BANNER EVIDENZIATO) */}
            <div className="mb-5 border-2 border-rose-300 bg-rose-50/60 p-4 rounded-xl">
              <div className="flex items-center space-x-2 text-rose-800 font-black text-sm uppercase tracking-wide border-b border-rose-200 pb-2 mb-3">
                <ShieldCheck className="w-4 h-4 text-rose-600" />
                <span>1. Valutazione Worst-Case Identificati per il Protocollo di Pulizia</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Worst Residue */}
                <div className="bg-white p-3 rounded-lg border border-rose-200">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">
                    Peggior Residuo per Pulibilità &amp; Tossicità:
                  </span>
                  {evaluation.worstResidueProduct ? (
                    <div className="mt-1">
                      <div className="font-black text-slate-900 text-sm">
                        {evaluation.worstResidueProduct.name}
                      </div>
                      <div className="text-[11px] text-slate-600 mt-0.5 space-x-1">
                        <span>CAS: <strong>{evaluation.worstResidueProduct.casNumber || 'N/A'}</strong></span>
                        <span>•</span>
                        <span>Tipo: <strong>{evaluation.worstResidueProduct.type}</strong></span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] bg-slate-50 p-2 rounded border border-slate-100">
                        <div>Difficoltà (a): <strong>Cat {evaluation.worstResidueProduct.cleanabilityCategory}</strong></div>
                        <div>Solubilità (b): <strong>Grp {evaluation.worstResidueProduct.solubilityGroup}</strong></div>
                        <div>ADE/PDE (c): <strong>{evaluation.worstResidueProduct.pdeUgDay} µg (Grp {evaluation.worstResidueProduct.pdeGroup})</strong></div>
                        <div>Min Dose (d): <strong>{evaluation.worstResidueProduct.minDailyDoseMg} mg (Grp {evaluation.worstResidueProduct.doseGroup})</strong></div>
                      </div>
                    </div>
                  ) : (
                    <span className="text-slate-400 italic">Nessun prodotto presente nella matrice</span>
                  )}
                </div>

                {/* Worst Transition */}
                <div className="bg-white p-3 rounded-lg border border-rose-200">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">
                    Transizione Worst-Case Più Sfavorevole (MACO Minimo):
                  </span>
                  {evaluation.worstCaseCombination ? (
                    <div className="mt-1">
                      <div className="font-black text-rose-700 text-sm">
                        {evaluation.worstCaseCombination.fromProduct.name} &rarr; {evaluation.worstCaseCombination.toProduct.name}
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] bg-rose-50/40 p-2 rounded border border-rose-100 font-medium">
                        <div>MACO Selezionato: <strong className="text-rose-900">{evaluation.worstCaseCombination.macoSelectedMg} mg</strong></div>
                        <div>Criterio: <strong>{evaluation.worstCaseCombination.governingCriteria}</strong></div>
                        <div>Limite Swab: <strong>{evaluation.worstCaseCombination.swabLimitUgPerSwab} µg/tampone</strong></div>
                        <div>Limite Rinse: <strong>{evaluation.worstCaseCombination.rinseLimitMgL} ppm (mg/L)</strong></div>
                      </div>
                      <p className="text-[10px] text-slate-600 italic mt-2">
                        {evaluation.worstCaseCombination.scientificRationale}
                      </p>
                    </div>
                  ) : (
                    <span className="text-slate-400 italic">Inserire almeno 2 prodotti per calcolare la combinazione peggiore</span>
                  )}
                </div>
              </div>
            </div>

            {/* SEZIONE 2: TABELLA PRODOTTI E ASSEGNAZIONE RATING APIC */}
            <div className="mb-5">
              <h2 className="text-xs font-black uppercase tracking-wide text-slate-800 border-b border-slate-300 pb-1 mb-2">
                2. Prodotti Inseriti nella Matrice e Assegnazione Rating APIC (Criteri a, b, c, d)
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full text-[10px] border-collapse border border-slate-200">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 text-left">
                      <th className="p-1.5 border border-slate-200">Prodotto / Intermedio</th>
                      <th className="p-1.5 border border-slate-200">CAS</th>
                      <th className="p-1.5 border border-slate-200">Tipo</th>
                      <th className="p-1.5 border border-slate-200 text-center">Pulibilità (a)</th>
                      <th className="p-1.5 border border-slate-200 text-center">Solubilità (b)</th>
                      <th className="p-1.5 border border-slate-200 text-center">ADE/PDE (c)</th>
                      <th className="p-1.5 border border-slate-200 text-center">Dose (d)</th>
                      <th className="p-1.5 border border-slate-200 text-right">MBS (kg)</th>
                      <th className="p-1.5 border border-slate-200 text-right">MDD (mg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.products.map((p) => (
                      <tr key={p.id} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-1.5 border border-slate-200 font-bold text-slate-900">
                          {p.name}
                          {p.code && <span className="block text-[9px] text-slate-500 font-normal">{p.code}</span>}
                        </td>
                        <td className="p-1.5 border border-slate-200 font-mono text-[9px]">{p.casNumber || 'N/A'}</td>
                        <td className="p-1.5 border border-slate-200">{p.type}</td>
                        <td className="p-1.5 border border-slate-200 text-center">
                          <span className={`px-1 py-0.5 rounded font-bold ${
                            p.cleanabilityCategory === 3 ? 'bg-rose-100 text-rose-800' :
                            p.cleanabilityCategory === 2 ? 'bg-amber-100 text-amber-800' :
                            'bg-emerald-100 text-emerald-800'
                          }`}>
                            Cat {p.cleanabilityCategory}
                          </span>
                        </td>
                        <td className="p-1.5 border border-slate-200 text-center">
                          <span className="px-1 py-0.5 rounded bg-slate-100 text-slate-800 font-semibold">
                            Grp {p.solubilityGroup}
                          </span>
                        </td>
                        <td className="p-1.5 border border-slate-200 text-center">
                          <span className="font-bold text-slate-900">{p.pdeUgDay} µg</span>
                          <span className="block text-[9px] text-slate-500">Grp {p.pdeGroup}</span>
                        </td>
                        <td className="p-1.5 border border-slate-200 text-center">
                          <span className="font-bold text-slate-900">{p.minDailyDoseMg} mg</span>
                          <span className="block text-[9px] text-slate-500">Grp {p.doseGroup}</span>
                        </td>
                        <td className="p-1.5 border border-slate-200 text-right font-mono">{p.minBatchSizeKg}</td>
                        <td className="p-1.5 border border-slate-200 text-right font-mono">{p.maxDailyDoseMg}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SEZIONE 3: MATRICE COMBINATORIA CROSS-CARRYOVER (A -> B) */}
            <div className="mb-5">
              <h2 className="text-xs font-black uppercase tracking-wide text-slate-800 border-b border-slate-300 pb-1 mb-2">
                3. Matrice Completa Combinazioni Cross-Carryover ($A \rightarrow B$) e Valori MACO
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full text-[10px] border-collapse border border-slate-200">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 text-left">
                      <th className="p-1.5 border border-slate-200">Precedente A</th>
                      <th className="p-1.5 border border-slate-200">Successivo B</th>
                      <th className="p-1.5 border border-slate-200 text-right">MACO PDE (mg)</th>
                      <th className="p-1.5 border border-slate-200 text-right">MACO Dose (mg)</th>
                      <th className="p-1.5 border border-slate-200 text-right">MACO 10ppm (mg)</th>
                      <th className="p-1.5 border border-slate-200 text-right">MACO Finale (mg)</th>
                      <th className="p-1.5 border border-slate-200">Criterio Governatore</th>
                      <th className="p-1.5 border border-slate-200 text-right">Swab (µg/swab)</th>
                      <th className="p-1.5 border border-slate-200 text-right">Rinse (ppm)</th>
                      <th className="p-1.5 border border-slate-200 text-center">Stato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evaluation.combinations.map((c, i) => (
                      <tr
                        key={i}
                        className={`border-b border-slate-200 ${
                          c.isWorstCase ? 'bg-rose-100/70 font-bold text-rose-950' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="p-1.5 border border-slate-200 font-medium">{c.fromProduct.name}</td>
                        <td className="p-1.5 border border-slate-200 font-medium">{c.toProduct.name}</td>
                        <td className="p-1.5 border border-slate-200 text-right font-mono">{c.macoPdeMg}</td>
                        <td className="p-1.5 border border-slate-200 text-right font-mono">{c.macoDoseMg}</td>
                        <td className="p-1.5 border border-slate-200 text-right font-mono">{c.maco10PpmMg}</td>
                        <td className="p-1.5 border border-slate-200 text-right font-mono font-bold text-slate-900">
                          {c.macoSelectedMg}
                        </td>
                        <td className="p-1.5 border border-slate-200 text-[9px]">{c.governingCriteria}</td>
                        <td className="p-1.5 border border-slate-200 text-right font-mono">{c.swabLimitUgPerSwab}</td>
                        <td className="p-1.5 border border-slate-200 text-right font-mono">{c.rinseLimitMgL}</td>
                        <td className="p-1.5 border border-slate-200 text-center">
                          {c.isWorstCase ? (
                            <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[9px] font-black uppercase">
                              Worst Case
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[9px]">Standard</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SEZIONE 4: BLOCCO FIRME E APPROVAZIONI GMP */}
            <div className="border-t-2 border-slate-900 pt-4 mt-6">
              <div className="text-[11px] font-bold text-slate-800 uppercase tracking-wide mb-3">
                4. Approvazioni Ufficiali del Protocollo di Convalida Pulizia (Good Manufacturing Practice)
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-[10px]">
                <div className="border border-slate-300 p-3 rounded bg-slate-50">
                  <div className="font-bold text-slate-800 uppercase">Redatto da:</div>
                  <div className="text-slate-500 mt-1">QA Validation Specialist</div>
                  <div className="border-b border-slate-400 mt-6 mb-1"></div>
                  <div className="flex justify-between text-[9px] text-slate-500">
                    <span>Firma</span>
                    <span>Data: {reportSignDate}</span>
                  </div>
                </div>

                <div className="border border-slate-300 p-3 rounded bg-slate-50">
                  <div className="font-bold text-slate-800 uppercase">Verificato da:</div>
                  <div className="text-slate-500 mt-1">Responsabile Produzione / Impianti</div>
                  <div className="border-b border-slate-400 mt-6 mb-1"></div>
                  <div className="flex justify-between text-[9px] text-slate-500">
                    <span>Firma</span>
                    <span>Data: {reportSignDate}</span>
                  </div>
                </div>

                <div className="border border-slate-300 p-3 rounded bg-slate-50">
                  <div className="font-bold text-slate-800 uppercase">Approvato da:</div>
                  <div className="text-slate-500 mt-1">Qualified Person / Direttore QA</div>
                  <div className="border-b border-slate-400 mt-6 mb-1"></div>
                  <div className="flex justify-between text-[9px] text-slate-500">
                    <span>Firma</span>
                    <span>Data: {reportSignDate}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* Modal Footer - No print */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 no-print">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-purple-400" />
            <span>Report generato conforme a Guida APIC Capitolo 7.0 &amp; EMA GMP Annex 15</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors"
            >
              Chiudi
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-colors flex items-center space-x-1.5 shadow-md shadow-purple-600/20"
            >
              <Printer className="w-4 h-4" />
              <span>Stampa / Salva in PDF</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
