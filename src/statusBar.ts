import { StatusBarAlignment, StatusBarItem, window } from 'vscode';
import { getConfig } from './config';
import { StockQuote } from './types';
import { formatLabelString } from './utils';

const DEFAULT_LABEL_FORMAT = '「${name}」${price} ${icon}（${percent}）';

export class StockStatusBar {
  private items: StatusBarItem[] = [];
  private quotes: StockQuote[] = [];
  private pages: StockQuote[][] = [];
  private currentPage = 0;
  private scrollTimer: NodeJS.Timeout | null = null;
  private scrollTimerSignature = '';

  update(quotes: StockQuote[]): void {
    if (getConfig('hideStatusBar', false) || !quotes.length) {
      this.quotes = [];
      this.pages = [];
      this.stopScrolling();
      this.clear();
      return;
    }

    this.quotes = quotes;
    this.rebuildPages();
    this.currentPage = Math.min(this.currentPage, this.pageCount - 1);
    this.renderCurrentPage();
    this.configureScrolling();
  }

  showLoading(codes: string[]): void {
    if (getConfig('hideStatusBar', false) || this.items.length) {
      return;
    }

    this.ensureItemCount(1);
    const item = this.items[0];
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

    this.quotes = [];
    this.pages = [];
    this.stopScrolling();
    this.ensureItemCount(1);
    const item = this.items[0];
    item.text = `$(warning) ${message}`;
    item.tooltip = `股票代码：${codes.join(', ')}`;
    item.color = getConfig('fallColor', '#C9AD06');
    item.command = 'vscstock.refresh';
    item.show();
  }

  clear(): void {
    this.stopScrolling();
    this.quotes = [];
    this.pages = [];
    this.currentPage = 0;
    this.items.forEach((item) => item.dispose());
    this.items = [];
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

  private renderCurrentPage(): void {
    const visibleQuotes = this.pages[this.currentPage] || [];
    this.ensureItemCount(visibleQuotes.length);
    visibleQuotes.forEach((quote, index) => this.updateItem(this.items[index], quote));
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

  private rebuildPages(): void {
    const pages: StockQuote[][] = [];
    let currentPage: StockQuote[] = [];

    for (const quote of this.quotes) {
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

  private ensureItemCount(count: number): void {
    while (this.items.length < count) {
      this.items.push(window.createStatusBarItem(StatusBarAlignment.Left, 3));
    }

    while (this.items.length > count) {
      this.items.pop()?.dispose();
    }
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
