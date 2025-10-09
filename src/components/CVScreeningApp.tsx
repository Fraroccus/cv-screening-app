'use client';

import { useState } from 'react';
import { JobRequirements, CVData } from '@/types';
import JobRequirementsForm from './JobRequirementsForm';
import CVUpload from './CVUpload';
import CVList from './CVList';

type Tab = 'requirements' | 'upload' | 'results';

export default function CVScreeningApp() {
  const [activeTab, setActiveTab] = useState<Tab>('requirements');
  const [jobRequirements, setJobRequirements] = useState<JobRequirements>({
    position: '',
    requiredSkills: [],
    minExperience: 0,
    education: 'bachelor',
    weights: {
      skills: 50,
      experience: 30,
      education: 20
    }
  });
  const [cvs, setCVs] = useState<CVData[]>([]);

  const handleJobRequirementsSubmit = (requirements: JobRequirements) => {
    setJobRequirements(requirements);
    setActiveTab('upload');
  };

  const handleCVUpload = (newCV: CVData) => {
    setCVs(prev => [...prev, newCV]);
  };

  const handleCVAnalyzed = (analyzedCV: CVData) => {
    setCVs(prev => prev.map(cv => cv.id === analyzedCV.id ? analyzedCV : cv));
    // Auto-switch to results tab when first CV is analyzed
    if (activeTab === 'upload') {
      setActiveTab('results');
    }
  };

  const analyzedCVs = cvs.filter(cv => cv.analysis);

  const tabs = [
    { id: 'requirements' as Tab, label: 'Requisiti Lavoro', disabled: false },
    { id: 'upload' as Tab, label: 'Carica CV', disabled: !jobRequirements.position },
    { id: 'results' as Tab, label: 'Risultati', disabled: analyzedCVs.length === 0 }
  ];

  return (
    <div className="max-w-6xl mx-auto">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : tab.disabled
                  ? 'border-transparent text-gray-400 cursor-not-allowed'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              disabled={tab.disabled}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {activeTab === 'requirements' && (
          <JobRequirementsForm
            initialRequirements={jobRequirements}
            onSubmit={handleJobRequirementsSubmit}
          />
        )}

        {activeTab === 'upload' && (
          <CVUpload
            jobRequirements={jobRequirements}
            onCVUpload={handleCVUpload}
            onCVAnalyzed={handleCVAnalyzed}
          />
        )}

        {activeTab === 'results' && (
          <CVList
            cvs={cvs}
            jobRequirements={jobRequirements}
          />
        )}
      </div>
    </div>
  );
}