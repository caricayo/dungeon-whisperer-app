/**
 * @fileoverview Technology detection utility for Context7 documentation suggestions
 */

export interface TechDetectionResult {
  hasTechTerms: boolean;
  detectedTechs: string[];
  suggestedQuery: string;
}

/**
 * Technology terms that should trigger Context7 documentation suggestions
 */
const TECH_TERMS = {
  // Frontend frameworks and libraries
  react: ['react', 'jsx', 'tsx', 'component', 'hook', 'state', 'props', 'context'],
  typescript: ['typescript', 'type', 'interface', 'generic', 'ts', 'tsx'],
  tailwind: ['tailwind', 'css', 'utility', 'responsive', 'dark mode', 'theme'],
  
  // Backend and database
  supabase: ['supabase', 'postgresql', 'postgres', 'rls', 'row level security', 'auth'],
  database: ['database', 'sql', 'query', 'migration', 'schema', 'table'],
  
  // AI and LLM
  ai: ['ai', 'llm', 'gpt', 'claude', 'openai', 'anthropic', 'prompt', 'completion'],
  mcp: ['mcp', 'model context protocol', 'context server', 'ai tool'],
  
  // Testing
  testing: ['test', 'testing', 'playwright', 'vitest', 'jest', 'e2e', 'unit test'],
  
  // Development tools
  vite: ['vite', 'build', 'bundler', 'dev server', 'hmr'],
  git: ['git', 'github', 'version control', 'commit', 'merge', 'branch'],
  
  // General programming
  javascript: ['javascript', 'js', 'async', 'await', 'promise', 'callback'],
  api: ['api', 'rest', 'endpoint', 'request', 'response', 'fetch'],
} as const;

/**
 * Detects technology terms in user input and suggests Context7 documentation
 */
export function detectTechTerms(input: string): TechDetectionResult {
  if (!input || typeof input !== 'string') {
    return {
      hasTechTerms: false,
      detectedTechs: [],
      suggestedQuery: '',
    };
  }
  
  const lowerInput = input.toLowerCase();
  const detectedTechs: string[] = [];
  const matchedTerms: string[] = [];
  
  // Check each technology category
  Object.entries(TECH_TERMS).forEach(([tech, terms]) => {
    const hasMatch = terms.some(term => {
      const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(lowerInput)) {
        matchedTerms.push(term);
        return true;
      }
      return false;
    });
    
    if (hasMatch && !detectedTechs.includes(tech)) {
      detectedTechs.push(tech);
    }
  });
  
  // Generate suggested query for Context7
  let suggestedQuery = '';
  if (detectedTechs.length > 0) {
    // Use the most relevant detected terms for the query
    const relevantTerms = matchedTerms.slice(0, 3); // Limit to top 3 terms
    suggestedQuery = relevantTerms.join(' ');
  }
  
  return {
    hasTechTerms: detectedTechs.length > 0,
    detectedTechs,
    suggestedQuery,
  };
}

/**
 * Generates a Context7 URL with encoded query parameters
 */
export function generateContext7Url(query: string): string {
  const baseUrl = 'https://context7.com';
  if (!query) return baseUrl;
  
  const encodedQuery = encodeURIComponent(query);
  return `${baseUrl}/?q=${encodedQuery}`;
}

/**
 * Checks if Context7 suggestions should be shown based on user settings
 */
export function shouldShowContext7Suggestion(
  userSettings: { context7Enabled?: boolean } = {}
): boolean {
  return userSettings.context7Enabled !== false; // Default to enabled
}