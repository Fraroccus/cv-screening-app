'use client';

import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { JobRequirements, CVData, UploadResponse, AnalysisResponse } from '@/types';
import { formatFileSize } from '@/lib/utils';
import SharePointIntegration from './SharePointIntegration';
import SharePointURLUpload from './SharePointURLUpload';

interface CVUploadProps {
  jobRequirements: JobRequirements;
  onCVUpload: (cv: CVData) => void;
  onCVAnalyzed: (cv: CVData) => void;
}

interface ProcessingStatus {
  fileName: string;
  status: 'uploading' | 'analyzing' | 'completed' | 'error';
  error?: string;
}

export default function CVUpload({ jobRequirements, onCVUpload, onCVAnalyzed }: CVUploadProps) {
  const [processingFiles, setProcessingFiles] = useState<ProcessingStatus[]>([]);
  const [globalStatus, setGlobalStatus] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Clear processing data on component unmount for security
  useEffect(() => {
    return () => {
      console.log('🧹 Clearing upload processing data...');
      setProcessingFiles([]);
      setGlobalStatus('');
    };
  }, []);

  // Handler for folder selection
  const handleFolderSelect = async () => {
    try {
      // Check if browser supports the File System Access API
      if (!('showDirectoryPicker' in window)) {
        alert('Folder selection is not supported in your browser. Please use Chrome, Edge, or Opera (latest versions), or upload a ZIP file instead.');
        return;
      }

      setGlobalStatus('Opening folder picker...');
      
      // @ts-expect-error - showDirectoryPicker is not in TypeScript types yet
      const directoryHandle = await window.showDirectoryPicker();
      
      setGlobalStatus('Scanning folder for CV files...');
      const files: File[] = [];
      
      // Recursively collect all supported files from the directory
      await collectFilesFromDirectory(directoryHandle, files);
      
      if (files.length === 0) {
        setGlobalStatus('No supported CV files found in the selected folder (looking for PDF, DOCX, TXT).');
        setTimeout(() => setGlobalStatus(''), 5000);
        return;
      }
      
      setGlobalStatus(`Found ${files.length} CV file${files.length > 1 ? 's' : ''}. Starting processing...`);
      
      // Process the collected files using the existing onDrop handler
      await onDrop(files);
      
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        setGlobalStatus('Folder selection cancelled.');
      } else {
        console.error('Error selecting folder:', error);
        setGlobalStatus(`Error: ${error instanceof Error ? error.message : 'Failed to select folder'}`);
      }
      setTimeout(() => setGlobalStatus(''), 5000);
    }
  };

  // Recursively collect files from directory and subdirectories
  const collectFilesFromDirectory = async (directoryHandle: any, files: File[]) => {
    const supportedExtensions = ['.pdf', '.docx', '.txt'];
    
    for await (const entry of directoryHandle.values()) {
      if (entry.kind === 'file') {
        const file = await entry.getFile();
        const fileName = file.name.toLowerCase();
        
        // Check if file has a supported extension
        if (supportedExtensions.some(ext => fileName.endsWith(ext))) {
          files.push(file);
        }
      } else if (entry.kind === 'directory') {
        // Recursively process subdirectories
        await collectFilesFromDirectory(entry, files);
      }
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 1000) {
      setGlobalStatus('Troppi file! Seleziona fino a 1000 CV alla volta.');
      setTimeout(() => setGlobalStatus(''), 5000);
      return;
    }

    if (acceptedFiles.length === 0) {
      setGlobalStatus('Nessun file valido selezionato. Scegli file PDF, DOCX, TXT o ZIP.');
      setTimeout(() => setGlobalStatus(''), 5000);
      return;
    }

    setIsProcessing(true);
    setGlobalStatus(`Elaborazione di ${acceptedFiles.length} CV${acceptedFiles.length > 1 ? '' : ''}...`);
    
    // Initialize processing status for all files
    const initialStatus: ProcessingStatus[] = acceptedFiles.map(file => ({
      fileName: file.name,
      status: 'uploading'
    }));
    setProcessingFiles(initialStatus);

    // Process files with concurrency limit to avoid overwhelming the server
    const concurrency = 5; // Process 5 files at a time for better throughput
    const chunks = [];
    for (let i = 0; i < acceptedFiles.length; i += concurrency) {
      chunks.push(acceptedFiles.slice(i, i + concurrency));
    }

    let completed = 0;
    let failed = 0;
    
    for (const chunk of chunks) {
      const results = await Promise.allSettled(chunk.map(file => processFile(file, completed, acceptedFiles.length)));
      
      // Count successful vs failed operations
      results.forEach((result, index) => {
        const fileName = chunk[index].name;
        const fileStatus = processingFiles.find(f => f.fileName === fileName);
        
        if (result.status === 'fulfilled' && fileStatus?.status === 'completed') {
          completed++;
        } else {
          failed++;
        }
      });
    }

    setIsProcessing(false);
    
    // Show appropriate completion message
    if (completed > 0 && failed === 0) {
      setGlobalStatus(`Elaborati con successo ${completed} CV${completed > 1 ? '' : ''}!`);
    } else if (completed > 0 && failed > 0) {
      setGlobalStatus(`Elaborati ${completed} CV con successo, ${failed} falliti.`);
    } else if (failed > 0) {
      setGlobalStatus(`Elaborazione fallita per tutti i ${failed} CV.`);
    }
    
    // Clear status after 5 seconds
    setTimeout(() => {
      setGlobalStatus('');
      setProcessingFiles([]);
    }, 5000);
  }, [jobRequirements]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/zip': ['.zip']
    },
    multiple: true,
    maxFiles: 1000,
    onDropRejected: (fileRejections) => {
      const errors = fileRejections.map(rejection => 
        `${rejection.file.name}: ${rejection.errors.map(e => e.message).join(', ')}`
      ).join('; ');
      setGlobalStatus(`Some files were rejected: ${errors}`);
      setTimeout(() => setGlobalStatus(''), 10000);
    }
  });

  const processFile = async (file: File, currentIndex: number, totalFiles: number) => {
    const updateFileStatus = (status: ProcessingStatus['status'], error?: string) => {
      setProcessingFiles(prev => 
        prev.map(item => 
          item.fileName === file.name 
            ? { ...item, status, error } 
            : item
        )
      );
    };

    try {
      updateFileStatus('uploading');
      
      // Upload file
      const formData = new FormData();
      formData.append('file', file);
      
      console.log('📤 Uploading file:', file.name, 'Size:', file.size, 'Type:', file.type);
      console.log('📋 FormData entries:', Array.from(formData.entries()).map(([key, value]) => {
        if (value instanceof File) {
          return [key, `File(${value.name}, ${value.size} bytes, ${value.type})`];
        }
        return [key, value];
      }));

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      
      console.log('🔍 Upload response status:', uploadResponse.status, uploadResponse.statusText);
      console.log('📋 Response headers:', Object.fromEntries(uploadResponse.headers.entries()));

      if (!uploadResponse.ok) {
        let errorMessage = `Upload failed: ${uploadResponse.statusText}`;
        try {
          // Try to get detailed error from server response
          const errorData = await uploadResponse.json();
          if (errorData.error) {
            errorMessage = errorData.error;
            if (errorData.details) {
              errorMessage += ` (${errorData.details})`;
            }
            if (errorData.suggestions && Array.isArray(errorData.suggestions)) {
              errorMessage += '\n\nSuggerimenti:\n' + errorData.suggestions.join('\n');
            }
          }
        } catch (e) {
          // If can't parse JSON, use status text
          console.log('Could not parse error response as JSON:', e);
        }
        throw new Error(errorMessage);
      }

      const uploadData: UploadResponse = await uploadResponse.json();

      // Check if this is a ZIP archive with multiple files
      if (uploadData.isZipArchive && uploadData.files && Array.isArray(uploadData.files)) {
        console.log(`📦 ZIP archive contains ${uploadData.files.length} files`);
        updateFileStatus('analyzing');
        
        // Process each file from the ZIP individually
        let processedCount = 0;
        let failedCount = 0;
        
        for (const zipFile of uploadData.files) {
          try {
            // Create CV data object for each file in ZIP
            const cvData: CVData = {
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
              fileName: zipFile.fileName,
              fileSize: zipFile.fileSize,
              fileType: zipFile.fileType,
              extractedText: zipFile.extractedText,
              uploadedAt: uploadData.uploadedAt
            };

            onCVUpload(cvData);
            
            // Analyze each CV
            const analysisResponse = await fetch('/api/analyze', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                cvText: zipFile.extractedText,
                jobRequirements
              })
            });

            if (!analysisResponse.ok) {
              console.error(`Analysis failed for ${zipFile.fileName}`);
              failedCount++;
              continue;
            }

            const analysisData: AnalysisResponse = await analysisResponse.json();

            // Update CV with analysis
            const analyzedCV: CVData = {
              ...cvData,
              analysis: analysisData.analysis
            };

            onCVAnalyzed(analyzedCV);
            processedCount++;
            
          } catch (fileError) {
            console.error(`Error processing ${zipFile.fileName} from ZIP:`, fileError);
            failedCount++;
          }
        }
        
        console.log(`✅ ZIP processing complete: ${processedCount} succeeded, ${failedCount} failed`);
        updateFileStatus('completed');
        return;
      }

      // Handle single file (non-ZIP)
      const cvData: CVData = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        fileName: uploadData.fileName,
        fileSize: uploadData.fileSize,
        fileType: uploadData.fileType,
        extractedText: uploadData.extractedText,
        uploadedAt: uploadData.uploadedAt
      };

      onCVUpload(cvData);
      updateFileStatus('analyzing');
      
      // Start analysis
      const analysisResponse = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          cvText: uploadData.extractedText,
          jobRequirements
        })
      });

      if (!analysisResponse.ok) {
        throw new Error(`Analysis failed: ${analysisResponse.statusText}`);
      }

      const analysisData: AnalysisResponse = await analysisResponse.json();

      // Update CV with analysis
      const analyzedCV: CVData = {
        ...cvData,
        analysis: analysisData.analysis
      };

      onCVAnalyzed(analyzedCV);
      updateFileStatus('completed');
      
      // Clear sensitive data after processing
      console.log(`🧹 File ${file.name} processed and cleared from memory`);

    } catch (error) {
      console.error('Error processing file:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      updateFileStatus('error', errorMessage);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        Carica File CV
      </h2>

      {/* Security Notice */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-800">🔒 Protezione Privacy</p>
            <p className="text-xs text-blue-700 mt-1">
              I file CV vengono elaborati solo in memoria e cancellati automaticamente. Nessun dato viene salvato sul server.
            </p>
          </div>
        </div>
      </div>

      <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="font-medium text-blue-900 mb-2">Requisiti Lavoro Attuali:</h3>
        <div className="text-sm text-blue-800">
          <p><strong>Posizione:</strong> {jobRequirements.position}</p>
          <p><strong>Competenze Richieste:</strong> {jobRequirements.requiredSkills.join(', ')}</p>
          <p><strong>Esperienza Minima:</strong> {jobRequirements.minExperience} anni</p>
          <p><strong>Istruzione:</strong> {jobRequirements.education}</p>
          {jobRequirements.preferredSkills && jobRequirements.preferredSkills.length > 0 && (
            <p><strong>Competenze Preferite:</strong> {jobRequirements.preferredSkills.join(', ')}</p>
          )}
        </div>
      </div>

      {/* SharePoint Integration */}
      <div className="mb-6">
        <SharePointIntegration 
          jobRequirements={jobRequirements}
          onCVUpload={onCVUpload}
          onCVAnalyzed={onCVAnalyzed}
        />
      </div>

      {/* SharePoint URL Upload */}
      <div className="mb-6">
        <SharePointURLUpload 
          jobRequirements={jobRequirements}
          onCVUpload={onCVUpload}
          onCVAnalyzed={onCVAnalyzed}
        />
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input {...getInputProps()} />
        
        <div className="space-y-4">
          <div className="mx-auto w-12 h-12 text-gray-400">
            <svg
              className="w-full h-full"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 48 48"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              />
            </svg>
          </div>
          
          {isDragActive ? (
            <p className="text-lg text-blue-600">Rilascia i file CV qui...</p>
          ) : (
            <div>
              <p className="text-lg text-gray-600 mb-2">
                Trascina e rilascia i file CV qui, o clicca per selezionare
              </p>
              <p className="text-sm text-gray-500 mb-1">
                Supporta file PDF, DOCX, TXT e ZIP. Carica fino a 1000 CV in una volta per l'elaborazione di massa.
              </p>
              <p className="text-xs text-gray-400">
                I caricamenti di massa verranno elaborati in lotti per prestazioni ottimali.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Folder Selection Button */}
      <div className="mt-4 flex justify-center">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleFolderSelect();
          }}
          disabled={isProcessing}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <span className="font-medium">Oppure Seleziona Intera Cartella</span>
        </button>
      </div>
      
      <div className="mt-2 text-center">
        <p className="text-xs text-gray-500">
          La selezione cartella funziona in Chrome, Edge e Opera. 
          <br />
          Tutti i file PDF, DOCX e TXT verranno automaticamente estratti dalla cartella e sottocartelle.
        </p>
      </div>

      {/* Status Messages and Progress */}
      {(isProcessing || globalStatus || processingFiles.length > 0) && (
        <div className="mt-4 space-y-4">
          {/* Global Status */}
          {globalStatus && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center space-x-3">
                {isProcessing && (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                )}
                <span className="text-sm font-medium text-blue-800">{globalStatus}</span>
              </div>
            </div>
          )}

          {/* Individual File Progress */}
          {processingFiles.length > 0 && (
            <div className="p-4 bg-gray-50 rounded-lg border">
              <h4 className="text-sm font-medium text-gray-900 mb-3">
                Progresso Elaborazione ({processingFiles.filter(f => f.status === 'completed').length}/{processingFiles.length} completati)
              </h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {processingFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 truncate flex-1 mr-3">{file.fileName}</span>
                    <div className="flex items-center space-x-2">
                      {file.status === 'uploading' && (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                          <span className="text-blue-600">Caricamento...</span>
                        </>
                      )}
                      {file.status === 'analyzing' && (
                        <>
                          <div className="animate-pulse h-4 w-4 bg-yellow-500 rounded-full"></div>
                          <span className="text-yellow-600">Analizzando...</span>
                        </>
                      )}
                      {file.status === 'completed' && (
                        <>
                          <div className="h-4 w-4 bg-green-500 rounded-full flex items-center justify-center">
                            <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <span className="text-green-600">Completato</span>
                        </>
                      )}
                      {file.status === 'error' && (
                        <>
                          <div className="h-4 w-4 bg-red-500 rounded-full flex items-center justify-center">
                            <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <span className="text-red-600" title={file.error}>Errore</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h4 className="font-medium text-yellow-800 mb-2">Suggerimenti per l'elaborazione di massa dei CV:</h4>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>• <strong>Seleziona Cartella Intera:</strong> Usa il pulsante verde per selezionare una cartella - tutti i CV verranno automaticamente estratti</li>
          <li>• <strong>Upload ZIP:</strong> Carica file ZIP contenenti fino a 1000 CV - verranno estratti automaticamente</li>
          <li>• <strong>Selezione File Multipli:</strong> Clicca o trascina fino a 1000 file PDF, DOCX o TXT</li>
          <li>• Assicurati che i file CV siano chiari e ben formattati (i file PDF devono avere testo selezionabile)</li>
          <li>• I file vengono elaborati in lotti di 5 per ottimizzare le prestazioni</li>
          <li>• Usa le opzioni di filtro avanzate nei Risultati per trovare candidati specifici</li>
          <li>• L'IA valuterà e classificherà automaticamente tutti i candidati in base ai tuoi requisiti</li>
        </ul>
      </div>
    </div>
  );
}