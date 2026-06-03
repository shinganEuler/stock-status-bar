import { workspace } from 'vscode';
import {
  normalizeStockCode,
  normalizeStockCodeForAdd,
  normalizeStockCodeForGroup,
  normalizeStockCodes,
  normalizeStockCodesForGroup,
  StockGroupConfigKey
} from './codeNormalizer';

export const CONFIG_NAMESPACE = 'vscstock';

const DEFAULT_A_STOCKS = ['000001', '399001', '399006', '000300', '000016', '000688'];
const DEFAULT_HK_STOCKS = ['hsi', 'hstech', 'hscei'];
const DEFAULT_US_STOCKS = ['dji', 'ixic', 'inx'];

export function getConfig<T>(key: string, defaultValue: T): T {
  return workspace.getConfiguration(CONFIG_NAMESPACE).get<T>(key, defaultValue);
}

export async function setConfig<T>(key: string, value: T): Promise<void> {
  await workspace.getConfiguration(CONFIG_NAMESPACE).update(key, value, true);
}

export function getStocks(): string[] {
  const groups = getStockGroups();
  return normalizeStockCodes([
    ...groups.aStocks,
    ...groups.hkStocks,
    ...groups.usStocks,
    ...groups.stocks,
  ]);
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
