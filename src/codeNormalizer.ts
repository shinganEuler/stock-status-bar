export type StockGroupConfigKey = 'aStocks' | 'hkStocks' | 'usStocks' | 'stocks';

export interface NormalizedStockSelection {
  key: StockGroupConfigKey;
  code: string;
}

const PREFIXED_CODE_PATTERN = /^(sh|sz|bj|hk|usr_|gb_|nf_|hf_|cnf_)/i;
const HK_INDEX_CODES = new Set(['hsi', 'hstech', 'hscei']);

export function getStockGroupConfigKey(code: string): StockGroupConfigKey {
  const normalized = normalizeStockCode(code);
  if (/^(sh|sz|bj)/i.test(normalized)) {
    return 'aStocks';
  }
  if (/^hk/i.test(normalized)) {
    return 'hkStocks';
  }
  if (/^(usr_|gb_)/i.test(normalized)) {
    return 'usStocks';
  }
  if (/^\d{6}$/.test(normalized)) {
    return 'aStocks';
  }
  if (/^\d{5}$/.test(normalized) || HK_INDEX_CODES.has(normalized.toLowerCase())) {
    return 'hkStocks';
  }
  if (isLikelyUsStockSymbol(normalized)) {
    return 'usStocks';
  }
  return 'stocks';
}

export function normalizeStockCodeForAdd(raw: string): NormalizedStockSelection | null {
  const code = normalizeStockCode(raw);
  if (!code) {
    return null;
  }

  if (PREFIXED_CODE_PATTERN.test(code)) {
    const key = getStockGroupConfigKey(code);
    return {
      key,
      code: normalizeStockCodeForGroup(key, code)
    };
  }

  if (/^\d{6}$/.test(code)) {
    return {
      key: 'aStocks',
      code: normalizeStockCodeForGroup('aStocks', code)
    };
  }

  if (/^\d{5}$/.test(code)) {
    return {
      key: 'hkStocks',
      code: normalizeStockCodeForGroup('hkStocks', code)
    };
  }

  if (HK_INDEX_CODES.has(code.toLowerCase())) {
    return {
      key: 'hkStocks',
      code: normalizeStockCodeForGroup('hkStocks', code)
    };
  }

  if (isLikelyUsStockSymbol(code)) {
    return {
      key: 'usStocks',
      code: normalizeStockCodeForGroup('usStocks', code)
    };
  }

  return {
    key: 'stocks',
    code
  };
}

export function normalizeStockCodes(stocks: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const raw of stocks || []) {
    const code = normalizeStockCode(raw);
    const key = code.toLowerCase();
    if (code && !seen.has(key)) {
      seen.add(key);
      normalized.push(code);
    }
  }

  return normalized;
}

export function normalizeStockCodesForGroup(
  group: StockGroupConfigKey,
  stocks: string[]
): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const raw of stocks || []) {
    const code = normalizeStockCodeForGroup(group, raw);
    const key = code.toLowerCase();
    if (code && !seen.has(key)) {
      seen.add(key);
      normalized.push(code);
    }
  }

  return normalized;
}

export function normalizeStockCodeForGroup(group: StockGroupConfigKey, raw: string): string {
  const code = normalizeStockCode(raw);
  if (!code) {
    return '';
  }

  if (PREFIXED_CODE_PATTERN.test(code)) {
    return normalizeStockCode(code);
  }

  if (group === 'aStocks') {
    return normalizeAStockCode(code);
  }
  if (group === 'hkStocks') {
    return `hk${code.toLowerCase()}`;
  }
  if (group === 'usStocks') {
    return `usr_${code.toLowerCase()}`;
  }

  return code;
}

export function normalizeStockCode(raw: string): string {
  const code = (raw || '').trim();
  if (!code) {
    return '';
  }

  if (/^(sh|sz|bj|hk|usr_|gb_|cnf_)/i.test(code)) {
    const prefix = /^(usr_|gb_|cnf_)/i.exec(code)?.[0];
    if (prefix) {
      const normalizedPrefix = prefix.toLowerCase();
      const symbol = code.slice(prefix.length);
      const normalizedSymbol =
        normalizedPrefix === 'cnf_' ? symbol.toUpperCase() : symbol.toLowerCase();
      return normalizedPrefix + normalizedSymbol;
    }

    const market = code.slice(0, 2).toLowerCase();
    const symbol = code.slice(2);
    return market + (market === 'hk' ? symbol.toLowerCase() : symbol);
  }

  if (/^(nf_|hf_)/i.test(code)) {
    return code.slice(0, 3).toLowerCase() + code.slice(3).toUpperCase();
  }

  return code;
}

function normalizeAStockCode(code: string): string {
  if (/^(399|15|16|18|30)/.test(code)) {
    return `sz${code}`;
  }
  if (/^(8|4|9)/.test(code)) {
    return `bj${code}`;
  }
  return `sh${code}`;
}

function isLikelyUsStockSymbol(code: string): boolean {
  if (!/^[a-z][a-z0-9.]{0,9}$/i.test(code)) {
    return false;
  }

  return !/^[A-Z]{1,4}\d+$/.test(code);
}
