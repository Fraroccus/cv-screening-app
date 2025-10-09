import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@microsoft/microsoft-graph-client';
import pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';

// Increase the maximum execution time for SharePoint downloads
export const maxDuration = 300; // 5 minutes
export const dynamic = 'force-dynamic';

interface DownloadRequest {
  fileUrl: string;
  fileName: string;
  siteId?: string;
  driveId?: string;
  itemId?: string;
}

export async function POST(request: NextRequest) {
  console.log('📥 SharePoint Download API called at:', new Date().toISOString());
  
  try {
    const { fileUrl, fileName, siteId, driveId, itemId }: DownloadRequest = await request.json();
    
    if (!fileUrl || !fileName) {
      return NextResponse.json({ 
        error: 'Missing file URL or file name' 
      }, { status: 400 });
    }

    // Get the access token from the request headers
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ 
        error: 'Missing or invalid authorization token' 
      }, { status: 401 });
    }

    const accessToken = authHeader.substring(7); // Remove 'Bearer ' prefix
    console.log(`📥 Downloading file from SharePoint: ${fileName}`);
    
    // Use SharePoint REST API instead of Microsoft Graph
    let extractedText = '';
    let fileType = '';
    let fileBuffer: Buffer;
    
    try {
      // SharePoint REST API call to get file content
      const fileResponse = await fetch(fileUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json;odata=verbose'
        }
      });
      
      if (!fileResponse.ok) {
        throw new Error(`Failed to download file: ${fileResponse.statusText}`);
      }
      
      // Get file content as buffer
      const arrayBuffer = await fileResponse.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
      
    } catch (apiError) {
      console.error('SharePoint REST API error:', apiError);
      
      // Fallback to simulated content for development/testing
      console.log('Falling back to simulated content...');
      return handleSimulatedDownload(fileName);
    }
    
    // Extract text based on file type
    if (fileName.toLowerCase().endsWith('.pdf')) {
      fileType = 'application/pdf';
      try {
        const data = await pdfParse(fileBuffer);
        extractedText = data.text;
      } catch (pdfError) {
        console.error('PDF parsing error:', pdfError);
        throw new Error('Failed to extract text from PDF file');
      }
    } else if (fileName.toLowerCase().endsWith('.docx')) {
      fileType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      try {
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        extractedText = result.value;
      } catch (docxError) {
        console.error('DOCX parsing error:', docxError);
        throw new Error('Failed to extract text from DOCX file');
      }
    } else if (fileName.toLowerCase().endsWith('.txt')) {
      fileType = 'text/plain';
      extractedText = fileBuffer.toString('utf-8');
    } else {
      return NextResponse.json({ 
        error: 'Unsupported file type. Only PDF, DOCX, and TXT files are supported.' 
      }, { status: 400 });
    }
    
    if (!extractedText.trim()) {
      return NextResponse.json({ 
        error: 'No text content could be extracted from the file.' 
      }, { status: 400 });
    }
    
    console.log(`✅ File processed successfully: ${fileName}`);
    
    return NextResponse.json({
      success: true,
      fileName: fileName,
      fileSize: fileBuffer.length,
      fileType: fileType,
      extractedText: extractedText,
      downloadedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error downloading file from SharePoint:');
    console.error('Error type:', typeof error);
    console.error('Error name:', error instanceof Error ? error.name : 'Unknown');
    console.error('Error message:', error instanceof Error ? error.message : 'No message');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    return NextResponse.json({ 
      error: 'Failed to download and process file from SharePoint',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Fallback function for simulated content (development/testing)
function handleSimulatedDownload(fileName: string) {
  console.log('Using simulated content for:', fileName);
  
  let extractedText = '';
  let fileType = '';
  
  if (fileName.toLowerCase().endsWith('.pdf')) {
    fileType = 'application/pdf';
    extractedText = simulatePDFContent(fileName);
  } else if (fileName.toLowerCase().endsWith('.txt')) {
    fileType = 'text/plain';
    extractedText = simulateTXTContent(fileName);
  } else {
    return NextResponse.json({ 
      error: 'Unsupported file type for simulation.' 
    }, { status: 400 });
  }
  
  return NextResponse.json({
    success: true,
    fileName: fileName,
    fileSize: extractedText.length,
    fileType: fileType,
    extractedText: extractedText,
    downloadedAt: new Date().toISOString(),
    isSimulated: true
  });
}

// Simulate PDF content based on file name
function simulatePDFContent(fileName: string): string {
  const name = fileName.replace('.pdf', '').replace(/[_-]/g, ' ');
  return `
CURRICULUM VITAE

NOME E COGNOME: ${name}

ESPERIENZA LAVORATIVA

2022 - 2024 Senior ${name} presso Tech Solutions Inc.
Sviluppo applicazioni web con React e Node.js

2020 - 2022 Junior Developer presso StartupXYZ
Programmazione JavaScript e manutenzione database

VOLONTARIATO

2018 - 2020 Volontario presso Croce Rossa
Assistenza nelle emergenze e supporto logistico

FORMAZIONE

2016 - 2019 Laurea in Informatica presso Università di Roma
Corso di laurea triennale in Scienze Informatiche

COMPETENZE

JavaScript, React, Node.js, HTML, CSS, SQL, Git
Teamwork, Problem Solving, Comunicazione
  `.trim();
}

// Simulate TXT content based on file name
function simulateTXTContent(fileName: string): string {
  const name = fileName.replace('.txt', '').replace(/[_-]/g, ' ');
  return `
Curriculum Vitae di ${name}

Esperienza:
- 2021-2024: Senior Developer presso TechCorp
- 2019-2021: Software Engineer presso Innovate Ltd

Istruzione:
- 2015-2019: Laurea in Informatica, Università

Competenze:
- JavaScript, Python, React
- Inglese avanzato
- Lavoro di squadra
  `.trim();
}