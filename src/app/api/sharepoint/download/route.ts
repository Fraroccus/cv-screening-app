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
    
    // Determine SharePoint URL type and extract real filename
    let cleanFileName = fileName;
    let actualFileUrl = fileUrl;
    
    try {
      const urlObj = new URL(fileUrl);
      
      // Type 1: Forms/AllItems.aspx URLs - extract from 'id' parameter
      if (fileUrl.includes('/Forms/AllItems.aspx')) {
        const idParam = urlObj.searchParams.get('id');
        if (idParam) {
          cleanFileName = decodeURIComponent(idParam.split('/').pop() || fileName);
          // Convert to direct download URL
          const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;
          actualFileUrl = baseUrl + idParam;
          console.log(`📋 Converted Forms URL to direct URL: ${actualFileUrl}`);
        }
      }
      // Type 2: Sharing links (:b:/g/ or :f:/g/)
      else if (fileUrl.includes('/:b:/') || fileUrl.includes('/:f:/')) {
        console.log('🔗 Detected sharing link format');
        console.log('⚠️ Sharing links require Microsoft Graph API authentication');
      }
      // Type 3: Direct file URLs
      else {
        cleanFileName = fileName.split('?')[0];
      }
    } catch (urlError) {
      console.error('Error parsing URL:', urlError);
    }
    
    console.log(`🧹 Cleaned filename: ${cleanFileName}`);
    
    // Return error - real SharePoint integration requires Azure AD authentication
    return NextResponse.json({ 
      error: 'SharePoint integration requires Azure AD authentication',
      details: 'Please work with your admin to set up Azure AD app registration with Microsoft Graph API permissions',
      suggestions: [
        '1. Register an Azure AD application',
        '2. Configure Microsoft Graph API permissions (Files.Read.All)',
        '3. Add environment variables: NEXT_PUBLIC_AZURE_CLIENT_ID, NEXT_PUBLIC_SHAREPOINT_SITE_URL',
        '4. Implement authentication flow with MSAL',
        '5. Alternative: Download files manually and use the regular upload feature'
      ]
    }, { status: 501 }); // 501 = Not Implemented

  } catch (error) {
    console.error('❌ Error processing SharePoint request:');
    console.error('Error type:', typeof error);
    console.error('Error name:', error instanceof Error ? error.name : 'Unknown');
    console.error('Error message:', error instanceof Error ? error.message : 'No message');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    return NextResponse.json({ 
      error: 'Failed to process SharePoint request',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}