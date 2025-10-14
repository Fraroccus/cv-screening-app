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

  const extractFileNameFromUrl = (url: string): string => {
    try {
      // Handle Forms/AllItems.aspx URLs - extract from 'id' parameter
      if (url.includes('/Forms/AllItems.aspx')) {
        const urlObj = new URL(url);
        const idParam = urlObj.searchParams.get('id');
        if (idParam) {
          // Extract filename from the path
          const fileName = decodeURIComponent(idParam.split('/').pop() || 'unknown.pdf');
          return fileName;
        }
      }
      
      // Handle sharing links like :b:/g/ or :f:/g/
      if (url.includes('/:b:/') || url.includes('/:f:/')) {
        // For sharing links, we can't easily extract the filename
        // Return a generic name and let the backend handle it
        return 'SharePoint_Document.pdf';
      }
      
      // Handle direct file URLs
      const urlWithoutQuery = url.split('?')[0];
      const fileName = decodeURIComponent(urlWithoutQuery.split('/').pop() || 'unknown.pdf');
      return fileName;
    } catch (error) {
      console.error('Error extracting filename:', error);
      return 'unknown.pdf';
    }
  };

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
      // Extract filename from various SharePoint URL formats
      const fileName = extractFileNameFromUrl(url);
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
      
      {/* Warning Banner */}
      <div className="mb-4 p-3 bg-orange-100 border border-orange-300 rounded-md">
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 text-orange-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="font-medium text-orange-900">Azure AD Setup Required</p>
            <p className="text-sm text-orange-800 mt-1">
              SharePoint URL processing requires Azure AD authentication with Microsoft Graph API permissions.
              Please work with your admin to complete the setup before using this feature.
            </p>
          </div>
        </div>
      </div>
      
      <div className="space-y-4">
        <div className="bg-blue-50 p-3 rounded-md">
          <h4 className="font-medium text-blue-900 mb-2">How to get SharePoint file URLs:</h4>
          <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
            <li>Go to your SharePoint document library</li>
            <li>Right-click on a CV file and select "Copy link" or "Share"</li>
            <li>Paste the URL(s) below (one per line)</li>
            <li>Supported URL formats:
              <ul className="ml-6 mt-1 list-disc space-y-0.5">
                <li>Direct file links: <code className="text-xs bg-blue-100 px-1 rounded">https://.../*.pdf</code></li>
                <li>Sharing links: <code className="text-xs bg-blue-100 px-1 rounded">https://.../:b:/g/...</code></li>
                <li>Forms URLs: <code className="text-xs bg-blue-100 px-1 rounded">https://...AllItems.aspx?id=...</code></li>
              </ul>
            </li>
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
            placeholder="Paste SharePoint URLs here (one per line):
https://yourcompany.sharepoint.com/:b:/g/...
https://yourcompany.sharepoint.com/.../document.pdf
https://yourcompany.sharepoint.com/Forms/AllItems.aspx?id=..."
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
          <p className="font-medium mb-2">Setup Requirements:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Azure AD app registration with your admin</li>
            <li>Microsoft Graph API permissions (Files.Read.All)</li>
            <li>Environment variables configured (AZURE_CLIENT_ID, SHAREPOINT_SITE_URL)</li>
            <li><strong>Alternative:</strong> Download files manually from SharePoint and use the regular file upload above</li>
          </ul>
        </div>
      </div>
    </div>
  );
}