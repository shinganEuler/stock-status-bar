export interface StockQuote {
  code: string;
  name: string;
  open: string;
  yestclose: string;
  price: string;
  low: string;
  high: string;
  volume: string;
  amount: string;
  time: string;
  percent: string;
  updown: string;
  type: string;
  symbol: string;
  afterPrice?: string;
  afterPercent?: string;
  extendedLabel?: string;
  extendedTime?: string;
  error?: string;
}

export type StockMarket = 'a' | 'hk' | 'us';

export type StockMarketVisibility = Record<StockMarket, boolean>;

export type UsMarketPhase = 'pre' | 'main' | 'after' | 'closed';
