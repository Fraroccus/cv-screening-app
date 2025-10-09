# Azure SharePoint Integration Setup Guide

## Step 1: Register Application in Azure AD

### 1.1 Access Azure Portal
1. Go to [Azure Portal](https://portal.azure.com)
2. Sign in with your Microsoft 365 admin account
3. Navigate to **Azure Active Directory** > **App registrations**

### 1.2 Create New App Registration
1. Click **"New registration"**
2. Fill in the following details:
   - **Name**: `CV Screening App SharePoint Integration`
   - **Supported account types**: 
     - Choose "Accounts in this organizational directory only" for single tenant
     - OR "Accounts in any organizational directory" for multi-tenant
   - **Redirect URI**: 
     - Platform: **Single-page application (SPA)**
     - URL: `http://localhost:3000` (for development)
3. Click **"Register"**

### 1.3 Note the Application Details
After registration, copy these values:
- **Application (client) ID** - You'll need this for environment variables
- **Directory (tenant) ID** - For single-tenant applications

## Step 2: Configure API Permissions

### 2.1 Add Microsoft Graph Permissions
1. In your app registration, go to **"API permissions"**
2. Click **"Add a permission"**
3. Select **"Microsoft Graph"** > **"Delegated permissions"**
4. Add the following permissions:
   ```
   Files.Read.All          - Read all files in SharePoint and OneDrive
   Sites.Read.All          - Read all site collections  
   User.Read              - Sign in and read user profile
   Sites.ReadWrite.All    - (Optional) Read and write to all sites
   ```

### 2.2 Grant Admin Consent
1. Click **"Grant admin consent for [Your Organization]"**
2. Confirm the consent
3. Ensure all permissions show "Granted for [Your Organization]"

## Step 3: Configure Authentication

### 3.1 Platform Configuration
1. Go to **"Authentication"** in your app registration
2. Under **"Single-page application"**, ensure these URLs are added:
   ```
   http://localhost:3000
   http://localhost:3001
   https://yourdomain.com (for production)
   ```

### 3.2 Advanced Settings
1. **Allow public client flows**: No (keep disabled)
2. **Enable the following mobile and desktop flows**: No
3. **Supported account types**: As configured in Step 1.2

## Step 4: Environment Configuration

Create/update your `.env.local` file:

```env
# Azure AD Configuration
NEXT_PUBLIC_AZURE_CLIENT_ID=your-application-client-id-here
NEXT_PUBLIC_AZURE_TENANT_ID=your-tenant-id-here (optional for single tenant)
NEXT_PUBLIC_SHAREPOINT_REDIRECT_URI=http://localhost:3000

# SharePoint Configuration  
NEXT_PUBLIC_SHAREPOINT_SITE_URL=https://yourtenant.sharepoint.com/sites/yoursite
NEXT_PUBLIC_SHAREPOINT_LIBRARY=Shared Documents/CVs
```

## Step 5: Test the Integration

### 5.1 Development Testing
1. Start your development server: `npm run dev`
2. Navigate to the CV upload section
3. Click "Connect to SharePoint"
4. You should be redirected to Microsoft login
5. After authentication, you should see your SharePoint files

### 5.2 Verify Permissions
Test that your app can:
- ✅ Authenticate users
- ✅ List SharePoint sites
- ✅ Browse document libraries
- ✅ Download CV files
- ✅ Extract text content

## Troubleshooting

### Common Issues:
1. **Authentication fails**: Check client ID and redirect URI
2. **Permission denied**: Ensure admin consent is granted
3. **No files shown**: Verify SharePoint site URL and library path
4. **CORS errors**: Add your domain to Azure AD redirect URIs

### Testing Commands:
```bash
# Test if Azure authentication works
curl -X POST http://localhost:3000/api/sharepoint/test

# Check environment variables
echo $NEXT_PUBLIC_AZURE_CLIENT_ID
```

## Production Deployment

### Additional Steps for Production:
1. Update redirect URIs to include production domain
2. Configure proper HTTPS endpoints
3. Set up proper secret management
4. Enable audit logging
5. Configure conditional access policies (if required)

## Security Considerations

- Never expose client secrets in frontend code
- Use proper CORS configuration
- Implement proper error handling
- Log authentication events
- Regular permission audits
- Use least privilege principle

## Next Steps

After completing this setup:
1. The SharePoint integration should work with real data
2. Users can authenticate with their Microsoft accounts
3. CV files can be directly accessed from SharePoint libraries
4. Automatic analysis will work on SharePoint files