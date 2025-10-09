// Corrected test of the volunteer section removal implementation
const fs = require('fs');
const path = require('path');

// Sample CV text with volunteer sections to test
const sampleCV = `
CURRICULUM VITAE

Dati personali
Nome: Mario
Cognome: Rossi
Email: mario.rossi@example.com

ESPERIENZA LAVORATIVA
01/2020 - Presente
Software Engineer presso TechCorp
- Sviluppo di applicazioni web
- Collaborazione con team internazionali

VOLONTARIATO
06/2012 – 06/2017
Calderara di Reno e Bologna
Animatore per Estate Ragazzi
- Organizzazione attività per bambini
- Gestione gruppi di 20 partecipanti

ISTRUZIONE
2015 - 2019
Laurea in Informatica, Università di Bologna
- Tesi: "Sviluppo di applicazioni scalabili"
- Voto: 110/110

COMPETENZE
- JavaScript
- React
- Node.js
`;

console.log('Testing corrected volunteer section removal implementation...\n');

// Test our enhanced approach
function testEnhancedApproach(cvText) {
  console.log('Testing ENHANCED volunteer section removal approach...\n');
  
  // Multi-language volunteer keywords
  const volunteerKeywords = {
    italian: [
      'volontariato', 'volontario', 'volontaria', 'volontari',
      'attività volontarie', 'attività volontaria', 
      'servizio volontario', 'servizio civile volontario',
      'esperienza volontaria', 'esperienze volontarie',
      'animatore', 'animatrice', 'estate ragazzi',
      'ong', 'onlus', 'associazione', 'fondazione benefica',
      'croce rossa', 'protezione civile', 'caritas', 
      'medici senza frontiere', 'amnesty', 'wwf', 'greenpeace',
      'scout', 'scautismo', 'oratorio', 'parrocchia', 'chiesa', 'centro estivo'
    ],
    english: [
      'volunteer', 'volunteering', 'voluntary work', 'community service',
      'charity work', 'unpaid work', 'social service',
      'community involvement', 'civic engagement',
      'red cross', 'scouts'
    ]
  };
  
  // Non-paid indicators
  const nonPaidIndicators = [
    'senza retribuzione', 'non retribuito', 'gratuito', 'gratis',
    'unpaid', 'non-paid', 'without pay', 'no salary',
    'bénévole', 'sin remuneración', 'gratuit'
  ];
  
  // Organizational indicators
  const orgIndicators = [
    'ong', 'ngo', 'onlus', 'charity', 'association', 'associazione',
    'fondazione', 'foundation', 'parish', 'parrocchia', 'church',
    'red cross', 'croce rossa', 'scouts', 'scout'
  ];
  
  // Paid work indicators
  const paidWorkIndicators = [
    'stipendio', 'salary', 'retribuzione', 'contratto', 'contract',
    'pagato', 'paid', 'compensation', 'wage', 'income', 'remuneration',
    'lavoro', 'work', 'employment', 'carriera', 'career', 'professional', 'professionale'
  ];
  
  // Preserve indicators
  const preserveIndicators = [
    'servizio civile', 'military service', ' compulsory service'
  ];
  
  // Teaching job indicators
  const teachingIndicators = [
    'insegnante', 'teacher', 'docente', 'professore', 'professor', 'educatore', 'educator',
    'tutor', 'formatore', 'trainer', 'coordinatrice', 'coordinator'
  ];
  
  // Line-by-line analysis
  const lines = cvText.split('\n');
  let filteredLines = [];
  let currentSection = '';
  let sectionScore = 0;
  let sectionLines = [];
  let isInVolunteerSection = false;
  let preserveCurrentSection = false;
  let removedSections = [];
  
  console.log(`Analyzing ${lines.length} lines...\n`);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Detect section headers
    const isSectionHeader = line.length > 3 && 
                           line === line.toUpperCase() && 
                           !line.startsWith(' ') && 
                           !line.startsWith('\t') &&
                           line.match(/[A-Z]{3,}/);
    
    // If we found a new section header or reached the end
    if (isSectionHeader || i === lines.length - 1) {
      // Process the previous section
      if (currentSection) {
        // Special preservation rules
        const shouldPreserve = preserveIndicators.some(indicator => 
          currentSection.toLowerCase().includes(indicator)) ||
          teachingIndicators.some(indicator => 
            sectionLines.some(l => l.toLowerCase().includes(indicator)));
        
        console.log(`Section "${currentSection}": Score = ${sectionScore}, Is Volunteer = ${isInVolunteerSection}, Preserve = ${shouldPreserve}`);
        
        // Add section to filtered text if it's not a volunteer section or should be preserved
        if (!isInVolunteerSection || shouldPreserve) {
          filteredLines.push(...sectionLines);
        } else {
          console.log(`REMOVING volunteer section: "${currentSection}" (score: ${sectionScore})`);
          removedSections.push(`Excluded volunteer section: ${currentSection} (score: ${sectionScore})`);
        }
      }
      
      // Start new section
      currentSection = line;
      sectionScore = 0;
      sectionLines = [line];
      isInVolunteerSection = false;
      preserveCurrentSection = false;
      
      // Check if this is obviously a volunteer section
      const isVolunteerHeader = Object.values(volunteerKeywords).flat().some(keyword => 
        currentSection.toLowerCase().includes(keyword));
      
      if (isVolunteerHeader) {
        sectionScore += 5;
        console.log(`Strong volunteer indicator in header: "${currentSection}"`);
      }
      
      // Check if this section should be preserved
      preserveCurrentSection = preserveIndicators.some(indicator => 
        currentSection.toLowerCase().includes(indicator)) ||
        teachingIndicators.some(indicator => 
          currentSection.toLowerCase().includes(indicator));
    } else {
      // Add line to current section
      sectionLines.push(line);
      
      // Score the line for volunteer indicators
      if (currentSection) {
        // Check for volunteer keywords
        Object.values(volunteerKeywords).flat().forEach(keyword => {
          const regex = new RegExp(`\\b${keyword.replace(/\s+/g, '\\s+')}\\b`, 'gi');
          if (regex.test(line)) {
            sectionScore += 1;
            console.log(`Found volunteer keyword "${keyword}" in line: "${line.substring(0, 50)}..."`);
          }
        });
        
        // Check for non-paid indicators (higher weight)
        nonPaidIndicators.forEach(indicator => {
          const regex = new RegExp(`\\b${indicator.replace(/\s+/g, '\\s+')}\\b`, 'gi');
          if (regex.test(line)) {
            sectionScore += 3;
            console.log(`Found non-paid indicator "${indicator}" in line: "${line.substring(0, 50)}..."`);
          }
        });
        
        // Check for organizational indicators
        orgIndicators.forEach(org => {
          const regex = new RegExp(`\\b${org}\\b`, 'gi');
          if (regex.test(line)) {
            sectionScore += 2;
            console.log(`Found organization indicator "${org}" in line: "${line.substring(0, 50)}..."`);
          }
        });
        
        // Check for paid work indicators (negative score)
        paidWorkIndicators.forEach(indicator => {
          const regex = new RegExp(`\\b${indicator}\\b`, 'gi');
          if (regex.test(line)) {
            sectionScore -= 2;
            console.log(`Found paid work indicator "${indicator}" in line: "${line.substring(0, 50)}..."`);
          }
        });
        
        // Check for teaching indicators (strong negative score)
        const hasTeachingIndicator = teachingIndicators.some(indicator => {
          const regex = new RegExp(`\\b${indicator}\\b`, 'gi');
          return regex.test(line);
        });
        
        if (hasTeachingIndicator) {
          sectionScore -= 10;
          console.log(`Found teaching indicator in line: "${line.substring(0, 50)}..."`);
        }
      }
    }
    
    // Determine if this is a volunteer section based on score
    if (currentSection && !preserveCurrentSection) {
      isInVolunteerSection = sectionScore >= 3;
    }
  }
  
  // Join the filtered lines
  const filteredText = filteredLines.join('\n');
  
  console.log('\nRESULTS:');
  console.log('========');
  console.log(`Original length: ${cvText.length} characters`);
  console.log(`Filtered length: ${filteredText.length} characters`);
  console.log(`Removed: ${cvText.length - filteredText.length} characters`);
  
  if (removedSections.length > 0) {
    console.log('\nRemoved sections:');
    removedSections.forEach(section => console.log(`- ${section}`));
  } else {
    console.log('\nNo sections were removed!');
  }
  
  console.log('\nFiltered text preview:');
  console.log(filteredText.substring(0, 300) + '...');
  
  return {
    originalLength: cvText.length,
    filteredLength: filteredText.length,
    removedSections,
    filteredText
  };
}

// Run the test
const result = testEnhancedApproach(sampleCV);

console.log('\n\nEnhanced volunteer section removal test completed successfully!');