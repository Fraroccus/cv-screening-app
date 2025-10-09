# CV Screening App Usage Guide

## Overview
This application allows you to screen and analyze CVs based on job requirements. It supports both manual file uploads and SharePoint integration for direct access to CVs stored in SharePoint document libraries.

## Features
1. Manual CV upload (PDF and TXT files)
2. SharePoint integration for direct access to CVs
3. Automated CV analysis based on job requirements
4. Experience calculation excluding volunteer work
5. Bulk processing of up to 500 CVs at once

## Getting Started

### Prerequisites
- Node.js installed on your system
- Microsoft 365 account (for SharePoint integration)

### Installation
1. Clone the repository
2. Install dependencies: `npm install`
3. Create a `.env.local` file with SharePoint configuration (see SHAREPOINT_INTEGRATION.md)
4. Start the development server: `npm run dev`

## Using the Application

### Manual CV Upload
1. Navigate to the main page
2. Fill in the job requirements form
3. Drag and drop CV files or click to select files
4. The application will automatically process and analyze the CVs

### SharePoint Integration
1. Navigate to the main page
2. Fill in the job requirements form
3. Click "Connect to SharePoint" in the SharePoint Integration section
4. Authenticate with your Microsoft account
5. Select CV files from your SharePoint libraries
6. Click "Process Selected" to analyze the CVs

## Configuration

### Environment Variables
Create a `.env.local` file in the root directory with the following variables:

```env
NEXT_PUBLIC_SHAREPOINT_CLIENT_ID=your-sharepoint-client-id
NEXT_PUBLIC_SHAREPOINT_REDIRECT_URI=http://localhost:3000
```

## Troubleshooting

### Common Issues
1. **Authentication errors with SharePoint**: Ensure your Azure AD app is properly configured with the correct permissions and redirect URIs.

2. **Files not processing**: Check that files are in PDF or TXT format and contain selectable text (not scanned images).

3. **Experience calculation incorrect**: The system excludes volunteer work from experience calculation. Ensure volunteer sections are properly formatted with "Volontariato" or similar terms.

### Development Server Issues
If you encounter issues starting the development server:
1. Check that Node.js is properly installed
2. Try using `npx next dev` instead of `npm run dev`
3. If port 3000 is in use, the app will automatically use another port

## API Endpoints

### /api/upload
- **Method**: POST
- **Purpose**: Upload and extract text from CV files
- **Input**: FormData with file
- **Output**: Extracted text and file metadata

### /api/analyze
- **Method**: POST
- **Purpose**: Analyze CV text against job requirements
- **Input**: JSON with cvText and jobRequirements
- **Output**: Analysis results including experience, skills match, etc.

### /api/sharepoint/download
- **Method**: POST
- **Purpose**: Download and process files from SharePoint
- **Input**: JSON with fileUrl and fileName
- **Output**: Extracted text from SharePoint files

## Customization

### Modifying Experience Calculation
The experience calculation logic can be found in `src/app/api/analyze/route.ts`. The system excludes sections containing volunteer work from experience calculation.

### Adding New File Types
To support additional file types:
1. Update the file type validation in `src/components/CVUpload.tsx`
2. Add parsing logic in `src/app/api/upload/route.ts`
3. Update the SharePoint download API if needed

## Performance Considerations
- The application processes files in batches of 5 for better performance
- Large file uploads are supported with appropriate timeout configurations
- Concurrent processing is limited to prevent server overload