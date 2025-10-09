import { NextRequest, NextResponse } from 'next/server';

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

    console.log(`📥 Processing SharePoint file: ${fileName} from ${fileUrl}`);
    
    // For now, return simulated content but with proper structure for real files
    // This fallback ensures the component works while SharePoint auth is being set up
    let extractedText = '';
    let fileType = '';
    
    if (fileName.toLowerCase().endsWith('.pdf')) {
      fileType = 'application/pdf';
      extractedText = simulatePDFContent(fileName);
    } else if (fileName.toLowerCase().endsWith('.docx')) {
      fileType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      extractedText = simulateDOCXContent(fileName);
    } else if (fileName.toLowerCase().endsWith('.txt')) {
      fileType = 'text/plain';
      extractedText = simulateTXTContent(fileName);
    } else {
      return NextResponse.json({ 
        error: 'Unsupported file type. Only PDF, DOCX, and TXT files are supported.' 
      }, { status: 400 });
    }
    
    console.log(`✅ File processed successfully: ${fileName}`);
    
    return NextResponse.json({
      success: true,
      fileName: fileName,
      fileSize: extractedText.length,
      fileType: fileType,
      extractedText: extractedText,
      downloadedAt: new Date().toISOString(),
      note: 'Using simulated content - real SharePoint integration requires Azure AD setup'
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

// Simulate DOCX content based on file name
function simulateDOCXContent(fileName: string): string {
  const name = fileName.replace('.docx', '').replace(/[_-]/g, ' ');
  return `
CURRICULUM VITAE

NOME E COGNOME: ${name}

ESPERIENZA LAVORATIVA

2022 - 2024 Senior ${name} presso Tech Solutions Inc.
Sviluppo applicazioni web con React e Node.js
Gestione team di sviluppo

2020 - 2022 Junior Developer presso StartupXYZ
Programmazione JavaScript e manutenzione database
Collaborazione in progetti agili

VOLONTARIATO

2018 - 2020 Volontario presso Croce Rossa
Assistenza nelle emergenze e supporto logistico

FORMAZIONE

2016 - 2019 Laurea in Informatica presso Università di Roma
Corso di laurea triennale in Scienze Informatiche
Tesi su intelligenza artificiale

COMPETENZE

JavaScript, React, Node.js, HTML, CSS, SQL, Git
Teamwork, Problem Solving, Comunicazione
Inglese avanzato, Tedesco base
  `.trim();
}

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