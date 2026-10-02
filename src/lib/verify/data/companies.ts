export interface CompanyData {
  name: string;
  aliases: string[];
  officialDomains: string[];
  careersUrl: string;
}

export const KNOWN_COMPANIES: Record<string, CompanyData> = {
  google: {
    name: "Google",
    aliases: ["alphabet", "google india"],
    officialDomains: ["google.com", "alphabet.com"],
    careersUrl: "https://careers.google.com",
  },
  microsoft: {
    name: "Microsoft",
    aliases: ["ms", "microsoft india"],
    officialDomains: ["microsoft.com"],
    careersUrl: "https://careers.microsoft.com",
  },
  amazon: {
    name: "Amazon",
    aliases: ["aws", "amazon india"],
    officialDomains: ["amazon.com", "amazon.jobs", "amazon.in"],
    careersUrl: "https://amazon.jobs",
  },
  meta: {
    name: "Meta",
    aliases: ["facebook", "fb", "instagram", "whatsapp"],
    officialDomains: ["meta.com", "facebook.com", "fb.com", "instagram.com", "whatsapp.com"],
    careersUrl: "https://www.metacareers.com",
  },
  apple: {
    name: "Apple",
    aliases: ["apple india"],
    officialDomains: ["apple.com"],
    careersUrl: "https://jobs.apple.com",
  },
  tcs: {
    name: "TCS",
    aliases: ["tata consultancy services"],
    officialDomains: ["tcs.com"],
    careersUrl: "https://www.tcs.com/careers",
  },
  infosys: {
    name: "Infosys",
    aliases: ["infy"],
    officialDomains: ["infosys.com"],
    careersUrl: "https://careers.infosys.com",
  },
  wipro: {
    name: "Wipro",
    aliases: [],
    officialDomains: ["wipro.com"],
    careersUrl: "https://careers.wipro.com",
  },
  hcl: {
    name: "HCLTech",
    aliases: ["hcl", "hcl technologies"],
    officialDomains: ["hcltech.com", "hcl.com"],
    careersUrl: "https://www.hcltech.com/careers",
  },
  cognizant: {
    name: "Cognizant",
    aliases: ["cts"],
    officialDomains: ["cognizant.com"],
    careersUrl: "https://careers.cognizant.com",
  },
  accenture: {
    name: "Accenture",
    aliases: [],
    officialDomains: ["accenture.com"],
    careersUrl: "https://www.accenture.com/in-en/careers",
  },
  deloitte: {
    name: "Deloitte",
    aliases: [],
    officialDomains: ["deloitte.com"],
    careersUrl: "https://jobs2.deloitte.com",
  },
  flipkart: {
    name: "Flipkart",
    aliases: [],
    officialDomains: ["flipkart.com"],
    careersUrl: "https://www.flipkartcareers.com",
  },
  zomato: {
    name: "Zomato",
    aliases: [],
    officialDomains: ["zomato.com"],
    careersUrl: "https://zomato.com/careers",
  },
  swiggy: {
    name: "Swiggy",
    aliases: [],
    officialDomains: ["swiggy.in", "swiggy.com"],
    careersUrl: "https://careers.swiggy.com",
  },
  razorpay: {
    name: "Razorpay",
    aliases: [],
    officialDomains: ["razorpay.com"],
    careersUrl: "https://razorpay.com/jobs",
  },
  paytm: {
    name: "Paytm",
    aliases: ["one97"],
    officialDomains: ["paytm.com", "one97.com"],
    careersUrl: "https://paytm.com/careers",
  },
};

function levenshtein(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[a.length][b.length];
}

export function resolveCompany(name: string): { company: CompanyData | null; confidence: number } {
  if (!name || name.trim().length === 0) return { company: null, confidence: 0 };
  
  const searchName = name.toLowerCase().trim();
  
  // 1. Exact match (name or alias)
  for (const key of Object.keys(KNOWN_COMPANIES)) {
    const comp = KNOWN_COMPANIES[key];
    if (comp.name.toLowerCase() === searchName || comp.aliases.includes(searchName)) {
      return { company: comp, confidence: 1 };
    }
  }
  
  // Short names require exact match
  if (searchName.length < 4) {
    return { company: null, confidence: 0 };
  }
  
  // 2. Token match or Levenshtein
  let bestMatch: CompanyData | null = null;
  let bestConfidence = 0;
  
  for (const key of Object.keys(KNOWN_COMPANIES)) {
    const comp = KNOWN_COMPANIES[key];
    const targetName = comp.name.toLowerCase();
    
    // Substring match (e.g. "google inc" matches "google")
    if (searchName.includes(targetName) || targetName.includes(searchName)) {
      if (bestConfidence < 0.9) {
        bestMatch = comp;
        bestConfidence = 0.9;
      }
    }
    
    // Edit distance
    const dist = levenshtein(searchName, targetName);
    const maxLen = Math.max(searchName.length, targetName.length);
    const conf = 1 - (dist / maxLen);
    
    if (conf > 0.8 && conf > bestConfidence) {
      bestMatch = comp;
      bestConfidence = conf;
    }
  }
  
  return { company: bestMatch, confidence: bestConfidence };
}

export function resolveCompanyFromDomains(domains: string[]): { company: CompanyData | null } {
  if (!domains || domains.length === 0) return { company: null };
  for (const domain of domains) {
    const lower = domain.toLowerCase();
    for (const key of Object.keys(KNOWN_COMPANIES)) {
      const comp = KNOWN_COMPANIES[key];
      for (const off of comp.officialDomains) {
        if (lower === off || lower.endsWith('.' + off)) {
          return { company: comp };
        }
      }
    }
  }
  return { company: null };
}

export function inferCompanyFromText(text: string): { company: CompanyData | null } {
  if (!text) return { company: null };
  const lower = text.toLowerCase();
  
  // Find the longest matching name or alias to avoid partial short matches
  let bestMatch: CompanyData | null = null;
  let maxLen = 0;
  
  for (const key of Object.keys(KNOWN_COMPANIES)) {
    const comp = KNOWN_COMPANIES[key];
    const terms = [comp.name.toLowerCase(), ...comp.aliases.map(a => a.toLowerCase())];
    for (const term of terms) {
      if (term.length > 3 && lower.includes(term)) {
        // use word boundaries for the term to avoid matching 'infy' inside 'infystuff'
        const regex = new RegExp(`\\b${term}\\b`, 'i');
        if (regex.test(lower)) {
          if (term.length > maxLen) {
            maxLen = term.length;
            bestMatch = comp;
          }
        }
      }
    }
  }
  return { company: bestMatch };
}
