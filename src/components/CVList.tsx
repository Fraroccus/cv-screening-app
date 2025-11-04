'use client';

import { useState, useMemo } from 'react';
import { CVData, JobRequirements } from '@/types';
import { formatFileSize, getScoreColor, getScoreBgColor } from '@/lib/utils';

interface CVListProps {
  cvs: CVData[];
  jobRequirements: JobRequirements;
}

type SortField = 'score' | 'fileName' | 'uploadedAt';
type SortOrder = 'asc' | 'desc';

interface FilterOptions {
  minScore: number;
  keywordSearch: string;
  positionFilter: string;
  technologyFilter: string;
  certificationFilter: string;
  softSkillsFilter?: string;
}

export default function CVList({ cvs, jobRequirements }: CVListProps) {
  const [sortField, setSortField] = useState<SortField>('score');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [expandedCV, setExpandedCV] = useState<string | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  const [filters, setFilters] = useState<FilterOptions>({
    minScore: 0,
    keywordSearch: '',
    positionFilter: '',
    technologyFilter: '',
    certificationFilter: ''
  });

  // Filter and sort CVs with advanced filtering
  const processedCVs = useMemo(() => {
    return cvs
      .filter(cv => {
        if (!cv.analysis) return false;
        
        // Score filter
        if (cv.analysis.score < filters.minScore) return false;
        
        // Keyword search (searches in CV text, file name, and extracted keywords)
        if (filters.keywordSearch) {
          const keyword = filters.keywordSearch.toLowerCase();
          const searchableText = `${cv.fileName} ${cv.extractedText} ${cv.analysis.metadata.keywords.join(' ')}`.toLowerCase();
          if (!searchableText.includes(keyword)) return false;
        }
        
        // Soft Skills filter
        if (filters.softSkillsFilter) {
          const skillKeyword = filters.softSkillsFilter.toLowerCase();
          const hasSoftSkill = cv.analysis.metadata.softSkills?.some(skill => 
            skill.toLowerCase().includes(skillKeyword)
          );
          if (!hasSoftSkill) return false;
        }
        
        // Technology filter
        if (filters.technologyFilter) {
          const techKeyword = filters.technologyFilter.toLowerCase();
          const hasTechnology = cv.analysis.metadata.technologies.some(tech => 
            tech.toLowerCase().includes(techKeyword)
          ) || cv.analysis.skillsMatch.matched.some(skill =>
            skill.toLowerCase().includes(techKeyword)
          );
          if (!hasTechnology) return false;
        }
        
        // Certification filter
        if (filters.certificationFilter) {
          const certKeyword = filters.certificationFilter.toLowerCase();
          const hasCertification = cv.analysis.metadata.certifications.some(cert => 
            cert.toLowerCase().includes(certKeyword)
          );
          if (!hasCertification) return false;
        }
        
        return true;
      })
      .sort((a, b) => {
        if (!a.analysis || !b.analysis) return 0;
        
        let aValue: any, bValue: any;
        
        switch (sortField) {
          case 'score':
            aValue = a.analysis.score;
            bValue = b.analysis.score;
            break;
          case 'fileName':
            aValue = a.fileName.toLowerCase();
            bValue = b.fileName.toLowerCase();
            break;
          case 'uploadedAt':
            aValue = new Date(a.uploadedAt);
            bValue = new Date(b.uploadedAt);
            break;
          default:
            return 0;
        }
        
        if (sortOrder === 'asc') {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        } else {
          return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        }
      });
  }, [cvs, sortField, sortOrder, filters]);

  // Helper function to update filters
  const updateFilter = (key: keyof FilterOptions, value: string | number) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Get unique values for filter dropdowns
  const getUniqueValues = (field: 'positions' | 'technologies' | 'certifications' | 'softSkills') => {
    const allValues = new Set<string>();
    cvs.forEach(cv => {
      if (cv.analysis?.metadata[field]) {
        cv.analysis.metadata[field].forEach(value => allValues.add(value));
      }
    });
    return Array.from(allValues).sort();
  };

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'score' ? 'desc' : 'asc');
    }
  };

  const exportToCSV = () => {
    const headers = [
      'File Name',
      'Overall Score',
      'Skills Score',
      'Experience Score',
      'Education Score',
      'Matched Skills',
      'Missing Skills',
      'Estimated Experience',
      'Education Level',
      'Upload Date'
    ];

    const rows = processedCVs.map(cv => {
      const analysis = cv.analysis!;
      return [
        cv.fileName,
        analysis.score,
        analysis.skillsMatch.score,
        analysis.experienceAnalysis.score,
        analysis.educationMatch.score,
        analysis.skillsMatch.matched.join('; '),
        analysis.skillsMatch.missing.join('; '),
        `${analysis.experienceAnalysis.estimatedYears} years`,
        analysis.educationMatch.level,
        new Date(cv.uploadedAt).toLocaleDateString()
      ];
    });

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cv-screening-results-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const analyzedCVs = cvs.filter(cv => cv.analysis);
  const pendingCVs = cvs.filter(cv => !cv.analysis);

  if (cvs.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>Nessun CV caricato ancora. Vai alla scheda Carica per aggiungere file CV.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Risultati Selezione CV
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {analyzedCVs.length} analizzati • {pendingCVs.length} in attesa
          </p>
        </div>
        
        {analyzedCVs.length > 0 && (
          <button
            onClick={exportToCSV}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
          >
            Esporta CSV
          </button>
        )}
      </div>

      {/* Security Notice */}
      {analyzedCVs.length > 0 && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-green-800">🔒 Sicurezza dei Dati Attiva</p>
              <p className="text-xs text-green-700 mt-1">
                I dati dei CV vengono automaticamente cancellati dalla memoria quando chiudi o ricarichi questa pagina.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Sorting */}
      {analyzedCVs.length > 0 && (
        <div className="mb-6 space-y-4">
          {/* Basic Filters Row */}
          <div className="p-4 bg-gray-50 rounded-lg border">
            <div className="flex flex-wrap gap-4 items-center justify-between">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Punteggio Min:</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={filters.minScore}
                    onChange={(e) => updateFilter('minScore', parseInt(e.target.value))}
                    className="w-24"
                  />
                  <span className="text-sm text-gray-600">{filters.minScore}%</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Ordina per:</label>
                  <select
                    value={`${sortField}-${sortOrder}`}
                    onChange={(e) => {
                      const [field, order] = e.target.value.split('-');
                      setSortField(field as SortField);
                      setSortOrder(order as SortOrder);
                    }}
                    className="px-3 py-1 border border-gray-300 rounded text-sm"
                  >
                    <option value="score-desc">Punteggio (Alto a Basso)</option>
                    <option value="score-asc">Punteggio (Basso ad Alto)</option>
                    <option value="fileName-asc">Nome (A a Z)</option>
                    <option value="fileName-desc">Nome (Z ad A)</option>
                    <option value="uploadedAt-desc">Data Caricamento (Più Recente)</option>
                    <option value="uploadedAt-asc">Data Caricamento (Più Vecchio)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Cerca parole chiave..."
                    value={filters.keywordSearch}
                    onChange={(e) => updateFilter('keywordSearch', e.target.value)}
                    className="px-3 py-1 border border-gray-300 rounded text-sm w-48"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                >
                  {showAdvancedFilters ? 'Nascondi' : 'Mostra'} Filtri Avanzati
                </button>
                
                <div className="text-sm text-gray-600">
                  Mostrando {processedCVs.length} di {analyzedCVs.length} candidati
                </div>
              </div>
            </div>
          </div>

          {/* Advanced Filters */}
          {showAdvancedFilters && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="text-sm font-medium text-blue-900 mb-3">Filtri Avanzati</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-blue-800 mb-1">Soft Skills</label>
                  <input
                    type="text"
                    placeholder="es. Leadership, Comunicazione"
                    value={filters.softSkillsFilter || ''}
                    onChange={(e) => updateFilter('softSkillsFilter', e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-blue-300 rounded focus:ring-blue-500 focus:border-blue-500"
                  />
                  {getUniqueValues('softSkills').length > 0 && (
                    <select 
                      onChange={(e) => updateFilter('softSkillsFilter', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-blue-300 rounded mt-1"
                    >
                      <option value="">Seleziona soft skill...</option>
                      {getUniqueValues('softSkills').slice(0, 10).map(skill => (
                        <option key={skill} value={skill}>{skill}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-blue-800 mb-1">Posizione</label>
                  <input
                    type="text"
                    placeholder="es. Sviluppatore Senior"
                    value={filters.positionFilter}
                    onChange={(e) => updateFilter('positionFilter', e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-blue-300 rounded focus:ring-blue-500 focus:border-blue-500"
                  />
                  {getUniqueValues('positions').length > 0 && (
                    <select 
                      onChange={(e) => updateFilter('positionFilter', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-blue-300 rounded mt-1"
                    >
                      <option value="">Seleziona posizione...</option>
                      {getUniqueValues('positions').slice(0, 10).map(position => (
                        <option key={position} value={position}>{position}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-blue-800 mb-1">Tecnologia</label>
                  <input
                    type="text"
                    placeholder="es. React, Python"
                    value={filters.technologyFilter}
                    onChange={(e) => updateFilter('technologyFilter', e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-blue-300 rounded focus:ring-blue-500 focus:border-blue-500"
                  />
                  {getUniqueValues('technologies').length > 0 && (
                    <select 
                      onChange={(e) => updateFilter('technologyFilter', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-blue-300 rounded mt-1"
                    >
                      <option value="">Seleziona tecnologia...</option>
                      {getUniqueValues('technologies').slice(0, 15).map(tech => (
                        <option key={tech} value={tech}>{tech}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-blue-800 mb-1">Certificazione</label>
                  <input
                    type="text"
                    placeholder="es. AWS, Azure"
                    value={filters.certificationFilter}
                    onChange={(e) => updateFilter('certificationFilter', e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-blue-300 rounded focus:ring-blue-500 focus:border-blue-500"
                  />
                  {getUniqueValues('certifications').length > 0 && (
                    <select 
                      onChange={(e) => updateFilter('certificationFilter', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-blue-300 rounded mt-1"
                    >
                      <option value="">Seleziona certificazione...</option>
                      {getUniqueValues('certifications').slice(0, 10).map(cert => (
                        <option key={cert} value={cert}>{cert}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
              
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setFilters({
                    minScore: 0,
                    keywordSearch: '',
                    positionFilter: '',
                    technologyFilter: '',
                    certificationFilter: '',
                    softSkillsFilter: ''
                  })}
                  className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                >
                  Cancella Tutti i Filtri
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CV List */}
      <div className="space-y-4">
        {processedCVs.map((cv) => {
          const analysis = cv.analysis!;
          const isExpanded = expandedCV === cv.id;
          
          return (
            <div
              key={cv.id}
              className={`border rounded-lg p-4 ${getScoreBgColor(analysis.score)}`}
            >
              {/* CV Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{cv.fileName}</h3>
                  <p className="text-sm text-gray-500">
                    {formatFileSize(cv.fileSize)} • Uploaded {new Date(cv.uploadedAt).toLocaleDateString()}
                  </p>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${getScoreColor(analysis.score)}`}>
                      {analysis.score}%
                    </div>
                    <div className="text-xs text-gray-500">Punteggio Totale</div>
                  </div>
                  
                  <button
                    onClick={() => setExpandedCV(isExpanded ? null : cv.id)}
                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                  >
                    {isExpanded ? 'Meno' : 'Dettagli'}
                  </button>
                </div>
              </div>

              {/* Quick Summary */}
              <div className="grid grid-cols-4 gap-4 mb-3 text-sm">
                <div>
                  <span className="text-gray-600">Competenze:</span>
                  <span className={`ml-1 font-medium ${getScoreColor(analysis.skillsMatch.score)}`}>
                    {analysis.skillsMatch.score}%
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Esperienza:</span>
                  <span className={`ml-1 font-medium ${getScoreColor(analysis.experienceAnalysis.score)}`}>
                    {analysis.experienceAnalysis.score}%
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Istruzione:</span>
                  <span className={`ml-1 font-medium ${getScoreColor(analysis.educationMatch.score)}`}>
                    {analysis.educationMatch.score}%
                  </span>
                </div>
                {/* Confidence Indicator */}
                {(analysis as any).debug?.confidence && (
                  <div>
                    <span className="text-gray-600">Affidabilità esperienza:</span>
                    <span className={`ml-1 font-medium ${
                      (analysis as any).debug.confidence.overallConfidence >= 85 
                        ? 'text-green-600' 
                        : (analysis as any).debug.confidence.overallConfidence >= 65
                        ? 'text-yellow-600'
                        : 'text-red-600'
                    }`}>
                      {(analysis as any).debug.confidence.overallConfidence}%
                    </span>
                  </div>
                )}
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="border-t pt-4 mt-4 space-y-4">
                  {/* Skills Analysis */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Analisi Competenze</h4>
                    <div className="grid grid-cols-1 gap-4 text-sm">
                      {/* Required Skills */}
                      <div>
                        <span className="text-blue-600 font-medium">Competenze Richieste:</span>
                        <div className="mt-1">
                          {analysis.skillsMatch.requiredMatched && analysis.skillsMatch.requiredMatched.length > 0 ? (
                            <div className="mb-2">
                              <span className="text-xs text-green-600 font-medium">✓ Presenti:</span>
                              <div className="mt-1">
                                {analysis.skillsMatch.requiredMatched.map(skill => (
                                  <span key={skill} className="inline-block bg-green-100 text-green-800 px-2 py-1 rounded text-xs mr-1 mb-1">
                                    {skill}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : null}
                          {analysis.skillsMatch.requiredMissing && analysis.skillsMatch.requiredMissing.length > 0 ? (
                            <div>
                              <span className="text-xs text-red-600 font-medium">✗ Mancanti:</span>
                              <div className="mt-1">
                                {analysis.skillsMatch.requiredMissing.map(skill => (
                                  <span key={skill} className="inline-block bg-red-100 text-red-800 px-2 py-1 rounded text-xs mr-1 mb-1">
                                    {skill}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                      
                      {/* Preferred Skills */}
                      {analysis.skillsMatch.preferredMatched && analysis.skillsMatch.preferredMatched.length > 0 && (
                        <div>
                          <span className="text-purple-600 font-medium">Competenze Preferite (Bonus):</span>
                          <div className="mt-1">
                            {analysis.skillsMatch.preferredMatched.map(skill => (
                              <span key={skill} className="inline-block bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs mr-1 mb-1">
                                {skill} ⭐
                              </span>
                            ))}
                          </div>
                          <p className="text-xs text-purple-600 mt-1">
                            ℹ️ Le competenze preferite sono informative e non influenzano il punteggio principale
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Experience & Education */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Esperienza</h4>
                      <p>
                        <span className="text-gray-600">Stimata:</span> {analysis.experienceAnalysis.estimatedYears} anni
                      </p>
                      <p>
                        <span className="text-gray-600">Richiesta:</span> {jobRequirements.minExperience} anni
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Istruzione</h4>
                      <p>
                        <span className="text-gray-600">Livello:</span> {analysis.educationMatch.level}
                      </p>
                      <p>
                        <span className="text-gray-600">Richiesto:</span> {jobRequirements.education}
                      </p>
                    </div>
                  </div>

                  {/* Strengths & Weaknesses */}
                  {(analysis.strengths.length > 0 || analysis.weaknesses.length > 0) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      {analysis.strengths.length > 0 && (
                        <div>
                          <h4 className="font-medium text-green-800 mb-2">Punti di Forza</h4>
                          <ul className="list-disc list-inside text-gray-700 space-y-1">
                            {analysis.strengths.map((strength, index) => (
                              <li key={index}>{strength}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {analysis.weaknesses.length > 0 && (
                        <div>
                          <h4 className="font-medium text-red-800 mb-2">Aree di Preoccupazione</h4>
                          <ul className="list-disc list-inside text-gray-700 space-y-1">
                            {analysis.weaknesses.map((weakness, index) => (
                              <li key={index}>{weakness}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Recommendations */}
                  {analysis.recommendations.length > 0 && (
                    <div>
                      <h4 className="font-medium text-blue-800 mb-2">Raccomandazioni</h4>
                      <ul className="list-disc list-inside text-gray-700 space-y-1 text-sm">
                        {analysis.recommendations.map((rec, index) => (
                          <li key={index}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Extracted Metadata */}
                  {analysis.metadata && (
                    <div className="border-t pt-4 mt-4">
                      <h4 className="font-medium text-gray-900 mb-3">Informazioni Estratte</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        {analysis.metadata.softSkills && analysis.metadata.softSkills.length > 0 && (
                          <div>
                            <span className="font-medium text-gray-800">Soft Skills:</span>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {analysis.metadata.softSkills.map((skill, index) => (
                                <span key={index} className="inline-block bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs">
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {analysis.metadata.positions.length > 0 && (
                          <div>
                            <span className="font-medium text-gray-800">Posizioni:</span>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {analysis.metadata.positions.map((position, index) => (
                                <span key={index} className="inline-block bg-indigo-100 text-indigo-800 px-2 py-1 rounded text-xs">
                                  {position}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {analysis.metadata.technologies.length > 0 && (
                          <div>
                            <span className="font-medium text-gray-800">Tecnologie:</span>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {analysis.metadata.technologies.slice(0, 10).map((tech, index) => (
                                <span key={index} className="inline-block bg-cyan-100 text-cyan-800 px-2 py-1 rounded text-xs">
                                  {tech}
                                </span>
                              ))}
                              {analysis.metadata.technologies.length > 10 && (
                                <span className="inline-block bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">
                                  +{analysis.metadata.technologies.length - 10} altro
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {analysis.metadata.certifications.length > 0 && (
                          <div>
                            <span className="font-medium text-gray-800">Certificazioni:</span>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {analysis.metadata.certifications.map((cert, index) => (
                                <span key={index} className="inline-block bg-emerald-100 text-emerald-800 px-2 py-1 rounded text-xs">
                                  {cert}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Debug Information */}
                  {(analysis as any).debug && Object.keys((analysis as any).debug).length > 0 && (
                    <div className="border-t pt-4 mt-4">
                      <h4 className="font-medium text-gray-900 mb-3">🔍 Debug Info Esperienza</h4>
                      <div className="text-xs bg-gray-50 p-3 rounded">
                        <div className="mb-2">
                          <strong>Testo CV:</strong> {(analysis as any).debug.originalTextLength} caratteri → {(analysis as any).debug.filteredTextLength} dopo filtri
                        </div>
                        {(analysis as any).debug.removedSections && (analysis as any).debug.removedSections.length > 0 && (
                          <div className="mb-2">
                            <strong>Sezioni Escluse:</strong>
                            <ul className="list-disc list-inside ml-2">
                              {(analysis as any).debug.removedSections.map((section: string, i: number) => (
                                <li key={i}>{section}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {(analysis as any).debug.detectedRanges && (analysis as any).debug.detectedRanges.length > 0 && (
                          <div className="mb-2">
                            <strong>Range Date Rilevate:</strong>
                            <ul className="list-disc list-inside ml-2">
                              {(analysis as any).debug.detectedRanges.map((range: string, i: number) => (
                                <li key={i} className="mb-1">
                                  <div className="text-green-700">"{range}"</div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {(analysis as any).debug.rawPeriods && (analysis as any).debug.rawPeriods.length > 0 && (
                          <div className="mb-2">
                            <strong>Periodi Elaborati:</strong>
                            <ul className="list-disc list-inside ml-2">
                              {(analysis as any).debug.rawPeriods.map((period: any, i: number) => (
                                <li key={i} className="mb-2">
                                  <div><strong>"{period.original}"</strong></div>
                                  <div className="text-blue-600 ml-4">{period.start} → {period.end} ({period.duration?.toFixed(1)} anni)</div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {(analysis as any).debug.mergedPeriods && (analysis as any).debug.mergedPeriods.length > 0 && (
                          <div className="mb-2">
                            <strong>Periodi Uniti:</strong>
                            <ul className="list-disc list-inside ml-2">
                              {(analysis as any).debug.mergedPeriods.map((period: any, i: number) => (
                                <li key={i} className="mb-1">
                                  <div className="text-purple-600">{period.start} → {period.end} ({period.duration?.toFixed(1)} anni)</div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {/* Gap Detection Results */}
                        {(analysis as any).debug.overlapAnalysis?.detectedGaps && (analysis as any).debug.overlapAnalysis.detectedGaps.length > 0 && (
                          <div className="mb-2">
                            <strong className="text-blue-600">📊 Gap Lavorativi:</strong>
                            <ul className="list-disc list-inside ml-2">
                              {(analysis as any).debug.overlapAnalysis.detectedGaps.map((gap: any, i: number) => (
                                <li key={i} className="mb-1">
                                  <div className="text-blue-700">Gap di {gap.gapMonths?.toFixed(1)} mesi ({gap.gapType})</div>
                                  <div className="text-xs text-gray-600 ml-4">
                                    {gap.beforePeriod?.start} → {gap.beforePeriod?.end} ••• {gap.afterPeriod?.start} → {gap.afterPeriod?.end}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {/* Legacy gap detection for backward compatibility */}
                        {!(analysis as any).debug.overlapAnalysis?.detectedGaps && (analysis as any).debug.detectedGaps && (analysis as any).debug.detectedGaps.length > 0 && (
                          <div className="mb-2">
                            <strong className="text-blue-600">📊 Gap Lavorativi:</strong>
                            <ul className="list-disc list-inside ml-2">
                              {(analysis as any).debug.detectedGaps.map((gap: any, i: number) => (
                                <li key={i} className="mb-1">
                                  <div className="text-blue-700">Gap di {gap.gapMonths?.toFixed(1)} mesi ({gap.gapType})</div>
                                  <div className="text-xs text-gray-600 ml-4">
                                    {gap.beforePeriod?.start} → {gap.beforePeriod?.end} ••• {gap.afterPeriod?.start} → {gap.afterPeriod?.end}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {/* Confidence Information */}
                        {(analysis as any).debug.confidence && (
                          <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded">
                            <div className="flex items-center justify-between mb-2">
                              <strong className="text-blue-800">🎯 Affidabilità Calcolo</strong>
                              <span className={`px-2 py-1 rounded text-sm font-medium ${
                                (analysis as any).debug.confidence.overallConfidence >= 85 
                                  ? 'bg-green-100 text-green-800' 
                                  : (analysis as any).debug.confidence.overallConfidence >= 65
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {(analysis as any).debug.confidence.overallConfidence}% Sicurezza
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-gray-600">Chiarezza Date:</span>
                                <span className="ml-1 font-medium">{(analysis as any).debug.confidence.factors.dateFormatClarity}%</span>
                              </div>
                              <div>
                                <span className="text-gray-600">Qualità Contesto:</span>
                                <span className="ml-1 font-medium">{(analysis as any).debug.confidence.factors.contextQuality}%</span>
                              </div>
                              <div>
                                <span className="text-gray-600">Filtro Educazione:</span>
                                <span className="ml-1 font-medium">{(analysis as any).debug.confidence.factors.educationFiltering}%</span>
                              </div>
                              <div>
                                <span className="text-gray-600">Affidabilità Gap:</span>
                                <span className="ml-1 font-medium">{(analysis as any).debug.confidence.factors.gapReliability}%</span>
                              </div>
                            </div>
                            {(analysis as any).debug.confidence.details && (analysis as any).debug.confidence.details.length > 0 && (
                              <div className="mt-2 text-xs text-blue-700">
                                <details>
                                  <summary className="cursor-pointer hover:text-blue-800">Dettagli Analisi</summary>
                                  <ul className="mt-1 ml-4 space-y-1">
                                    {(analysis as any).debug.confidence.details.map((detail: string, i: number) => (
                                      <li key={i}>{detail}</li>
                                    ))}
                                  </ul>
                                </details>
                              </div>
                            )}
                          </div>
                        )}
                        
                        <div>
                          <strong>Esperienza Finale:</strong> {(analysis as any).debug.finalExperience} anni
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Pending CVs */}
        {pendingCVs.map((cv) => (
          <div key={cv.id} className="border rounded-lg p-4 bg-yellow-50 border-yellow-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">{cv.fileName}</h3>
                <p className="text-sm text-gray-500">
                  {formatFileSize(cv.fileSize)} • Elaborazione in corso...
                </p>
              </div>
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-yellow-600"></div>
            </div>
          </div>
        ))}

        {processedCVs.length === 0 && analyzedCVs.length > 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>Nessun candidato corrisponde ai criteri di filtro attuali.</p>
            <p className="text-sm mt-1">
              {filters.minScore > 0 && `Punteggio minimo: ${filters.minScore}% • `}
              {filters.keywordSearch && `Parole chiave: "${filters.keywordSearch}" • `}
              {filters.softSkillsFilter && `Soft Skills: "${filters.softSkillsFilter}" • `}
              {filters.positionFilter && `Posizione: "${filters.positionFilter}" • `}
              {filters.technologyFilter && `Tecnologia: "${filters.technologyFilter}" • `}
              {filters.certificationFilter && `Certificazione: "${filters.certificationFilter}"`}
            </p>
            <button
              onClick={() => setFilters({
                minScore: 0,
                keywordSearch: '',
                positionFilter: '',
                technologyFilter: '',
                certificationFilter: '',
                softSkillsFilter: ''
              })}
              className="mt-2 px-4 py-2 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
            >
              Cancella Tutti i Filtri
            </button>
          </div>
        )}
      </div>
    </div>
  );
}