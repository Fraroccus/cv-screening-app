# SharePoint Integration Admin Setup Guide

## Application Details
- **App Name**: CV Screening Application
- **App URL**: https://cv-screening-app-sand.vercel.app
- **Purpose**: Enable HR team to analyze CVs directly from SharePoint document libraries
- **Authentication Method**: Microsoft Graph API with Azure AD

## Step 1: Azure AD App Registration

### 1.1 Create App Registration
1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** > **App registrations**
3. Click **"New registration"**
4. Fill in details:
   ```
   Name: CV Screening App
   Supported account types: Accounts in this organizational directory only
   Redirect URI: Single-page application (SPA)
   URI: https://cv-screening-app-sand.vercel.app
   ```
5. Click **"Register"**

### 1.2 Note Important Values
After registration, copy these values:
- **Application (client) ID**: [Will be provided to the app]
- **Directory (tenant) ID**: [Optional, for single-tenant setup]

## Step 2: Configure API Permissions

### 2.1 Add Microsoft Graph Permissions
1. In your app registration, go to **"API permissions"**
2. Click **"Add a permission"** > **"Microsoft Graph"** > **"Delegated permissions"**
3. Add these permissions:
   ```
   Files.Read.All - Read all files user has access to
   Sites.Read.All - Read all SharePoint sites user has access to  
   User.Read - Sign in and read user profile
   ```

### 2.2 Grant Admin Consent
1. Click **"Grant admin consent for [Organization]"**
2. Confirm the consent
3. Verify all permissions show "Granted for [Organization]"

## Step 3: Configure Authentication

### 3.1 Redirect URIs
Ensure these URIs are configured under **Authentication**:
```
Production: https://cv-screening-app-sand.vercel.app
Development: http://localhost:3000
```

### 3.2 Token Configuration
1. **Access tokens**: Enabled
2. **ID tokens**: Enabled
3. **Allow public client flows**: No

## Step 4: Provide Configuration to App

### 4.1 Environment Variables Needed
Provide these values to be added to the application:
```
NEXT_PUBLIC_AZURE_CLIENT_ID=[Your Application Client ID]
NEXT_PUBLIC_AZURE_TENANT_ID=[Your Tenant ID] (optional)
NEXT_PUBLIC_SHAREPOINT_REDIRECT_URI=https://cv-screening-app-sand.vercel.app
```

### 4.2 SharePoint Site Configuration (Optional)
If you want to restrict to specific SharePoint sites:
```
NEXT_PUBLIC_SHAREPOINT_SITE_URL=https://[tenant].sharepoint.com/sites/[sitename]
NEXT_PUBLIC_SHAREPOINT_LIBRARY=Shared Documents/CVs
```

## Step 5: Test the Integration

### 5.1 Test Authentication
1. Go to https://cv-screening-app-sand.vercel.app
2. Login with admin/ITSMAKER
3. Click "Connect to SharePoint"
4. Should redirect to Microsoft login
5. After authentication, should show SharePoint files

### 5.2 Test File Access
1. Verify the app can list SharePoint documents
2. Verify the app can download and analyze CV files
3. Check that only files the user has access to are visible

## Security Considerations

### 5.1 Permissions Model
- **Delegated permissions**: App acts on behalf of the signed-in user
- **Principle of least privilege**: Users only see files they have access to
- **No app-only access**: Admin permissions not required for individual files

### 5.2 Audit and Compliance
- All file access is logged under the user's account
- SharePoint audit logs show file access by the user
- No additional compliance requirements beyond existing SharePoint access

## Troubleshooting

### Common Issues:
1. **"Invalid redirect URI"**: Ensure production URL is in allowed redirect URIs
2. **"Permission denied"**: Verify admin consent was granted for all permissions
3. **"Site not found"**: Check SharePoint site URL configuration
4. **"Authentication failed"**: Verify client ID is correct

### Support Information:
- **App URL**: https://cv-screening-app-sand.vercel.app
- **GitHub Repository**: https://github.com/Fraroccus/cv-screening-app
- **Technical Contact**: [Your contact information]

## Benefits for Organization

### Efficiency Gains:
- Eliminates manual CV file downloads
- Streamlines HR screening process
- Leverages existing SharePoint infrastructure
- Maintains security through Azure AD authentication

### Security Benefits:
- Uses existing organizational authentication
- Respects SharePoint permissions
- Full audit trail
- No additional security risks

## Post-Setup Tasks

After configuration is complete:
1. Test with HR team members
2. Verify different permission levels work correctly
3. Monitor initial usage for any issues
4. Consider expanding to additional SharePoint sites if successful

---

## Quick Reference

**What the admin needs to do:**
1. Create Azure AD app registration
2. Add Microsoft Graph permissions (Files.Read.All, Sites.Read.All, User.Read)
3. Grant admin consent
4. Provide Client ID to application team

**What gets configured automatically:**
- User authentication flow
- File access permissions
- SharePoint site discovery
- CV file processing

**Time required:** 15-20 minutes for admin setup