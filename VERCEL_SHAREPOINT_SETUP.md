# SharePoint Integration Setup for cv-screening-app-sand.vercel.app

## Step 1: Update Vercel Environment Variables

Go to your Vercel dashboard:
1. Visit: https://vercel.com/dashboard
2. Select your project: cv-screening-app-sand
3. Go to Settings > Environment Variables
4. Add these variables:

### Required Variables:
```
NEXT_PUBLIC_SHAREPOINT_REDIRECT_URI=https://cv-screening-app-sand.vercel.app
APP_USERNAME=admin
APP_PASSWORD=ITSMAKER
```

### Optional (for custom SharePoint site):
```
NEXT_PUBLIC_SHAREPOINT_SITE_URL=https://yourtenant.sharepoint.com/sites/hr
NEXT_PUBLIC_SHAREPOINT_LIBRARY=Shared Documents/CVs
```

## Step 2: Choose SharePoint Access Method

### Method A: SharePoint App-Only (Simpler)
1. Go to: https://yourtenant.sharepoint.com/sites/yoursite/_layouts/15/appregnew.aspx
2. Generate Client ID and Secret
3. Set App Domain: cv-screening-app-sand.vercel.app
4. Set Redirect URI: https://cv-screening-app-sand.vercel.app

### Method B: Azure AD (More Secure)
1. Go to Azure Portal > Azure AD > App registrations
2. Create new registration:
   - Name: CV Screening App
   - Redirect URI: https://cv-screening-app-sand.vercel.app
3. Add permissions: Files.Read.All, Sites.Read.All
4. Copy Client ID

## Step 3: Test SharePoint Integration
Visit: https://cv-screening-app-sand.vercel.app
- Click "Connect to SharePoint"
- Authenticate with your Microsoft account
- Browse and select CV files from SharePoint

## Quick Start (Recommended)
Use the OneDrive sync method first, then upgrade to direct integration later if needed.