# Fresh GitHub Repository Setup

## Step 1: Create New Repository
1. Go to: https://github.com/new
2. Repository name: `cv-screening-app-v2` (or any name you prefer)
3. Description: `CV Screening Application with SharePoint Integration`
4. Set to Public or Private (your choice)
5. **DO NOT** initialize with README, .gitignore, or license
6. Click "Create repository"

## Step 2: Upload Your Current Code
After creating the repository, you'll see instructions. Use the "upload files" method:

1. Click "uploading an existing file"
2. Drag and drop these folders/files from your local project:
   - `src/` folder (entire folder)
   - `public/` folder (if it exists)
   - `package.json`
   - `package-lock.json`
   - `next.config.ts`
   - `tsconfig.json`
   - `eslint.config.mjs`
   - `postcss.config.mjs`
   - `.gitignore`
   - All `.md` files (README, guides, etc.)

3. **DO NOT upload**:
   - `.git/` folder
   - `node_modules/` folder
   - `.next/` folder
   - `.env.local`

4. Commit message: "Initial commit - CV Screening App with SharePoint integration"
5. Click "Commit changes"

## Step 3: Deploy to Vercel
1. Go to: https://vercel.com/dashboard
2. Click "Import Project"
3. Import your new repository: `cv-screening-app-v2`
4. Configure:
   - Framework: Next.js (auto-detected)
   - Root Directory: `.`
   - Build Command: `npm run build`
   - Output Directory: `.next`

## Step 4: Add Environment Variables
In Vercel project settings, add:
```
APP_USERNAME = admin
APP_PASSWORD = ITSMAKER
```

## Step 5: Test New Deployment
Your new URL will be something like:
`https://cv-screening-app-v2.vercel.app`

The SharePoint URL Upload component should now be visible!

## Advantages of Fresh Repository:
- ✅ Clean Git history
- ✅ No sync conflicts
- ✅ Guaranteed to have latest code
- ✅ Fresh Vercel deployment
- ✅ All components will be included
- ✅ Takes 10 minutes instead of debugging Git issues