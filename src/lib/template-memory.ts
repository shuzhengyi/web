export interface MappingRule {
  fingerprint: string;
  mapping: Record<string, string>;
  templateName: string;
  lastUsed: number;
  usageCount: number;
}

const STORAGE_KEY = "template_mapping_rules";
const MAX_RULES = 20;

function generateFingerprint(headers: string[]): string {
  const normalizedHeaders = headers
    .map(h => h.toLowerCase().replace(/[\s\-_（）()/\\]/g, "").trim())
    .filter(h => h.length > 0)
    .sort();
  
  const hash = normalizedHeaders.join("|");
  let hashValue = 0;
  
  for (let i = 0; i < hash.length; i++) {
    const char = hash.charCodeAt(i);
    hashValue = ((hashValue << 5) - hashValue) + char;
    hashValue = hashValue & hashValue;
  }
  
  return Math.abs(hashValue).toString(36);
}

function loadRules(): MappingRule[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveRules(rules: MappingRule[]): void {
  const sortedRules = rules.sort((a, b) => b.lastUsed - a.lastUsed);
  const limitedRules = sortedRules.slice(0, MAX_RULES);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(limitedRules));
}

export function saveMappingRule(headers: string[], mapping: Record<string, string>, templateName: string): void {
  const rules = loadRules();
  const fingerprint = generateFingerprint(headers);
  
  const existingIndex = rules.findIndex(r => r.fingerprint === fingerprint);
  
  if (existingIndex >= 0) {
    rules[existingIndex] = {
      ...rules[existingIndex],
      mapping,
      templateName,
      lastUsed: Date.now(),
      usageCount: rules[existingIndex].usageCount + 1
    };
  } else {
    rules.push({
      fingerprint,
      mapping,
      templateName,
      lastUsed: Date.now(),
      usageCount: 1
    });
  }
  
  saveRules(rules);
}

export function getMappingRule(headers: string[]): MappingRule | undefined {
  const rules = loadRules();
  const fingerprint = generateFingerprint(headers);
  
  const rule = rules.find(r => r.fingerprint === fingerprint);
  
  if (rule) {
    rule.lastUsed = Date.now();
    rule.usageCount++;
    saveRules(rules);
  }
  
  return rule;
}

export function getAllRules(): MappingRule[] {
  return loadRules();
}

export function deleteRule(fingerprint: string): void {
  const rules = loadRules();
  const filteredRules = rules.filter(r => r.fingerprint !== fingerprint);
  saveRules(filteredRules);
}

export function clearAllRules(): void {
  localStorage.removeItem(STORAGE_KEY);
}
