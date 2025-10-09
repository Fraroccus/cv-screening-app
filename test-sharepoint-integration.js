// Simple test script to verify SharePoint integration components
const fs = require('fs');
const path = require('path');

console.log('🔍 Testing SharePoint Integration Components...\n');

// Check if required files exist
const requiredFiles = [
  'src/components/SharePointIntegration.tsx',
  'src/app/api/sharepoint/download/route.ts',
  'src/app/api/sharepoint/test/route.ts',
  '.env.local'
];

console.log('📋 Checking required files:');
requiredFiles.forEach(file => {
  const exists = fs.existsSync(path.join(__dirname, file));
  console.log(`  ${exists ? '✅' : '❌'} ${file} ${exists ? '' : '(missing)'}`);
});

// Check if required dependencies are installed
console.log('\n📦 Checking required dependencies:');
try {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  const dependencies = {
    '@azure/msal-browser': packageJson.dependencies['@azure/msal-browser'],
    '@microsoft/microsoft-graph-client': packageJson.dependencies['@microsoft/microsoft-graph-client']
  };
  
  Object.entries(dependencies).forEach(([dep, version]) => {
    const installed = !!version;
    console.log(`  ${installed ? '✅' : '❌'} ${dep} ${installed ? `(${version})` : '(not installed)'}`);
  });
} catch (error) {
  console.log('  ❌ Error reading package.json');
}

// Check environment variables
console.log('\n🔐 Checking environment variables:');
try {
  const envContent = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8');
  const hasClientId = envContent.includes('NEXT_PUBLIC_SHAREPOINT_CLIENT_ID');
  const hasRedirectUri = envContent.includes('NEXT_PUBLIC_SHAREPOINT_REDIRECT_URI');
  
  console.log(`  ${hasClientId ? '✅' : '⚠️'} NEXT_PUBLIC_SHAREPOINT_CLIENT_ID ${hasClientId ? '' : '(not configured)'}`);
  console.log(`  ${hasRedirectUri ? '✅' : '⚠️'} NEXT_PUBLIC_SHAREPOINT_REDIRECT_URI ${hasRedirectUri ? '' : '(not configured)'}`);
} catch (error) {
  console.log('  ❌ .env.local file not found');
}

console.log('\n✅ SharePoint integration verification complete!');
console.log('\n📝 Next steps:');
console.log('  1. Ensure you have configured the environment variables in .env.local');
console.log('  2. Start the development server with "npm run dev"');
console.log('  3. Navigate to the application and test the SharePoint integration');