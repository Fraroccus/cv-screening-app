'use client';

import { useState } from 'react';
import { PublicClientApplication } from '@azure/msal-browser';
import { JobRequirements, CVData } from '@/types';

// Microsoft Graph API configuration
const MSAL_CONFIG = {
  auth: {
    clientId: process.env.NEXT_PUBLIC_AZURE_CLIENT_ID || 'your-client-id',
    authority: process.env.NEXT_PUBLIC_AZURE_TENANT_ID 
      ? `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_AZURE_TENANT_ID}`
      : 'https://login.microsoftonline.com/common',
    redirectUri: process.env.NEXT_PUBLIC_SHAREPOINT_REDIRECT_URI || 'https://cv-screening-app-sand.vercel.app',
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  }
};

const GRAPH_SCOPES = [
  'User.Read',
  'Files.Read.All',
  'Sites.Read.All'
];

let msalInstance: PublicClientApplication | null = null;

if (typeof window !== 'undefined') {
  msalInstance = new PublicClientApplication(MSAL_CONFIG);
}

interface SharePointFile {
  id: string;
  name: string;
  size: number;
  modified: string;
  url: string;
  fileType: string;
  webUrl: string;
  siteId?: string;
  driveId?: string;
  itemId?: string;
}

interface SharePointIntegrationProps {
  jobRequirements: JobRequirements;
  onCVUpload: (cv: CVData) => void;
  onCVAnalyzed: (cv: CVData) => void;
  onFilesSelected?: (files: SharePointFile[]) => void;
}

export default function SharePointIntegration({ 
  jobRequirements, 
  onCVUpload, 
  onCVAnalyzed,
  onFilesSelected 
}: SharePointIntegrationProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [files, setFiles] = useState<SharePointFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<SharePointFile[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [accessToken, setAccessToken] = useState('');

  // Initialize SharePoint connection using App-Only authentication
  const connectToSharePoint = async () => {
    setIsLoading(true);
    setError('');
    setStatus('Connecting to SharePoint using App-Only authentication...');
    
    try {
      // Get SharePoint site URL from environment or user input
      const siteUrl = process.env.NEXT_PUBLIC_SHAREPOINT_SITE_URL || 'https://yourcompany.sharepoint.com/sites/yoursite';
      
      // Call our SharePoint App-Only auth API
      const authResponse = await fetch('/api/sharepoint/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ siteUrl })
      });
      
      if (!authResponse.ok) {
        const errorData = await authResponse.json();
        throw new Error(errorData.error || 'Authentication failed');
      }
      
      const authData = await authResponse.json();
      setAccessToken(authData.access_token);
      setIsConnected(true);
      setStatus('Connected to SharePoint successfully!');
      
      // Fetch files after successful connection
      await fetchSharePointFiles(authData.access_token);
      
    } catch (err: any) {
      console.error('SharePoint App-Only connection error:', err);
      setError(`Failed to connect to SharePoint: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch files from SharePoint
  const fetchSharePointFiles = async (token?: string) => {
    const currentToken = token || accessToken;
    
    if (!currentToken) {
      setError('Not authenticated with SharePoint');
      return;
    }

    setIsLoading(true);
    setStatus('Fetching files from SharePoint...');
    
    try {
      // Initialize Microsoft Graph client
      const { Client } = await import('@microsoft/microsoft-graph-client');
      
      const graphClient = Client.init({
        authProvider: (done) => {
          done(null, currentToken);
        }
      });
      
      // First, try to get the default SharePoint site
      let siteResponse;
      const customSiteUrl = process.env.NEXT_PUBLIC_SHAREPOINT_SITE_URL;
      
      if (customSiteUrl) {
        // Use custom SharePoint site URL if configured
        const urlMatch = customSiteUrl.match(/https:\/\/([^.]+)\.sharepoint\.com\/sites\/(.+)/);
        if (urlMatch) {
          const [, tenant, siteName] = urlMatch;
          siteResponse = await graphClient
            .api(`/sites/${tenant}.sharepoint.com:/sites/${siteName}`)
            .get();
        } else {
          throw new Error('Invalid SharePoint site URL format');
        }
      } else {
        // Get the root SharePoint site
        siteResponse = await graphClient
          .api('/sites/root')
          .get();
      }
      
      if (!siteResponse) {
        throw new Error('Unable to access SharePoint site');
      }
      
      // Get the default document library (drive)
      const driveResponse = await graphClient
        .api(`/sites/${siteResponse.id}/drive`)
        .get();
      
      // Get files from the specified library path or root
      const libraryPath = process.env.NEXT_PUBLIC_SHAREPOINT_LIBRARY || '';
      let filesEndpoint = `/sites/${siteResponse.id}/drive/root/children`;
      
      if (libraryPath) {
        filesEndpoint = `/sites/${siteResponse.id}/drive/root:/${libraryPath}:/children`;
      }
      
      const filesResponse = await graphClient
        .api(filesEndpoint)
        .filter("file ne null and (endswith(name,'.pdf') or endswith(name,'.docx') or endswith(name,'.txt'))")
        .select('id,name,size,lastModifiedDateTime,webUrl,file')
        .top(50) // Limit to 50 files for performance
        .get();
      
      const sharePointFiles: SharePointFile[] = filesResponse.value.map((file: any) => ({
        id: file.id,
        name: file.name,
        size: file.size,
        modified: file.lastModifiedDateTime,
        url: file.webUrl,
        webUrl: file.webUrl,
        fileType: file.file.mimeType || getFileTypeFromName(file.name),
        siteId: siteResponse.id,
        driveId: driveResponse.id,
        itemId: file.id
      }));
      
      setFiles(sharePointFiles);
      setStatus(`Found ${sharePointFiles.length} CV files in SharePoint`);
      
    } catch (err: any) {
      console.error('SharePoint file fetch error:', err);
      
      // If Graph API fails, fall back to simulated data for development
      if (err.code === 'Forbidden' || err.code === 'Unauthorized') {
        setError('Access denied to SharePoint. Please check your permissions.');
      } else if (err.message?.includes('AADSTS')) {
        setError('Authentication error. Please disconnect and reconnect to SharePoint.');
      } else {
        console.log('Falling back to simulated data for development...');
        
        // Simulated SharePoint files for development
        const mockFiles: SharePointFile[] = [
          {
            id: '1',
            name: 'john_doe_cv.pdf',
            size: 120456,
            modified: '2025-09-15T10:30:00Z',
            url: 'https://company.sharepoint.com/sites/hr/Shared%20Documents/CVs/john_doe_cv.pdf',
            webUrl: 'https://company.sharepoint.com/sites/hr/Shared%20Documents/CVs/john_doe_cv.pdf',
            fileType: 'application/pdf'
          },
          {
            id: '2',
            name: 'jane_smith_resume.pdf',
            size: 98765,
            modified: '2025-09-14T14:22:00Z',
            url: 'https://company.sharepoint.com/sites/hr/Shared%20Documents/CVs/jane_smith_resume.pdf',
            webUrl: 'https://company.sharepoint.com/sites/hr/Shared%20Documents/CVs/jane_smith_resume.pdf',
            fileType: 'application/pdf'
          },
          {
            id: '3',
            name: 'michael_brown_cv.txt',
            size: 45678,
            modified: '2025-09-13T09:15:00Z',
            url: 'https://company.sharepoint.com/sites/hr/Shared%20Documents/CVs/michael_brown_cv.txt',
            webUrl: 'https://company.sharepoint.com/sites/hr/Shared%20Documents/CVs/michael_brown_cv.txt',
            fileType: 'text/plain'
          },
          {
            id: '4',
            name: 'sarah_johnson_cv.pdf',
            size: 112345,
            modified: '2025-09-12T16:45:00Z',
            url: 'https://company.sharepoint.com/sites/hr/Shared%20Documents/CVs/sarah_johnson_cv.pdf',
            webUrl: 'https://company.sharepoint.com/sites/hr/Shared%20Documents/CVs/sarah_johnson_cv.pdf',
            fileType: 'application/pdf'
          },
          {
            id: '5',
            name: 'david_wilson_resume.txt',
            size: 78901,
            modified: '2025-09-11T11:20:00Z',
            url: 'https://company.sharepoint.com/sites/hr/Shared%20Documents/CVs/david_wilson_resume.txt',
            webUrl: 'https://company.sharepoint.com/sites/hr/Shared%20Documents/CVs/david_wilson_resume.txt',
            fileType: 'text/plain'
          }
        ];
        
        setFiles(mockFiles);
        setStatus(`Found ${mockFiles.length} CV files in SharePoint (simulated data)`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to determine file type from name
  const getFileTypeFromName = (fileName: string): string => {
    const extension = fileName.toLowerCase().split('.').pop();
    switch (extension) {
      case 'pdf':
        return 'application/pdf';
      case 'docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'txt':
        return 'text/plain';
      default:
        return 'application/octet-stream';
    }
  };

  // Select/deselect a file
  const toggleFileSelection = (file: SharePointFile) => {
    setSelectedFiles(prev => {
      const isSelected = prev.some(f => f.id === file.id);
      if (isSelected) {
        return prev.filter(f => f.id !== file.id);
      } else {
        return [...prev, file];
      }
    });
  };

  // Select all files
  const selectAllFiles = () => {
    setSelectedFiles([...files]);
  };

  // Deselect all files
  const deselectAllFiles = () => {
    setSelectedFiles([]);
  };

  // Process selected files from SharePoint
  const processSelectedFiles = async () => {
    if (selectedFiles.length === 0) {
      setError('Please select at least one file to process.');
      return;
    }

    setIsLoading(true);
    setStatus(`Processing ${selectedFiles.length} files from SharePoint...`);
    
    if (onFilesSelected) {
      onFilesSelected(selectedFiles);
    }

    try {
      // Process each selected file
      for (const file of selectedFiles) {
        await processSharePointFile(file);
      }
      
      setStatus(`Successfully processed ${selectedFiles.length} files from SharePoint!`);
      setSelectedFiles([]);
    } catch (err) {
      setError('Failed to process files from SharePoint.');
      console.error('SharePoint file processing error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Process a single SharePoint file
  const processSharePointFile = async (file: SharePointFile) => {
    try {
      // Call the SharePoint download API
      const response = await fetch('/api/sharepoint/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ 
          fileUrl: file.url, 
          fileName: file.name,
          siteId: file.siteId,
          driveId: file.driveId,
          itemId: file.itemId
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }

      const downloadData = await response.json();
      
      // Create CV data object
      const cvData: CVData = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        fileName: file.name,
        fileSize: file.size,
        fileType: file.fileType,
        extractedText: downloadData.extractedText,
        uploadedAt: new Date().toISOString()
      };

      onCVUpload(cvData);
      
      // Start analysis
      const analysisResponse = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          cvText: downloadData.extractedText,
          jobRequirements
        })
      });

      if (!analysisResponse.ok) {
        throw new Error(`Analysis failed: ${analysisResponse.statusText}`);
      }

      const analysisData = await analysisResponse.json();

      // Update CV with analysis
      const analyzedCV: CVData = {
        ...cvData,
        analysis: analysisData.analysis
      };

      onCVAnalyzed(analyzedCV);
    } catch (error) {
      console.error('Error processing SharePoint file:', error);
      throw error;
    }
  };

  // Disconnect from SharePoint
  const disconnectFromSharePoint = () => {
    setIsConnected(false);
    setFiles([]);
    setSelectedFiles([]);
    setStatus('');
    setError('');
    setAccessToken('');
    
    // Clear MSAL cache
    if (msalInstance) {
      const accounts = msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        msalInstance.clearCache();
      }
    }
  };

  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">SharePoint Integration</h3>
      
      {!isConnected ? (
        <div className="space-y-4">
          <p className="text-gray-700">
            Connect to SharePoint to directly analyze CVs from your document libraries without manual uploads.
          </p>
          
          <div className="bg-blue-50 p-4 rounded-md">
            <h4 className="font-medium text-blue-900 mb-2">Setup Instructions (Admin Required):</h4>
            <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
              <li>Admin creates Azure AD app registration with Microsoft Graph permissions</li>
              <li>App gets Files.Read.All and Sites.Read.All permissions</li>
              <li>Admin provides Client ID for environment configuration</li>
              <li>Users authenticate with their Microsoft 365 accounts</li>
            </ol>
          </div>
          
          <button
            onClick={connectToSharePoint}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Connecting...
              </>
            ) : (
              'Connect to SharePoint'
            )}
          </button>
          
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-md">
              {error}
            </div>
          )}
          
          {status && (
            <div className="p-3 bg-blue-50 text-blue-700 rounded-md">
              {status}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-medium text-gray-900">SharePoint Files</h4>
            <div className="flex space-x-2">
              <button
                onClick={disconnectFromSharePoint}
                className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Disconnect
              </button>
            </div>
          </div>
          
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
          
          <div className="flex space-x-2">
            <button
              onClick={selectAllFiles}
              className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              Select All
            </button>
            <button
              onClick={deselectAllFiles}
              className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              Deselect All
            </button>
            <button
              onClick={processSelectedFiles}
              disabled={selectedFiles.length === 0 || isLoading}
              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : (
                `Process ${selectedFiles.length} Selected`
              )}
            </button>
          </div>
          
          <div className="border rounded-md max-h-60 overflow-y-auto">
            {files.length > 0 ? (
              <ul className="divide-y divide-gray-200">
                {files.map((file) => {
                  const isSelected = selectedFiles.some(f => f.id === file.id);
                  return (
                    <li key={file.id} className="p-3 hover:bg-gray-50">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleFileSelection(file)}
                          className="h-4 w-4 text-blue-600 rounded"
                        />
                        <div className="ml-3 flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {file.name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {(file.size / 1024).toFixed(1)} KB • {new Date(file.modified).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="ml-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {file.fileType.includes('pdf') ? 'PDF' : file.fileType.includes('word') || file.fileType.includes('docx') ? 'DOCX' : file.fileType.includes('zip') ? 'ZIP' : 'TXT'}
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="p-4 text-center text-gray-500">
                No files found in SharePoint
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}