import React, { useState } from 'react';
import {
  PharmaceuticalCompound,
  GlobalManufacturer,
  TherapeuticCategory,
  OEBLevel,
  CleanabilityRating,
} from '../types/apic';
import { ALL_MANUFACTURERS, ALL_CATEGORIES } from '../data/globalApiDatabase';
import { X, Plus, Trash2, CheckCircle2 } from 'lucide-react';

interface AddCustomCompoundModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (compound: PharmaceuticalCompound) => void;
  initialPde?: number;
  initialNoael?: number;
  initialFFactors?: any;
}

export const AddCustomCompoundModal: React.FC<AddCustomCompoundModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialPde,
  initialNoael,
  initialFFactors,
}) => {
  const [name, setName] = useState('');
  const [chemicalName, setChemicalName] = useState('');
  const [casNumber, setCasNumber] = useState('');
  const [molecularFormula, setMolecularFormula] = useState('');
  const [molecularWeight, setMolecularWeight] = useState(300);
  const [category, setCategory] = useState<TherapeuticCategory>('Cardiovascular');
  const [selectedMfg, setSelectedMfg] = useState<GlobalManufacturer[]>(['Teva']);
  const [oeb, setOeb] = useState<OEBLevel>('OEB 3');
  const [pdeMgDay, setPdeMgDay] = useState<number>(initialPde || 0.1);
  const [minDailyDoseMg, setMinDailyDoseMg] = useState<number>(10);
  const [maxDailyDoseMg, setMaxDailyDoseMg] = useState<number>(80);
  const [route, setRoute] = useState<'Oral' | 'Parenteral' | 'Inhalation' | 'Topical'>('Oral');
  const [solubility, setSolubility] = useState<PharmaceuticalCompound['solubilityInWater']>('Slightly Soluble');
  const [cleanability, setCleanability] = useState<CleanabilityRating>('Moderate (Detergent/CIP)');
  const [toxicologicalClass, setToxicologicalClass] = useState<PharmaceuticalCompound['toxicologicalClass']>('Non-potent');
  const [cipAgent, setCipAgent] = useState('0.2M NaOH at 60°C seguito da risciacquo WFI');
  const [method, setMethod] = useState<PharmaceuticalCompound['recommendedAnalyticalMethod']>('HPLC-UV');
  const [recovery, setRecovery] = useState<number>(85);

  // Intermediates list
  const [intermediateCode, setIntermediateCode] = useState('');
  const [intermediateName, setIntermediateName] = useState('');
  const [intermediateStage, setIntermediateStage] = useState<'Starting Material' | 'Early Intermediate' | 'Advanced Intermediate' | 'Penultimate'>('Penultimate');
  const [intermediatePde, setIntermediatePde] = useState<number>(0.1);
  const [intermediates, setIntermediates] = useState<PharmaceuticalCompound['intermediates']>([]);

  if (!isOpen) return null;

  const handleAddIntermediate = () => {
    if (!intermediateCode.trim() || !intermediateName.trim()) return;
    setIntermediates((prev) => [
      ...prev,
      {
        id: `custom-int-${Date.now()}-${Math.random()}`,
        code: intermediateCode.trim(),
        name: intermediateName.trim(),
        stage: intermediateStage,
        pdeValueMg: intermediatePde,
        cleanability: cleanability,
      },
    ]);
    setIntermediateCode('');
    setIntermediateName('');
  };

  const handleRemoveIntermediate = (id: string) => {
    setIntermediates((prev) => prev.filter((i) => i.id !== id));
  };

  const toggleManufacturer = (mfg: GlobalManufacturer) => {
    setSelectedMfg((prev) =>
      prev.includes(mfg)
        ? prev.length > 1
          ? prev.filter((m) => m !== mfg)
          : prev
        : [...prev, mfg]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newCompound: PharmaceuticalCompound = {
      id: `custom-${Date.now()}`,
      name: name.trim(),
      chemicalName: chemicalName.trim() || name.trim(),
      casNumber: casNumber.trim() || 'N/A',
      molecularFormula: molecularFormula.trim() || 'C20H25NO3',
      molecularWeight: Number(molecularWeight) || 300,
      category,
      primaryManufacturers: selectedMfg,
      oeb,
      pdeMgDay: Number(pdeMgDay) || 0.1,
      pdeUgDay: (Number(pdeMgDay) || 0.1) * 1000,
      minDailyDoseMg: Number(minDailyDoseMg) || 1,
      maxDailyDoseMg: Number(maxDailyDoseMg) || 10,
      routeOfAdministration: route,
      solubilityInWater: solubility,
      cleanability,
      toxicologicalClass,
      noaelMgKgDay: initialNoael || undefined,
      fFactors: initialFFactors || undefined,
      recommendedAnalyticalMethod: method,
      defaultSwabRecoveryPercent: Number(recovery) || 85,
      suggestedCipCleaningAgent: cipAgent,
      intermediates,
      isCustom: true,
      monographReference: 'Dossier Convalida Interno',
    };

    onSave(newCompound);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl text-slate-100 overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-5 bg-slate-800 border-b border-slate-700">
          <div>
            <h2 className="text-xl font-bold text-white">Aggiungi Nuovo Principio Attivo / Intermedio</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Registra un composto proprietario con limiti ADE/PDE e albero intermedi nel database locale.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto text-xs">
          {/* Main active identity */}
          <div className="space-y-3">
            <h3 className="font-bold text-teal-400 uppercase tracking-wider">Identificazione Chimica & Clinica</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Nome Principio Attivo (INN / Attivo) *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Es. Rosuvastatina Calcio"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-teal-500 font-semibold"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Numero CAS</label>
                <input
                  type="text"
                  value={casNumber}
                  onChange={(e) => setCasNumber(e.target.value)}
                  placeholder="Es. 287714-41-4"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Nome IUPAC / Denominazione Chimica</label>
              <input
                type="text"
                value={chemicalName}
                onChange={(e) => setChemicalName(e.target.value)}
                placeholder="Denominazione chimica completa..."
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Categoria Terapeutica</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as TherapeuticCategory)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none"
                >
                  {ALL_CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Fascia OEB (Contenimento)</label>
                <select
                  value={oeb}
                  onChange={(e) => setOeb(e.target.value as OEBLevel)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none"
                >
                  <option value="OEB 1">OEB 1</option>
                  <option value="OEB 2">OEB 2</option>
                  <option value="OEB 3">OEB 3</option>
                  <option value="OEB 4">OEB 4</option>
                  <option value="OEB 5">OEB 5</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Classe Tossicologica</label>
                <select
                  value={toxicologicalClass}
                  onChange={(e) => setToxicologicalClass(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none"
                >
                  <option value="Non-potent">Non-potent (Standard)</option>
                  <option value="Cytotoxic">Cytotoxic</option>
                  <option value="Genotoxic / Mutagenic Alert">Genotoxic / Mutagenic Alert</option>
                  <option value="Sensitiser">Sensitiser (es. Beta-Lactam)</option>
                  <option value="Hormonal / Teratogenic">Hormonal / Teratogenic</option>
                  <option value="High Potency (HPAPI)">High Potency (HPAPI)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Toxicological limits & dosage */}
          <div className="space-y-3 pt-3 border-t border-slate-800">
            <h3 className="font-bold text-teal-400 uppercase tracking-wider">Limiti Tossicologici & Dosaggio</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">PDE / ADE (mg/die) *</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={pdeMgDay}
                  onChange={(e) => setPdeMgDay(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-teal-300 font-mono font-bold focus:outline-none focus:border-teal-500"
                />
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  = {(pdeMgDay * 1000).toFixed(2)} µg/die
                </span>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Dose Minima Giornaliera (mg)</label>
                <input
                  type="number"
                  step="any"
                  value={minDailyDoseMg}
                  onChange={(e) => setMinDailyDoseMg(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Dose Massima Giornaliera (mg)</label>
                <input
                  type="number"
                  step="any"
                  value={maxDailyDoseMg}
                  onChange={(e) => setMaxDailyDoseMg(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Solubilità in Acqua</label>
                <select
                  value={solubility}
                  onChange={(e) => setSolubility(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none"
                >
                  <option value="Freely Soluble">Freely Soluble</option>
                  <option value="Soluble">Soluble</option>
                  <option value="Sparingly Soluble">Sparingly Soluble</option>
                  <option value="Slightly Soluble">Slightly Soluble</option>
                  <option value="Very Slightly Soluble">Very Slightly Soluble</option>
                  <option value="Practically Insoluble">Practically Insoluble</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Pulibilità CIP</label>
                <select
                  value={cleanability}
                  onChange={(e) => setCleanability(e.target.value as CleanabilityRating)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none"
                >
                  <option value="Easy (Water/Mild)">Easy (Water/Mild)</option>
                  <option value="Moderate (Detergent/CIP)">Moderate (Detergent/CIP)</option>
                  <option value="Difficult (Hot Alkaline/Acid)">Difficult (Hot Alkaline/Acid)</option>
                  <option value="Very Difficult (Solvent Reflux/Boil-out)">Very Difficult (Solvent Reflux/Boil-out)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Global manufacturers checkboxes */}
          <div className="space-y-2 pt-3 border-t border-slate-800">
            <label className="text-slate-400 block font-bold uppercase tracking-wider text-teal-400">
              Produttori Associati:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_MANUFACTURERS.map((mfg) => {
                const isChecked = selectedMfg.includes(mfg);
                return (
                  <button
                    type="button"
                    key={mfg}
                    onClick={() => toggleManufacturer(mfg)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      isChecked
                        ? 'bg-teal-600 text-white font-bold'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {mfg}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Intermediates Section */}
          <div className="space-y-3 pt-3 border-t border-slate-800">
            <h3 className="font-bold text-indigo-400 uppercase tracking-wider">
              Aggiungi Intermedi di Sintesi Collegati ({intermediates.length})
            </h3>

            {intermediates.length > 0 && (
              <div className="space-y-1.5">
                {intermediates.map((intComp) => (
                  <div
                    key={intComp.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-800 border border-slate-700"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-indigo-300">{intComp.code}</span>
                      <span className="text-slate-300">{intComp.name}</span>
                      <span className="text-slate-500 font-mono">({intComp.stage})</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-teal-400 font-mono">{intComp.pdeValueMg} mg/d</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveIntermediate(intComp.id)}
                        className="text-rose-400 hover:text-rose-300 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Codice Intermedio (es. Stage 2 Cloro-derivato)"
                  value={intermediateCode}
                  onChange={(e) => setIntermediateCode(e.target.value)}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs"
                />
                <input
                  type="text"
                  placeholder="Nome Chimico / Descrizione Intermedio"
                  value={intermediateName}
                  onChange={(e) => setIntermediateName(e.target.value)}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <select
                  value={intermediateStage}
                  onChange={(e) => setIntermediateStage(e.target.value as any)}
                  className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                >
                  <option value="Penultimate">Penultimate</option>
                  <option value="Advanced Intermediate">Advanced Intermediate</option>
                  <option value="Early Intermediate">Early Intermediate</option>
                  <option value="Starting Material">Starting Material</option>
                </select>

                <div className="flex items-center space-x-2">
                  <span className="text-slate-400">PDE Intermedio (mg):</span>
                  <input
                    type="number"
                    step="any"
                    value={intermediatePde}
                    onChange={(e) => setIntermediatePde(parseFloat(e.target.value) || 0)}
                    className="w-24 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-teal-300 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleAddIntermediate}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold text-xs flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Aggiungi</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-lg transition-colors"
            >
              Salva Composto nel Database
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
