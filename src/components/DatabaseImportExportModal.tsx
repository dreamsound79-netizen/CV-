import React, { useState, useRef } from 'react';
import { PharmaceuticalCompound } from '../types/apic';
import {
  importDatabaseFile,
  generateTemplates,
  exportDatabaseToExcel,
  exportDatabaseToSql,
  ParseResult,
} from '../utils/databaseImporter';
import {
  X,
  Upload,
  FileSpreadsheet,
  Database,
  FileCode,
  Download,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Layers,
  HelpCircle,
} from 'lucide-react';

interface DatabaseImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  compounds: PharmaceuticalCompound[];
  onImportSuccess: (imported: PharmaceuticalCompound[], mode: 'merge' | 'replace') => void;
}

export const DatabaseImportExportModal: React.FC<DatabaseImportExportModalProps> = ({
  isOpen,
  onClose,
  compounds,
  onImportSuccess,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'import' | 'export' | 'standalone'>('import');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const processFile = async (file: File) => {
    setSelectedFile(file);
    setIsParsing(true);
    setParseResult(null);
    try {
      const result = await importDatabaseFile(file);
      setParseResult(result);
    } catch (err: any) {
      setParseResult({
        compounds: [],
        errors: [`Errore durante la lettura del file: ${err.message}`],
        warnings: [],
        format: 'csv',
        totalRows: 0,
      });
    } finally {
      setIsParsing(false);
    }
  };

  const handleExecuteImport = () => {
    if (!parseResult || parseResult.compounds.length === 0) return;
    onImportSuccess(parseResult.compounds, importMode);
    onClose();
  };

  // Download sample templates
  const handleDownloadTemplate = (format: 'excel' | 'csv' | 'sql') => {
    const templates = generateTemplates();

    if (format === 'excel') {
      const blob = new Blob([templates.excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      triggerDownload(blob, 'APIC_Template_Database_Import.xlsx');
    } else if (format === 'csv') {
      const blob = new Blob([templates.csvLines], { type: 'text/csv;charset=utf-8' });
      triggerDownload(blob, 'APIC_Template_Database_Import.csv');
    } else if (format === 'sql') {
      const blob = new Blob([templates.sqlLines], { type: 'application/sql;charset=utf-8' });
      triggerDownload(blob, 'APIC_Template_Database_Import.sql');
    }
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export full JSON
  const handleExportJson = () => {
    const dataStr = JSON.stringify(compounds, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    triggerDownload(blob, `APIC_Database_Backup_${new Date().toISOString().slice(0, 10)}.json`);
  };

  // Standalone HTML Download
  const handleDownloadStandaloneHtml = () => {
    const link = document.createElement('a');
    link.href = '/apic-cleaning-validation-standalone.html';
    link.download = 'APIC-Cleaning-Validation-Standalone.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl text-slate-100 overflow-hidden my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                Database Manager
              </span>
              <span className="text-xs text-slate-400">Excel • SQL • CSV • Singolo File HTML</span>
            </div>
            <h2 className="text-xl font-bold text-white mt-1">Gestione & Caricamento Database Esterni</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="flex border-b border-slate-800 bg-slate-900/60 px-6 pt-2">
          <button
            onClick={() => setActiveSubTab('import')}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              activeSubTab === 'import'
                ? 'border-teal-400 text-teal-300 bg-slate-800/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Carica Intero Database (Excel / SQL / CSV)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('export')}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              activeSubTab === 'export'
                ? 'border-teal-400 text-teal-300 bg-slate-800/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Esporta Database Completo</span>
          </button>

          <button
            onClick={() => setActiveSubTab('standalone')}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              activeSubTab === 'standalone'
                ? 'border-indigo-400 text-indigo-300 bg-slate-800/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-4 h-4 text-indigo-400" />
            <span>Singolo File HTML Standalone (.html)</span>
          </button>
        </div>

        {/* Tab 1: Import */}
        {activeSubTab === 'import' && (
          <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-xs">
            {/* Drag & Drop Area */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-teal-500/70 bg-slate-800/40 hover:bg-slate-800/70 rounded-2xl p-8 text-center cursor-pointer transition-all space-y-3"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.tsv,.sql,.json"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-400 flex items-center justify-center mx-auto border border-teal-500/20">
                <Upload className="w-6 h-6" />
              </div>

              <div>
                <span className="text-sm font-bold text-white block">
                  Trascina qui il file del database o clicca per sfogliare
                </span>
                <span className="text-xs text-slate-400 block mt-1">
                  Formati supportati: Microsoft Excel (<strong>.xlsx, .xls</strong>), Script SQL con INSERT (<strong>.sql</strong>), Tabelle CSV delimitati (<strong>.csv, .tsv</strong>), o Dump JSON (<strong>.json</strong>)
                </span>
              </div>

              {selectedFile && (
                <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-teal-950/80 text-teal-300 border border-teal-700/50 text-xs font-mono font-medium">
                  <FileText className="w-4 h-4" />
                  <span>{selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                </div>
              )}
            </div>

            {/* Parsing feedback & preview */}
            {isParsing && (
              <div className="p-4 bg-slate-800 rounded-xl text-center text-slate-300 flex items-center justify-center space-x-2">
                <RefreshCw className="w-4 h-4 animate-spin text-teal-400" />
                <span>Analisi e mappatura del file in corso...</span>
              </div>
            )}

            {parseResult && (
              <div className="space-y-4">
                {/* Result header */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-800/80 rounded-xl border border-slate-700">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-teal-500 text-slate-950">
                      Formato Riconosciuto: {parseResult.format.toUpperCase()}
                    </span>
                    <span className="text-xs text-slate-300 font-medium">
                      Righe Totali: <strong>{parseResult.totalRows}</strong>
                    </span>
                    <span className="text-xs text-teal-400 font-bold">
                      • {parseResult.compounds.length} Principi Attivi Mappati
                    </span>
                  </div>

                  {/* Mode choice */}
                  <div className="flex items-center space-x-2">
                    <label className="text-xs text-slate-300 font-semibold">Modalità di Caricamento:</label>
                    <select
                      value={importMode}
                      onChange={(e) => setImportMode(e.target.value as 'merge' | 'replace')}
                      className="px-3 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none"
                    >
                      <option value="merge">Unisci al Database Attuale (Merge)</option>
                      <option value="replace">Sostituisci Intero Database (Replace All)</option>
                    </select>
                  </div>
                </div>

                {/* Errors display */}
                {parseResult.errors.length > 0 && (
                  <div className="p-3.5 bg-rose-950/30 border border-rose-500/40 rounded-xl text-rose-300 text-xs space-y-1">
                    <span className="font-bold block flex items-center space-x-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                      <span>Avvisi / Anomalie riscontrate ({parseResult.errors.length})</span>
                    </span>
                    <ul className="list-disc list-inside space-y-0.5 text-[11px] text-rose-200">
                      {parseResult.errors.slice(0, 3).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                      {parseResult.errors.length > 3 && (
                        <li>...e altri {parseResult.errors.length - 3} errori non bloccanti</li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Preview Table */}
                {parseResult.compounds.length > 0 && (
                  <div className="space-y-2">
                    <span className="font-semibold text-slate-300 block">
                      Anteprima primi 5 record estratti dal file:
                    </span>
                    <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-950">
                      <table className="w-full text-left text-[11px] text-slate-300">
                        <thead className="bg-slate-800 text-slate-400 font-semibold uppercase">
                          <tr>
                            <th className="py-2 px-3">Nome API</th>
                            <th className="py-2 px-3">CAS</th>
                            <th className="py-2 px-3">Categoria</th>
                            <th className="py-2 px-3">OEB</th>
                            <th className="py-2 px-3">PDE (mg/d)</th>
                            <th className="py-2 px-3">Dose Min (mg)</th>
                            <th className="py-2 px-3">Produttori</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {parseResult.compounds.slice(0, 5).map((c) => (
                            <tr key={c.id}>
                              <td className="py-2 px-3 font-bold text-white">{c.name}</td>
                              <td className="py-2 px-3 font-mono">{c.casNumber}</td>
                              <td className="py-2 px-3">{c.category}</td>
                              <td className="py-2 px-3 font-semibold text-teal-300">{c.oeb}</td>
                              <td className="py-2 px-3 font-mono font-bold text-teal-400">{c.pdeMgDay}</td>
                              <td className="py-2 px-3 font-mono">{c.minDailyDoseMg}</td>
                              <td className="py-2 px-3 text-slate-400 truncate max-w-xs">{c.primaryManufacturers.join(', ')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Execute Import Button */}
                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={handleExecuteImport}
                        className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-lg transition-colors"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Conferma e Importa {parseResult.compounds.length} Principi Attivi</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Template Download Section */}
            <div className="pt-4 border-t border-slate-800 space-y-2">
              <span className="font-bold text-slate-300 block uppercase tracking-wider text-[11px]">
                Modelli e Template di Esempio da Scaricare:
              </span>
              <p className="text-slate-400 text-[11px]">
                Se desideri preparare o formattare i tuoi dati, scarica i modelli precompilati con intestazioni conformi:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleDownloadTemplate('excel')}
                  className="flex items-center justify-center space-x-2 p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>Template Excel (.xlsx)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadTemplate('csv')}
                  className="flex items-center justify-center space-x-2 p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium transition-colors"
                >
                  <FileText className="w-4 h-4 text-blue-400" />
                  <span>Template CSV (.csv)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadTemplate('sql')}
                  className="flex items-center justify-center space-x-2 p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium transition-colors"
                >
                  <Database className="w-4 h-4 text-amber-400" />
                  <span>Template Script SQL (.sql)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Export */}
        {activeSubTab === 'export' && (
          <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-xs">
            <div>
              <h3 className="text-sm font-bold text-white">Esportazione Database Completo ({compounds.length} Composti)</h3>
              <p className="text-slate-400 mt-1">
                Scarica l&apos;intero catalogo precaricato e personalizzato con tutti i valori tossicologici, dosi,
                profili CIP e albero degli intermedi sintetici.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Excel Export */}
              <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700 space-y-3">
                <div className="flex items-center space-x-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                  <span className="font-bold text-white text-sm">Microsoft Excel (.xlsx)</span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Foglio elettronico strutturato con tutte le 21 colonne tossicologiche e dettagli intermedi espansi.
                </p>
                <button
                  onClick={() => exportDatabaseToExcel(compounds)}
                  className="w-full flex items-center justify-center space-x-2 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Esporta in Excel (.xlsx)</span>
                </button>
              </div>

              {/* SQL Export */}
              <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700 space-y-3">
                <div className="flex items-center space-x-2">
                  <Database className="w-5 h-5 text-amber-400" />
                  <span className="font-bold text-white text-sm">Script SQL Completo (.sql)</span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Script con istruzioni <code>CREATE TABLE</code> e <code>INSERT INTO</code> per PostgreSQL, MySQL o SQLite.
                </p>
                <button
                  onClick={() => exportDatabaseToSql(compounds)}
                  className="w-full flex items-center justify-center space-x-2 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Esporta Dump SQL (.sql)</span>
                </button>
              </div>

              {/* JSON Backup Export */}
              <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700 space-y-3 sm:col-span-2">
                <div className="flex items-center space-x-2">
                  <FileCode className="w-5 h-5 text-blue-400" />
                  <span className="font-bold text-white text-sm">Backup Nativo JSON (.json)</span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Archivio JSON gerarchico con l&apos;intero schema relazionale di composti, alberi di sintesi e fattori $F1 \dots F5$.
                </p>
                <button
                  onClick={handleExportJson}
                  className="w-full flex items-center justify-center space-x-2 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Esporta JSON (.json)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Standalone Single HTML File */}
        {activeSubTab === 'standalone' && (
          <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-xs">
            <div className="bg-indigo-950/40 border border-indigo-500/50 p-6 rounded-2xl space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg font-bold">
                  <FileCode className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Applicazione Standalone in Singolo File HTML (.html)
                  </h3>
                  <span className="text-xs text-indigo-300">
                    100% Autonoma • Nessun server • Funziona offline su qualsiasi browser
                  </span>
                </div>
              </div>

              <p className="text-slate-300 text-xs leading-relaxed">
                Come richiesto, l&apos;intera applicazione (interfaccia reattiva Tailwind, database globale completo con tutti i 43 API e 40 intermedi, calcolatore APIC MACO, matrice impianto e derivazione tossicologica PDE) è pacchettizzata in un <strong>unico file HTML autonomo</strong>.
              </p>

              <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-700/80 space-y-2 font-mono text-[11px]">
                <div className="text-slate-400">Vantaggi del Singolo File HTML:</div>
                <ul className="list-disc list-inside text-slate-300 space-y-1">
                  <li>Può essere inviato via email, copiato su chiavetta USB o archiviato nel Document Management System aziendale (EDMS).</li>
                  <li>Basta fare <strong>doppio click</strong> sul file salvato per aprirlo con qualsiasi browser (Chrome, Edge, Safari, Firefox).</li>
                  <li>Include il motore di import/export Excel, CSV e SQL direttamente nel client browser via WebAssembly/JS.</li>
                </ul>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleDownloadStandaloneHtml}
                  className="flex items-center justify-center space-x-2 w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xl transition-all"
                >
                  <Download className="w-5 h-5" />
                  <span>Scarica Ora Singolo File HTML (APIC-Cleaning-Validation-Standalone.html)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};
