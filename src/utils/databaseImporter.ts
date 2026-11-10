import * as XLSX from 'xlsx';
import {
  PharmaceuticalCompound,
  IntermediateCompound,
  GlobalManufacturer,
  TherapeuticCategory,
  OEBLevel,
  CleanabilityRating,
} from '../types/apic';

export interface ParseResult {
  compounds: PharmaceuticalCompound[];
  errors: string[];
  warnings: string[];
  format: 'excel' | 'csv' | 'sql' | 'json';
  totalRows: number;
}

/**
 * Normalizes a header or key to lowercase alphanumeric for robust matching
 */
function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Maps raw object from CSV/Excel/SQL to PharmaceuticalCompound
 */
export function mapRowToCompound(raw: Record<string, any>, index: number): PharmaceuticalCompound | null {
  const normMap: Record<string, any> = {};
  for (const [k, v] of Object.entries(raw)) {
    normMap[normalizeKey(k)] = v;
  }

  // Name resolution
  let name =
    normMap['name'] ||
    normMap['nome'] ||
    normMap['api'] ||
    normMap['nomeprincipioattivo'] ||
    normMap['principioattivo'] ||
    normMap['compound'] ||
    normMap['activsubstance'] ||
    normMap['active'];

  if (!name) {
    // Check if any key contains 'name' or 'nome' or 'api'
    for (const [k, v] of Object.entries(normMap)) {
      if ((k.includes('name') || k.includes('nome') || k.includes('api')) && v && String(v).trim().length > 0) {
        name = v;
        break;
      }
    }
  }

  if (!name || String(name).trim() === '') {
    return null;
  }

  const casNumber = String(
    normMap['cas'] ||
    normMap['casnumber'] ||
    normMap['casno'] ||
    normMap['numerocas'] ||
    'N/A'
  ).trim();

  const chemicalName = String(
    normMap['chemicalname'] ||
    normMap['nomechimico'] ||
    normMap['iupac'] ||
    name
  ).trim();

  // PDE resolution & unit check
  let pdeMg = 0.1;
  if (normMap['pdemgday'] !== undefined) {
    pdeMg = parseFloat(normMap['pdemgday']);
  } else if (normMap['pdemgdie'] !== undefined) {
    pdeMg = parseFloat(normMap['pdemgdie']);
  } else if (normMap['pdemg'] !== undefined) {
    pdeMg = parseFloat(normMap['pdemg']);
  } else if (normMap['pde'] !== undefined) {
    pdeMg = parseFloat(normMap['pde']);
  } else if (normMap['ade'] !== undefined) {
    pdeMg = parseFloat(normMap['ade']);
  } else if (normMap['pdeugday'] !== undefined || normMap['pdeugdie'] !== undefined || normMap['pdeug'] !== undefined) {
    const valUg = parseFloat(normMap['pdeugday'] || normMap['pdeugdie'] || normMap['pdeug']);
    if (!isNaN(valUg)) pdeMg = valUg / 1000;
  }

  if (isNaN(pdeMg) || pdeMg <= 0) {
    pdeMg = 0.1;
  }

  // Dose resolution
  let minDose = 10;
  if (normMap['mindailydosemg'] !== undefined) minDose = parseFloat(normMap['mindailydosemg']);
  else if (normMap['mindose'] !== undefined) minDose = parseFloat(normMap['mindose']);
  else if (normMap['dosemin'] !== undefined) minDose = parseFloat(normMap['dosemin']);
  else if (normMap['tdd'] !== undefined) minDose = parseFloat(normMap['tdd']);
  if (isNaN(minDose) || minDose <= 0) minDose = 10;

  let maxDose = minDose * 4;
  if (normMap['maxdailydosemg'] !== undefined) maxDose = parseFloat(normMap['maxdailydosemg']);
  else if (normMap['maxdose'] !== undefined) maxDose = parseFloat(normMap['maxdose']);
  else if (normMap['dosemax'] !== undefined) maxDose = parseFloat(normMap['dosemax']);
  if (isNaN(maxDose) || maxDose < minDose) maxDose = minDose * 4;

  // Category
  const catRaw = String(normMap['category'] || normMap['categoria'] || normMap['classeterapeutica'] || 'Cardiovascular');
  const category: TherapeuticCategory = matchCategory(catRaw);

  // OEB
  const oebRaw = String(normMap['oeb'] || normMap['oeblevel'] || normMap['fasciaoeb'] || 'OEB 3').toUpperCase();
  let oeb: OEBLevel = 'OEB 3';
  if (oebRaw.includes('5')) oeb = 'OEB 5';
  else if (oebRaw.includes('4')) oeb = 'OEB 4';
  else if (oebRaw.includes('2')) oeb = 'OEB 2';
  else if (oebRaw.includes('1')) oeb = 'OEB 1';

  // Cleanability
  const cleanRaw = String(normMap['cleanability'] || normMap['pulibilita'] || normMap['pulizia'] || 'Moderate');
  let cleanability: CleanabilityRating = 'Moderate (Detergent/CIP)';
  if (cleanRaw.toLowerCase().includes('easy') || cleanRaw.toLowerCase().includes('facile')) {
    cleanability = 'Easy (Water/Mild)';
  } else if (cleanRaw.toLowerCase().includes('very difficult') || cleanRaw.toLowerCase().includes('molto diff')) {
    cleanability = 'Very Difficult (Solvent Reflux/Boil-out)';
  } else if (cleanRaw.toLowerCase().includes('difficult') || cleanRaw.toLowerCase().includes('difficile')) {
    cleanability = 'Difficult (Hot Alkaline/Acid)';
  }

  // Manufacturers
  const mfgRaw = String(normMap['manufacturers'] || normMap['produttori'] || normMap['produttore'] || normMap['primarymanufacturers'] || 'Teva');
  const primaryManufacturers = matchManufacturers(mfgRaw);

  // Intermediates
  let intermediates: IntermediateCompound[] = [];
  const intRaw = normMap['intermediates'] || normMap['intermedi'];
  if (intRaw) {
    if (Array.isArray(intRaw)) {
      intermediates = intRaw;
    } else if (typeof intRaw === 'string') {
      try {
        const parsed = JSON.parse(intRaw);
        if (Array.isArray(parsed)) {
          intermediates = parsed;
        }
      } catch {
        // Parse comma/semicolon separated codes
        intermediates = intRaw.split(/[;,]/).map((item, i) => {
          const trimmed = item.trim();
          return {
            id: `int-imp-${index}-${i}`,
            code: trimmed,
            name: `${trimmed} (Intermedio)`,
            stage: 'Advanced Intermediate' as const,
            cleanability: cleanability,
            pdeValueMg: Number((pdeMg * 0.8).toFixed(4)),
          };
        }).filter(item => item.code.length > 0);
      }
    }
  }

  // Solubility
  const solRaw = String(normMap['solubility'] || normMap['solubilita'] || normMap['solubilityinwater'] || 'Slightly Soluble');
  const solubility = matchSolubility(solRaw);

  return {
    id: `imp-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`,
    name: String(name).trim(),
    chemicalName,
    casNumber,
    molecularFormula: String(normMap['molecularformula'] || normMap['formula'] || 'C20H25NO3').trim(),
    molecularWeight: parseFloat(normMap['molecularweight'] || normMap['mw'] || normMap['pesomolecolare']) || 350.0,
    category,
    primaryManufacturers,
    oeb,
    pdeMgDay: Number(pdeMg.toFixed(6)),
    pdeUgDay: Number((pdeMg * 1000).toFixed(3)),
    minDailyDoseMg: minDose,
    maxDailyDoseMg: maxDose,
    routeOfAdministration: normMap['route'] === 'Parenteral' ? 'Parenteral' : 'Oral',
    solubilityInWater: solubility,
    cleanability,
    toxicologicalClass: oeb === 'OEB 5' || oeb === 'OEB 4' ? 'High Potency (HPAPI)' : 'Non-potent',
    recommendedAnalyticalMethod: normMap['method'] || (oeb === 'OEB 5' ? 'LC-MS/MS' : 'HPLC-UV'),
    defaultSwabRecoveryPercent: parseFloat(normMap['recovery']) || 85,
    suggestedCipCleaningAgent: normMap['cipagent'] || '0.2M NaOH at 60°C seguito da WFI rinse',
    intermediates,
    isCustom: true,
    monographReference: normMap['reference'] || 'Importato da Database Esterno',
  };
}

function matchCategory(val: string): TherapeuticCategory {
  const v = val.toLowerCase();
  if (v.includes('oncol') || v.includes('citotoss') || v.includes('cytotox')) return 'Oncology / Cytotoxic';
  if (v.includes('cardio') || v.includes('iperten') || v.includes('statin')) return 'Cardiovascular';
  if (v.includes('cns') || v.includes('nervos') || v.includes('depress') || v.includes('epilep')) return 'Central Nervous System';
  if (v.includes('antibiot') || v.includes('antimicrob') || v.includes('antifung')) return 'Antimicrobial / Antibiotic';
  if (v.includes('immuno')) return 'Immunosuppressant / Immunomodulator';
  if (v.includes('respirat') || v.includes('asma')) return 'Respiratory';
  if (v.includes('gastro') || v.includes('ppi') || v.includes('stomaco')) return 'Gastrointestinal';
  if (v.includes('antivir') || v.includes('hiv') || v.includes('covid')) return 'Antiviral';
  if (v.includes('infiamm') || v.includes('analges') || v.includes('nsaid')) return 'Anti-inflammatory / Analgesic';
  if (v.includes('steroid') || v.includes('ormon')) return 'Steroids & Hormones';
  if (v.includes('anestet') || v.includes('neuromusc')) return 'Anesthetic & Neuromuscular';
  if (v.includes('diabet') || v.includes('metabol') || v.includes('endocrin')) return 'Endocrine & Metabolic';
  return 'Cardiovascular';
}

function matchManufacturers(val: string): GlobalManufacturer[] {
  const validMfgs: GlobalManufacturer[] = [
    'Teva', 'Lonza', 'Pfizer', 'Novartis', 'Axplora', 'Dipharma', 'Curia', 'Olon', 'Sanofi', 'Cambrex', 'Cipla', 'Procos', 'Aurobindo'
  ];
  const found: GlobalManufacturer[] = [];
  for (const m of validMfgs) {
    if (new RegExp(m, 'i').test(val)) {
      found.push(m);
    }
  }
  return found.length > 0 ? found : ['Teva'];
}

function matchSolubility(val: string): PharmaceuticalCompound['solubilityInWater'] {
  const v = val.toLowerCase();
  if (v.includes('freely') || v.includes('facilmente')) return 'Freely Soluble';
  if (v.includes('very slightly') || v.includes('molto poco')) return 'Very Slightly Soluble';
  if (v.includes('practically insol') || v.includes('insolubil') || v.includes('praticamente')) return 'Practically Insoluble';
  if (v.includes('slightly') || v.includes('poco')) return 'Slightly Soluble';
  if (v.includes('sparingly') || v.includes('scarsamente')) return 'Sparingly Soluble';
  if (v.includes('soluble') || v.includes('solubile')) return 'Soluble';
  return 'Slightly Soluble';
}

/**
 * Parses an Excel (.xlsx, .xls) file using SheetJS
 */
export async function parseExcelFile(file: File | ArrayBuffer): Promise<ParseResult> {
  const data = file instanceof File ? await file.arrayBuffer() : file;
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  const compounds: PharmaceuticalCompound[] = [];
  const errors: string[] = [];

  rawRows.forEach((row, idx) => {
    try {
      const comp = mapRowToCompound(row, idx);
      if (comp) {
        compounds.push(comp);
      }
    } catch (e: any) {
      errors.push(`Riga ${idx + 2}: ${e.message}`);
    }
  });

  return {
    compounds,
    errors,
    warnings: [],
    format: 'excel',
    totalRows: rawRows.length,
  };
}

/**
 * Parses a CSV / TSV text with robust delimiter detection and quoting
 */
export function parseCsvText(text: string): ParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { compounds: [], errors: ['File vuoto o privo di intestazione'], warnings: [], format: 'csv', totalRows: 0 };
  }

  // Detect delimiter: comma, semicolon, tab
  const headerLine = lines[0];
  let delimiter = ',';
  if (headerLine.includes(';') && headerLine.split(';').length >= headerLine.split(',').length) {
    delimiter = ';';
  } else if (headerLine.includes('\t') && headerLine.split('\t').length >= headerLine.split(',').length) {
    delimiter = '\t';
  }

  const parseCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        if (inQuotes && line[i + 1] === char) {
          current += char;
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseCsvLine(lines[0]);
  const compounds: PharmaceuticalCompound[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const rowObj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rowObj[h] = values[idx] || '';
    });

    try {
      const comp = mapRowToCompound(rowObj, i);
      if (comp) {
        compounds.push(comp);
      }
    } catch (e: any) {
      errors.push(`Riga ${i + 1}: ${e.message}`);
    }
  }

  return {
    compounds,
    errors,
    warnings: [],
    format: 'csv',
    totalRows: lines.length - 1,
  };
}

/**
 * Parses SQL dump containing INSERT INTO statements
 */
export function parseSqlDump(sqlText: string): ParseResult {
  const compounds: PharmaceuticalCompound[] = [];
  const errors: string[] = [];

  // Match: INSERT INTO `table` (`col1`, `col2`, ...) VALUES (...), (...)
  const insertRegex = /INSERT\s+INTO\s+[`"']?(\w+)[`"']?\s*\(([^)]+)\)\s*VALUES\s*([\s\S]+?);/gi;
  let match;
  let rowCount = 0;

  while ((match = insertRegex.exec(sqlText)) !== null) {
    const colString = match[2];
    const valuesBlock = match[3];

    // Extract columns
    const columns = colString
      .split(',')
      .map((c) => c.replace(/[`"'\[\]\s]/g, ''));

    // Extract rows: match tuples (val1, val2, ...)
    const rowRegex = /\(([^)]+)\)/g;
    let rowMatch;

    while ((rowMatch = rowRegex.exec(valuesBlock)) !== null) {
      rowCount++;
      const valStr = rowMatch[1];
      // Split values respecting quotes
      const values: string[] = [];
      let cur = '';
      let inQuotes = false;
      let quoteChar = '';

      for (let j = 0; j < valStr.length; j++) {
        const c = valStr[j];
        if ((c === "'" || c === '"') && valStr[j - 1] !== '\\') {
          if (!inQuotes) {
            inQuotes = true;
            quoteChar = c;
          } else if (c === quoteChar) {
            inQuotes = false;
          } else {
            cur += c;
          }
        } else if (c === ',' && !inQuotes) {
          values.push(cur.trim().replace(/^['"]|['"]$/g, ''));
          cur = '';
        } else {
          cur += c;
        }
      }
      values.push(cur.trim().replace(/^['"]|['"]$/g, ''));

      const rowObj: Record<string, string> = {};
      columns.forEach((col, idx) => {
        rowObj[col] = values[idx] || '';
      });

      try {
        const comp = mapRowToCompound(rowObj, rowCount);
        if (comp) {
          compounds.push(comp);
        }
      } catch (e: any) {
        errors.push(`SQL Row ${rowCount}: ${e.message}`);
      }
    }
  }

  if (compounds.length === 0) {
    errors.push('Nessuna istruzione INSERT INTO valida o colonne riconosciute trovate nello script SQL.');
  }

  return {
    compounds,
    errors,
    warnings: [],
    format: 'sql',
    totalRows: rowCount,
  };
}

/**
 * Universal database importer taking any file (XLSX, XLS, CSV, SQL, JSON)
 */
export async function importDatabaseFile(file: File): Promise<ParseResult> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'xlsx' || ext === 'xls') {
    return parseExcelFile(file);
  }

  const text = await file.text();

  if (ext === 'json') {
    try {
      const parsed = JSON.parse(text);
      const rows = Array.isArray(parsed) ? parsed : parsed.compounds || [];
      const compounds: PharmaceuticalCompound[] = [];
      rows.forEach((r: any, idx: number) => {
        const comp = mapRowToCompound(r, idx);
        if (comp) compounds.push(comp);
      });
      return {
        compounds,
        errors: [],
        warnings: [],
        format: 'json',
        totalRows: rows.length,
      };
    } catch (e: any) {
      return { compounds: [], errors: [`JSON non valido: ${e.message}`], warnings: [], format: 'json', totalRows: 0 };
    }
  }

  if (ext === 'sql') {
    return parseSqlDump(text);
  }

  // Default to CSV / TSV
  return parseCsvText(text);
}

/**
 * Generates downloadable templates for Excel, CSV, and SQL
 */
export function generateTemplates() {
  const sampleData = [
    {
      name: 'Rosuvastatin Calcium',
      cas: '287714-41-4',
      category: 'Cardiovascular',
      oeb: 'OEB 3',
      pde_mg_day: 0.1,
      min_daily_dose_mg: 5,
      max_daily_dose_mg: 40,
      solubility: 'Slightly Soluble',
      cleanability: 'Moderate',
      manufacturers: 'Teva, AstraZeneca',
      intermediates: 'Tert-butyl (E)-(6-[2-[4-(4-fluorophenyl)-6-isopropyl-2-[methyl(methylsulfonyl)amino]pyrimidin-5-yl]vinyl]-(4R,6S)-2,2-dimethyl-1,3-dioxan-4-yl)acetate',
    },
    {
      name: 'Osimertinib Mesylate',
      cas: '1421373-66-1',
      category: 'Oncology / Cytotoxic',
      oeb: 'OEB 5',
      pde_mg_day: 0.0008,
      min_daily_dose_mg: 40,
      max_daily_dose_mg: 80,
      solubility: 'Practically Insoluble',
      cleanability: 'Very Difficult',
      manufacturers: 'Lonza, Curia',
      intermediates: 'N-(4-fluoro-2-methoxy-5-nitrophenyl)-4-(1-methyl-1H-indol-3-yl)pyrimidin-2-amine',
    },
    {
      name: 'Amoxicillin Trihydrate',
      cas: '61336-70-7',
      category: 'Antimicrobial / Antibiotic',
      oeb: 'OEB 3',
      pde_mg_day: 0.05,
      min_daily_dose_mg: 250,
      max_daily_dose_mg: 3000,
      solubility: 'Sparingly Soluble',
      cleanability: 'Easy',
      manufacturers: 'Sanofi, Aurobindo',
      intermediates: '6-APA (6-Aminopenicillanic acid)',
    },
  ];

  // 1. Excel workbook
  const ws = XLSX.utils.json_to_sheet(sampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Database_API');
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

  // 2. CSV string
  const headers = Object.keys(sampleData[0]);
  const csvLines = [
    headers.join(','),
    ...sampleData.map((row) =>
      headers
        .map((h) => {
          const val = (row as any)[h];
          return `"${String(val).replace(/"/g, '""')}"`;
        })
        .join(',')
    ),
  ].join('\n');

  // 3. SQL string
  const sqlLines = [
    '-- Template SQL per Import Database APIC Cleaning Validation',
    'CREATE TABLE IF NOT EXISTS api_compounds (',
    '  id INT AUTO_INCREMENT PRIMARY KEY,',
    '  name VARCHAR(255) NOT NULL,',
    '  cas VARCHAR(64),',
    '  category VARCHAR(128),',
    '  oeb VARCHAR(32),',
    '  pde_mg_day DECIMAL(10,6),',
    '  min_daily_dose_mg DECIMAL(10,2),',
    '  max_daily_dose_mg DECIMAL(10,2),',
    '  solubility VARCHAR(64),',
    '  cleanability VARCHAR(64),',
    '  manufacturers VARCHAR(255),',
    '  intermediates TEXT',
    ');',
    '',
    'INSERT INTO api_compounds (name, cas, category, oeb, pde_mg_day, min_daily_dose_mg, max_daily_dose_mg, solubility, cleanability, manufacturers, intermediates) VALUES',
    ...sampleData.map(
      (r, idx) =>
        `  ('${r.name}', '${r.cas}', '${r.category}', '${r.oeb}', ${r.pde_mg_day}, ${r.min_daily_dose_mg}, ${r.max_daily_dose_mg}, '${r.solubility}', '${r.cleanability}', '${r.manufacturers}', '${r.intermediates}')${idx === sampleData.length - 1 ? ';' : ','}`
    ),
  ].join('\n');

  return { excelBuffer, csvLines, sqlLines };
}

/**
 * Exports the entire live database to Excel format
 */
export function exportDatabaseToExcel(compounds: PharmaceuticalCompound[]) {
  const exportRows = compounds.map((c) => ({
    Nome_API: c.name,
    Nome_Chimico: c.chemicalName,
    CAS: c.casNumber,
    Formula: c.molecularFormula,
    Peso_Molecolare: c.molecularWeight,
    Categoria_Terapeutica: c.category,
    Fascia_OEB: c.oeb,
    PDE_mg_die: c.pdeMgDay,
    PDE_ug_die: c.pdeUgDay,
    Dose_Minima_mg: c.minDailyDoseMg,
    Dose_Massima_mg: c.maxDailyDoseMg,
    Via_Somministrazione: c.routeOfAdministration,
    Solubilita_Acqua: c.solubilityInWater,
    Pulibilita_CIP: c.cleanability,
    Classe_Tossicologica: c.toxicologicalClass,
    Metodo_Analitico: c.recommendedAnalyticalMethod,
    Recupero_Swab_Percentuale: c.defaultSwabRecoveryPercent,
    Agente_Lavaggio_CIP: c.suggestedCipCleaningAgent,
    Produttori_Globali: c.primaryManufacturers.join(', '),
    Numero_Intermedi: c.intermediates.length,
    Intermedi_Dettaglio: c.intermediates.map((i) => `${i.code}: ${i.name} [PDE: ${i.pdeValueMg} mg]`).join(' | '),
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Database_Globale_ADE_PDE');
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `APIC_Database_ADE_PDE_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports database to SQL script with CREATE TABLE and INSERT statements
 */
export function exportDatabaseToSql(compounds: PharmaceuticalCompound[]) {
  const lines = [
    '-- ====================================================================',
    '-- APIC CLEANING VALIDATION - DUMP DATABASE GLOBALE ADE/PDE & INTERMEDI',
    `-- Data Creazione: ${new Date().toISOString()}`,
    '-- Linee Guida: APIC/CEFIC Guidance on Cleaning Validation in API Plants',
    '-- ====================================================================',
    '',
    'CREATE TABLE IF NOT EXISTS cleaning_validation_apis (',
    '  id VARCHAR(64) PRIMARY KEY,',
    '  name VARCHAR(255) NOT NULL,',
    '  chemical_name TEXT,',
    '  cas_number VARCHAR(64),',
    '  molecular_formula VARCHAR(128),',
    '  molecular_weight DECIMAL(10,2),',
    '  category VARCHAR(128),',
    '  oeb VARCHAR(16),',
    '  pde_mg_day DECIMAL(12,6),',
    '  pde_ug_day DECIMAL(12,3),',
    '  min_daily_dose_mg DECIMAL(10,2),',
    '  max_daily_dose_mg DECIMAL(10,2),',
    '  solubility VARCHAR(64),',
    '  cleanability VARCHAR(64),',
    '  toxicological_class VARCHAR(64),',
    '  analytical_method VARCHAR(64),',
    '  swab_recovery_pct DECIMAL(5,2),',
    '  cip_cleaning_agent TEXT,',
    '  primary_manufacturers TEXT,',
    '  intermediates_json TEXT',
    ');',
    '',
    'INSERT INTO cleaning_validation_apis (',
    '  id, name, chemical_name, cas_number, molecular_formula, molecular_weight,',
    '  category, oeb, pde_mg_day, pde_ug_day, min_daily_dose_mg, max_daily_dose_mg,',
    '  solubility, cleanability, toxicological_class, analytical_method, swab_recovery_pct,',
    '  cip_cleaning_agent, primary_manufacturers, intermediates_json',
    ') VALUES',
  ];

  const escapeStr = (str: string) => str.replace(/'/g, "''");

  const valuesClauses = compounds.map((c, i) => {
    const isLast = i === compounds.length - 1;
    const intsJson = JSON.stringify(c.intermediates);
    return `  ('${c.id}', '${escapeStr(c.name)}', '${escapeStr(c.chemicalName)}', '${c.casNumber}', '${c.molecularFormula}', ${c.molecularWeight}, '${escapeStr(c.category)}', '${c.oeb}', ${c.pdeMgDay}, ${c.pdeUgDay}, ${c.minDailyDoseMg}, ${c.maxDailyDoseMg}, '${c.solubilityInWater}', '${c.cleanability}', '${c.toxicologicalClass}', '${c.recommendedAnalyticalMethod}', ${c.defaultSwabRecoveryPercent}, '${escapeStr(c.suggestedCipCleaningAgent)}', '${escapeStr(c.primaryManufacturers.join(', '))}', '${escapeStr(intsJson)}')${isLast ? ';' : ','}`;
  });

  const fullSql = [...lines, ...valuesClauses].join('\n');
  const blob = new Blob([fullSql], { type: 'application/sql;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `APIC_Database_ADE_PDE_${new Date().toISOString().slice(0, 10)}.sql`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
