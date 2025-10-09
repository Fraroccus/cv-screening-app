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
  const [results, setResults] = useState<Array<{
    fileName: string;
    status: 'success' | 'failed';
    message: string;
  }>>([]);

  const validateSharePointUrl = (url: string): boolean => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.includes('sharepoint.com') || 
             urlObj.hostname.includes('onedrive.com');
    } catch {
      return false;
    }
  };

  const downloadAndAnalyzeCV = async (
    url: string,
    index: number,
    total: number
  ): Promise<{ fileName: string; status: 'success' | 'failed'; message: string }> => {
    try {
      const fileName = decodeURIComponent(url.split('/').pop() || 'unknown.pdf');
      setStatus(`Downloading ${index}/${total}: ${fileName}...`);

      // Download file from SharePoint via your backend
      const downloadResponse = await fetch('/api/sharepoint/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fileUrl: url, fileName: fileName })
      });

      if (!downloadResponse.ok) {
        const errorData = await downloadResponse.json();
        throw new Error(errorData.error || 'Failed to download file');
      }

      const downloadData = await downloadResponse.json();
      const cvText = downloadData.extractedText;

      if (!cvText || cvText.trim().length === 0) {
        throw new Error('No text content extracted from file');
      }

      // Create CV data object
      const cvData: CVData = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        fileName: downloadData.fileName || fileName,
        fileSize: cvText.length,
        fileType: downloadData.fileType || (fileName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'text/plain'),
        extractedText: cvText,
        uploadedAt: new Date().toISOString()
      };

      onCVUpload(cvData);

      // Analyze the CV
      setStatus(`Analyzing ${index}/${total}: ${fileName}...`);

      const analysisResponse = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          cvText: cvText,
          jobRequirements
        })
      });

      if (!analysisResponse.ok) {
        const errorData = await analysisResponse.json();
        throw new Error(errorData.error || 'Analysis failed');
      }

      const analysisData = await analysisResponse.json();

      if (!analysisData?.analysis) {
        throw new Error('Invalid analysis response');
      }

      // Update CV with analysis
      const analyzedCV: CVData = {
        ...cvData,
        analysis: analysisData.analysis
      };

      onCVAnalyzed(analyzedCV);

      return {
        fileName,
        status: 'success',
        message: `Successfully processed. Experience: ${analysisData.analysis.experienceAnalysis?.estimatedYears || 'N/A'} years`
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error processing SharePoint URL:', error);
      
      return {
        fileName: url.split('/').pop() || 'unknown',
        status: 'failed',
        message: errorMessage
      };
    }
  };

  const processSharePointURLs = async () => {
    if (!sharePointUrls.trim()) {
      setError('Please enter at least one SharePoint file URL');
      return;
    }

    setIsProcessing(true);
    setError('');
    setStatus('');
    setResults([]);

    try {
      // Split URLs by newlines and filter out empty lines
      const urls = sharePointUrls
        .split('\n')
        .map(url => url.trim())
        .filter(url => url.length > 0);

      // Validate all URLs first
      const invalidUrls = urls.filter(url => !validateSharePointUrl(url));
      if (invalidUrls.length > 0) {
        const errorMsg = 'Invalid SharePoint URLs detected:\n' + 
                        invalidUrls.join('\n') + 
                        '\n\nSharePoint URLs should be from sharepoint.com or onedrive.com domains.';
        setError(errorMsg);
        setIsProcessing(false);
        return;
      }

      const processedResults: Array<{
        fileName: string;
        status: 'success' | 'failed';
        message: string;
      }> = [];

      for (let i = 0; i < urls.length; i++) {
        const result = await downloadAndAnalyzeCV(urls[i], i + 1, urls.length);
        processedResults.push(result);
      }

      setResults(processedResults);

      const successCount = processedResults.filter(r => r.status === 'success').length;
      const failedCount = processedResults.filter(r => r.status === 'failed').length;

      if (successCount > 0 && failedCount === 0) {
        setStatus(`✅ Successfully processed ${successCount} SharePoint file(s)!`);
      } else if (successCount > 0 && failedCount > 0) {
        setStatus(`⚠️ Processed ${successCount} file(s) successfully, ${failedCount} failed.`);
      } else {
        setError(`❌ Failed to process all ${failedCount} file(s).`);
      }

      // Clear the URLs after processing
      if (successCount > 0) {
        setSharePointUrls('');
      }

    } catch (error) {
      console.error('Error processing SharePoint URLs:', error);
      setError(error instanceof Error ? error.message : 'Failed to process SharePoint URLs');
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
            <li>Make sure you have permission to access the files</li>
          </ol>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            SharePoint File URLs (one per line):
          </label>
          <textarea
            value={sharePointUrls}
            onChange={(e) => setSharePointUrls(e.target.value)}
            placeholder="https://yourcompany.sharepoint.com/sites/hr/Shared%20Documents/CVs/cv1.pdf"
            className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm font-mono"
            disabled={isProcessing}
          />
        </div>

        <button
          onClick={processSharePointURLs}
          disabled={isProcessing || !sharePointUrls.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {isProcessing ? (
            <>
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
          <div className={`p-3 rounded-md ${status.includes('✅') ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
            {status}
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 text-red-700 rounded-md whitespace-pre-wrap">
            {error}
          </div>
        )}

        {results.length > 0 && (
          <div className="border rounded-md p-4 bg-gray-50">
            <h4 className="font-medium text-gray-900 mb-3">Processing Results:</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {results.map((result, index) => (
                <div
                  key={index}
                  className={`p-2 rounded text-sm flex items-start gap-2 ${
                    result.status === 'success'
                      ? 'bg-green-50 text-green-800'
                      : 'bg-red-50 text-red-800'
                  }`}
                >
                  <span className="mt-0.5">
                    {result.status === 'success' ? '✓' : '✗'}
                  </span>
                  <div>
                    <p className="font-medium">{result.fileName}</p>
                    <p className="text-xs opacity-75">{result.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded">
          <p className="font-medium mb-2">Requirements:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>SharePoint URLs must be from sharepoint.com or onedrive.com domains</li>
            <li>Your account must have read access to the files</li>
            <li>Backend will process files through existing upload pipeline</li>
            <li>PDF and DOCX files will be automatically parsed</li>
            <li>Results will appear in the main CV analysis results</li>
          </ul>
        </div>
      </div>
    </div>
  );
}