import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCsvText,
  parseSqlDump,
  mapRowToCompound,
} from './databaseImporter';

test('parseCsvText parses standard CSV with headers and values', () => {
  const csv = `name,cas,category,oeb,pde_mg_day,min_daily_dose_mg,solubility,cleanability,manufacturers
"Atorvastatin","344423-98-9","Cardiovascular","OEB 3",0.15,10,"Slightly Soluble","Moderate","Teva; Pfizer"
"Paclitaxel","33069-62-4","Oncology / Cytotoxic","OEB 5",0.0006,0.5,"Practically Insoluble","Very Difficult","Lonza"`;

  const result = parseCsvText(csv);
  assert.equal(result.compounds.length, 2);
  assert.equal(result.compounds[0].name, 'Atorvastatin');
  assert.equal(result.compounds[0].casNumber, '344423-98-9');
  assert.equal(result.compounds[0].pdeMgDay, 0.15);
  assert.equal(result.compounds[0].pdeUgDay, 150);
  assert.equal(result.compounds[1].name, 'Paclitaxel');
  assert.equal(result.compounds[1].oeb, 'OEB 5');
});

test('parseCsvText detects semicolon delimiter and quotes', () => {
  const csv = `Nome;CAS;PDE (mg/die);Dose Minima;Produttori
"Rivaroxaban";"366789-02-8";0.08;2.5;"Teva, Dipharma"
"Mesalamina";"89-57-6";2.5;500;"Axplora, Olon"`;

  const result = parseCsvText(csv);
  assert.equal(result.compounds.length, 2);
  assert.equal(result.compounds[0].name, 'Rivaroxaban');
  assert.equal(result.compounds[0].pdeMgDay, 0.08);
  assert.equal(result.compounds[1].name, 'Mesalamina');
  assert.equal(result.compounds[1].pdeMgDay, 2.5);
});

test('parseSqlDump parses multi-row INSERT INTO statement', () => {
  const sql = `
    CREATE TABLE apis (id INT, name VARCHAR(255), cas VARCHAR(64), pde_mg_day DECIMAL(10,6), min_daily_dose_mg DECIMAL(10,2), category VARCHAR(100));
    INSERT INTO apis (name, cas, pde_mg_day, min_daily_dose_mg, category) VALUES
    ('Apixaban', '503612-47-3', 0.05, 2.5, 'Cardiovascular'),
    ('Imatinib Mesylate', '220127-57-1', 0.02, 100, 'Oncology / Cytotoxic');
  `;

  const result = parseSqlDump(sql);
  assert.equal(result.compounds.length, 2);
  assert.equal(result.compounds[0].name, 'Apixaban');
  assert.equal(result.compounds[0].casNumber, '503612-47-3');
  assert.equal(result.compounds[0].pdeMgDay, 0.05);
  assert.equal(result.compounds[1].name, 'Imatinib Mesylate');
  assert.equal(result.compounds[1].pdeMgDay, 0.02);
});

test('mapRowToCompound gracefully handles unit conversions and missing fields', () => {
  const raw = {
    nome_principio_attivo: 'Test Compound X',
    cas: '9999-99-9',
    pde_ug_day: '250', // in ug!
    tdd: '50',
    classe: 'Cardiovascular',
  };

  const comp = mapRowToCompound(raw, 1);
  assert.ok(comp);
  assert.equal(comp?.name, 'Test Compound X');
  assert.equal(comp?.casNumber, '9999-99-9');
  assert.equal(comp?.pdeMgDay, 0.25); // 250 ug converted to 0.25 mg!
  assert.equal(comp?.pdeUgDay, 250);
});
