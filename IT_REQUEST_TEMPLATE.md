# IT Request: Azure AD App Registration for CV Screening App

## Request Summary
We need an Azure AD app registration to enable our CV screening application to access SharePoint files with user permissions (no admin consent required).

## Application Details
- **App Name**: CV Screening App
- **App URL**: https://cv-screening-app-sand.vercel.app
- **Purpose**: Allow users to analyze CV files directly from SharePoint without manual uploads

## Required Permissions (Delegated - User Consent)
Please configure these **delegated permissions** (NOT application permissions):

```
Microsoft Graph:
- Files.Read (Delegated) - Read user files
- Sites.Read.All (Delegated) - Read SharePoint sites user has access to
- User.Read (Delegated) - Read user profile
```

## Configuration Settings
```
App Type: Single Page Application (SPA)
Redirect URIs: 
  - https://cv-screening-app-sand.vercel.app
  - http://localhost:3000 (for development)
Authentication: Public client flows - NO
Implicit grant: Access tokens - YES, ID tokens - YES
```

## Why Delegated Permissions?
- Users authenticate with their own Microsoft accounts
- App only accesses SharePoint files the user already has permission to see
- No admin consent required
- More secure than app-only permissions

## What We Need Back
Once configured, please provide:
- Application (Client) ID
- Tenant ID (optional)

## Benefits for Organization
- Streamlines CV screening process
- No manual file uploads needed
- Uses existing SharePoint security model
- Audit trail through user authentication

## Technical Contact
[Your Name] - [Your Email]
Application URL: https://cv-screening-app-sand.vercel.app