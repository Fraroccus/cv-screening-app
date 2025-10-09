'use client';

import { useState, useCallback } from 'react';
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

      // Create CV data object
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
          <li>• Carica fino a 1000 CV alla volta per una selezione efficiente di massa</li>
          <li>• Assicurati che i file CV siano chiari e ben formattati (i file PDF devono avere testo selezionabile, i file DOCX devono essere validi, i file ZIP devono contenere documenti supportati)</li>
          <li>• I file vengono elaborati in lotti di 5 per ottimizzare le prestazioni</li>
          <li>• Usa le opzioni di filtro avanzate nei Risultati per trovare candidati specifici</li>
          <li>• L'IA valuterà e classificherà automaticamente tutti i candidati in base ai tuoi requisiti</li>
          <li>• Connettiti a SharePoint per accedere direttamente ai CV archiviati senza caricamenti manuali</li>
        </ul>
      </div>
    </div>
  );
}