import { StatusBarAlignment, StatusBarItem, ThemeColor, window } from 'vscode';
import { getConfig, getMarketVisibility, isStockVisibleByMarket } from './config';
import { StockMarket, StockMarketVisibility, StockQuote } from './types';
import { formatLabelString } from './utils';

const DEFAULT_LABEL_FORMAT = '「${name}」${price} ${icon}（${percent}）';
const MARKET_FILTER_PRIORITY_BASE = -10000;
const MARKET_FILTER_COUNT = 3;
const QUOTE_ITEM_PRIORITY_BASE = MARKET_FILTER_PRIORITY_BASE - MARKET_FILTER_COUNT;
const ACTIVE_MARKET_COLOR = new ThemeColor('statusBar.foreground');
const INACTIVE_MARKET_COLOR = new ThemeColor('disabledForeground');
const MARKET_FILTERS: Array<{
  market: StockMarket;
  label: string;
  name: string;
  command: string;
  priority: number;
}> = [
  {
    market: 'a',
    label: 'A',
    name: 'A 股',
    command: 'vscstock.toggleAStockMarketVisibility',
    priority: MARKET_FILTER_PRIORITY_BASE
  },
  {
    market: 'hk',
    label: '港',
    name: '港股',
    command: 'vscstock.toggleHKStockMarketVisibility',
    priority: MARKET_FILTER_PRIORITY_BASE - 1
  },
  {
    market: 'us',
    label: '美',
    name: '美股',
    command: 'vscstock.toggleUSStockMarketVisibility',
    priority: MARKET_FILTER_PRIORITY_BASE - 2
  }
];

export class StockStatusBar {
  private quoteItems: StatusBarItem[] = [];
  private marketItems = new Map<StockMarket, StatusBarItem>();
  private quotes: StockQuote[] = [];
  private pages: StockQuote[][] = [];
  private currentPage = 0;
  private scrollTimer: NodeJS.Timeout | null = null;
  private scrollTimerSignature = '';

  update(quotes: StockQuote[]): void {
    if (getConfig('hideStatusBar', false)) {
      this.clear();
      return;
    }

    this.quotes = quotes;
    this.renderMarketItems();
    this.renderQuotes();
  }

  showControls(): void {
    if (getConfig('hideStatusBar', false)) {
      this.clear();
      return;
    }

    this.renderMarketItems();
    this.clearQuotes();
  }

  refreshMarketFilters(visibility: StockMarketVisibility = getMarketVisibility()): void {
    if (getConfig('hideStatusBar', false)) {
      this.clear();
      return;
    }

    this.renderMarketItems(visibility);
    this.renderQuotes(visibility);
  }

  showLoading(codes: string[]): void {
    if (getConfig('hideStatusBar', false)) {
      this.clear();
      return;
    }

    this.renderMarketItems();
    if (this.quoteItems.length) {
      return;
    }

    this.ensureQuoteItemCount(1);
    const item = this.quoteItems[0];
    item.text = '$(sync~spin) 股票行情';
    item.tooltip = `正在刷新：${codes.join(', ')}`;
    item.command = 'vscstock.refresh';
    item.show();
  }

  showError(message: string, codes: string[]): void {
    if (getConfig('hideStatusBar', false)) {
      this.clear();
      return;
    }

    this.renderMarketItems();
    this.quotes = [];
    this.pages = [];
    this.stopScrolling();
    this.ensureQuoteItemCount(1);
    const item = this.quoteItems[0];
    item.text = `$(warning) ${message}`;
    item.tooltip = `股票代码：${codes.join(', ')}`;
    item.color = getConfig('fallColor', '#C9AD06');
    item.command = 'vscstock.refresh';
    item.show();
  }

  clear(): void {
    this.clearQuotes();
    this.marketItems.forEach((item) => item.dispose());
    this.marketItems.clear();
  }

  dispose(): void {
    this.clear();
  }

  private get maxVisibleItems(): number {
    return Math.max(1, Math.floor(getConfig('maxStatusBarItems', 5)));
  }

  private get pageCount(): number {
    return Math.max(1, this.pages.length);
  }

  private get scrollInterval(): number {
    return Math.max(1000, Math.floor(getConfig('scrollInterval', 5000)));
  }

  private renderMarketItems(visibility: StockMarketVisibility = getMarketVisibility()): void {
    for (const filter of MARKET_FILTERS) {
      let item = this.marketItems.get(filter.market);
      if (!item) {
        item = window.createStatusBarItem(StatusBarAlignment.Left, filter.priority);
        this.marketItems.set(filter.market, item);
      }

      const enabled = visibility[filter.market];
      item.text = filter.label;
      item.tooltip = `${enabled ? '点击隐藏' : '点击显示'}${filter.name}状态栏股票`;
      item.color = enabled ? ACTIVE_MARKET_COLOR : INACTIVE_MARKET_COLOR;
      item.command = filter.command;
      item.show();
    }
  }

  private renderQuotes(visibility: StockMarketVisibility = getMarketVisibility()): void {
    this.rebuildPages(visibility);

    if (!this.pages.length) {
      this.stopScrolling();
      this.currentPage = 0;
      this.ensureQuoteItemCount(0);
      return;
    }

    this.currentPage = Math.min(this.currentPage, this.pageCount - 1);
    this.renderCurrentPage();
    this.configureScrolling();
  }

  private renderCurrentPage(): void {
    const visibleQuotes = this.pages[this.currentPage] || [];

    this.ensureQuoteItemCount(visibleQuotes.length);
    visibleQuotes.forEach((quote, index) => this.updateItem(this.quoteItems[index], quote));
  }

  private configureScrolling(): void {
    if (this.pageCount <= 1) {
      this.stopScrolling();
      return;
    }

    const signature = `${this.pageCount}:${this.maxVisibleItems}:${this.scrollInterval}`;
    if (this.scrollTimer && this.scrollTimerSignature === signature) {
      return;
    }

    this.stopScrolling();
    this.scrollTimerSignature = signature;
    this.scrollTimer = setInterval(() => {
      if (!this.quotes.length || getConfig('hideStatusBar', false)) {
        this.stopScrolling();
        return;
      }

      this.rebuildPages();
      this.switchToNextPage();
    }, this.scrollInterval);
  }

  private stopScrolling(): void {
    if (this.scrollTimer) {
      clearInterval(this.scrollTimer);
      this.scrollTimer = null;
    }
    this.scrollTimerSignature = '';
  }

  private switchToNextPage(): void {
    this.currentPage = (this.currentPage + 1) % this.pageCount;
    this.renderCurrentPage();
  }

  private rebuildPages(visibility: StockMarketVisibility = getMarketVisibility()): void {
    const pages: StockQuote[][] = [];
    let currentPage: StockQuote[] = [];

    const visibleQuotes = this.quotes.filter((quote) =>
      isStockVisibleByMarket(quote.code, visibility)
    );

    for (const quote of visibleQuotes) {
      if (currentPage.length >= this.maxVisibleItems) {
        pages.push(currentPage);
        currentPage = [];
      }

      currentPage.push(quote);
    }

    if (currentPage.length) {
      pages.push(currentPage);
    }

    this.pages = pages;
    this.currentPage = Math.min(this.currentPage, this.pageCount - 1);
  }

  private ensureQuoteItemCount(count: number): void {
    while (this.quoteItems.length < count) {
      this.quoteItems.push(
        window.createStatusBarItem(
          StatusBarAlignment.Left,
          QUOTE_ITEM_PRIORITY_BASE - this.quoteItems.length
        )
      );
    }

    while (this.quoteItems.length > count) {
      this.quoteItems.pop()?.dispose();
    }
  }

  private clearQuotes(): void {
    this.stopScrolling();
    this.quotes = [];
    this.pages = [];
    this.currentPage = 0;
    this.quoteItems.forEach((item) => item.dispose());
    this.quoteItems = [];
  }

  private updateItem(item: StatusBarItem, quote: StockQuote): void {
    item.text = this.getItemText(quote);
    item.tooltip = this.getTooltip(quote);
    item.color = quote.percent.startsWith('-')
      ? getConfig('fallColor', '#C9AD06')
      : getConfig('riseColor', 'white');
    item.command = 'vscstock.refresh';
    item.show();
  }

  private getItemText(quote: StockQuote): string {
    const falling = quote.percent.startsWith('-');
    const icon = getConfig('hideStatusBarIcon', false)
      ? ''
      : falling
      ? '$(triangle-down)'
      : '$(triangle-up)';
    const labelFormat = getConfig('labelFormat', DEFAULT_LABEL_FORMAT);

    return quote.error
      ? `$(warning) ${quote.code}`
      : formatLabelString(labelFormat, {
          ...quote,
          percent: `${quote.percent}%`,
          icon
        });
  }

  private getTooltip(quote: StockQuote): string {
    if (quote.error) {
      return quote.error;
    }

    const afterText = quote.afterPrice
      ? `\n${quote.extendedLabel || '盘后'}：${quote.afterPrice}   涨跌幅：${
          quote.afterPercent || ''
        }%${quote.extendedTime ? `   时间：${quote.extendedTime}` : ''}`
      : '';
    const pageText =
      this.pageCount > 1 ? `\n分页：第 ${this.currentPage + 1}/${this.pageCount} 页` : '';

    return `「今日行情」${quote.name}（${quote.code}）
涨跌：${quote.updown}   百分：${quote.percent}%
最高：${quote.high}   最低：${quote.low}
今开：${quote.open}   昨收：${quote.yestclose}${afterText}
成交量：${quote.volume}   成交额：${quote.amount}
更新时间：${quote.time || '接口未返回'}${pageText}`;
  }
}
