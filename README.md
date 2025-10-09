# CV Screening Application

A Next.js application for automated CV screening and analysis with SharePoint integration.

## Features

- Upload and analyze CV files (PDF, DOCX, TXT, ZIP)
- Batch processing of up to 1000 CVs
- AI-powered candidate scoring and ranking
- **SharePoint integration** for direct access to document libraries
- Experience confidence calculation
- Advanced filtering and search capabilities
- Real-time progress tracking for bulk uploads

## SharePoint Integration

This application supports direct integration with Microsoft SharePoint through Azure AD, allowing you to:

- Access CV files directly from SharePoint document libraries
- Authenticate using your Microsoft 365 account
- Process files without manual uploads
- Maintain security through Azure AD permissions

### Quick Setup for SharePoint

1. **Azure AD App Registration**: Follow the [Azure Setup Guide](./AZURE_SETUP_GUIDE.md) to register your application
2. **Environment Configuration**: Copy `.env.example` to `.env.local` and configure your Azure settings
3. **Permissions**: Ensure your app has `Files.Read.All` and `Sites.Read.All` permissions
4. **Connect**: Use the "Connect to SharePoint" button in the application

For detailed setup instructions, see [AZURE_SETUP_GUIDE.md](./AZURE_SETUP_GUIDE.md).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.