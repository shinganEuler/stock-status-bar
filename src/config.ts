import { workspace } from 'vscode';
import {
  getStockGroupConfigKey,
  normalizeStockCode,
  normalizeStockCodeForAdd,
  normalizeStockCodeForGroup,
  normalizeStockCodes,
  normalizeStockCodesForGroup,
  StockGroupConfigKey
} from './codeNormalizer';
import { StockMarket, StockMarketVisibility } from './types';

export const CONFIG_NAMESPACE = 'vscstock';

const DEFAULT_A_STOCKS = ['000001', '399001', '399006', '000300', '000016', '000688'];
const DEFAULT_HK_STOCKS = ['hsi', 'hstech', 'hscei'];
const DEFAULT_US_STOCKS = ['dji', 'ixic', 'inx'];
const DEFAULT_MARKET_VISIBILITY: StockMarketVisibility = { a: true, hk: true, us: true };
const STOCK_GROUP_MARKETS: Partial<Record<StockGroupConfigKey, StockMarket>> = {
  aStocks: 'a',
  hkStocks: 'hk',
  usStocks: 'us'
};

export function getConfig<T>(key: string, defaultValue: T): T {
  return workspace.getConfiguration(CONFIG_NAMESPACE).get<T>(key, defaultValue);
}

export async function setConfig<T>(key: string, value: T): Promise<void> {
  await workspace.getConfiguration(CONFIG_NAMESPACE).update(key, value, true);
}

export function getStocks(): string[] {
  const groups = getStockGroups();
  return normalizeStockCodes(getOrderedStocks(groups));
}

export function getVisibleStocks(
  visibility: StockMarketVisibility = getMarketVisibility()
): string[] {
  const groups = getStockGroups();
  const groupStocks = getOrderedGroupStocks(groups, visibility);
  const legacyStocks = getVisibleLegacyStocks(groups.stocks, visibility);
  const preferLegacyStocks = shouldPreferLegacyStocks(groups.stocks);

  return normalizeStockCodes(
    preferLegacyStocks ? [...legacyStocks, ...groupStocks] : [...groupStocks, ...legacyStocks]
  );
}

export async function setStocks(stocks: string[]): Promise<void> {
  await setConfig('stocks', normalizeStockCodes(stocks));
}

export function getStockGroups(): Record<StockGroupConfigKey, string[]> {
  return {
    aStocks: normalizeStockCodesForGroup('aStocks', getConfig<string[]>('aStocks', DEFAULT_A_STOCKS)),
    hkStocks: normalizeStockCodesForGroup(
      'hkStocks',
      getConfig<string[]>('hkStocks', DEFAULT_HK_STOCKS)
    ),
    usStocks: normalizeStockCodesForGroup(
      'usStocks',
      getConfig<string[]>('usStocks', DEFAULT_US_STOCKS)
    ),
    stocks: normalizeStockCodes(getConfig<string[]>('stocks', [])),
  };
}

export function getMarketVisibility(): StockMarketVisibility {
  const raw = getConfig<Partial<StockMarketVisibility>>(
    'marketVisibility',
    DEFAULT_MARKET_VISIBILITY
  );

  return {
    a: raw?.a !== false,
    hk: raw?.hk !== false,
    us: raw?.us !== false
  };
}

export function isStockVisibleByMarket(
  code: string,
  visibility: StockMarketVisibility = getMarketVisibility()
): boolean {
  const market = STOCK_GROUP_MARKETS[getStockGroupConfigKey(code)];
  return !market || visibility[market];
}

export async function toggleMarketVisibility(
  market: StockMarket
): Promise<StockMarketVisibility> {
  const visibility = getMarketVisibility();
  const nextVisibility = {
    ...visibility,
    [market]: !visibility[market]
  };

  await setConfig('marketVisibility', nextVisibility);
  return nextVisibility;
}

function normalizeStockCodeByDetectedMarket(code: string): string {
  const key = getStockGroupConfigKey(code);
  if (key === 'stocks') {
    return normalizeStockCode(code);
  }
  return normalizeStockCodeForGroup(key, code);
}

function getOrderedStocks(groups: Record<StockGroupConfigKey, string[]>): string[] {
  const groupStocks = [
    ...groups.aStocks,
    ...groups.hkStocks,
    ...groups.usStocks
  ];

  return shouldPreferLegacyStocks(groups.stocks)
    ? [...groups.stocks, ...groupStocks]
    : [...groupStocks, ...groups.stocks];
}

function getOrderedGroupStocks(
  groups: Record<StockGroupConfigKey, string[]>,
  visibility: StockMarketVisibility
): string[] {
  return [
    ...(visibility.a ? groups.aStocks : []),
    ...(visibility.hk ? groups.hkStocks : []),
    ...(visibility.us ? groups.usStocks : [])
  ];
}

function getVisibleLegacyStocks(
  stocks: string[],
  visibility: StockMarketVisibility
): string[] {
  return stocks
    .filter((code) => isStockVisibleByMarket(code, visibility))
    .map(normalizeStockCodeByDetectedMarket);
}

function shouldPreferLegacyStocks(stocks: string[]): boolean {
  return (
    stocks.length > 0 &&
    hasConfiguredValue('stocks') &&
    !hasConfiguredValue('aStocks') &&
    !hasConfiguredValue('hkStocks') &&
    !hasConfiguredValue('usStocks')
  );
}

function hasConfiguredValue(key: string): boolean {
  const inspected = workspace.getConfiguration(CONFIG_NAMESPACE).inspect<unknown>(key);
  return Boolean(
    inspected &&
      (inspected.globalValue !== undefined ||
        inspected.workspaceValue !== undefined ||
        inspected.workspaceFolderValue !== undefined)
  );
}

export async function addStocks(stocks: string[]): Promise<void> {
  const groups = getStockGroups();
  const previousGroups = cloneStockGroups(groups);

  for (const raw of stocks) {
    const selection = normalizeStockCodeForAdd(raw);
    if (!selection) {
      continue;
    }
    groups[selection.key] = normalizeStockCodes([...groups[selection.key], selection.code]);
  }

  await updateChangedStockGroups(groups, previousGroups);
}

export async function removeStocks(stocks: string[]): Promise<void> {
  const removeSet = new Set<string>();
  for (const raw of stocks) {
    const code = normalizeStockCode(raw);
    const selection = normalizeStockCodeForAdd(raw);
    if (code) {
      removeSet.add(code.toLowerCase());
    }
    if (selection) {
      removeSet.add(selection.code.toLowerCase());
    }
  }

  const groups = getStockGroups();
  const previousGroups = cloneStockGroups(groups);

  for (const key of Object.keys(groups) as StockGroupConfigKey[]) {
    groups[key] = groups[key].filter((code) => !removeSet.has(code.toLowerCase()));
  }

  await updateChangedStockGroups(groups, previousGroups);
}

function cloneStockGroups(
  groups: Record<StockGroupConfigKey, string[]>
): Record<StockGroupConfigKey, string[]> {
  return {
    aStocks: [...groups.aStocks],
    hkStocks: [...groups.hkStocks],
    usStocks: [...groups.usStocks],
    stocks: [...groups.stocks]
  };
}

async function updateChangedStockGroups(
  groups: Record<StockGroupConfigKey, string[]>,
  previousGroups: Record<StockGroupConfigKey, string[]>
): Promise<void> {
  const updates = (Object.keys(groups) as StockGroupConfigKey[])
    .map((key) => [key, normalizeStockCodes(groups[key])] as const)
    .filter(([key, codes]) => !sameStockCodes(codes, previousGroups[key]))
    .map(([key, codes]) => setConfig(key, codes));

  await Promise.all(updates);
}

function sameStockCodes(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((code, index) => code.toLowerCase() === right[index].toLowerCase());
}
