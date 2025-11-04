import { NextRequest, NextResponse } from 'next/server';
import * as mammoth from 'mammoth';
import JSZip from 'jszip';
import { uploadRateLimiter, getClientIp } from '@/lib/rate-limit';

// Increase the maximum execution time for batch processing
export const maxDuration = 300; // 5 minutes for large batch uploads
export const dynamic = 'force-dynamic';

// Configuration for handling large uploads
const UPLOAD_CONFIG = {
  maxFileSize: 10 * 1024 * 1024, // 10MB per file
  maxTotalSize: 1000 * 1024 * 1024, // 1000MB total batch size
  supportedTypes: ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'],
  maxConcurrentProcessing: 5,
};

export async function POST(request: NextRequest) {
  console.log('📤 Upload API called at:', new Date().toISOString());
  console.log('📋 Request headers:', Object.fromEntries(request.headers.entries()));
  console.log('📍 Request URL:', request.url);
  console.log('🔧 Request method:', request.method);
  
  // Rate limiting check
  const clientIp = getClientIp(request);
  const rateLimitResult = uploadRateLimiter.check(clientIp);
  
  // Add rate limit headers to all responses
  const rateLimitHeaders = {
    'X-RateLimit-Limit': rateLimitResult.limit.toString(),
    'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
    'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString(),
  };
  
  if (!rateLimitResult.allowed) {
    console.log(`⚠️ Rate limit exceeded for IP: ${clientIp}`);
    const resetDate = new Date(rateLimitResult.resetTime);
    const resetMinutes = Math.ceil((rateLimitResult.resetTime - Date.now()) / 60000);
    
    return NextResponse.json({
      error: 'Limite di richieste superato',
      message: `Hai superato il limite di ${rateLimitResult.limit} caricamenti ogni 10 minuti. Riprova tra ${resetMinutes} minuti.`,
      resetAt: resetDate.toISOString(),
      resetIn: `${resetMinutes} minuti`
    }, { 
      status: 429,
      headers: rateLimitHeaders
    });
  }
  
  console.log(`✅ Rate limit OK for IP ${clientIp}: ${rateLimitResult.remaining} requests remaining`);
  
  try {
    console.log('🔄 Processing upload request...');
    
    // Check if request has form data
    const contentType = request.headers.get('content-type');
    console.log('📄 Content-Type:', contentType);
    
    if (!contentType || !contentType.includes('multipart/form-data')) {
      console.log('❌ Invalid content type - expected multipart/form-data, got:', contentType);
      return NextResponse.json({ 
        error: 'Tipo di contenuto non valido. Richiesto multipart/form-data.' 
      }, { status: 400 });
    }
    
    const formData = await request.formData();
    console.log('✅ FormData received successfully');
    console.log('📝 FormData keys:', Array.from(formData.keys()));
    
    const file = formData.get('file') as File;
    
    if (!file) {
      console.log('No file provided');
      return NextResponse.json({ error: 'Nessun file caricato' }, { status: 400 });
    }

    console.log(`File received: ${file.name}, size: ${file.size}, type: ${file.type}`);
    
    // Validate file size
    if (file.size > UPLOAD_CONFIG.maxFileSize) {
      return NextResponse.json({ 
        error: `File troppo grande. Dimensione massima consentita: ${UPLOAD_CONFIG.maxFileSize / (1024 * 1024)}MB` 
      }, { status: 400 });
    }
    
    // Validate file type
    if (!UPLOAD_CONFIG.supportedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: `Tipo di file non supportato: ${file.type}. Tipi supportati: ${UPLOAD_CONFIG.supportedTypes.join(', ')}` 
      }, { status: 400 });
    }

    // Convert file to buffer with better memory management
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    console.log('File converted to buffer, size:', buffer.length, 'bytes');

    let extractedText = '';
    
    // Extract text based on file type with optimized processing
    if (file.type === 'application/pdf') {
      console.log('📝 Processing PDF file...');
      try {
        // Use dynamic import to avoid test file dependency issues
        const pdfParse = (await import('pdf-parse')).default;
        
        // Configure PDF parsing for better performance with large batches
        const options = {
          max: 0, // Parse all pages
        };
        
        const data = await pdfParse(buffer, options);
        extractedText = data.text;
        console.log(`✅ PDF text extracted successfully`);
        console.log(`📊 PDF stats - Pages: ${data.numpages}, Version: ${data.version}`);
        console.log(`📏 Text length: ${extractedText.length} characters`);
        console.log(`🗒️ First 200 chars: "${extractedText.substring(0, 200)}..."`);
        console.log(`🔍 Text preview (after trim): "${extractedText.trim().substring(0, 100)}..."`);
      } catch (pdfError) {
        console.error('❌ PDF parsing error:', pdfError);
        console.error('🐞 PDF error type:', pdfError instanceof Error ? pdfError.name : typeof pdfError);
        console.error('📜 PDF error message:', pdfError instanceof Error ? pdfError.message : 'Unknown error');
        return NextResponse.json({ 
          error: 'Errore nell\'elaborazione del file PDF. Assicurati che il PDF contenga testo selezionabile e non sia protetto da password.',
          details: pdfError instanceof Error ? pdfError.message : 'Unknown PDF parsing error'
        }, { status: 400 });
      }
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      console.log('📝 Processing DOCX file...');
      try {
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value;
        
        if (result.messages && result.messages.length > 0) {
          console.log('⚠️ DOCX parsing warnings:', result.messages.map(m => m.message).join(', '));
        }
        
        console.log(`✅ DOCX text extracted successfully`);
        console.log(`📏 Text length: ${extractedText.length} characters`);
        console.log(`🗒️ First 200 chars: "${extractedText.substring(0, 200)}..."`);
        console.log(`🔍 Text preview (after trim): "${extractedText.trim().substring(0, 100)}..."`);
      } catch (docxError) {
        console.error('❌ DOCX parsing error:', docxError);
        console.error('🐞 DOCX error type:', docxError instanceof Error ? docxError.name : typeof docxError);
        console.error('📜 DOCX error message:', docxError instanceof Error ? docxError.message : 'Unknown error');
        return NextResponse.json({ 
          error: 'Errore nell\'elaborazione del file DOCX. Assicurati che il file Word non sia corrotto o protetto da password.',
          details: docxError instanceof Error ? docxError.message : 'Unknown DOCX parsing error'
        }, { status: 400 });
      }
    } else if (file.type === 'application/zip') {
      console.log('📦 Processing ZIP file...');
      try {
        const zip = new JSZip();
        const zipContent = await zip.loadAsync(buffer);
        
        const extractedFiles: { name: string; content: string }[] = [];
        
        // Process each file in the ZIP
        for (const [filename, zipEntry] of Object.entries(zipContent.files)) {
          if (zipEntry.dir) continue; // Skip directories
          
          console.log(`Processing file in ZIP: ${filename}`);
          
          try {
            // Get file extension
            const fileExt = filename.toLowerCase().split('.').pop();
            
            if (fileExt === 'pdf') {
              // Process PDF files
              const fileBuffer = await zipEntry.async('nodebuffer');
              const pdfParse = (await import('pdf-parse')).default;
              const pdfData = await pdfParse(fileBuffer);
              extractedFiles.push({
                name: filename,
                content: pdfData.text
              });
            } else if (fileExt === 'docx') {
              // Process DOCX files
              const fileBuffer = await zipEntry.async('nodebuffer');
              const result = await mammoth.extractRawText({ buffer: fileBuffer });
              extractedFiles.push({
                name: filename,
                content: result.value
              });
            } else if (fileExt === 'txt') {
              // Process TXT files
              const textContent = await zipEntry.async('string');
              extractedFiles.push({
                name: filename,
                content: textContent
              });
            } else {
              console.log(`Skipping unsupported file: ${filename}`);
            }
          } catch (fileError) {
            console.error(`Error processing file ${filename}:`, fileError);
            // Continue with other files even if one fails
          }
        }
        
        if (extractedFiles.length === 0) {
          return NextResponse.json({
            error: 'Il file ZIP non contiene documenti supportati (PDF, DOCX, TXT).',
            suggestions: [
              '1. Verificare che il ZIP contenga file PDF, DOCX o TXT',
              '2. Assicurarsi che i file nel ZIP non siano corrotti',
              '3. Provare a decomprimere e caricare i file singolarmente'
            ]
          }, { status: 400 });
        }
        
        console.log(`✅ ZIP processed successfully - ${extractedFiles.length} files extracted`);
        
        // Return array of individual files instead of combined text
        return NextResponse.json({
          success: true,
          isZipArchive: true,
          fileName: file.name,
          fileCount: extractedFiles.length,
          files: extractedFiles.map(f => ({
            fileName: f.name,
            fileSize: f.content.length,
            fileType: f.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 
                     f.name.toLowerCase().endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 
                     'text/plain',
            extractedText: f.content
          })),
          uploadedAt: new Date().toISOString()
        }, {
          headers: rateLimitHeaders
        });
        
      } catch (zipError) {
        console.error('❌ ZIP processing error:', zipError);
        console.error('🐞 ZIP error type:', zipError instanceof Error ? zipError.name : typeof zipError);
        console.error('📜 ZIP error message:', zipError instanceof Error ? zipError.message : 'Unknown error');
        return NextResponse.json({ 
          error: 'Errore nell\'elaborazione del file ZIP. Assicurati che il file ZIP non sia corrotto o protetto da password.',
          details: zipError instanceof Error ? zipError.message : 'Unknown ZIP processing error'
        }, { status: 400 });
      }
    } else if (file.type === 'text/plain') {
      console.log('Processing text file...');
      extractedText = buffer.toString('utf-8');
      console.log(`Text extracted, length: ${extractedText.length}`);
    }

    // Check if we extracted any meaningful text
    if (!extractedText || extractedText.trim().length < 10) {
      console.log('❌ No meaningful text extracted');
      console.log('📏 Extracted text length:', extractedText?.length || 0);
      console.log('📋 First 100 chars of extracted text:', extractedText?.substring(0, 100) || 'None');
      
      if (file.type === 'application/pdf') {
        return NextResponse.json({ 
          error: 'Il PDF non contiene testo selezionabile. Potrebbe essere un documento scansionato o basato su immagini. Prova a:', 
          suggestions: [
            '1. Convertire il PDF in un documento con testo selezionabile',
            '2. Utilizzare un file TXT o DOCX invece del PDF',
            '3. Verificare che il PDF non sia protetto da password',
            '4. Assicurarsi che il PDF contenga testo e non solo immagini'
          ]
        }, { status: 400 });
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        return NextResponse.json({ 
          error: 'Il file DOCX è vuoto o non contiene contenuto leggibile.',
          suggestions: [
            '1. Verificare che il file DOCX non sia vuoto',
            '2. Assicurarsi che il file DOCX non sia corrotto',
            '3. Controllare che il file contenga del testo',
            '4. Provare a salvare il documento in un nuovo file DOCX'
          ]
        }, { status: 400 });
      } else if (file.type === 'application/zip') {
        return NextResponse.json({ 
          error: 'Il file ZIP è vuoto o non contiene documenti supportati.',
          suggestions: [
            '1. Verificare che il ZIP contenga file PDF, DOCX o TXT',
            '2. Assicurarsi che il file ZIP non sia corrotto',
            '3. Controllare che i file nel ZIP contengano del testo',
            '4. Provare a decomprimere e caricare i file singolarmente'
          ]
        }, { status: 400 });
      } else {
        return NextResponse.json({ 
          error: 'Il file di testo è vuoto o non contiene contenuto leggibile.',
          suggestions: [
            '1. Verificare che il file non sia vuoto',
            '2. Assicurarsi che il file sia in formato UTF-8',
            '3. Controllare che il file contenga del testo'
          ]
        }, { status: 400 });
      }
    }

    console.log('Upload successful, returning response');
    return NextResponse.json({
      success: true,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      extractedText: extractedText,
      uploadedAt: new Date().toISOString()
    }, {
      headers: rateLimitHeaders
    });

  } catch (error) {
    console.error('❌ Error processing file:');
    console.error('Error type:', typeof error);
    console.error('Error name:', error instanceof Error ? error.name : 'Unknown');
    console.error('Error message:', error instanceof Error ? error.message : 'No message');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    // Check if it's a specific type of error
    if (error instanceof Error) {
      if (error.message.includes('multipart')) {
        return NextResponse.json({ 
          error: 'Errore nel parsing del form multipart. Verifica che il file sia allegato correttamente.',
          details: error.message
        }, { status: 400 });
      }
      if (error.message.includes('pdf-parse')) {
        return NextResponse.json({ 
          error: 'Errore nella libreria pdf-parse. Il PDF potrebbe essere corrotto.',
          details: error.message
        }, { status: 400 });
      }
    }
    
    return NextResponse.json({ 
      error: 'Errore interno del server durante l\'elaborazione del file',
      details: error instanceof Error ? error.message : 'Unknown error',
      errorType: error instanceof Error ? error.constructor.name : typeof error
    }, { status: 500 });
  }
}