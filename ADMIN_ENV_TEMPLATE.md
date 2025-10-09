# Environment Variables for Admin

## Vercel Environment Variables Setup

Once your admin provides the Azure AD app details, add these to your Vercel project:

### Go to Vercel Dashboard:
1. Visit: https://vercel.com/dashboard
2. Select project: cv-screening-app-sand
3. Go to Settings > Environment Variables

### Current Variables (keep these):
```
APP_USERNAME = admin
APP_PASSWORD = ITSMAKER
```

### New Variables to Add (from admin):
```
NEXT_PUBLIC_AZURE_CLIENT_ID = [Client ID from Azure AD app registration]
NEXT_PUBLIC_AZURE_TENANT_ID = [Tenant ID - optional for single tenant]
NEXT_PUBLIC_SHAREPOINT_REDIRECT_URI = https://cv-screening-app-sand.vercel.app
```

### Optional SharePoint Configuration:
```
NEXT_PUBLIC_SHAREPOINT_SITE_URL = https://[tenant].sharepoint.com/sites/[site]
NEXT_PUBLIC_SHAREPOINT_LIBRARY = Shared Documents/CVs
```

## Example Values:
```
NEXT_PUBLIC_AZURE_CLIENT_ID = 12345678-abcd-1234-efgh-123456789abc
NEXT_PUBLIC_AZURE_TENANT_ID = yourcompany.onmicrosoft.com
NEXT_PUBLIC_SHAREPOINT_REDIRECT_URI = https://cv-screening-app-sand.vercel.app
NEXT_PUBLIC_SHAREPOINT_SITE_URL = https://yourcompany.sharepoint.com/sites/hr
NEXT_PUBLIC_SHAREPOINT_LIBRARY = Shared Documents/CVs
```

## After Adding Variables:
1. Click "Save" in Vercel
2. Go to Deployments tab
3. Click "Redeploy" on the latest deployment
4. Wait for deployment to complete
5. Test SharePoint integration

## Testing Checklist:
- ✅ App loads: https://cv-screening-app-sand.vercel.app
- ✅ Login works: admin/ITSMAKER
- ✅ SharePoint section shows "Connect to SharePoint" button
- ✅ Clicking button redirects to Microsoft login
- ✅ After Microsoft login, returns to app
- ✅ Shows SharePoint files from your organization
- ✅ Can select and process CV files