'use client';

import { useState, useEffect } from 'react';

export default function SharePointTestPage() {
  const [testResult, setTestResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testSharePointIntegration = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/sharepoint/test');
      const data = await response.json();
      setTestResult(data);
    } catch (error) {
      setTestResult({ error: 'Failed to test SharePoint integration' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-6">SharePoint Integration Test</h1>
      
      <div className="mb-6">
        <button
          onClick={testSharePointIntegration}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Testing...' : 'Test SharePoint Integration'}
        </button>
      </div>

      {testResult && (
        <div className="border rounded-md p-4 bg-gray-50">
          <h2 className="text-lg font-semibold mb-2">Test Results</h2>
          <pre className="bg-white p-4 rounded-md overflow-auto">
            {JSON.stringify(testResult, null, 2)}
          </pre>
        </div>
      )}

      <div className="mt-8 p-4 bg-blue-50 rounded-md">
        <h3 className="font-medium text-blue-900 mb-2">Next Steps:</h3>
        <ol className="list-decimal list-inside text-blue-800 space-y-1">
          <li>Check that environment variables are properly configured in .env.local</li>
          <li>Navigate to the main application to test the SharePoint integration</li>
          <li>Click "Connect to SharePoint" and follow the authentication flow</li>
        </ol>
      </div>
    </div>
  );
}