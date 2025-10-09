# SharePoint Integration Setup

## Overview
This application includes SharePoint integration that allows you to directly analyze CVs from your SharePoint document libraries without manual uploads.

## Prerequisites
1. Microsoft 365 account with access to SharePoint
2. Azure AD application registration with appropriate permissions

## Setup Instructions

### 1. Register an Application in Azure AD
1. Go to the Azure Portal (https://portal.azure.com)
2. Navigate to "Azure Active Directory" > "App registrations"
3. Click "New registration"
4. Enter a name for your application (e.g., "CV Screening App")
5. Select "Single tenant" or "Multi-tenant" based on your needs
6. For redirect URI, select "Single-page application (SPA)" and enter:
   - `http://localhost:3000` (for development)
   - `http://localhost:3001` (if using port 3001)
7. Click "Register"

### 2. Configure API Permissions
1. In your app registration, go to "API permissions"
2. Click "Add a permission" > "Microsoft Graph" > "Delegated permissions"
3. Add the following permissions:
   - `Files.Read` - Read user files
   - `Sites.Read.All` - Read all site collections
   - `User.Read` - Sign in and read user profile
4. Click "Grant admin consent" for your organization

### 3. Configure Environment Variables
Create a `.env.local` file in the root of your project with the following content:

```env
NEXT_PUBLIC_SHAREPOINT_CLIENT_ID=your-application-client-id
NEXT_PUBLIC_SHAREPOINT_REDIRECT_URI=http://localhost:3000
```

Replace `your-application-client-id` with the Application (client) ID from your Azure AD app registration.

### 4. Using SharePoint Integration
1. Start the development server: `npm run dev`
2. Open the application in your browser
3. Navigate to the CV upload section
4. Click "Connect to SharePoint"
5. Authenticate with your Microsoft account
6. Select CV files from your SharePoint libraries
7. Process selected files for analysis

## Troubleshooting
- If you encounter authentication issues, ensure your Azure AD app is properly configured
- Make sure you've granted admin consent for the required permissions
- Check that your Microsoft account has access to the SharePoint sites you want to connect to

## Notes
- The current implementation uses simulated data for demonstration purposes
- In a production environment, you would connect to the actual Microsoft Graph API to fetch and download files
- Ensure your SharePoint files are properly formatted for best analysis results