export interface JobRequirements {
  position: string;
  requiredSkills: string[];
  minExperience: number;
  education: string;
  preferredSkills?: string[];
  // Weighting options for scoring (percentages)
  weights?: {
    skills: number;     // Default: 50%
    experience: number; // Default: 30% 
    education: number;  // Default: 20%
  };
}

export interface CVData {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  extractedText: string;
  uploadedAt: string;
  analysis?: CVAnalysis;
}

export interface CVAnalysis {
  score: number;
  strengths: string[];
  weaknesses: string[];
  skillsMatch: {
    matched: string[];
    missing: string[];
    score: number;
    // Enhanced skills tracking
    requiredMatched?: string[];
    preferredMatched?: string[];
    requiredMissing?: string[];
  };
  experienceAnalysis: {
    estimatedYears: number;
    relevantExperience: boolean;
    score: number;
  };
  educationMatch: {
    level: string;
    relevant: boolean;
    score: number;
  };
  recommendations: string[];
  metadata: {
    softSkills: string[]; // Replaced companies with soft skills
    keywords: string[];
    positions: string[];
    technologies: string[];
    certifications: string[];
  };
}

export interface UploadResponse {
  success: boolean;
  fileName: string;
  fileSize: number;
  fileType: string;
  extractedText: string;
  uploadedAt: string;
  // ZIP archive properties
  isZipArchive?: boolean;
  fileCount?: number;
  files?: Array<{
    fileName: string;
    fileSize: number;
    fileType: string;
    extractedText: string;
  }>;
}

export interface AnalysisResponse {
  success: boolean;
  analysis: CVAnalysis;
  analyzedAt: string;
}