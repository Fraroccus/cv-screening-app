# Manual Upload to Existing Repository

## Step 1: Go to Your Current Repository
Visit: https://github.com/Fraroccus/cv-screening-app

## Step 2: Delete Old Files (if needed)
If the repository has outdated files:
1. Select all files in the web interface
2. Click the trash icon to delete them
3. Commit the deletion

## Step 3: Upload Fresh Files
1. Click "Add file" > "Upload files"
2. Drag and drop from your local project:

### Essential Files:
- `src/` folder (complete with all subfolders)
- `package.json`
- `package-lock.json`
- `next.config.ts`
- `tsconfig.json`
- `eslint.config.mjs`
- `postcss.config.mjs`

### Optional Files:
- All `.md` documentation files
- `public/` folder
- `test/` folder

### DO NOT Upload:
- `.git/` folder
- `node_modules/`
- `.next/`
- `.env.local`

## Step 4: Commit
- Message: "Complete app with SharePoint URL upload component"
- Click "Commit changes"

## Step 5: Trigger Vercel Redeploy
1. Go to Vercel dashboard
2. Find cv-screening-app-sand project
3. Go to Deployments tab
4. Click "Redeploy" on latest deployment

## Expected Result
After redeployment, your app should show:
- Blue SharePoint Integration box
- **Yellow SharePoint URL Processing box** ← This should now appear
- Main drag-and-drop upload area