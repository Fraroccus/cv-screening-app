import { NextRequest, NextResponse } from "next/server";
import * as pdfParse from "pdf-parse";
import * as mammoth from "mammoth";
import JSZip from "jszip";
import { JobRequirements, CVAnalysis } from "@/types";
import { analyzeRateLimiter, getClientIp } from "@/lib/rate-limit";

interface WorkPeriod {
  text: string;
  startDate: Date;
  endDate: Date;
  fullMatch: string;
  confidence?: number; // Add confidence score for each period
}

interface EmploymentGap {
  startDate: Date;
  endDate: Date;
  duration: number;
  severity: 'minor' | 'moderate' | 'significant';
}

interface ConfidenceFactors {
  dateFormatClarity: number;     // 0-100: How clear/specific the date formats are
  contextQuality: number;        // 0-100: Quality of job context information
  educationFiltering: number;    // 0-100: Confidence in education/work classification
  gapReliability: number;        // 0-100: Reliability of gap detection
  overallConsistency: number;    // 0-100: Overall consistency of the CV
}

// Complete CV Experience Extraction System
// Handles Italian, English, and mixed-language CVs with comprehensive date parsing

function extractExperienceYears(cvText: string) {
    console.log('=== STARTING CV EXPERIENCE EXTRACTION ===');
    console.log('Original CV length:', cvText.length, 'characters');
    
    // Step 1: Filter out education and volunteer sections
    const filteredText = filterEducationAndVolunteer(cvText);
    console.log('Filtered CV length:', filteredText.length, 'characters');
    
    // Step 2: Extract all date ranges
    const dateRanges = extractDateRanges(filteredText);
    console.log('Found date ranges:', dateRanges.length);
    
    // Step 3: Validate and classify each period
    const workPeriods: WorkPeriod[] = [];
    dateRanges.forEach((range, index) => {
        console.log(`\nAnalyzing period ${index + 1}: "${range.text}"`);
        console.log(`Parsed dates: ${range.startDate.toDateString()} to ${range.endDate.toDateString()}`);
        
        const isEducationOrVolunteer = checkIfEducationPeriod(range.text, range.startDate, range.endDate, cvText);
        
        if (!isEducationOrVolunteer) {
            workPeriods.push(range);
            console.log('✅ INCLUDED as work experience');
        } else {
            console.log('❌ EXCLUDED as education/volunteer');
        }
    });
    
    // Step 4: Calculate total years with gap analysis
    const result = calculateTotalYears(workPeriods);
    
    // Step 5: Calculate confidence level
    const confidence = calculateExperienceConfidence(workPeriods, result.gaps, cvText);
    
    console.log(`\n=== FINAL RESULT ===`);
    console.log(`Valid work periods: ${workPeriods.length}`);
    console.log(`Total experience: ${result.totalYears.toFixed(1)} years`);
    console.log(`Confidence level: ${confidence.overallConfidence}%`);
    
    // Log employment gaps if any
    if (result.gaps.length > 0) {
        console.log(`\n=== EMPLOYMENT GAPS ===`);
        result.gaps.forEach((gap: EmploymentGap, index: number) => {
            console.log(`Gap ${index + 1}: ${gap.duration.toFixed(1)} years (${gap.severity}) from ${gap.startDate.toDateString()} to ${gap.endDate.toDateString()}`);
        });
    }
    
    return {
        totalYears: result.totalYears,
        gaps: result.gaps,
        mergedPeriods: result.mergedPeriods,
        confidence: confidence,
        workPeriods: workPeriods.length,
        parsedWorkPeriods: workPeriods,
        debug: {
            originalLength: cvText.length,
            filteredLength: filteredText.length,
            foundRanges: dateRanges.length,
            validWorkPeriods: workPeriods.length
        }
    };
}

function filterEducationAndVolunteer(cvText: string) {
    let filteredText = cvText;
    
    // Remove obvious education sections
    const educationPatterns = [
        /\b(?:ISTRUZIONE|EDUCAZIONE|EDUCATION|FORMAZIONE|STUDIES|ACADEMIC)\b[\s\S]*?(?=\n\s*[A-Z][A-Z\s]{3,}\s*\n|$)/gi,
        /\b(?:UNIVERSITÀ|UNIVERSITY|COLLEGE|INSTITUTE|POLITECNICO)\b[\s\S]*?(?=\n\s*[A-Z][A-Z\s]{3,}\s*\n|$)/gi,
        /\b(?:LAUREA IN|LAUREA|DIPLOMA IN|DIPLOMA|DIPLOMA ACCADEMICO)\b[\s\S]*?(?=\n\s*[A-Z][A-Z\s]{3,}\s*\n|$)/gi
    ];
    
    // Remove obvious volunteer sections
    const volunteerPatterns = [
        /\b(?:VOLONTARIATO|VOLUNTEER|VOLUNTARY)\b[\s\S]*?(?=\n\s*[A-Z][A-Z\s]{3,}\s*\n|$)/gi
    ];
    
    [...educationPatterns, ...volunteerPatterns].forEach(pattern => {
        const matches = filteredText.match(pattern);
        if (matches) {
            matches.forEach(match => {
                console.log(`Removing section: ${match.substring(0, 50)}...`);
                filteredText = filteredText.replace(match, '');
            });
        }
    });
    
    return filteredText;
}

function extractDateRanges(text: string): WorkPeriod[] {
    console.log('\n=== DATE EXTRACTION ===');
    
    const ranges: WorkPeriod[] = [];
    
    // Italian month names mapping
    const monthMap: { [key: string]: number } = {
        // Italian abbreviations
        'gen': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'mag': 4, 'giu': 5,
        'lug': 6, 'ago': 7, 'set': 8, 'ott': 9, 'nov': 10, 'dic': 11,
        // Full Italian names
        'gennaio': 0, 'febbraio': 1, 'marzo': 2, 'aprile': 3, 'maggio': 4, 'giugno': 5,
        'luglio': 6, 'agosto': 7, 'settembre': 8, 'ottobre': 9, 'novembre': 10, 'dicembre': 11,
        // English abbreviations (where different from Italian)
        'jan': 0, 'jun': 5, 'jul': 6, 'aug': 7, 'sep': 8, 'sept': 8, 'oct': 9, 'dec': 11,
        // Full English names
        'january': 0, 'february': 1, 'march': 2, 'april': 3, 'may': 4, 'june': 5,
        'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11
    };
    
    // Comprehensive date patterns
    const datePatterns = [
        // NEW: Italian preposition patterns - "da gennaio 2021 ad oggi"
        /\b(?:da|dal)\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre|gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic)\s+(\d{4})\s+(?:a|al|ad)\s+(?:oggi|attualmente|presente|corrente|ora|attuale\s+occupazione|ancora\s+in\s+corso|in\s+poi)/gi,
        
        // NEW: Italian preposition year ongoing - "dal 2019 a oggi"
        /\b(?:dal|da)\s+(\d{4})\s+(?:a|al|ad)\s+(?:oggi|attualmente|presente|corrente|ora|attuale\s+occupazione|ancora\s+in\s+corso|in\s+poi)/gi,
        
        // NEW: Italian preposition year ranges - "dal 2007 al 2011"
        /\b(?:dal|da)\s+(\d{4})\s+(?:al|a)\s+(\d{4})/gi,
        
        // NEW: Italian preposition with month ranges - "da ottobre a dicembre 2005"
        /\b(?:da|dal)\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre|gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic)\s+(?:a|al)\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre|gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic)\s+(\d{4})/gi,
        
        // NEW: Single year with preposition - "anno 2008", "nel 2008"
        /\b(?:anno|year|nel|in)\s+(\d{4})/gi,
        
        // NEW: Year ongoing patterns - "dal 2022", "dal 2022 in poi", "dopo il 2022"
        /\b(?:dal|da)\s+(\d{4})$/gi,
        /\b(?:dal|da)\s+(\d{4})\s+(?:in\s+poi)/gi,
        /\b(?:dopo\s+il)\s+(\d{4})/gi,
        
        // Pattern 1: Italian months with years - Gen 2021 – Apr 2023
        /\b(gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic|gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s*(\d{4})\s*[–—-]\s*(gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic|gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s*(\d{4})/gi,
        
        // Pattern 2: Italian months to "in corso" - Gen 2021 – in corso
        /\b(gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic|gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s*(\d{4})\s*[–—-]\s*(?:in\s*corso|attuale|presente|corrente|attuale\s+occupazione|ancora\s+in\s+corso|in\s+poi)/gi,
        
        // Pattern 3: English months with years - Jan 2021 – Apr 2023
        /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)\s*(\d{4})\s*[–—-]\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)\s*(\d{4})/gi,
        
        // Pattern 4: English months to current - Jan 2021 – current
        /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)\s*(\d{4})\s*[–—-]\s*(?:current|ongoing|present|now)/gi,
        
        // Pattern 5: Numeric dates - 01/2021 – 12/2023
        /\b(\d{1,2})\/(\d{4})\s*[–—-]\s*(\d{1,2})\/(\d{4})/g,
        
        // Pattern 6: Numeric dates to current - 01/2021 – current
        /\b(\d{1,2})\/(\d{4})\s*[–—-]\s*(?:current|ongoing|present|now|in\s*corso|attuale|attuale\s+occupazione|ancora\s+in\s+corso|in\s+poi)/gi,
        
        // Pattern 7: Year only ranges - 2021 – 2023
        /\b(\d{4})\s*[–—-]\s*(\d{4})/g,
        
        // Pattern 8: Year to current - 2021 – current
        /\b(\d{4})\s*[–—-]\s*(?:current|ongoing|present|now|in\s*corso|attuale|attuale\s+occupazione|ancora\s+in\s+corso|in\s+poi)/gi
    ];
    
    const currentDate = new Date();
    
    datePatterns.forEach((pattern, index) => {
        console.log(`Testing pattern ${index + 1}:`, pattern.source);
        
        let match;
        pattern.lastIndex = 0; // Reset regex
        
        while ((match = pattern.exec(text)) !== null) {
            console.log(`Found match: "${match[0]}"`);
            
            let startDate: Date | undefined, endDate: Date | undefined;
            
            try {
                if (index === 0) {
                    // "da gennaio 2021 ad oggi" - Italian month to current with prepositions
                    const startMonth = monthMap[match[1].toLowerCase()];
                    const startYear = parseInt(match[2]);
                    startDate = new Date(startYear, startMonth, 1);
                    endDate = currentDate;
                    
                } else if (index === 1) {
                    // "dal 2019 a oggi" - Italian year to current with prepositions
                    const startYear = parseInt(match[1]);
                    startDate = new Date(startYear, 0, 1);
                    endDate = currentDate;
                    
                } else if (index === 2) {
                    // "dal 2007 al 2011" - Italian year range with prepositions
                    const startYear = parseInt(match[1]);
                    const endYear = parseInt(match[2]);
                    startDate = new Date(startYear, 0, 1);
                    endDate = new Date(endYear, 11, 31);
                    
                } else if (index === 3) {
                    // "da ottobre a dicembre 2005" - Italian month range with prepositions
                    const startMonth = monthMap[match[1].toLowerCase()];
                    const endMonth = monthMap[match[2].toLowerCase()];
                    const year = parseInt(match[3]);
                    startDate = new Date(year, startMonth, 1);
                    endDate = new Date(year, endMonth + 1, 0);
                    
                } else if (index === 4) {
                    // "anno 2008", "nel 2008" - Single year with preposition
                    const year = parseInt(match[1]);
                    startDate = new Date(year, 0, 1);
                    endDate = new Date(year, 11, 31);
                    
                } else if (index === 5) {
                    // "dal 2022" - Year ongoing (standalone)
                    const year = parseInt(match[1]);
                    startDate = new Date(year, 0, 1);
                    endDate = currentDate;
                    
                } else if (index === 6) {
                    // "dal 2022 in poi" - Year ongoing with explicit continuation
                    const year = parseInt(match[1]);
                    startDate = new Date(year, 0, 1);
                    endDate = currentDate;
                    
                } else if (index === 7) {
                    // "dopo il 2022" - After a specific year
                    const year = parseInt(match[1]);
                    startDate = new Date(year + 1, 0, 1); // Start from next year
                    endDate = currentDate;
                    
                } else if (index >= 8 && index <= 11) {
                    // Standard month name patterns (existing logic)
                    const startMonth = monthMap[match[1].toLowerCase()];
                    const startYear = parseInt(match[2]);
                    
                    if (match[3] && match[4]) {
                        // Has end date
                        const endMonth = monthMap[match[3].toLowerCase()];
                        const endYear = parseInt(match[4]);
                        
                        startDate = new Date(startYear, startMonth, 1);
                        endDate = new Date(endYear, endMonth + 1, 0); // Last day of month
                    } else {
                        // Ongoing position
                        startDate = new Date(startYear, startMonth, 1);
                        endDate = currentDate;
                    }
                } else if (index >= 12 && index <= 13) {
                    // Numeric patterns (existing logic)
                    if (match[3] && match[4]) {
                        // Has end date
                        startDate = new Date(parseInt(match[2]), parseInt(match[1]) - 1, 1);
                        endDate = new Date(parseInt(match[4]), parseInt(match[3]), 0);
                    } else {
                        // Ongoing position
                        startDate = new Date(parseInt(match[2]), parseInt(match[1]) - 1, 1);
                        endDate = currentDate;
                    }
                } else {
                    // Year only patterns (existing logic)
                    if (match[2]) {
                        // Has end year
                        startDate = new Date(parseInt(match[1]), 0, 1);
                        endDate = new Date(parseInt(match[2]), 11, 31);
                    } else {
                        // Ongoing position
                        startDate = new Date(parseInt(match[1]), 0, 1);
                        endDate = currentDate;
                    }
                }
                
                // Validate dates
                if (startDate && endDate && startDate <= endDate && 
                    startDate.getFullYear() >= 1970 && startDate.getFullYear() <= currentDate.getFullYear() + 1) {
                    
                    // IMPROVED: Get extended context that includes job descriptions on following lines
                    const contextStart = Math.max(0, match.index! - 100);
                    const contextEnd = Math.min(text.length, match.index! + match[0].length + 300); // Extended to 300 chars after
                    const context = text.substring(contextStart, contextEnd);
                    
                    ranges.push({
                        text: match[0],
                        startDate: startDate,
                        endDate: endDate,
                        fullMatch: context
                    });
                    console.log(`✅ Valid date range: ${startDate.toDateString()} to ${endDate.toDateString()}`);
                } else {
                    console.log(`❌ Invalid date range: ${startDate} to ${endDate}`);
                }
            } catch (error) {
                console.log(`❌ Error parsing dates: ${error}`);
            }
        }
    });
    
    console.log(`Total valid ranges found: ${ranges.length}`);
    return ranges;
}

function checkIfEducationPeriod(dateRangeText: string, startDate: Date, endDate: Date, originalCvText: string): boolean {
    const rangeText = dateRangeText.toLowerCase();
    
    console.log(`   🔍 Checking if education/volunteer: "${dateRangeText}"`);
    
    // Get context around this date range with improved fallback
    const cvTextLower = originalCvText.toLowerCase();
    const dateIndex = cvTextLower.indexOf(rangeText);
    let contextText = '';
    
    if (dateIndex !== -1) {
        const start = Math.max(0, dateIndex - 300);
        const end = Math.min(cvTextLower.length, dateIndex + rangeText.length + 300);
        contextText = cvTextLower.substring(start, end);
    } else {
        // Enhanced fallback: try to find any part of the date range or use wider context
        const yearMatches = rangeText.match(/\d{4}/g);
        if (yearMatches && yearMatches.length > 0) {
            const firstYear = yearMatches[0];
            const yearIndex = cvTextLower.indexOf(firstYear);
            if (yearIndex !== -1) {
                const start = Math.max(0, yearIndex - 400);
                const end = Math.min(cvTextLower.length, yearIndex + 400);
                contextText = cvTextLower.substring(start, end);
            } else {
                // Last resort: use entire CV text but prioritize sections near dates
                contextText = cvTextLower;
            }
        } else {
            contextText = cvTextLower;
        }
    }
    
    console.log(`   Context: "${contextText.substring(0, 100)}..."`);
    
    // Enhanced work indicators with professional teaching roles (3x weight)
    const professionalTeachingRoles = [
        'docenza', 'teacher', 'docente', 'professore', 'professor', 'insegnante', 'istruttore', 'formatore',
        'lecturer', 'instructor', 'tutor universitario', 'docente universitario', 'ricercatore universitario'
    ];
    
    // Strong work indicators (2x weight)
    const strongWorkIndicators = [
        // Employment terms
        'salary', 'wage', 'paid', 'contract', 'employment', 'hired', 'employee', 'stage', 'stagista', 'tirocinante', 'apprendistato', 'apprendista', 
        'collaborazione', 'collaboratore', 'collabora', 'stipendio', 'retribuzione', 'contratto', 'assunto', 'assunta', 'dipendente', 
        'servizio civile', 'servizio civile ambientale', 'servizio civile universale', 'servizio',
        
        // Professional titles
        'manager', 'director', 'coordinator', 'supervisor', 'consultant', 'analyst', 'analista',
        'engineer', 'developer', 'specialist', 'lead', 'senior', 'junior', 'ingegnere',
        'responsabile', 'direttore', 'direttrice', 'coordinatore', 'coordinatrice', 'consulente', 'assegnista',
        
        // Business context
        'company', 'corporation', 'firm', 'business', 'client', 'project', 'progetto', 'lavoro', 'cooperativa',
        'azienda', 'società', 'cliente', 'collaborazione', 'consultant', 'consulenza', 'progettista',
        
        // Professional activities
        'coordinate', 'develop', 'implement', 'lead', 'libera professione', 'libera professionista', 'libera attività', 
        'professionista', 'professional', 'coach', 'gestire', 'coordinare', 'sviluppare', 'implementare', 'prestazione', 
        'libero profesionista', 'creative director'
    ];
    
    // Enhanced volunteer indicators
    const volunteerIndicators = [
        'volunteer', 'volunteering', 'voluntary', 'unpaid', 'charity', 'volontariato', 'volontario', 
        'beneficenza', 'gratuito', 'volontaria', 'estate ragazzi', 'non retribuito', 'senza compenso',
        'attività benefica', 'opera di volontariato', 'servizio comunitario'
    ];
    
    // Enhanced education indicators (as student) with university types
    const educationIndicators = [
        // Student status
        'studying', 'student', 'enrolled', 'studiando', 'studente', 'iscritto', 'iscritta', 'frequentante',
        // Academic credentials
        'degree', 'bachelor', 'master', 'phd', 'dottorato', 'laurea', 'diploma', 'diploma accademico',
        // Academic contexts
        'corso', 'facoltà', 'corso di studi', 'curricolare', 'curriculare', 'its', 'tesi', 'thesis',
        // Institution types
        'università', 'university', 'politecnico', 'college', 'institute', 'istituto', 'accademia', 'academy',
        'conservatorio', 'scuola superiore', 'high school', 'liceo', 'istituto tecnico',
        // Academic activities
        'esami', 'exam', 'voto', 'votazione', 'crediti', 'credits', 'semestre', 'semester', 'anno accademico',
        'borsa di studio', 'scholarship', 'erasmus', 'exchange student'
    ];
    
    // Count indicators with weighted scoring
    let workScore = 0;
    let volunteerScore = 0;
    let educationScore = 0;
    
    // Professional teaching roles get 3x weight (6 points)
    professionalTeachingRoles.forEach(indicator => {
        if (contextText.includes(indicator)) {
            workScore += 6; // 3x weight as per specifications
            console.log(`   💼 Found professional teaching role (3x): "${indicator}"`);
        }
    });
    
    // Regular work indicators get 2x weight (2 points)
    strongWorkIndicators.forEach(indicator => {
        if (contextText.includes(indicator)) {
            workScore += 2;
            console.log(`   💼 Found work indicator: "${indicator}"`);
        }
    });
    
    volunteerIndicators.forEach(indicator => {
        if (contextText.includes(indicator)) {
            volunteerScore += 2;
            console.log(`   🤝 Found volunteer indicator: "${indicator}"`);
        }
    });
    
    educationIndicators.forEach(indicator => {
        if (contextText.includes(indicator)) {
            educationScore += 2;
            console.log(`   🎓 Found education indicator: "${indicator}"`);
        }
    });
    
    const duration = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    console.log(`   Duration: ${duration.toFixed(1)} years`);
    console.log(`   Scores - Work: ${workScore}, Volunteer: ${volunteerScore}, Education: ${educationScore}`);
    
    // Enhanced decision logic following specifications
    if (workScore >= 3) { // Raised threshold to 3 as per memory specifications
        console.log(`   ✅ WORK: Strong work indicators (score >= 3)`);
        return false;
    }
    
    if (volunteerScore >= 2 && workScore === 0) {
        console.log(`   🤝 VOLUNTEER: Clear volunteer work`);
        return true;
    }
    
    if (educationScore >= 2 && workScore === 0 && duration >= 1 && duration <= 8) {
        console.log(`   🎓 EDUCATION: Student period`);
        return true;
    }
    
    // Default to work experience
    console.log(`   ✅ WORK (default): Treating as work experience`);
    return false;
}

function calculateExperienceConfidence(workPeriods: WorkPeriod[], gaps: EmploymentGap[], originalCvText: string): { overallConfidence: number; factors: ConfidenceFactors; details: string[] } {
    const details: string[] = [];
    
    // 1. Date Format Clarity (0-100)
    let dateFormatClarity = 0;
    let preciseFormats = 0;
    let vagueDateCount = 0;
    
    workPeriods.forEach(period => {
        const text = period.text.toLowerCase();
        
        // High confidence: specific month/year formats
        if (text.match(/\b(gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic|january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}/i)) {
            preciseFormats++;
        }
        // Medium confidence: year-only formats
        else if (text.match(/\b\d{4}\b/)) {
            preciseFormats += 0.7;
        }
        // Low confidence: vague formats
        else {
            vagueDateCount++;
        }
    });
    
    if (workPeriods.length > 0) {
        dateFormatClarity = Math.min(100, (preciseFormats / workPeriods.length) * 100);
        if (vagueDateCount > 0) {
            dateFormatClarity *= 0.8; // Penalty for vague dates
        }
    }
    
    details.push(`Date format clarity: ${dateFormatClarity.toFixed(0)}% (${preciseFormats.toFixed(1)}/${workPeriods.length} periods with clear dates)`);
    
    // 2. Context Quality (0-100)
    let contextQuality = 0;
    let richContextCount = 0;
    
    workPeriods.forEach(period => {
        const context = period.fullMatch?.toLowerCase() || '';
        let contextScore = 30; // Base score
        
        // Bonus for job titles/roles
        if (context.match(/\b(manager|director|developer|engineer|analyst|consultant|specialist|coordinator|responsabile|ingegnere|sviluppatore)\b/i)) {
            contextScore += 25;
        }
        
        // Bonus for company mentions
        if (context.match(/\b(azienda|società|company|corporation|firm|presso|at|per)\b/i)) {
            contextScore += 20;
        }
        
        // Bonus for work activities
        if (context.match(/\b(develop|manage|coordinate|implement|project|progetto|gestire|coordinare|sviluppare)\b/i)) {
            contextScore += 15;
        }
        
        // Bonus for employment terms
        if (context.match(/\b(contract|stipendio|salary|employment|contratto|assunto|dipendente)\b/i)) {
            contextScore += 10;
        }
        
        richContextCount += Math.min(100, contextScore) / 100;
    });
    
    if (workPeriods.length > 0) {
        contextQuality = Math.min(100, (richContextCount / workPeriods.length) * 100);
    }
    
    details.push(`Context quality: ${contextQuality.toFixed(0)}% (average context richness across periods)`);
    
    // 3. Education Filtering Confidence (0-100)
    let educationFiltering = 85; // Base confidence in filtering logic
    
    // Check for ambiguous cases that might reduce confidence
    const cvLower = originalCvText.toLowerCase();
    let ambiguousCases = 0;
    
    // Look for potentially ambiguous education/work overlaps
    const ambiguousPatterns = [
        /\b(stage|tirocinio|internship).*\b(universit[aà]|university|college)\b/gi,
        /\b(ricerca|research).*\b(dottorato|phd|università)\b/gi,
        /\b(teaching|docenza|insegnamento).*\b(università|university)\b/gi
    ];
    
    ambiguousPatterns.forEach(pattern => {
        const matches = cvLower.match(pattern);
        if (matches) {
            ambiguousCases += matches.length;
        }
    });
    
    if (ambiguousCases > 0) {
        educationFiltering = Math.max(60, educationFiltering - (ambiguousCases * 10));
        details.push(`Education filtering: ${educationFiltering.toFixed(0)}% (${ambiguousCases} potentially ambiguous cases detected)`);
    } else {
        details.push(`Education filtering: ${educationFiltering.toFixed(0)}% (clear work/education separation)`);
    }
    
    // 4. Gap Reliability (0-100)
    let gapReliability = 90; // Base confidence
    
    if (gaps.length > 0) {
        const significantGaps = gaps.filter(gap => gap.severity === 'significant').length;
        const moderateGaps = gaps.filter(gap => gap.severity === 'moderate').length;
        
        // Reduce confidence if there are many gaps (might indicate missing data)
        if (significantGaps > 2) {
            gapReliability -= 20;
        } else if (significantGaps > 0) {
            gapReliability -= 10;
        }
        
        if (moderateGaps > 3) {
            gapReliability -= 15;
        }
        
        details.push(`Gap reliability: ${gapReliability.toFixed(0)}% (${gaps.length} gaps detected, ${significantGaps} significant)`);
    } else {
        details.push(`Gap reliability: ${gapReliability.toFixed(0)}% (continuous work history)`);
    }
    
    // 5. Overall Consistency (0-100)
    let overallConsistency = 80; // Base score
    
    // Check for chronological consistency
    const sortedPeriods = [...workPeriods].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    let chronologicalIssues = 0;
    
    for (let i = 1; i < sortedPeriods.length; i++) {
        const prev = sortedPeriods[i - 1];
        const curr = sortedPeriods[i];
        
        // Check for overlaps that weren't merged (potential data quality issues)
        if (curr.startDate < prev.endDate) {
            const overlapYears = (prev.endDate.getTime() - curr.startDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
            if (overlapYears > 0.1) { // More than ~1 month overlap
                chronologicalIssues++;
            }
        }
    }
    
    if (chronologicalIssues > 0) {
        overallConsistency -= Math.min(30, chronologicalIssues * 10);
    }
    
    // Check for reasonable career progression
    const careerSpan = workPeriods.length > 0 ? 
        (Math.max(...workPeriods.map(p => p.endDate.getTime())) - Math.min(...workPeriods.map(p => p.startDate.getTime()))) / (1000 * 60 * 60 * 24 * 365.25) : 0;
    
    if (careerSpan > 50) { // Unrealistic career span
        overallConsistency -= 20;
        details.push(`Overall consistency: ${overallConsistency.toFixed(0)}% (unusually long career span: ${careerSpan.toFixed(0)} years)`);
    } else if (chronologicalIssues > 0) {
        details.push(`Overall consistency: ${overallConsistency.toFixed(0)}% (${chronologicalIssues} chronological inconsistencies)`);
    } else {
        details.push(`Overall consistency: ${overallConsistency.toFixed(0)}% (chronologically consistent)`);
    }
    
    // Calculate weighted overall confidence
    const weights = {
        dateFormatClarity: 0.25,
        contextQuality: 0.20,
        educationFiltering: 0.20,
        gapReliability: 0.15,
        overallConsistency: 0.20
    };
    
    const overallConfidence = Math.round(
        dateFormatClarity * weights.dateFormatClarity +
        contextQuality * weights.contextQuality +
        educationFiltering * weights.educationFiltering +
        gapReliability * weights.gapReliability +
        overallConsistency * weights.overallConsistency
    );
    
    const factors: ConfidenceFactors = {
        dateFormatClarity: Math.round(dateFormatClarity),
        contextQuality: Math.round(contextQuality),
        educationFiltering: Math.round(educationFiltering),
        gapReliability: Math.round(gapReliability),
        overallConsistency: Math.round(overallConsistency)
    };
    
    return { overallConfidence, factors, details };
}

function calculateTotalYears(workPeriods: WorkPeriod[]): { totalYears: number; gaps: EmploymentGap[]; mergedPeriods: WorkPeriod[] } {
    if (workPeriods.length === 0) {
        return { totalYears: 0, gaps: [], mergedPeriods: [] };
    }

    // Sort by start date
    const sorted = [...workPeriods].sort(
        (a, b) => a.startDate.getTime() - b.startDate.getTime()
    );

    // Merge overlapping or adjacent intervals
    const merged: WorkPeriod[] = [];
    let current = { ...sorted[0] };

    for (let i = 1; i < sorted.length; i++) {
        const next = sorted[i];

        if (next.startDate <= current.endDate) {
            // Overlap → extend current period
            if (next.endDate > current.endDate) {
                current.endDate = next.endDate;
            }
            console.log(`Merged overlapping periods: ${current.text} + ${next.text}`);
        } else {
            // No overlap → push current and start new
            merged.push(current);
            current = { ...next };
        }
    }
    merged.push(current);

    // Calculate total experience in years
    const msInYear = 1000 * 60 * 60 * 24 * 365.25;
    const totalYears = merged.reduce(
        (sum, p) => sum + (p.endDate.getTime() - p.startDate.getTime()) / msInYear,
        0
    );

    // Calculate gaps between merged periods
    const gaps: EmploymentGap[] = [];
    for (let i = 1; i < merged.length; i++) {
        const prev = merged[i - 1];
        const curr = merged[i];
        const gapDuration = (curr.startDate.getTime() - prev.endDate.getTime()) / msInYear;
        
        // Only consider gaps of 30+ days (about 0.08 years) as significant per specifications
        if (gapDuration > 0.08) {
            let severity: 'minor' | 'moderate' | 'significant';
            if (gapDuration < 0.5) severity = 'minor';        // < 6 months
            else if (gapDuration < 2) severity = 'moderate';   // 6 months - 2 years  
            else severity = 'significant';                     // > 2 years
            
            gaps.push({
                startDate: prev.endDate,
                endDate: curr.startDate,
                duration: gapDuration,
                severity
            });
            
            console.log(`🔍 Employment gap detected: ${gapDuration.toFixed(1)} years (${severity}) between ${prev.endDate.toDateString()} and ${curr.startDate.toDateString()}`);
        }
    }

    // Enhanced debug logging
    merged.forEach((period, index) => {
        const years = (period.endDate.getTime() - period.startDate.getTime()) / msInYear;
        console.log(`Merged period ${index + 1}: ${years.toFixed(1)} years (${period.startDate.getFullYear()}-${period.endDate.getFullYear()})`);
    });

    return { totalYears, gaps, mergedPeriods: merged };
}

// Comprehensive CV Analysis Function
function analyzeCV(cvText: string, jobRequirements: JobRequirements): CVAnalysis {
    // Get experience analysis with full debug info
    const experienceResult = extractExperienceYears(cvText);
    
    // Skills analysis
    const skillsAnalysis = analyzeSkills(cvText, jobRequirements);
    
    // Experience analysis
    const experienceAnalysis = analyzeExperience(cvText, jobRequirements);
    
    // Education analysis
    const educationAnalysis = analyzeEducation(cvText, jobRequirements);
    
    // Extract metadata
    const metadata = extractMetadata(cvText);
    
    // Calculate weighted score
    const weights = jobRequirements.weights || { skills: 50, experience: 30, education: 20 };
    const normalizedWeights = normalizeWeights(weights);
    
    const overallScore = Math.round(
        (skillsAnalysis.score * normalizedWeights.skills / 100) +
        (experienceAnalysis.score * normalizedWeights.experience / 100) +
        (educationAnalysis.score * normalizedWeights.education / 100)
    );
    
    // Generate recommendations
    const recommendations = generateRecommendations(skillsAnalysis, experienceAnalysis, educationAnalysis, jobRequirements);
    
    // Generate strengths and weaknesses
    const { strengths, weaknesses } = generateStrengthsWeaknesses(skillsAnalysis, experienceAnalysis, educationAnalysis, jobRequirements);
    
    // Enhanced debug info combining experience extraction debug with other analysis data
    const enhancedDebug = {
        // Experience extraction debug (from your restored system)
        originalLength: experienceResult.debug.originalLength,
        filteredLength: experienceResult.debug.filteredLength,
        foundRanges: experienceResult.debug.foundRanges,
        validWorkPeriods: experienceResult.debug.validWorkPeriods,
        finalExperience: experienceResult.totalYears,
        
        // NEW: Confidence information
        confidence: experienceResult.confidence || null,
        
        // NEW: Detailed working periods for debug display
        parsedWorkPeriods: experienceResult.parsedWorkPeriods.map(period => ({
            text: period.text,
            startDate: period.startDate.toISOString().split('T')[0], // Format as YYYY-MM-DD
            endDate: period.endDate.toISOString().split('T')[0],
            duration: ((period.endDate.getTime() - period.startDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1) + ' years',
            context: period.fullMatch ? period.fullMatch.substring(0, 100) + '...' : 'No context'
        })),
        
        // NEW: Employment gap information
        employmentGaps: experienceResult.gaps ? experienceResult.gaps.map((gap: EmploymentGap) => ({
            startDate: gap.startDate.toISOString().split('T')[0],
            endDate: gap.endDate.toISOString().split('T')[0], 
            duration: gap.duration.toFixed(1) + ' years',
            severity: gap.severity,
            description: `${gap.severity} gap (${gap.duration.toFixed(1)} years)`
        })) : [],
        
        // NEW: Merged periods after overlap resolution
        mergedWorkPeriods: experienceResult.mergedPeriods ? experienceResult.mergedPeriods.map((period: WorkPeriod) => ({
            startDate: period.startDate.toISOString().split('T')[0],
            endDate: period.endDate.toISOString().split('T')[0],
            duration: ((period.endDate.getTime() - period.startDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1) + ' years'
        })) : [],
        
        // Legacy field names for backward compatibility
        originalTextLength: experienceResult.debug.originalLength,
        filteredTextLength: experienceResult.debug.filteredLength,
        detectedRanges: [],
        removedSections: [],
        rawPeriods: [],
        mergedPeriods: [],
        
        // Analysis scores debug
        scoreBreakdown: {
            skills: skillsAnalysis.score,
            experience: experienceAnalysis.score,
            education: educationAnalysis.score,
            weights: normalizedWeights,
            final: overallScore
        }
    };
    
    return {
        score: overallScore,
        strengths,
        weaknesses,
        skillsMatch: skillsAnalysis,
        experienceAnalysis,
        educationMatch: educationAnalysis,
        recommendations,
        metadata,
        // Include enhanced debug info
        debug: enhancedDebug
    } as CVAnalysis & { debug: any };
}

// Normalize weights to sum to 100%
function normalizeWeights(weights: { skills: number; experience: number; education: number }) {
    const total = weights.skills + weights.experience + weights.education;
    if (total === 0) return { skills: 50, experience: 30, education: 20 };
    
    return {
        skills: (weights.skills / total) * 100,
        experience: (weights.experience / total) * 100,
        education: (weights.education / total) * 100
    };
}

// Skills analysis function
function analyzeSkills(cvText: string, jobRequirements: JobRequirements) {
    const cvLower = cvText.toLowerCase();
    
    // Analyze required skills
    const requiredMatched: string[] = [];
    const requiredMissing: string[] = [];
    
    jobRequirements.requiredSkills.forEach(skill => {
        if (cvLower.includes(skill.toLowerCase())) {
            requiredMatched.push(skill);
        } else {
            requiredMissing.push(skill);
        }
    });
    
    // Analyze preferred skills
    const preferredMatched: string[] = [];
    if (jobRequirements.preferredSkills) {
        jobRequirements.preferredSkills.forEach(skill => {
            if (cvLower.includes(skill.toLowerCase())) {
                preferredMatched.push(skill);
            }
        });
    }
    
    // Calculate score based on required skills only
    const requiredScore = jobRequirements.requiredSkills.length > 0 
        ? Math.round((requiredMatched.length / jobRequirements.requiredSkills.length) * 100)
        : 100;
    
    return {
        matched: [...requiredMatched, ...preferredMatched],
        missing: requiredMissing,
        score: requiredScore,
        requiredMatched,
        preferredMatched,
        requiredMissing
    };
}

// Experience analysis function
function analyzeExperience(cvText: string, jobRequirements: JobRequirements) {
    const experienceResult = extractExperienceYears(cvText);
    const estimatedYears = experienceResult.totalYears;
    const minRequired = jobRequirements.minExperience;
    
    // Calculate score based on experience
    let score = 0;
    if (estimatedYears >= minRequired) {
        score = 100;
        // Bonus for significantly more experience
        if (estimatedYears > minRequired * 1.5) {
            score = Math.min(100, score + 10);
        }
    } else {
        // Partial score for less experience
        score = Math.round((estimatedYears / minRequired) * 80); // Max 80% if below requirement
    }
    
    // Factor in employment gaps for scoring adjustment
    if (experienceResult.gaps && experienceResult.gaps.length > 0) {
        const totalGapYears = experienceResult.gaps.reduce((sum: number, gap: EmploymentGap) => sum + gap.duration, 0);
        const significantGaps = experienceResult.gaps.filter(gap => gap.severity === 'significant').length;
        
        // Reduce score based on gap severity
        let gapPenalty = 0;
        if (significantGaps > 0) {
            gapPenalty = Math.min(15, significantGaps * 10); // Up to 15% penalty for significant gaps
        } else if (totalGapYears > 1) {
            gapPenalty = Math.min(10, totalGapYears * 5); // Up to 10% penalty for moderate gaps
        }
        
        score = Math.max(0, score - gapPenalty);
    }
    
    return {
        estimatedYears: Math.round(estimatedYears * 10) / 10,
        relevantExperience: estimatedYears >= minRequired,
        employmentGaps: experienceResult.gaps || [],
        gapAnalysis: experienceResult.gaps ? {
            totalGaps: experienceResult.gaps.length,
            totalGapDuration: experienceResult.gaps.reduce((sum, gap) => sum + gap.duration, 0),
            significantGaps: experienceResult.gaps.filter(gap => gap.severity === 'significant').length
        } : null,
        score: Math.max(0, Math.min(100, score))
    };
}

// Education analysis function
function analyzeEducation(cvText: string, jobRequirements: JobRequirements) {
    const cvLower = cvText.toLowerCase();
    const requiredEducation = jobRequirements.education.toLowerCase();
    
    // Education level mapping
    const educationLevels = {
        'phd': 5,
        'doctorate': 5,
        'dottorato': 5,
        'specializzazione': 5,
        'master': 4,
        'magistrale': 4,
        'msc': 4,
        'laurea magistrale': 4,
        // Italian Master's degree equivalents
        'diploma accademico di ii livello': 4,
        'diploma accademico di 2 livello': 4,
        'diploma accademico di secondo livello': 4,
        'bachelor': 3,
        'laurea': 3,
        'degree': 3,
        // Italian Bachelor's degree equivalents
        'diploma di perito': 3,
        'diploma its': 3,
        'diploma di its': 3,
        'diploma accademico di i livello': 3,
        'diploma accademico di 1 livello': 3,
        'diploma accademico di primo livello': 3,
        'diploma di tecnico superiore': 3,
        'diploma di istituto tecnico superiore': 3,
        'diploma': 2,
        'high school': 1,
        'scuola superiore': 1
    };
    
    // Detect education level in CV
    let detectedLevel = 'Unknown';
    let detectedLevelScore = 0;
    
    for (const [level, score] of Object.entries(educationLevels)) {
        if (cvLower.includes(level)) {
            if (score > detectedLevelScore) {
                detectedLevel = level;
                detectedLevelScore = score;
            }
        }
    }
    
    // Get required level score
    let requiredLevelScore = 0;
    for (const [level, score] of Object.entries(educationLevels)) {
        if (requiredEducation.includes(level)) {
            requiredLevelScore = Math.max(requiredLevelScore, score);
        }
    }
    
    // Calculate score
    let score = 0;
    if (detectedLevelScore >= requiredLevelScore) {
        score = 100;
    } else if (detectedLevelScore > 0) {
        score = Math.round((detectedLevelScore / requiredLevelScore) * 80);
    } else {
        score = 30; // Default score when education level is unclear
    }
    
    return {
        level: detectedLevel,
        relevant: detectedLevelScore >= requiredLevelScore,
        score: Math.max(0, Math.min(100, score))
    };
}

// Extract metadata from CV
function extractMetadata(cvText: string) {
    const cvLower = cvText.toLowerCase();
    
    // Extract technologies
    const techKeywords = [
        'javascript', 'python', 'java', 'react', 'angular', 'vue', 'node.js', 'express',
        'mongodb', 'mysql', 'postgresql', 'docker', 'kubernetes', 'aws', 'azure', 'git',
        'typescript', 'html', 'css', 'sass', 'webpack', 'npm', 'yarn', 'redux', 'graphql',
        'rest api', 'microservices', 'agile', 'scrum', 'devops', 'ci/cd', 'jenkins',
        'php', 'laravel', 'symfony', 'django', 'flask', 'spring', 'hibernate', 'maven',
        'gradle', 'junit', 'selenium', 'cypress', 'jest', 'mocha', 'linux', 'nginx',
        'apache', 'redis', 'elasticsearch', 'kafka', 'rabitmq', 'terraform', 'ansible'
    ];
    
    const technologies = techKeywords.filter(tech => cvLower.includes(tech));
    
    // Extract soft skills
    const softSkillKeywords = [
        'leadership', 'communication', 'teamwork', 'problem solving', 'analytical',
        'creative', 'organized', 'detail oriented', 'time management', 'adaptable',
        'collaborative', 'innovative', 'strategic', 'customer focused', 'results driven',
        'gestione team', 'comunicazione', 'lavoro di squadra', 'risoluzione problemi',
        'analitico', 'creativo', 'organizzato', 'orientato ai dettagli', 'flessibile',
        'innovativo', 'strategico', 'orientato al cliente', 'orientato ai risultati'
    ];
    
    const softSkills = softSkillKeywords.filter(skill => cvLower.includes(skill));
    
    // Extract positions (common job titles)
    const positionKeywords = [
        'developer', 'engineer', 'architect', 'manager', 'director', 'analyst',
        'consultant', 'specialist', 'coordinator', 'supervisor', 'lead', 'senior',
        'junior', 'intern', 'amministratore', 'sviluppatore', 'ingegnere', 'architetto',
        'responsabile', 'direttore', 'analista', 'consulente', 'specialista',
        'coordinatore', 'supervisore', 'capo', 'senior', 'junior', 'stagista'
    ];
    
    const positions = positionKeywords.filter(pos => cvLower.includes(pos));
    
    // Extract certifications
    const certKeywords = [
        'aws', 'azure', 'google cloud', 'pmp', 'scrum master', 'agile', 'itil',
        'cisco', 'microsoft', 'oracle', 'salesforce', 'comptia', 'cissp',
        'ceh', 'cisa', 'cism', 'prince2', 'six sigma', 'iso 27001'
    ];
    
    const certifications = certKeywords.filter(cert => cvLower.includes(cert));
    
    // Extract keywords (combination of all above)
    const keywords = [...new Set([...technologies, ...softSkills, ...positions, ...certifications])];
    
    return {
        softSkills,
        keywords,
        positions,
        technologies,
        certifications
    };
}

// Generate recommendations
function generateRecommendations(skillsAnalysis: any, experienceAnalysis: any, educationAnalysis: any, jobRequirements: JobRequirements): string[] {
    const recommendations: string[] = [];
    
    // Skills recommendations
    if (skillsAnalysis.requiredMissing.length > 0) {
        recommendations.push(`Consider developing these missing required skills: ${skillsAnalysis.requiredMissing.join(', ')}`);
    }
    
    // Experience recommendations
    if (!experienceAnalysis.relevantExperience) {
        const gap = jobRequirements.minExperience - experienceAnalysis.estimatedYears;
        recommendations.push(`Consider gaining ${gap.toFixed(1)} more years of relevant experience`);
    }
    
    // Education recommendations
    if (!educationAnalysis.relevant) {
        recommendations.push(`Consider pursuing ${jobRequirements.education} to meet education requirements`);
    }
    
    // Positive recommendations
    if (skillsAnalysis.score >= 80 && experienceAnalysis.score >= 80) {
        recommendations.push('Strong candidate with excellent skills and experience match');
    }
    
    if (recommendations.length === 0) {
        recommendations.push('Well-qualified candidate that meets job requirements');
    }
    
    return recommendations;
}

// Generate strengths and weaknesses
function generateStrengthsWeaknesses(skillsAnalysis: any, experienceAnalysis: any, educationAnalysis: any, jobRequirements: JobRequirements) {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    
    // Skills strengths/weaknesses
    if (skillsAnalysis.score >= 80) {
        strengths.push(`Strong skills match (${skillsAnalysis.score}%) with ${skillsAnalysis.requiredMatched.length} of ${jobRequirements.requiredSkills.length} required skills`);
    } else if (skillsAnalysis.score < 50) {
        weaknesses.push(`Limited skills match (${skillsAnalysis.score}%) - missing key required skills`);
    }
    
    // Experience strengths/weaknesses
    if (experienceAnalysis.relevantExperience) {
        if (experienceAnalysis.estimatedYears > jobRequirements.minExperience * 1.5) {
            strengths.push(`Extensive experience (${experienceAnalysis.estimatedYears} years) exceeds requirements`);
        } else {
            strengths.push(`Meets experience requirements with ${experienceAnalysis.estimatedYears} years`);
        }
        
        // Add gap analysis to strengths/weaknesses
        if (experienceAnalysis.employmentGaps && experienceAnalysis.employmentGaps.length > 0) {
            const significantGaps = experienceAnalysis.employmentGaps.filter((gap: EmploymentGap) => gap.severity === 'significant');
            const moderateGaps = experienceAnalysis.employmentGaps.filter((gap: EmploymentGap) => gap.severity === 'moderate');
            
            if (significantGaps.length > 0) {
                weaknesses.push(`${significantGaps.length} significant employment gap${significantGaps.length > 1 ? 's' : ''} (>2 years each)`);
            } else if (moderateGaps.length > 1) {
                weaknesses.push(`${moderateGaps.length} moderate employment gaps (6 months - 2 years each)`);
            } else if (experienceAnalysis.employmentGaps.length === 1 && experienceAnalysis.employmentGaps[0].severity === 'minor') {
                // Don't mention minor single gaps as they're not significant
            } else if (experienceAnalysis.employmentGaps.length > 2) {
                weaknesses.push(`Multiple employment gaps in work history`);
            }
        }
    } else {
        const gap = jobRequirements.minExperience - experienceAnalysis.estimatedYears;
        weaknesses.push(`${gap.toFixed(1)} years below required experience level`);
    }
    
    // Education strengths/weaknesses
    if (educationAnalysis.relevant) {
        strengths.push(`Education level (${educationAnalysis.level}) meets requirements`);
    } else if (educationAnalysis.level !== 'Unknown') {
        weaknesses.push(`Education level (${educationAnalysis.level}) below requirements`);
    }
    
    // Preferred skills bonus
    if (skillsAnalysis.preferredMatched && skillsAnalysis.preferredMatched.length > 0) {
        strengths.push(`Additional preferred skills: ${skillsAnalysis.preferredMatched.join(', ')}`);
    }
    
    return { strengths, weaknesses };
}

export async function POST(request: NextRequest) {
  // Rate limiting check
  const clientIp = getClientIp(request);
  const rateLimitResult = analyzeRateLimiter.check(clientIp);
  
  // Add rate limit headers to all responses
  const rateLimitHeaders = {
    'X-RateLimit-Limit': rateLimitResult.limit.toString(),
    'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
    'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString(),
  };
  
  if (!rateLimitResult.allowed) {
    console.log(`⚠️ Rate limit exceeded for IP: ${clientIp}`);
    const resetDate = new Date(rateLimitResult.resetTime);
    const resetMinutes = Math.ceil((rateLimitResult.resetTime - Date.now()) / 60000);
    
    return NextResponse.json({
      error: 'Limite di richieste superato',
      message: `Hai superato il limite di ${rateLimitResult.limit} analisi ogni 10 minuti. Riprova tra ${resetMinutes} minuti.`,
      resetAt: resetDate.toISOString(),
      resetIn: `${resetMinutes} minuti`
    }, { 
      status: 429,
      headers: rateLimitHeaders
    });
  }
  
  try {
    const contentType = request.headers.get('content-type');
    
    // Handle JSON requests (from CVUpload component)
    if (contentType && contentType.includes('application/json')) {
      const { cvText, jobRequirements } = await request.json();
      
      if (!cvText) {
        return NextResponse.json({ error: 'No CV text provided' }, { status: 400 });
      }
      
      if (!jobRequirements) {
        return NextResponse.json({ error: 'No job requirements provided' }, { status: 400 });
      }
      
      // Use the comprehensive CV analysis
      const analysis = analyzeCV(cvText, jobRequirements);
      
      const response = {
        analysis,
        text: cvText
      };
      
      return NextResponse.json(response, {
        headers: rateLimitHeaders
      });
    }
    
    // Handle file uploads (multipart/form-data)
    if (contentType && contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File;
      const jobRequirementsStr = formData.get('jobRequirements') as string;

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }
      
      if (!jobRequirementsStr) {
        return NextResponse.json({ error: 'No job requirements provided' }, { status: 400 });
      }
      
      let jobRequirements: JobRequirements;
      try {
        jobRequirements = JSON.parse(jobRequirementsStr);
      } catch (error) {
        return NextResponse.json({ error: 'Invalid job requirements format' }, { status: 400 });
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      let cvText = '';
      
      try {
        if (file.type === 'application/pdf') {
          const pdfData = await pdfParse.default(buffer);
          cvText = pdfData.text;
        } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          const result = await mammoth.extractRawText({ buffer });
          cvText = result.value;
        } else if (file.type === 'application/zip') {
          // Process ZIP file - extract and combine all supported documents
          const zip = new JSZip();
          const zipContent = await zip.loadAsync(buffer);
          
          const extractedTexts: string[] = [];
          
          for (const [filename, zipEntry] of Object.entries(zipContent.files)) {
            if (zipEntry.dir) continue;
            
            const fileExt = filename.toLowerCase().split('.').pop();
            
            try {
              if (fileExt === 'pdf') {
                const fileBuffer = await zipEntry.async('nodebuffer');
                const pdfData = await pdfParse.default(fileBuffer);
                extractedTexts.push(`=== ${filename} ===\n${pdfData.text}\n\n`);
              } else if (fileExt === 'docx') {
                const fileBuffer = await zipEntry.async('nodebuffer');
                const result = await mammoth.extractRawText({ buffer: fileBuffer });
                extractedTexts.push(`=== ${filename} ===\n${result.value}\n\n`);
              } else if (fileExt === 'txt') {
                const textContent = await zipEntry.async('string');
                extractedTexts.push(`=== ${filename} ===\n${textContent}\n\n`);
              }
            } catch (fileError) {
              console.error(`Error processing ${filename} in ZIP:`, fileError);
            }
          }
          
          cvText = extractedTexts.join('');
        } else {
          // Handle other file types if needed
          throw new Error(`Unsupported file type: ${file.type}`);
        }
        
        // Use the comprehensive CV analysis
        const analysis = analyzeCV(cvText, jobRequirements);
        
        const response = {
          analysis,
          text: cvText
        };
        
        return NextResponse.json(response, {
          headers: rateLimitHeaders
        });
      } catch (parseError) {
        console.error('File parsing error:', parseError);
        let errorMessage = 'Failed to parse file. Please ensure it is a valid document.';
        
        if (file.type === 'application/pdf') {
          errorMessage = 'Failed to parse PDF file. Please ensure it is a valid PDF.';
        } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          errorMessage = 'Failed to parse DOCX file. Please ensure it is a valid Word document.';
        } else if (file.type === 'application/zip') {
          errorMessage = 'Failed to parse ZIP file. Please ensure it contains valid documents and is not corrupted.';
        }
        
        return NextResponse.json(
          { error: errorMessage },
          { status: 400 }
        );
      }
    }
    
    return NextResponse.json({ error: 'Invalid content type' }, { status: 400 });
    
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

