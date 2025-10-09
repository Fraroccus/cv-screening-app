'use client';

import { useState } from 'react';
import { JobRequirements, CVData } from '@/types';

interface SharePointURLUploadProps {
  jobRequirements: JobRequirements;
  onCVUpload: (cv: CVData) => void;
  onCVAnalyzed: (cv: CVData) => void;
}

export default function SharePointURLUpload({ 
  jobRequirements, 
  onCVUpload, 
  onCVAnalyzed 
}: SharePointURLUploadProps) {
  const [sharePointUrls, setSharePointUrls] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const processSharePointURLs = async () => {
    if (!sharePointUrls.trim()) {
      setError('Please enter at least one SharePoint file URL');
      return;
    }

    setIsProcessing(true);
    setError('');
    setStatus('Processing SharePoint URLs...');

    try {
      // Split URLs by newlines and filter out empty lines
      const urls = sharePointUrls
        .split('\n')
        .map(url => url.trim())
        .filter(url => url.length > 0);

      let processed = 0;
      let failed = 0;

      for (const url of urls) {
        try {
          setStatus(`Processing ${processed + 1}/${urls.length}: ${url.split('/').pop()}`);

          // Extract filename from URL
          const fileName = decodeURIComponent(url.split('/').pop() || 'unknown.pdf');

          // For now, we'll simulate processing since we need SharePoint access
          // In a real implementation, this would download the file from SharePoint
          const simulatedText = `
CURRICULUM VITAE - ${fileName}

ESPERIENZA LAVORATIVA
2022 - 2024 Senior Developer presso Tech Solutions
Sviluppo applicazioni web con React e Node.js

2020 - 2022 Junior Developer presso StartupXYZ
Programmazione JavaScript e database

FORMAZIONE
2016 - 2019 Laurea in Informatica
Università di Roma

COMPETENZE
JavaScript, React, Node.js, HTML, CSS
          `.trim();

          // Create CV data object
          const cvData: CVData = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            fileName: fileName,
            fileSize: simulatedText.length,
            fileType: fileName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'text/plain',
            extractedText: simulatedText,
            uploadedAt: new Date().toISOString()
          };

          onCVUpload(cvData);

          // Analyze the CV
          const analysisResponse = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              cvText: simulatedText,
              jobRequirements
            })
          });

          if (!analysisResponse.ok) {
            throw new Error(`Analysis failed for ${fileName}`);
          }

          const analysisData = await analysisResponse.json();

          // Update CV with analysis
          const analyzedCV: CVData = {
            ...cvData,
            analysis: analysisData.analysis
          };

          onCVAnalyzed(analyzedCV);
          processed++;

        } catch (fileError) {
          console.error(`Error processing ${url}:`, fileError);
          failed++;
        }
      }

      if (processed > 0 && failed === 0) {
        setStatus(`Successfully processed ${processed} SharePoint files!`);
      } else if (processed > 0 && failed > 0) {
        setStatus(`Processed ${processed} files successfully, ${failed} failed.`);
      } else {
        setError(`Failed to process all ${failed} files.`);
      }

      // Clear the URLs after processing
      setSharePointUrls('');

    } catch (error) {
      console.error('Error processing SharePoint URLs:', error);
      setError('Failed to process SharePoint URLs');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="border rounded-lg p-4 bg-yellow-50 border-yellow-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">SharePoint URL Processing</h3>
      
      <div className="space-y-4">
        <div className="bg-blue-50 p-3 rounded-md">
          <h4 className="font-medium text-blue-900 mb-2">How to get SharePoint file URLs:</h4>
          <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
            <li>Go to your SharePoint document library</li>
            <li>Right-click on a CV file</li>
            <li>Select "Copy link" or "Get link"</li>
            <li>Paste the URL(s) below (one per line)</li>
          </ol>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            SharePoint File URLs (one per line):
          </label>
          <textarea
            value={sharePointUrls}
            onChange={(e) => setSharePointUrls(e.target.value)}
            placeholder="https://yourcompany.sharepoint.com/sites/hr/Shared%20Documents/CVs/cv1.pdf&#10;https://yourcompany.sharepoint.com/sites/hr/Shared%20Documents/CVs/cv2.pdf"
            className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            disabled={isProcessing}
          />
        </div>

        <button
          onClick={processSharePointURLs}
          disabled={isProcessing || !sharePointUrls.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
        >
          {isProcessing ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </>
          ) : (
            'Process SharePoint Files'
          )}
        </button>

        {status && (
          <div className="p-3 bg-blue-50 text-blue-700 rounded-md">
            {status}
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 text-red-700 rounded-md">
            {error}
          </div>
        )}

        <div className="text-xs text-gray-500">
          <p><strong>Note:</strong> Currently using simulated file content for demonstration.</p>
          <p>In production, this would download and process actual files from SharePoint.</p>
        </div>
      </div>
    </div>
  );
}