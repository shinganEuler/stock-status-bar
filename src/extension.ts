import { commands, ExtensionContext, window, workspace } from 'vscode';
import {
  addStocks,
  CONFIG_NAMESPACE,
  getConfig,
  getMarketVisibility,
  getStocks,
  getVisibleStocks,
  removeStocks,
  setConfig,
  toggleMarketVisibility
} from './config';
import { StockService } from './stockService';
import { StockStatusBar } from './statusBar';
import { StockMarketVisibility } from './types';

let timer: NodeJS.Timeout | null = null;
let refreshing = false;

export async function activate(context: ExtensionContext): Promise<void> {
  const service = new StockService();
  const statusBar = new StockStatusBar();

  const refresh = async (visibility?: StockMarketVisibility) => {
    if (refreshing) {
      return;
    }

    if (getConfig('hideStatusBar', false)) {
      statusBar.clear();
      return;
    }

    const allStocks = getStocks();
    if (!allStocks.length) {
      statusBar.clear();
      return;
    }

    const marketVisibility = visibility || getMarketVisibility();
    const stocks = getVisibleStocks(marketVisibility);
    if (!stocks.length) {
      statusBar.showControls();
      return;
    }

    refreshing = true;
    statusBar.showLoading(stocks);
    try {
      const quotes = await service.getQuotes(stocks);
      if (quotes.length) {
        statusBar.update(quotes);
      } else {
        statusBar.showError('股票行情暂无数据', stocks);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      statusBar.showError('股票行情刷新失败', stocks);
      console.error(`[vscstock] refresh failed: ${message}`);
    } finally {
      refreshing = false;
    }
  };

  const resetTimer = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }

    const interval = Math.max(getConfig('interval', 5000), 3000);
    if (getConfig('hideStatusBar', false)) {
      return;
    }

    timer = setInterval(refresh, interval);
  };

  context.subscriptions.push(
    statusBar,
    commands.registerCommand('vscstock.refresh', refresh),
    commands.registerCommand('vscstock.addStock', async () => {
      const input = await window.showInputBox({
        prompt: '输入股票代码，多个代码可用逗号或空格分隔',
        placeHolder: 'sh000001, hk00700, usr_tsla, nf_IF0'
      });
      if (!input) {
        return;
      }

      await addStocks(input.split(/[\s,，]+/).filter(Boolean));
      await refresh();
    }),
    commands.registerCommand('vscstock.removeStock', async () => {
      const stocks = getStocks();
      if (!stocks.length) {
        window.showInformationMessage('当前没有配置状态栏股票。');
        return;
      }

      const selected = await window.showQuickPick(stocks, {
        canPickMany: true,
        placeHolder: '选择要从状态栏移除的股票代码'
      });
      if (!selected?.length) {
        return;
      }

      await removeStocks(selected);
      await refresh();
    }),
    commands.registerCommand('vscstock.toggleStatusBarIconVisibility', async () => {
      await setConfig('hideStatusBarIcon', !getConfig('hideStatusBarIcon', false));
      await refresh();
    }),
    commands.registerCommand('vscstock.toggleAStockMarketVisibility', async () => {
      const visibility = await toggleMarketVisibility('a');
      statusBar.refreshMarketFilters(visibility);
      await refresh(visibility);
    }),
    commands.registerCommand('vscstock.toggleHKStockMarketVisibility', async () => {
      const visibility = await toggleMarketVisibility('hk');
      statusBar.refreshMarketFilters(visibility);
      await refresh(visibility);
    }),
    commands.registerCommand('vscstock.toggleUSStockMarketVisibility', async () => {
      const visibility = await toggleMarketVisibility('us');
      statusBar.refreshMarketFilters(visibility);
      await refresh(visibility);
    }),
    workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(CONFIG_NAMESPACE)) {
        resetTimer();
        refresh();
      }
    })
  );

  await refresh();
  resetTimer();
}

export function deactivate(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
