'use client';

import { useState } from 'react';
import { JobRequirements } from '@/types';

interface JobRequirementsFormProps {
  initialRequirements: JobRequirements;
  onSubmit: (requirements: JobRequirements) => void;
}

export default function JobRequirementsForm({ initialRequirements, onSubmit }: JobRequirementsFormProps) {
  const [requirements, setRequirements] = useState<JobRequirements>({
    ...initialRequirements,
    weights: initialRequirements.weights || {
      skills: 50,
      experience: 30,
      education: 20
    }
  });
  const [newRequiredSkill, setNewRequiredSkill] = useState('');
  const [newPreferredSkill, setNewPreferredSkill] = useState('');
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(requirements);
  };

  const addRequiredSkill = () => {
    if (newRequiredSkill.trim()) {
      setRequirements(prev => ({
        ...prev,
        requiredSkills: [...prev.requiredSkills, newRequiredSkill.trim()]
      }));
      setNewRequiredSkill('');
    }
  };

  const removeRequiredSkill = (index: number) => {
    setRequirements(prev => ({
      ...prev,
      requiredSkills: prev.requiredSkills.filter((_, i) => i !== index)
    }));
  };

  const addPreferredSkill = () => {
    if (newPreferredSkill.trim()) {
      setRequirements(prev => ({
        ...prev,
        preferredSkills: [...(prev.preferredSkills || []), newPreferredSkill.trim()]
      }));
      setNewPreferredSkill('');
    }
  };

  const removePreferredSkill = (index: number) => {
    setRequirements(prev => ({
      ...prev,
      preferredSkills: prev.preferredSkills?.filter((_, i) => i !== index) || []
    }));
  };

  const updateWeight = (category: 'skills' | 'experience' | 'education', value: number) => {
    setRequirements(prev => ({
      ...prev,
      weights: {
        ...prev.weights!,
        [category]: value
      }
    }));
  };

  // Calculate remaining weight for auto-adjustment
  const getCurrentWeights = () => {
    return requirements.weights || { skills: 50, experience: 30, education: 20 };
  };

  const getTotalWeight = () => {
    const weights = getCurrentWeights();
    return weights.skills + weights.experience + weights.education;
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">
        Definisci i Requisiti del Lavoro
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Position Title */}
        <div>
          <label htmlFor="position" className="block text-sm font-medium text-gray-700 mb-1">
            Titolo della Posizione *
          </label>
          <input
            type="text"
            id="position"
            value={requirements.position}
            onChange={(e) => setRequirements(prev => ({ ...prev, position: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            placeholder="es. Sviluppatore Frontend Senior"
            required
          />
        </div>

        {/* Required Skills */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Competenze Richieste *
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newRequiredSkill}
              onChange={(e) => setNewRequiredSkill(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addRequiredSkill())}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Aggiungi una competenza richiesta..."
            />
            <button
              type="button"
              onClick={addRequiredSkill}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Aggiungi
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {requirements.requiredSkills.map((skill, index) => (
              <span
                key={index}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
              >
                {skill}
                <button
                  type="button"
                  onClick={() => removeRequiredSkill(index)}
                  className="ml-2 text-blue-600 hover:text-blue-800"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Preferred Skills */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Competenze Preferite (Opzionale)
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newPreferredSkill}
              onChange={(e) => setNewPreferredSkill(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addPreferredSkill())}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Aggiungi una competenza preferita..."
            />
            <button
              type="button"
              onClick={addPreferredSkill}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Aggiungi
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {requirements.preferredSkills?.map((skill, index) => (
              <span
                key={index}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-800"
              >
                {skill}
                <button
                  type="button"
                  onClick={() => removePreferredSkill(index)}
                  className="ml-2 text-gray-600 hover:text-gray-800"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Minimum Experience */}
        <div>
          <label htmlFor="experience" className="block text-sm font-medium text-gray-700 mb-1">
            Anni Minimi di Esperienza *
          </label>
          <input
            type="number"
            id="experience"
            min="0"
            max="50"
            value={requirements.minExperience}
            onChange={(e) => setRequirements(prev => ({ ...prev, minExperience: parseInt(e.target.value) || 0 }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>

        {/* Education Level */}
        <div>
          <label htmlFor="education" className="block text-sm font-medium text-gray-700 mb-1">
            Livello Minimo di Istruzione *
          </label>
          <select
            id="education"
            value={requirements.education}
            onChange={(e) => setRequirements(prev => ({ ...prev, education: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            required
          >
            <option value="certificate">Certificato</option>
            <option value="diploma">Diploma</option>
            <option value="associate">Laurea Breve</option>
            <option value="bachelor">Laurea Triennale</option>
            <option value="master">Laurea Magistrale</option>
            <option value="phd">Dottorato</option>
          </select>
        </div>

        {/* Advanced Options - Weighting */}
        <div className="border-t pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Opzioni Avanzate
            </h3>
            <button
              type="button"
              onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
            >
              {showAdvancedOptions ? 'Nascondi' : 'Mostra'} Pesi di Valutazione
            </button>
          </div>

          {showAdvancedOptions && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h4 className="text-sm font-medium text-blue-900 mb-3">
                Personalizza l'Importanza dei Criteri di Valutazione
              </h4>
              <p className="text-xs text-blue-700 mb-4">
                Regola quanto peso dare a ciascun criterio nella valutazione finale. I valori devono sommare a 100%.
              </p>
              
              <div className="space-y-4">
                {/* Skills Weight */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-blue-800">
                      💼 Competenze
                    </label>
                    <span className="text-sm text-blue-700 font-medium">
                      {getCurrentWeights().skills}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={getCurrentWeights().skills}
                    onChange={(e) => updateWeight('skills', parseInt(e.target.value))}
                    className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-blue-600 mt-1">
                    <span>Meno importante</span>
                    <span>Più importante</span>
                  </div>
                </div>

                {/* Experience Weight */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-blue-800">
                      🕐 Esperienza
                    </label>
                    <span className="text-sm text-blue-700 font-medium">
                      {getCurrentWeights().experience}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={getCurrentWeights().experience}
                    onChange={(e) => updateWeight('experience', parseInt(e.target.value))}
                    className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-blue-600 mt-1">
                    <span>Meno importante</span>
                    <span>Più importante</span>
                  </div>
                </div>

                {/* Education Weight */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-blue-800">
                      🎓 Istruzione
                    </label>
                    <span className="text-sm text-blue-700 font-medium">
                      {getCurrentWeights().education}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={getCurrentWeights().education}
                    onChange={(e) => updateWeight('education', parseInt(e.target.value))}
                    className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-blue-600 mt-1">
                    <span>Meno importante</span>
                    <span>Più importante</span>
                  </div>
                </div>

                {/* Total Weight Display */}
                <div className="mt-4 p-3 bg-white rounded border">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      Totale:
                    </span>
                    <span className={`text-sm font-bold ${
                      getTotalWeight() === 100 ? 'text-green-600' : 'text-amber-600'
                    }`}>
                      {getTotalWeight()}%
                    </span>
                  </div>
                  {getTotalWeight() !== 100 && (
                    <p className="text-xs text-amber-600 mt-1">
                      ⚠️ I pesi verranno normalizzati automaticamente per sommare al 100%
                    </p>
                  )}
                </div>

                {/* Preset Buttons */}
                <div className="mt-4">
                  <p className="text-xs text-blue-700 mb-2">Preset rapidi:</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setRequirements(prev => ({ 
                        ...prev, 
                        weights: { skills: 50, experience: 30, education: 20 } 
                      }))}
                      className="px-2 py-1 text-xs bg-white border border-blue-300 rounded hover:bg-blue-50"
                    >
                      Bilanciato (50/30/20)
                    </button>
                    <button
                      type="button"
                      onClick={() => setRequirements(prev => ({ 
                        ...prev, 
                        weights: { skills: 100, experience: 0, education: 0 } 
                      }))}
                      className="px-2 py-1 text-xs bg-white border border-blue-300 rounded hover:bg-blue-50"
                    >
                      Solo Competenze (100/0/0)
                    </button>
                    <button
                      type="button"
                      onClick={() => setRequirements(prev => ({ 
                        ...prev, 
                        weights: { skills: 0, experience: 100, education: 0 } 
                      }))}
                      className="px-2 py-1 text-xs bg-white border border-blue-300 rounded hover:bg-blue-50"
                    >
                      Solo Esperienza (0/100/0)
                    </button>
                    <button
                      type="button"
                      onClick={() => setRequirements(prev => ({ 
                        ...prev, 
                        weights: { skills: 0, experience: 0, education: 100 } 
                      }))}
                      className="px-2 py-1 text-xs bg-white border border-blue-300 rounded hover:bg-blue-50"
                    >
                      Solo Istruzione (0/0/100)
                    </button>
                    <button
                      type="button"
                      onClick={() => setRequirements(prev => ({ 
                        ...prev, 
                        weights: { skills: 70, experience: 20, education: 10 } 
                      }))}
                      className="px-2 py-1 text-xs bg-white border border-blue-300 rounded hover:bg-blue-50"
                    >
                      Focus Competenze (70/20/10)
                    </button>
                    <button
                      type="button"
                      onClick={() => setRequirements(prev => ({ 
                        ...prev, 
                        weights: { skills: 30, experience: 60, education: 10 } 
                      }))}
                      className="px-2 py-1 text-xs bg-white border border-blue-300 rounded hover:bg-blue-50"
                    >
                      Focus Esperienza (30/60/10)
                    </button>
                    <button
                      type="button"
                      onClick={() => setRequirements(prev => ({ 
                        ...prev, 
                        weights: { skills: 33, experience: 33, education: 34 } 
                      }))}
                      className="px-2 py-1 text-xs bg-white border border-blue-300 rounded hover:bg-blue-50"
                    >
                      Equo (33/33/34)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!requirements.position || requirements.requiredSkills.length === 0}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Imposta Requisiti e Continua
          </button>
        </div>
      </form>
    </div>
  );
}