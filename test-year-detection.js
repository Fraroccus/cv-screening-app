const testCV = `
ESPERIENZA LAVORATIVA
01/2022 – 12/2024 Senior Developer presso ABC Company
Sviluppo applicazioni web con React e Node.js

06/2021 – 12/2021 Junior Developer presso XYZ Corp
Programmazione JavaScript e manutenzione database

Volontariato
-
06/2012 – 06/2017 Calderara di Reno e Bologna
Animatore per Estate Ragazzi

01/2018 – 12/2020 Bologna
Volontario presso Croce Rossa Italiana

Formazione
09/2018 – 07/2021 Università di Bologna
Laurea in Informatica
`;

const jobRequirements = {
  position: "Senior Developer",
  requiredSkills: ["JavaScript", "React"],
  minExperience: 2,
  education: "bachelor"
};

console.log("Testing CV with EXACT user formatting...");
console.log("\nWork experience: 06/2021-12/2024 = ~3.5 years");
console.log("Volunteer work (should be excluded): 06/2012-06/2017 + 01/2018-12/2020 = ~8 years");
console.log("Education (should be excluded): 09/2018-07/2021 = ~3 years");
console.log("\nExpected result: ~3.5 years (only work experience)");
console.log("Previous result: 12+ years (incorrectly including volunteer work)");
console.log("\nKey formatting differences:");
console.log("- Section header: 'Volontariato' (title case, not VOLONTARIATO)");
console.log("- Date format: MM/YYYY – MM/YYYY (not just YYYY-YYYY)");
console.log("- Section separator: single dash line");
console.log("\nCV Text:");
console.log(testCV);

// Send request to analyze API
fetch('http://localhost:3000/api/analyze', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    cvText: testCV,
    jobRequirements: jobRequirements
  })
})
.then(response => response.json())
.then(data => {
  console.log("\n=== ANALYSIS RESULTS ===");
  console.log("Success:", data.success);
  
  if (data.analysis) {
    console.log("\nEstimated Years:", data.analysis.experienceAnalysis.estimatedYears);
    console.log("Score:", data.analysis.score);
    console.log("Strengths:", data.analysis.strengths);
    
    // More detailed debug output
    if (data.analysis.debug) {
      console.log("\n=== DETAILED DEBUG INFO ===");
      console.log("Original CV length:", data.analysis.debug.originalTextLength || data.analysis.debug.textAnalysis?.originalLength);
      console.log("Filtered CV length:", data.analysis.debug.filteredTextLength || data.analysis.debug.textAnalysis?.filteredLength);
      console.log("Removed sections:", data.analysis.debug.removedSections);
      console.log("Detected ranges:", data.analysis.debug.detectedRanges);
      console.log("Raw periods:", data.analysis.debug.rawPeriods);
      console.log("Merged periods:", data.analysis.debug.mergedPeriods);
      console.log("Final experience:", data.analysis.debug.finalExperience);
      
      // Show the filtered text preview if available
      if (data.analysis.debug.filteredTextPreview) {
        console.log("\nFiltered text preview:");
        console.log(data.analysis.debug.filteredTextPreview);
      }
    }
  }
  
  if (data.error) {
    console.error("Error:", data.error);
  }
})
.catch(error => {
  console.error('Error:', error);
});