import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface SharePointToken {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export async function POST(request: NextRequest) {
  console.log('🔐 SharePoint App-Only Auth API called');
  
  try {
    const { siteUrl } = await request.json();
    
    if (!siteUrl) {
      return NextResponse.json({ 
        error: 'SharePoint site URL is required' 
      }, { status: 400 });
    }

    // Environment variables from Vercel
    const clientId = process.env.SHAREPOINT_CLIENT_ID;
    const clientSecret = process.env.SHAREPOINT_CLIENT_SECRET;
    const tenantId = process.env.SHAREPOINT_TENANT_ID;
    
    if (!clientId || !clientSecret) {
      return NextResponse.json({ 
        error: 'SharePoint credentials not configured. Please set SHAREPOINT_CLIENT_ID and SHAREPOINT_CLIENT_SECRET in Vercel environment variables.' 
      }, { status: 500 });
    }

    // Extract tenant from site URL
    const tenantName = siteUrl.match(/https:\/\/([^.]+)\.sharepoint\.com/)?.[1];
    if (!tenantName) {
      return NextResponse.json({ 
        error: 'Invalid SharePoint site URL format' 
      }, { status: 400 });
    }

    // SharePoint App-Only authentication
    const tokenEndpoint = `https://accounts.accesscontrol.windows.net/${tenantId || tenantName}/tokens/OAuth/2`;
    
    const formData = new URLSearchParams({
      'grant_type': 'client_credentials',
      'client_id': `${clientId}@${tenantId || tenantName}`,
      'client_secret': clientSecret,
      'resource': `00000003-0000-0ff1-ce00-000000000000/${tenantName}.sharepoint.com@${tenantId || tenantName}`
    });

    const tokenResponse = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token request failed:', errorText);
      return NextResponse.json({ 
        error: 'Failed to authenticate with SharePoint',
        details: errorText
      }, { status: 401 });
    }

    const tokenData: SharePointToken = await tokenResponse.json();

    return NextResponse.json({
      success: true,
      access_token: tokenData.access_token,
      expires_in: tokenData.expires_in,
      token_type: tokenData.token_type
    });

  } catch (error) {
    console.error('❌ SharePoint authentication error:', error);
    return NextResponse.json({
      success: false,
      error: 'SharePoint authentication failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'SharePoint App-Only Authentication API',
    instructions: 'Send POST request with siteUrl to authenticate',
    requiredEnvVars: [
      'SHAREPOINT_CLIENT_ID',
      'SHAREPOINT_CLIENT_SECRET', 
      'SHAREPOINT_TENANT_ID (optional)'
    ]
  });
}