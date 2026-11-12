/**
 * Utility functions for exporting Facility Matrix data
 * Supports: PDF (printable GMP report), CSV (UTF-8 BOM), Excel (XML Spreadsheet), and Google Sheets (TSV / CSV)
 * Compliant with APIC Guide 2021 Chapter 7.0 & EMA GMP Annex 15
 */

import {
  FacilityMatrixTrain,
  MatrixProductItem,
  ApicChapter4CalculationInput,
  ApicChapter4CalculationResult,
} from '../types/apic';
import {
  evaluateAllMatrixCombinations,
  executeApicChapter4Calculation,
} from './apicCalculations';

/**
 * Generates clean CSV content with UTF-8 BOM for Excel / Google Sheets
 */
export function generateMatrixCsv(
  matrix: FacilityMatrixTrain,
  allMatricesCount: number = 1
): string {
  const evaluation = evaluateAllMatrixCombinations(matrix.products, {
    sharedSurfaceAreaM2: matrix.sharedSurfaceAreaM2,
    swabAreaCm2: matrix.swabAreaCm2,
    swabRecoveryPercent: matrix.swabRecoveryPercent,
    rinseVolumeLiters: matrix.rinseVolumeLiters,
  });

  const lines: string[] = [];

  // UTF-8 BOM to ensure proper character rendering (µg, m², accents) in Excel
  lines.push(`CLEANING VALIDATION & AUDIT TRAIL REGOLATORIO - MATRICE IMPIANTO (GUIDA APIC SEZ. 7 / EMA GMP ANNEX 15)`);
  lines.push(`Audit Trail ID;AT-APIC-${matrix.trainId}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`);
  lines.push(`Data e Ora Emissione;${new Date().toLocaleString('it-IT')}`);
  lines.push(`Matrice Impianto;${matrix.matrixIndex} di ${allMatricesCount}`);
  lines.push(`Identificativo Treno;${matrix.trainId}`);
  lines.push(`Denominazione Treno;${matrix.name}`);
  lines.push(`Cleaning Class;${matrix.cleaningClass} (${matrix.cleaningSolventNotes || 'Nessuna nota'})`);
  lines.push(`Superficie Totale Condivisa;${matrix.sharedSurfaceAreaM2} m² (${matrix.sharedSurfaceAreaM2 * 100} dm²)`);
  lines.push(`Area Dima Tampone (Swab);${matrix.swabAreaCm2} cm²`);
  lines.push(`Fattore di Recupero Analitico (WF);${matrix.swabRecoveryPercent} %`);
  lines.push(`Volume Solvente di Risciacquo;${matrix.rinseVolumeLiters} L`);
  lines.push(`Soglia Ispezione Visiva;${matrix.visualLimitUgCm2} µg/cm²`);
  lines.push(``);

  // SECTION 1: WORST CASE IDENTIFIED
  lines.push(`1. SINTESI WORST-CASE IDENTIFICATI NELLA MATRICE`);
  if (evaluation.worstResidueProduct) {
    const wr = evaluation.worstResidueProduct;
    lines.push(
      `Peggior Residuo per Pulibilita/Tossicita;${wr.name} (CAS: ${wr.casNumber});Cleanability Cat ${wr.cleanabilityCategory};Solubilita Grp ${wr.solubilityGroup};PDE Grp ${wr.pdeGroup} (${wr.pdeUgDay} µg/die);Dose Grp ${wr.doseGroup} (${wr.minDailyDoseMg} mg)`
    );
  } else {
    lines.push(`Peggior Residuo;Nessun prodotto inserito`);
  }

  if (evaluation.worstCaseCombination) {
    const wc = evaluation.worstCaseCombination;
    lines.push(
      `Transizione Worst-Case Piu Sfavorevole;${wc.fromProduct.name} -> ${wc.toProduct.name};MACO Selezionato: ${wc.macoSelectedMg} mg;Governato da: ${wc.governingCriteria};Limite Swab: ${wc.swabLimitUgPerSwab} µg/swab;Limite Rinse: ${wc.rinseLimitMgL} ppm (mg/L)`
    );
    lines.push(`Razionale Scientifico APIC;"${wc.scientificRationale.replace(/"/g, '""')}"`);
  } else {
    lines.push(`Transizione Worst-Case;Inserire almeno 2 prodotti per determinare il Worst-Case`);
  }
  lines.push(``);

  // SECTION 2: PRODUCTS TABLE
  lines.push(`2. CONFIGURAZIONE PRODOTTI E ASSEGNAZIONE RATING DI DIFFICOLTA / SOLUBILITA`);
  lines.push(
    `Nome Prodotto/Intermedio;Codice Interno;Numero CAS;Tipologia;Criterio a: Difficolta Pulizia (1=Easy, 2=Med, 3=Diff);Razionale Operatore Criterio a;Criterio b: Solubilita USP 24 (1=Molto Solubile, 2=Solubile, 3=Insolubile);Solvente Utilizzato;Criterio c: ADE/PDE (µg/die);Criterio c: ADE/PDE (mg/die);Gruppo Tossicologico ADE/PDE (1-5);Criterio d: Minima Dose Terapeutica (mg);Gruppo Terapeutico Dose (1-3);Lotto Minimo Successivo MBS (kg);Massima Dose Die Successiva MDD (mg)`
  );

  matrix.products.forEach((p) => {
    lines.push(
      [
        `"${p.name.replace(/"/g, '""')}"`,
        `"${(p.code || '').replace(/"/g, '""')}"`,
        `"${p.casNumber || 'N/A'}"`,
        `"${p.type}"`,
        `Cat ${p.cleanabilityCategory}`,
        `"${(p.cleanabilityRationale || '').replace(/"/g, '""')}"`,
        `Grp ${p.solubilityGroup}`,
        `"${(p.solubilityDescription || '').replace(/"/g, '""')}"`,
        p.pdeUgDay,
        p.pdeMgDay,
        `Gruppo ${p.pdeGroup}`,
        p.minDailyDoseMg,
        `Gruppo ${p.doseGroup}`,
        p.minBatchSizeKg,
        p.maxDailyDoseMg,
      ].join(';')
    );
  });
  lines.push(``);

  // SECTION 3: CROSS CARRYOVER COMBINATIONS
  lines.push(`3. MATRICE COMPLETA DELLE COMBINAZIONI CROSS-CARRYOVER (A -> B)`);
  lines.push(
    `Prodotto Precedente A;Prodotto Successivo B;MACO da Dati HBEL/PDE (mg);MACO da Criterio Dose 1/1000 (mg);MACO da Limite Generale 10 ppm (mg);MACO Finale Selezionato (mg);Criterio Governatore;Limite Superficiale Swab (µg/tampone);Limite Concentrazione Risciacquo (ppm);Worst-Case?;Razionale Tecnico Convalida`
  );

  evaluation.combinations.forEach((c) => {
    lines.push(
      [
        `"${c.fromProduct.name.replace(/"/g, '""')}"`,
        `"${c.toProduct.name.replace(/"/g, '""')}"`,
        c.macoPdeMg,
        c.macoDoseMg,
        c.maco10PpmMg,
        c.macoSelectedMg,
        `"${c.governingCriteria}"`,
        c.swabLimitUgPerSwab,
        c.rinseLimitMgL,
        c.isWorstCase ? 'SI (WORST CASE)' : 'NO',
        `"${c.scientificRationale.replace(/"/g, '""')}"`,
      ].join(';')
    );
  });

  return '\uFEFF' + lines.join('\r\n');
}

/**
 * Generates Tab-Separated Values (TSV) optimized for 1-click clipboard paste directly into Google Sheets
 */
export function generateMatrixTsvForGoogleSheets(
  matrix: FacilityMatrixTrain,
  allMatricesCount: number = 1
): string {
  const evaluation = evaluateAllMatrixCombinations(matrix.products, {
    sharedSurfaceAreaM2: matrix.sharedSurfaceAreaM2,
    swabAreaCm2: matrix.swabAreaCm2,
    swabRecoveryPercent: matrix.swabRecoveryPercent,
    rinseVolumeLiters: matrix.rinseVolumeLiters,
  });

  const lines: string[] = [];

  lines.push(`CLEANING VALIDATION DOSSIER\tMATRICE IMPIANTO E INCASTRO PRODOTTI (APIC 2021)`);
  lines.push(`Treno Impianto:\t${matrix.trainId} - ${matrix.name}\tCleaning Class:\t${matrix.cleaningClass} (${matrix.cleaningSolventNotes || ''})`);
  lines.push(`Superficie Condivisa:\t${matrix.sharedSurfaceAreaM2} m²\tArea Swab:\t${matrix.swabAreaCm2} cm²\tRecupero WF:\t${matrix.swabRecoveryPercent}%\tVolume Rinse:\t${matrix.rinseVolumeLiters} L`);
  lines.push(``);

  lines.push(`--- SINTESI WORST-CASE IDENTIFICATI ---`);
  if (evaluation.worstResidueProduct) {
    const wr = evaluation.worstResidueProduct;
    lines.push(`Worst Residue Molecule:\t${wr.name}\tCAS: ${wr.casNumber}\tPulibilita: Cat ${wr.cleanabilityCategory}\tSolubilita: Grp ${wr.solubilityGroup}\tPDE: ${wr.pdeUgDay} µg/die (Gruppo ${wr.pdeGroup})`);
  }
  if (evaluation.worstCaseCombination) {
    const wc = evaluation.worstCaseCombination;
    lines.push(`Transizione Worst-Case:\t${wc.fromProduct.name} -> ${wc.toProduct.name}\tMACO:\t${wc.macoSelectedMg} mg (${wc.governingCriteria})\tSwab Limit:\t${wc.swabLimitUgPerSwab} µg/swab\tRinse Limit:\t${wc.rinseLimitMgL} ppm`);
  }
  lines.push(``);

  lines.push(`--- TABELLA PRODOTTI E RATING APIC ---`);
  lines.push(`Nome Prodotto\tCodice\tCAS\tTipo\tDifficolta Pulizia (a)\tRazionale Pulibilita\tSolubilita USP (b)\tSolvente\tADE/PDE (µg)\tGruppo PDE (c)\tMin Dose (mg)\tGruppo Dose (d)\tMBS (kg)\tMDD (mg)`);
  matrix.products.forEach((p) => {
    lines.push(
      [
        p.name,
        p.code || '',
        p.casNumber || 'N/A',
        p.type,
        `Cat ${p.cleanabilityCategory}`,
        p.cleanabilityRationale || '',
        `Grp ${p.solubilityGroup}`,
        p.solubilityDescription || '',
        p.pdeUgDay,
        `Gruppo ${p.pdeGroup}`,
        p.minDailyDoseMg,
        `Gruppo ${p.doseGroup}`,
        p.minBatchSizeKg,
        p.maxDailyDoseMg,
      ].join('\t')
    );
  });
  lines.push(``);

  lines.push(`--- MATRICE DELLE COMBINAZIONI CROSS-CARRYOVER (A -> B) ---`);
  lines.push(`Prodotto A\tProdotto B\tMACO PDE (mg)\tMACO Dose (mg)\tMACO 10 ppm (mg)\tMACO Selezionato (mg)\tCriterio Governatore\tLimite Swab (µg/swab)\tLimite Rinse (ppm)\tWorst-Case?`);
  evaluation.combinations.forEach((c) => {
    lines.push(
      [
        c.fromProduct.name,
        c.toProduct.name,
        c.macoPdeMg,
        c.macoDoseMg,
        c.maco10PpmMg,
        c.macoSelectedMg,
        c.governingCriteria,
        c.swabLimitUgPerSwab,
        c.rinseLimitMgL,
        c.isWorstCase ? 'SI (WORST CASE)' : 'NO',
      ].join('\t')
    );
  });

  return lines.join('\n');
}

/**
 * Generates a professional Microsoft Excel XML Spreadsheet (SpreadsheetML) workbook
 * containing real, dynamic formulas (ss:Formula) and editable parameter cells for what-if scenarios.
 * Compliant with APIC Cleaning Validation Guide 2021 & EMA GMP Annex 15.
 */
export function generateDynamicExcelXmlWorkbook(
  matrix: FacilityMatrixTrain,
  allMatricesCount: number = 1,
  calculatorInput?: ApicChapter4CalculationInput,
  calculatorResult?: ApicChapter4CalculationResult
): string {
  const evaluation = evaluateAllMatrixCombinations(matrix.products, {
    sharedSurfaceAreaM2: matrix.sharedSurfaceAreaM2,
    swabAreaCm2: matrix.swabAreaCm2,
    swabRecoveryPercent: matrix.swabRecoveryPercent,
    rinseVolumeLiters: matrix.rinseVolumeLiters,
  });

  const escapeXml = (str: any) => {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  const worstCase = evaluation.worstCaseCombination;
  const prodA = worstCase?.fromProduct || matrix.products[0] || {
    name: 'Prodotto A (Residuo)',
    casNumber: 'N/A',
    pdeMgDay: 0.15,
    pdeUgDay: 150,
    minDailyDoseMg: 10,
    minBatchSizeKg: 250,
    maxDailyDoseMg: 40,
  };
  const prodB = worstCase?.toProduct || matrix.products[1] || {
    name: 'Prodotto B (Successivo)',
    casNumber: 'N/A',
    pdeMgDay: 0.5,
    pdeUgDay: 500,
    minDailyDoseMg: 20,
    minBatchSizeKg: 200,
    maxDailyDoseMg: 40,
  };

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>APIC Cleaning Validation Dynamic Model</Title>
  <Subject>Cleaning Validation &amp; Carryover Acceptance Criteria</Subject>
  <Author>QA Specialist - APIC Guide 2021</Author>
  <Created>${new Date().toISOString()}</Created>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="10" ss:Color="#0F172A"/>
  </Style>
  <Style ss:ID="HeaderTitle">
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="15" ss:Bold="1" ss:Color="#1E1B4B"/>
  </Style>
  <Style ss:ID="HeaderSubtitle">
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="10" ss:Italic="1" ss:Color="#475569"/>
  </Style>
  <Style ss:ID="SectionHeader">
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Bold="1" ss:Color="#312E81"/>
   <Interior ss:Color="#EEF2FF" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#C7D2FE"/>
   </Borders>
  </Style>
  <Style ss:ID="TableHeader">
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#4338CA" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#312E81"/>
   </Borders>
  </Style>
  <Style ss:ID="TableHeaderTeal">
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#0F766E" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#115E59"/>
   </Borders>
  </Style>
  <Style ss:ID="InputLabel">
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="10" ss:Bold="1" ss:Color="#065F46"/>
   <Interior ss:Color="#ECFDF5" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="InputCell">
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="10" ss:Bold="1" ss:Color="#047857"/>
   <Interior ss:Color="#D1FAE5" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Right"/>
   <NumberFormat ss:Format="#,##0.00"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#6EE7B7"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#6EE7B7"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#6EE7B7"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#6EE7B7"/>
   </Borders>
  </Style>
  <Style ss:ID="FormulaCell">
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="10" ss:Bold="1" ss:Color="#92400E"/>
   <Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Right"/>
   <NumberFormat ss:Format="#,##0.00"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FCD34D"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FCD34D"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FCD34D"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FCD34D"/>
   </Borders>
  </Style>
  <Style ss:ID="FormulaCellText">
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="10" ss:Bold="1" ss:Color="#92400E"/>
   <Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center"/>
  </Style>
  <Style ss:ID="WorstCaseRow">
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="10" ss:Bold="1" ss:Color="#991B1B"/>
   <Interior ss:Color="#FEE2E2" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FCA5A5"/>
   </Borders>
  </Style>
  <Style ss:ID="DataRow">
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="10" ss:Color="#1E293B"/>
  </Style>
  <Style ss:ID="NumberCell">
   <Alignment ss:Horizontal="Right"/>
   <NumberFormat ss:Format="#,##0.00"/>
  </Style>
  <Style ss:ID="NumberCellInt">
   <Alignment ss:Horizontal="Right"/>
   <NumberFormat ss:Format="#,##0"/>
  </Style>
  <Style ss:ID="BadgeCenter">
   <Alignment ss:Horizontal="Center"/>
  </Style>
 </Styles>

 <!-- ============================================================= -->
 <!-- WORKSHEET 1: MATRICE & TRANSIZIONI CON FORMULE DINAMICHE      -->
 <!-- ============================================================= -->
 <Worksheet ss:Name="Matrice &amp; Transizioni">
  <Table>
   <Column ss:Width="160"/>
   <Column ss:Width="160"/>
   <Column ss:Width="95"/>
   <Column ss:Width="95"/>
   <Column ss:Width="95"/>
   <Column ss:Width="95"/>
   <Column ss:Width="110"/>
   <Column ss:Width="110"/>
   <Column ss:Width="110"/>
   <Column ss:Width="120"/>
   <Column ss:Width="120"/>
   <Column ss:Width="110"/>
   <Column ss:Width="140"/>
   <Column ss:Width="160"/>
   <Column ss:Width="110"/>

   <!-- Titolo & Metadata -->
   <Row>
    <Cell ss:StyleID="HeaderTitle"><Data ss:Type="String">APIC CLEANING VALIDATION - MODELLO DINAMICO CON FORMULE</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="HeaderSubtitle"><Data ss:Type="String">Matrice: ${escapeXml(matrix.trainId)} (${escapeXml(matrix.name)}) • Cleaning Class: ${escapeXml(matrix.cleaningClass)} • Data: ${new Date().toLocaleDateString('it-IT')}</Data></Cell>
   </Row>
   <Row></Row>

   <!-- PARAMETRI IMPIANTO (Celle di input modificabili collegate alle formule) -->
   <Row>
    <Cell ss:StyleID="SectionHeader"><Data ss:Type="String">PARAMETRO TRENO IMPIANTI (INPUT MODIFICABILE)</Data></Cell>
    <Cell ss:StyleID="SectionHeader"><Data ss:Type="String">VALORE PARAMETRO</Data></Cell>
    <Cell ss:StyleID="SectionHeader"><Data ss:Type="String">UNITA / NOTE</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="InputLabel"><Data ss:Type="String">Superficie Totale Condivisa S_tot (m²):</Data></Cell>
    <Cell ss:StyleID="InputCell"><Data ss:Type="Number">${matrix.sharedSurfaceAreaM2}</Data></Cell>
    <Cell ss:Formula="=&quot;Area: &quot; &amp; TEXT(RC[-1]*10000, &quot;#,##0&quot;) &amp; &quot; cm²&quot;"><Data ss:Type="String">Area in cm²</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="InputLabel"><Data ss:Type="String">Area Dima Tampone Swab A_swab (cm²):</Data></Cell>
    <Cell ss:StyleID="InputCell"><Data ss:Type="Number">${matrix.swabAreaCm2}</Data></Cell>
    <Cell><Data ss:Type="String">Dima di campionamento convalidata</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="InputLabel"><Data ss:Type="String">Fattore di Recupero Analitico WF (%):</Data></Cell>
    <Cell ss:StyleID="InputCell"><Data ss:Type="Number">${matrix.swabRecoveryPercent}</Data></Cell>
    <Cell><Data ss:Type="String">Recovery analitico con tampone</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="InputLabel"><Data ss:Type="String">Volume Solvente di Risciacquo V (L):</Data></Cell>
    <Cell ss:StyleID="InputCell"><Data ss:Type="Number">${matrix.rinseVolumeLiters}</Data></Cell>
    <Cell><Data ss:Type="String">Volume del risciacquo finale convalidato</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="InputLabel"><Data ss:Type="String">Soglia Ispezione Visiva (µg/cm²):</Data></Cell>
    <Cell ss:StyleID="InputCell"><Data ss:Type="Number">${matrix.visualLimitUgCm2}</Data></Cell>
    <Cell><Data ss:Type="String">Soglia standard GMP Annex 15 (4.0 µg/cm²)</Data></Cell>
   </Row>
   <Row></Row>

   <!-- SEZIONE TRANSIZIONI CROSS-CARRYOVER CON FORMULE ATTIVE -->
   <Row>
    <Cell ss:StyleID="SectionHeader"><Data ss:Type="String">VALUTAZIONE CROSS-CARRYOVER A -&gt; B (FORMULE ATTIVE INTERATTIVE)</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Prodotto A (Residuo)</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Prodotto B (Successivo)</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">PDE A (µg)</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">TDD A (mg)</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">MBS B (kg) [Input]</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">MDD B (mg) [Input]</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">MACO HBEL (mg) [Formula]</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">MACO Dose (mg) [Formula]</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">MACO 10ppm (mg) [Formula]</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">MACO Selezionato [Formula]</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Limite Swab (µg) [Formula]</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Limite Rinse (ppm) [Formula]</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Criterio Governatore [Formula]</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Controllo Ispezione Visiva [Formula]</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Stato Worst-Case</Data></Cell>
   </Row>

   ${evaluation.combinations
     .map((c) => {
       const pdeUg = c.fromProduct.pdeUgDay;
       const tddMg = c.fromProduct.minDailyDoseMg;
       const mbsKg = c.toProduct.minBatchSizeKg || 250;
       const mddMg = c.toProduct.maxDailyDoseMg || 40;
       const rowStyle = c.isWorstCase ? 'WorstCaseRow' : 'DataRow';

       return `<Row ss:StyleID="${rowStyle}">
    <Cell><Data ss:Type="String">${escapeXml(c.fromProduct.name)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(c.toProduct.name)}</Data></Cell>
    <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">${pdeUg}</Data></Cell>
    <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">${tddMg}</Data></Cell>
    <Cell ss:StyleID="InputCell"><Data ss:Type="Number">${mbsKg}</Data></Cell>
    <Cell ss:StyleID="InputCell"><Data ss:Type="Number">${mddMg}</Data></Cell>
    <Cell ss:StyleID="FormulaCell" ss:Formula="=(RC[-4]/1000)*RC[-2]/RC[-1]"><Data ss:Type="Number">${c.macoPdeMg}</Data></Cell>
    <Cell ss:StyleID="FormulaCell" ss:Formula="=(RC[-4]/1000)*RC[-3]/RC[-2]"><Data ss:Type="Number">${c.macoDoseMg}</Data></Cell>
    <Cell ss:StyleID="FormulaCell" ss:Formula="=10*RC[-4]"><Data ss:Type="Number">${c.maco10PpmMg}</Data></Cell>
    <Cell ss:StyleID="FormulaCell" ss:Formula="=MIN(RC[-3],RC[-2],RC[-1])"><Data ss:Type="Number">${c.macoSelectedMg}</Data></Cell>
    <Cell ss:StyleID="FormulaCell" ss:Formula="=(RC[-1]*R5C2/(R4C2*10000))*(R6C2/100)*1000"><Data ss:Type="Number">${c.swabLimitUgPerSwab}</Data></Cell>
    <Cell ss:StyleID="FormulaCell" ss:Formula="=RC[-2]/R7C2"><Data ss:Type="Number">${c.rinseLimitMgL}</Data></Cell>
    <Cell ss:StyleID="FormulaCellText" ss:Formula="=IF(RC[-3]=RC[-6],&quot;PDE / ADE&quot;,IF(RC[-3]=RC[-5],&quot;Dose 0.001&quot;,&quot;10 ppm&quot;))"><Data ss:Type="String">${escapeXml(c.governingCriteria)}</Data></Cell>
    <Cell ss:StyleID="FormulaCellText" ss:Formula="=IF((RC[-3]/R5C2)&lt;R8C2,&quot;Limite Analitico Ok&quot;,&quot;Visivo Più Restrittivo&quot;)"><Data ss:Type="String">Analitico Ok</Data></Cell>
    <Cell ss:StyleID="BadgeCenter"><Data ss:Type="String">${c.isWorstCase ? 'WORST CASE DA VALIDARE' : 'Normale'}</Data></Cell>
   </Row>`;
     })
     .join('\n')}
  </Table>
 </Worksheet>

 <!-- ============================================================= -->
 <!-- WORKSHEET 2: CATALOGO PRODOTTI E CRITERI APIC                 -->
 <!-- ============================================================= -->
 <Worksheet ss:Name="Prodotti &amp; Criteri APIC">
  <Table>
   <Column ss:Width="160"/>
   <Column ss:Width="90"/>
   <Column ss:Width="110"/>
   <Column ss:Width="110"/>
   <Column ss:Width="95"/>
   <Column ss:Width="200"/>
   <Column ss:Width="100"/>
   <Column ss:Width="95"/>
   <Column ss:Width="95"/>
   <Column ss:Width="95"/>
   <Column ss:Width="95"/>
   <Column ss:Width="95"/>
   <Column ss:Width="100"/>
   <Column ss:Width="100"/>

   <Row>
    <Cell ss:StyleID="HeaderTitle"><Data ss:Type="String">CATALOGO PRODOTTI &amp; CRITERI APIC (a, b, c, d)</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="HeaderSubtitle"><Data ss:Type="String">Treno: ${escapeXml(matrix.trainId)} • Classificazione e parametri lotti successivi per calcolo carryover</Data></Cell>
   </Row>
   <Row></Row>

   <Row>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Nome Prodotto</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Codice</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Numero CAS</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Tipologia</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">a) Pulibilità</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Razionale Tecnico (a)</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">b) Solubilità USP</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">c) ADE/PDE (µg)</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">PDE (mg) [Formula]</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Gruppo PDE [Formula]</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">d) Min Dose (mg)</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Gruppo Dose [Formula]</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">MBS Successivo (kg)</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">MDD Successiva (mg)</Data></Cell>
   </Row>

   ${matrix.products
     .map((p) => {
       return `<Row ss:StyleID="DataRow">
    <Cell><Data ss:Type="String">${escapeXml(p.name)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(p.code || '')}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(p.casNumber || 'N/A')}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(p.type)}</Data></Cell>
    <Cell ss:StyleID="BadgeCenter"><Data ss:Type="String">Cat ${p.cleanabilityCategory}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(p.cleanabilityRationale || '')}</Data></Cell>
    <Cell ss:StyleID="BadgeCenter"><Data ss:Type="String">Grp ${p.solubilityGroup}</Data></Cell>
    <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">${p.pdeUgDay}</Data></Cell>
    <Cell ss:StyleID="FormulaCell" ss:Formula="=RC[-1]/1000"><Data ss:Type="Number">${p.pdeMgDay}</Data></Cell>
    <Cell ss:StyleID="FormulaCellText" ss:Formula="=IF(RC[-2]&gt;500,&quot;Gruppo 1&quot;,IF(RC[-2]&gt;=100,&quot;Gruppo 2&quot;,IF(RC[-2]&gt;=10,&quot;Gruppo 3&quot;,IF(RC[-2]&gt;=1,&quot;Gruppo 4&quot;,&quot;Gruppo 5&quot;))))"><Data ss:Type="String">Gruppo ${p.pdeGroup}</Data></Cell>
    <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">${p.minDailyDoseMg}</Data></Cell>
    <Cell ss:StyleID="FormulaCellText" ss:Formula="=IF(RC[-1]&gt;1000,&quot;Gruppo 1&quot;,IF(RC[-1]&gt;=100,&quot;Gruppo 2&quot;,IF(RC[-1]&gt;=10,&quot;Gruppo 3&quot;,IF(RC[-1]&gt;=1,&quot;Gruppo 4&quot;,&quot;Gruppo 5&quot;))))"><Data ss:Type="String">Gruppo ${p.doseGroup}</Data></Cell>
    <Cell ss:StyleID="InputCell"><Data ss:Type="Number">${p.minBatchSizeKg}</Data></Cell>
    <Cell ss:StyleID="InputCell"><Data ss:Type="Number">${p.maxDailyDoseMg}</Data></Cell>
   </Row>`;
     })
     .join('\n')}
  </Table>
 </Worksheet>

 <!-- ============================================================= -->
 <!-- WORKSHEET 3: CALCOLATORE MACO CAP. 4.0 DETTAGLIATO            -->
 <!-- ============================================================= -->
 <Worksheet ss:Name="Calcolatore MACO Cap 4.0">
  <Table>
   <Column ss:Width="250"/>
   <Column ss:Width="160"/>
   <Column ss:Width="260"/>

   <Row>
    <Cell ss:StyleID="HeaderTitle"><Data ss:Type="String">CALCOLATORE ACCETTAZIONE MACO (APIC GUIDA CAPITOLO 4.0)</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="HeaderSubtitle"><Data ss:Type="String">Modello interattivo per la convalida dei residui con formule dinamiche ricalcolabili</Data></Cell>
   </Row>
   <Row></Row>

   <!-- PARAMETRI IMPIANTO -->
   <Row>
    <Cell ss:StyleID="SectionHeader"><Data ss:Type="String">1. PARAMETRI TRENO D'IMPIANTO</Data></Cell>
    <Cell ss:StyleID="SectionHeader"><Data ss:Type="String">VALORE</Data></Cell>
    <Cell ss:StyleID="SectionHeader"><Data ss:Type="String">UNITA / NOTE</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="InputLabel"><Data ss:Type="String">Superficie Totale Condivisa S_tot (m²):</Data></Cell>
    <Cell ss:StyleID="InputCell"><Data ss:Type="Number">${matrix.sharedSurfaceAreaM2}</Data></Cell>
    <Cell ss:Formula="=&quot;Area: &quot; &amp; TEXT(RC[-1]*10000, &quot;#,##0&quot;) &amp; &quot; cm² (&quot; &amp; TEXT(RC[-1]*100, &quot;#,##0&quot;) &amp; &quot; dm²)&quot;"><Data ss:Type="String">Superficie interna a contatto</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="InputLabel"><Data ss:Type="String">Area Dima Tampone Swab A_swab (cm²):</Data></Cell>
    <Cell ss:StyleID="InputCell"><Data ss:Type="Number">${matrix.swabAreaCm2}</Data></Cell>
    <Cell><Data ss:Type="String">Area tipica tampone (es. 25 o 100 cm²)</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="InputLabel"><Data ss:Type="String">Fattore Recupero Analitico WF (%):</Data></Cell>
    <Cell ss:StyleID="InputCell"><Data ss:Type="Number">${matrix.swabRecoveryPercent}</Data></Cell>
    <Cell><Data ss:Type="String">Percentuale recupero validata con tampone</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="InputLabel"><Data ss:Type="String">Volume Solvente Risciacquo V_rinse (L):</Data></Cell>
    <Cell ss:StyleID="InputCell"><Data ss:Type="Number">${matrix.rinseVolumeLiters}</Data></Cell>
    <Cell><Data ss:Type="String">Volume totale del solvente di risciacquo</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="InputLabel"><Data ss:Type="String">Soglia Ispezione Visiva (µg/cm²):</Data></Cell>
    <Cell ss:StyleID="InputCell"><Data ss:Type="Number">${matrix.visualLimitUgCm2}</Data></Cell>
    <Cell><Data ss:Type="String">Limite empirico visivo APIC (4.0 µg/cm²)</Data></Cell>
   </Row>
   <Row></Row>

   <!-- RESIDUO CONTAMINANTE A -->
   <Row>
    <Cell ss:StyleID="SectionHeader"><Data ss:Type="String">2. SOSTANZA CONTAMINANTE (RESIDUO PRECEDENTE A)</Data></Cell>
    <Cell ss:StyleID="SectionHeader"><Data ss:Type="String">VALORE</Data></Cell>
    <Cell ss:StyleID="SectionHeader"><Data ss:Type="String">RIFERIMENTO</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">Denominazione Residuo A:</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(prodA.name)}</Data></Cell>
    <Cell><Data ss:Type="String">CAS: ${escapeXml(prodA.casNumber)}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="InputLabel"><Data ss:Type="String">HBEL / ADE / PDE A (mg/die):</Data></Cell>
    <Cell ss:StyleID="InputCell"><Data ss:Type="Number">${prodA.pdeMgDay}</Data></Cell>
    <Cell ss:Formula="=&quot;Equivalente a: &quot; &amp; TEXT(RC[-1]*1000, &quot;#,##0.00&quot;) &amp; &quot; µg/die&quot;"><Data ss:Type="String">Valore tossicologico</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="InputLabel"><Data ss:Type="String">Dose Minima Terapeutica TDD A (mg):</Data></Cell>
    <Cell ss:StyleID="InputCell"><Data ss:Type="Number">${prodA.minDailyDoseMg}</Data></Cell>
    <Cell><Data ss:Type="String">Dose terapeutica più piccola per 1/1000</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="InputLabel"><Data ss:Type="String">Purging Factor (PF) Par. 4.2.6:</Data></Cell>
    <Cell ss:StyleID="InputCell"><Data ss:Type="Number">1.0</Data></Cell>
    <Cell><Data ss:Type="String">Fattore di spurgo / rimozione per sintesi</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="InputLabel"><Data ss:Type="String">Safety Factor HBEL (SF):</Data></Cell>
    <Cell ss:StyleID="InputCell"><Data ss:Type="Number">1.0</Data></Cell>
    <Cell><Data ss:Type="String">Fattore di sicurezza HBEL (default 1)</Data></Cell>
   </Row>
   <Row></Row>

   <!-- PRODOTTO RICEVENTE B -->
   <Row>
    <Cell ss:StyleID="SectionHeader"><Data ss:Type="String">3. PRODOTTO RICEVENTE (LOTTO SUCCESSIVO B)</Data></Cell>
    <Cell ss:StyleID="SectionHeader"><Data ss:Type="String">VALORE</Data></Cell>
    <Cell ss:StyleID="SectionHeader"><Data ss:Type="String">NOTE</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">Denominazione Successivo B:</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(prodB.name)}</Data></Cell>
    <Cell><Data ss:Type="String">CAS: ${escapeXml(prodB.casNumber)}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="InputLabel"><Data ss:Type="String">Dimensione Minima Lotto MBS B (kg):</Data></Cell>
    <Cell ss:StyleID="InputCell"><Data ss:Type="Number">${prodB.minBatchSizeKg || 250}</Data></Cell>
    <Cell><Data ss:Type="String">Lotto minimo successivo nel treno</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="InputLabel"><Data ss:Type="String">Dose Massima Giornaliera MDD B (mg/die):</Data></Cell>
    <Cell ss:StyleID="InputCell"><Data ss:Type="Number">${prodB.maxDailyDoseMg || 40}</Data></Cell>
    <Cell><Data ss:Type="String">Dose massima giornaliera del prodotto B</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="InputLabel"><Data ss:Type="String">Limite Generale MAXCONC (ppm):</Data></Cell>
    <Cell ss:StyleID="InputCell"><Data ss:Type="Number">10.0</Data></Cell>
    <Cell><Data ss:Type="String">10 ppm standard APIC / 100 ppm per intermedi</Data></Cell>
   </Row>
   <Row></Row>

   <!-- RISULTATI CALCOLATI DINAMICAMENTE CON FORMULE -->
   <Row>
    <Cell ss:StyleID="TableHeaderTeal"><Data ss:Type="String">CRITERIO DI ACCETTAZIONE APIC</Data></Cell>
    <Cell ss:StyleID="TableHeaderTeal"><Data ss:Type="String">VALORE CALCOLATO (FORMULA)</Data></Cell>
    <Cell ss:StyleID="TableHeaderTeal"><Data ss:Type="String">DESCRIZIONE FORMULA EXCEL ATTIVA</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">MACO 4.2.1 Dati Tossicologici HBEL (mg):</Data></Cell>
    <Cell ss:StyleID="FormulaCell" ss:Formula="=(R13C2*R15C2*R20C2)/(R21C2*R16C2)"><Data ss:Type="Number">0.00</Data></Cell>
    <Cell><Data ss:Type="String">=(HBEL_A * PF * MBS_B) / (MDD_B * SF)</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">MACO 4.2.3 Criterio Dose 1/1000 (mg):</Data></Cell>
    <Cell ss:StyleID="FormulaCell" ss:Formula="=(R14C2/1000)*R20C2/R21C2"><Data ss:Type="Number">0.00</Data></Cell>
    <Cell><Data ss:Type="String">=(TDD_A / 1000) * MBS_B / MDD_B</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">MACO 4.2.2 Limite Generale 10 ppm (mg):</Data></Cell>
    <Cell ss:StyleID="FormulaCell" ss:Formula="=R22C2*R20C2"><Data ss:Type="Number">0.00</Data></Cell>
    <Cell><Data ss:Type="String">=MAXCONC_ppm * MBS_B (mg/kg * kg)</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="SectionHeader"><Data ss:Type="String">MACO FINALE GOVERNATORE SELEZIONATO (mg):</Data></Cell>
    <Cell ss:StyleID="FormulaCell" ss:Formula="=MIN(R25C2,R26C2,R27C2)"><Data ss:Type="Number">0.00</Data></Cell>
    <Cell ss:StyleID="SectionHeader"><Data ss:Type="String">=MIN(MACO_HBEL, MACO_Dose, MACO_10ppm)</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">Criterio Governatore:</Data></Cell>
    <Cell ss:StyleID="FormulaCellText" ss:Formula="=IF(R28C2=R25C2,&quot;4.2.1 Dati Tossicologici HBEL&quot;,IF(R28C2=R26C2,&quot;4.2.3 Criterio Dose (0.001)&quot;,&quot;4.2.2 Limite Generale (10 ppm)&quot;))"><Data ss:Type="String">Governatore</Data></Cell>
    <Cell><Data ss:Type="String">Criterio più sfavorevole vincolante</Data></Cell>
   </Row>
   <Row></Row>

   <!-- LIMITI CAMPIONAMENTO -->
   <Row>
    <Cell ss:StyleID="SectionHeader"><Data ss:Type="String">4. LIMITI ANALITICI DI CAMPIONAMENTO</Data></Cell>
    <Cell ss:StyleID="SectionHeader"><Data ss:Type="String">LIMITE CALCOLATO</Data></Cell>
    <Cell ss:StyleID="SectionHeader"><Data ss:Type="String">FORMULA MATEMATICA APIC</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">Limite Tampone Swab (µg/tampone):</Data></Cell>
    <Cell ss:StyleID="FormulaCell" ss:Formula="=(R28C2*R5C2/(R4C2*10000))*(R6C2/100)*1000"><Data ss:Type="Number">0.00</Data></Cell>
    <Cell><Data ss:Type="String">=(MACO * A_swab / (S_tot * 10^4)) * (WF / 100) * 1000</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">Limite Concentrazione Risciacquo (ppm o mg/L):</Data></Cell>
    <Cell ss:StyleID="FormulaCell" ss:Formula="=R28C2/R7C2"><Data ss:Type="Number">0.00</Data></Cell>
    <Cell><Data ss:Type="String">=MACO / V_rinse (mg / Litro)</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">Limite per Unità di Superficie (µg/cm²):</Data></Cell>
    <Cell ss:StyleID="FormulaCell" ss:Formula="=R28C2*1000/(R4C2*10000)"><Data ss:Type="Number">0.00</Data></Cell>
    <Cell><Data ss:Type="String">=MACO_mg * 1000 / (S_tot_m2 * 10000)</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">Verifica Ispezione Visiva:</Data></Cell>
    <Cell ss:StyleID="FormulaCellText" ss:Formula="=IF(R33C2&lt;R8C2,&quot;Limite Analitico Più Restrittivo (Ok)&quot;,&quot;ATTENZIONE: Visivo Più Restrittivo del MACO&quot;)"><Data ss:Type="String">Verifica</Data></Cell>
    <Cell><Data ss:Type="String">Confronto con soglia visiva ${matrix.visualLimitUgCm2} µg/cm²</Data></Cell>
   </Row>
  </Table>
 </Worksheet>
</Workbook>`;

  return xml;
}

/**
 * Standard backward-compatible Excel XML export: invokes the dynamic workbook generator with live formulas.
 */
export function generateMatrixExcelXml(
  matrix: FacilityMatrixTrain,
  allMatricesCount: number = 1
): string {
  return generateDynamicExcelXmlWorkbook(matrix, allMatricesCount);
}

/**
 * Exports a dynamic Excel XML model directly from the APIC MACO Calculator (Scheda 2)
 */
export function generateCalculatorExcelXml(
  calcInput: ApicChapter4CalculationInput,
  calcResult: ApicChapter4CalculationResult,
  trainInfo?: Partial<FacilityMatrixTrain>
): string {
  const syntheticTrain: FacilityMatrixTrain = {
    id: trainInfo?.id || 'Train-Calc',
    matrixIndex: trainInfo?.matrixIndex || 1,
    trainId: trainInfo?.trainId || 'Linea Sintesi Convalida',
    name: trainInfo?.name || 'Impianto Convalidato APIC',
    cleaningClass: trainInfo?.cleaningClass || 'Class I',
    cleaningSolventNotes: trainInfo?.cleaningSolventNotes || 'Acqua Purificata WFI',
    sharedSurfaceAreaM2: calcInput.totalSurfaceAreaM2 || 25,
    swabAreaCm2: calcInput.swabTemplateAreaCm2 || 25,
    swabRecoveryPercent: calcInput.swabRecoveryRatePercent || 85,
    rinseVolumeLiters: calcInput.rinseVolumeLiters || 500,
    visualLimitUgCm2: calcInput.visualCleanlinessThresholdUgCm2 || 4.0,
    products: [
      {
        id: 'calc-prod-a',
        name: 'Residuo Precedente A',
        casNumber: 'CAS-A',
        type: 'API',
        cleanabilityCategory: 2,
        solubilityGroup: 2,
        pdeUgDay: (calcInput.hbelMgDay || 0.15) * 1000,
        pdeMgDay: calcInput.hbelMgDay || 0.15,
        pdeGroup: 2,
        minDailyDoseMg: calcInput.previousMaterialTddMg || 10,
        doseGroup: 3,
        minBatchSizeKg: calcInput.nextMaterialMbsKg || 250,
        maxDailyDoseMg: calcInput.nextMaterialTddMg || 40,
      },
      {
        id: 'calc-prod-b',
        name: 'Prodotto Successivo B',
        casNumber: 'CAS-B',
        type: 'Finished Product',
        cleanabilityCategory: 2,
        solubilityGroup: 2,
        pdeUgDay: 500,
        pdeMgDay: 0.5,
        pdeGroup: 2,
        minDailyDoseMg: 20,
        doseGroup: 2,
        minBatchSizeKg: calcInput.nextMaterialMbsKg || 250,
        maxDailyDoseMg: calcInput.nextMaterialTddMg || 40,
      },
    ],
  };

  return generateDynamicExcelXmlWorkbook(syntheticTrain, 1, calcInput, calcResult);
}

/**
 * Download helper creating a data blob and triggering browser download
 */
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 200);
}
