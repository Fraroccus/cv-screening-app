# Vercel Environment Variables for SharePoint App-Only

## Go to Vercel Dashboard:
1. Visit: https://vercel.com/dashboard
2. Select your project: cv-screening-app-sand
3. Go to Settings > Environment Variables

## Add These Variables:

### Existing (keep these):
```
APP_USERNAME = admin
APP_PASSWORD = ITSMAKER
```

### New SharePoint App-Only Variables:
```
SHAREPOINT_CLIENT_ID = [your-generated-client-id-from-step-1]
SHAREPOINT_CLIENT_SECRET = [your-generated-client-secret-from-step-1]
SHAREPOINT_TENANT_ID = [your-tenant-name-or-id]
NEXT_PUBLIC_SHAREPOINT_SITE_URL = https://[yourcompany].sharepoint.com/sites/[yoursite]
NEXT_PUBLIC_SHAREPOINT_LIBRARY = Shared Documents/CVs
```

## Example Values:
```
SHAREPOINT_CLIENT_ID = 12345678-1234-1234-1234-123456789abc
SHAREPOINT_CLIENT_SECRET = AbCdEfGhIjKlMnOpQrStUvWxYz123456789=
SHAREPOINT_TENANT_ID = yourcompany.onmicrosoft.com
NEXT_PUBLIC_SHAREPOINT_SITE_URL = https://yourcompany.sharepoint.com/sites/hr
NEXT_PUBLIC_SHAREPOINT_LIBRARY = Shared Documents/CVs
```

## Important Notes:
- Replace [yourcompany] with your actual company name
- Replace [yoursite] with your actual SharePoint site name
- The Client ID and Secret come from Step 1 of the SharePoint registration process
- After adding these, redeploy your app in Vercel