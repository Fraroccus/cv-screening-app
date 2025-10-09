import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@microsoft/microsoft-graph-client';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  console.log('🧪 SharePoint Test API called at:', new Date().toISOString());
  
  try {
    // Get the access token from the request headers
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ 
        error: 'Missing or invalid authorization token',
        test: 'authentication',
        status: 'failed'
      }, { status: 401 });
    }

    const accessToken = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Initialize Microsoft Graph client
    const graphClient = Client.init({
      authProvider: (done) => {
        done(null, accessToken);
      }
    });
    
    const tests = {
      authentication: 'pending',
      userInfo: 'pending',
      siteAccess: 'pending',
      driveAccess: 'pending'
    };
    
    const results: any = { tests };
    
    try {
      // Test 1: Get user information
      const userInfo = await graphClient.api('/me').get();
      tests.authentication = 'passed';
      tests.userInfo = 'passed';
      results.userInfo = {
        displayName: userInfo.displayName,
        mail: userInfo.mail,
        userPrincipalName: userInfo.userPrincipalName
      };
      
      // Test 2: Access SharePoint site
      try {
        const customSiteUrl = process.env.NEXT_PUBLIC_SHAREPOINT_SITE_URL;
        let siteResponse;
        
        if (customSiteUrl) {
          const urlMatch = customSiteUrl.match(/https:\/\/([^.]+)\.sharepoint\.com\/sites\/(.+)/);
          if (urlMatch) {
            const [, tenant, siteName] = urlMatch;
            siteResponse = await graphClient
              .api(`/sites/${tenant}.sharepoint.com:/sites/${siteName}`)
              .get();
          }
        } else {
          siteResponse = await graphClient.api('/sites/root').get();
        }
        
        if (siteResponse) {
          tests.siteAccess = 'passed';
          results.siteInfo = {
            id: siteResponse.id,
            name: siteResponse.displayName,
            webUrl: siteResponse.webUrl
          };
          
          // Test 3: Access document library
          try {
            const driveResponse = await graphClient
              .api(`/sites/${siteResponse.id}/drive`)
              .get();
            
            tests.driveAccess = 'passed';
            results.driveInfo = {
              id: driveResponse.id,
              name: driveResponse.name,
              driveType: driveResponse.driveType
            };
            
            // Try to list some files
            const filesResponse = await graphClient
              .api(`/sites/${siteResponse.id}/drive/root/children`)
              .top(5)
              .get();
            
            results.sampleFiles = filesResponse.value.map((file: any) => ({
              name: file.name,
              size: file.size,
              type: file.file ? 'file' : 'folder'
            }));
            
          } catch (driveError) {
            tests.driveAccess = 'failed';
            results.driveError = driveError instanceof Error ? driveError.message : 'Unknown drive error';
          }
        }
        
      } catch (siteError) {
        tests.siteAccess = 'failed';
        results.siteError = siteError instanceof Error ? siteError.message : 'Unknown site error';
      }
      
    } catch (userError) {
      tests.authentication = 'failed';
      tests.userInfo = 'failed';
      results.authError = userError instanceof Error ? userError.message : 'Unknown auth error';
    }
    
    const allPassed = Object.values(tests).every(test => test === 'passed');
    
    return NextResponse.json({
      success: allPassed,
      timestamp: new Date().toISOString(),
      environment: {
        clientId: process.env.NEXT_PUBLIC_AZURE_CLIENT_ID ? 'configured' : 'missing',
        tenantId: process.env.NEXT_PUBLIC_AZURE_TENANT_ID ? 'configured' : 'not configured',
        siteUrl: process.env.NEXT_PUBLIC_SHAREPOINT_SITE_URL ? 'configured' : 'not configured',
        library: process.env.NEXT_PUBLIC_SHAREPOINT_LIBRARY ? 'configured' : 'not configured'
      },
      ...results
    });

  } catch (error) {
    console.error('❌ SharePoint test error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'SharePoint test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'SharePoint Test API',
    instructions: 'Send a POST request with Bearer token to test SharePoint integration',
    requiredHeaders: {
      'Authorization': 'Bearer <access_token>',
      'Content-Type': 'application/json'
    }
  });
}