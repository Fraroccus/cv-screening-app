import CVScreeningApp from '@/components/CVScreeningApp';

/**
 * CV Screening Application - Home Page
 * 
 * Security Features:
 * - Automatic data clearing on page unload/reload (CVScreeningApp)
 * - No server-side storage of CV content
 * - In-memory processing only
 * - Sensitive data marked with data-sensitive attribute for DOM clearing
 */
export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Valutazione CV
          </h1>
          <p className="text-lg text-gray-600">
            Carica i CV, imposta i requisiti lavorativi e ottieni valutazioni dei candidati basate sull'IA
          </p>
        </header>
        
        <CVScreeningApp />
      </div>
    </div>
  );
}
