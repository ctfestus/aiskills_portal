const BASE = 'https://wbbcxctblfoyoboskazr.supabase.co/storage/v1/object/public/Tools%20icons';

export const TOOL_ICONS: Record<string, string> = {
  'claude':         `${BASE}/Claude.png`,
  'excel':          `${BASE}/Excel.png`,
  'perplexity ai':  `${BASE}/Perplexity%20AI.png`,
  'power bi':       `${BASE}/Power%20BI.png`,
  'python':         `${BASE}/Python.png`,
  'sql':            `${BASE}/SQL.png`,
  'tableau':        `${BASE}/Tableau.png`,
  'zapier':         `${BASE}/Zapier.png`,
  'databricks':     `${BASE}/Databricks_Logo.png`,
  'aws':            `${BASE}/Amazon_Web_Services-Logo.wine.svg`,
  'azure':           `${BASE}/Microsoft_Azure.svg.png`,
  'microsoft azure': `${BASE}/Microsoft_Azure.svg.png`,
};

export function getToolIcon(name: string): string | undefined {
  return TOOL_ICONS[name.toLowerCase()];
}
