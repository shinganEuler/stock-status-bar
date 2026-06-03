import { StockQuote } from './types';
import {
  calcFixedPriceNumber,
  formatNumber,
  formatTencentTime,
  getUsMarketPhase,
  randHeader,
  requestText
} from './utils';

export class StockService {
  async getQuotes(codes: string[]): Promise<StockQuote[]> {
    if (!codes.length) {
      return [];
    }

    const orderedCodes = codes.map((code) => this.toQueryCode(code));
    const hkCodes: string[] = [];
    const sinaCodes: string[] = [];

    for (const code of orderedCodes) {
      if (code.startsWith('hk')) {
        hkCodes.push(`hk${code.slice(2).toUpperCase()}`);
      } else {
        sinaCodes.push(code);
      }
    }

    const results = await Promise.allSettled([
      this.getSinaQuotes(sinaCodes),
      this.getTencentHKQuotes(hkCodes)
    ]);

    const quotes = results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
    const quoteMap = new Map(quotes.map((quote) => [quote.code.toLowerCase(), quote]));
    return orderedCodes
      .map((code) => quoteMap.get(code.toLowerCase()))
      .filter((quote): quote is StockQuote => Boolean(quote));
  }

  private toQueryCode(code: string): string {
    if (/^[A-Z]+/.test(code)) {
      return `nf_${code}`;
    }
    if (/^cnf_/i.test(code)) {
      return code.replace(/^cnf_/i, 'nf_');
    }
    return code;
  }

  private async getSinaQuotes(codes: string[]): Promise<StockQuote[]> {
    if (!codes.length) {
      return [];
    }

    const url = `https://hq.sinajs.cn/list=${codes.map((code) => code.replace('.', '$')).join(',')}`;
    const data = await requestText(
      url,
      'GB18030',
      {
        ...randHeader(),
        Referer: 'http://finance.sina.com.cn/'
      },
      0,
      true
    );

    if (/FAILED/.test(data) && codes.length > 1) {
      const retryResults = await Promise.allSettled(codes.map((code) => this.getSinaQuotes([code])));
      return retryResults.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
    }

    return data
      .split('";\n')
      .map((line) => this.parseSinaLine(line))
      .filter((quote): quote is StockQuote => Boolean(quote));
  }

  private parseSinaLine(line: string): StockQuote | null {
    const index = line.indexOf('="');
    if (index === -1) {
      return null;
    }

    const codeMatch = /var\s+hq_str_([^=]+)$/.exec(line.slice(0, index).trim());
    if (!codeMatch) {
      return null;
    }

    const code = codeMatch[1].trim().replace('$', '.');
    const params = line.slice(index + 2).split(',');

    if (params.length <= 1) {
      return this.noDataQuote(code);
    }

    if (/^(sh|sz|bj)/.test(code)) {
      return this.parseAStockQuote(code, params);
    }
    if (/^usr_/.test(code)) {
      return this.parseUsStockQuote(code, params);
    }
    if (/^gb_/.test(code)) {
      return this.parseGbStockQuote(code, params);
    }
    if (/^nf_/.test(code)) {
      return this.parseCnFutureQuote(code, params);
    }
    if (/^hf_/.test(code)) {
      return this.parseOverseaFutureQuote(code, params);
    }

    return this.noDataQuote(code);
  }

  private parseAStockQuote(code: string, params: string[]): StockQuote {
    const open = params[1];
    const yestclose = params[2];
    let price = params[3];
    if (Number(price) === 0) {
      const buy1 = params[6];
      price = Number(buy1) !== 0 ? buy1 : yestclose;
    }

    const high = params[4];
    const low = params[5];
    if ([price, high, low, yestclose].every((value) => Number(value) === 0)) {
      return this.noDataQuote(code, `接口不支持该股票 ${params[0] || code}`);
    }

    const fixed = calcFixedPriceNumber(open, yestclose, price, high, low);
    return this.completeQuote(
      {
        code,
        name: params[0],
        open: formatNumber(open, fixed, false),
        yestclose: formatNumber(yestclose, fixed, false),
        price: formatNumber(price, fixed, false),
        low: formatNumber(low, fixed, false),
        high: formatNumber(high, fixed, false),
        volume: formatNumber(params[8], 2),
        amount: formatNumber(params[9], 2),
        time: `${params[30] || ''} ${params[31] || ''}`.trim(),
        type: code.slice(0, 2),
        symbol: code.slice(2)
      },
      fixed
    );
  }

  private parseGbStockQuote(code: string, params: string[]): StockQuote {
    const open = params[5];
    const yestclose = params[26];
    const price = params[1];
    const high = params[6];
    const low = params[7];
    const fixed = calcFixedPriceNumber(open, yestclose, price, high, low);

    return this.completeQuote(
      {
        code,
        name: params[0],
        open: formatNumber(open, fixed, false),
        yestclose: formatNumber(yestclose, fixed, false),
        price: formatNumber(price, fixed, false),
        low: formatNumber(low, fixed, false),
        high: formatNumber(high, fixed, false),
        volume: formatNumber(params[10], 2),
        amount: '接口无数据',
        time: '',
        type: code.slice(0, 3),
        symbol: code.slice(3)
      },
      fixed
    );
  }

  private parseUsStockQuote(
    code: string,
    params: string[],
    phase = getUsMarketPhase()
  ): StockQuote {
    const open = params[5];
    const regularPrice = params[1];
    let yestclose = params[26];
    let price = regularPrice;
    let afterPrice = '';
    let afterPercent = '';
    let extendedLabel = '';
    let extendedTime = '';
    let time = params[3] || '';

    const extendedPrice = params[21];
    const hasExtendedQuote = Number(extendedPrice) > 0 && Boolean(params[24]);

    if (phase === 'pre') {
      if (hasExtendedQuote) {
        price = extendedPrice;
        afterPrice = extendedPrice;
        afterPercent = params[22];
        extendedLabel = '盘前';
        extendedTime = params[24] || '';
        time = extendedTime;
        if (Number(params[35]) !== 0) {
          yestclose = params[35];
        }
      }
    } else if (phase === 'after' || phase === 'closed') {
      if (hasExtendedQuote) {
        price = extendedPrice;
        afterPrice = extendedPrice;
        afterPercent = params[22];
        extendedLabel = '盘后';
        extendedTime = params[24] || '';
        time = extendedTime;
        if (Number(regularPrice) !== 0) {
          yestclose = regularPrice;
        }
      }
    }

    const high = params[6];
    const low = params[7];
    const fixed = calcFixedPriceNumber(open, yestclose, price, high, low);

    return this.completeQuote(
      {
        code,
        name: params[0],
        open: formatNumber(open, fixed, false),
        yestclose: formatNumber(yestclose, fixed, false),
        price: formatNumber(price, fixed, false),
        low: formatNumber(low, fixed, false),
        high: formatNumber(high, fixed, false),
        volume: formatNumber(params[10], 2),
        amount: '接口无数据',
        time,
        type: code.slice(0, 4),
        symbol: code.slice(4),
        afterPrice: afterPrice ? formatNumber(afterPrice, fixed, false) : '',
        afterPercent,
        extendedLabel,
        extendedTime
      },
      fixed
    );
  }

  private parseCnFutureQuote(code: string, params: string[]): StockQuote {
    let name = params[0];
    let open = params[2];
    let high = params[3];
    let low = params[4];
    let price = params[8];
    let yestclose = params[10];
    let volume = params[14];

    const stockIndexFuture =
      /nf_IC/.test(code) ||
      /nf_IF/.test(code) ||
      /nf_IH/.test(code) ||
      /nf_IM/.test(code) ||
      /nf_TF/.test(code) ||
      /nf_TS/.test(code) ||
      /nf_T\d+/.test(code) ||
      /nf_TL/.test(code);

    if (stockIndexFuture && params.length > 49) {
      name = params[49].replace(/"$/, '');
      open = params[0];
      high = params[1];
      low = params[2];
      price = params[3];
      volume = params[4];
      yestclose = params[13];
    }

    const fixed = calcFixedPriceNumber(open, yestclose, price, high, low);
    return this.completeQuote(
      {
        code,
        name,
        open: formatNumber(open, fixed, false),
        yestclose: formatNumber(yestclose, fixed, false),
        price: formatNumber(price, fixed, false),
        low: formatNumber(low, fixed, false),
        high: formatNumber(high, fixed, false),
        volume: formatNumber(volume, 2),
        amount: '接口无数据',
        time: '',
        type: 'nf_',
        symbol: code.slice(3)
      },
      fixed
    );
  }

  private parseOverseaFutureQuote(code: string, params: string[]): StockQuote {
    let price = params[0];
    if (Number(price) > Number(params[3]) || Number(price) < Number(params[2])) {
      price = params[2];
    }

    const name = (params[13] || code).replace(/"$/, '');
    const time = params[6] || '';
    const date = params[12] || '';
    const open = params[8];
    const high = params[4];
    const low = params[5];
    const yestclose = params[7];
    const volume = params[14] ? params[14].replace(/"$/, '') : '0';
    const fixed = calcFixedPriceNumber(open, yestclose, price, high, low);

    return this.completeQuote(
      {
        code,
        name,
        open: formatNumber(open, fixed, false),
        yestclose: formatNumber(yestclose, fixed, false),
        price: formatNumber(price, fixed, false),
        low: formatNumber(low, fixed, false),
        high: formatNumber(high, fixed, false),
        volume: formatNumber(volume, 2),
        amount: '接口无数据',
        time: `${date} ${time}`.trim(),
        type: 'hf_',
        symbol: code.slice(3)
      },
      fixed
    );
  }

  private async getTencentHKQuotes(codes: string[]): Promise<StockQuote[]> {
    if (!codes.length) {
      return [];
    }

    const url = `https://qt.gtimg.cn/q=?q=${codes.map((code) => `r_${code}`).join(',')}&fmt=json`;
    const data = await requestText(url, 'GBK', randHeader());
    const stockData = JSON.parse(data) as Record<string, string[] | undefined>;

    return codes.map((code) => {
      const configuredCode = code.startsWith('hk') ? `hk${code.slice(2).toLowerCase()}` : code;
      const item = stockData[`r_${code}`];
      if (!item) {
        return this.noDataQuote(configuredCode);
      }

      const open = item[5];
      const yestclose = item[4];
      const price = item[3];
      const high = item[33];
      const low = item[34];
      const fixed = calcFixedPriceNumber(open, yestclose, price, high, low);

      return this.completeQuote(
        {
          code: configuredCode,
          name: item[1],
          open: formatNumber(open, fixed, false),
          yestclose: formatNumber(yestclose, fixed, false),
          price: formatNumber(price, fixed, false),
          low: formatNumber(low, fixed, false),
          high: formatNumber(high, fixed, false),
          volume: formatNumber(item[36] || 0, 2),
          amount: formatNumber(item[37] || 0, 2),
          time: formatTencentTime(item[30] || ''),
          type: 'hk',
          symbol: configuredCode.slice(2)
        },
        fixed
      );
    });
  }

  private completeQuote(
    quote: Omit<StockQuote, 'percent' | 'updown'>,
    fixed: number
  ): StockQuote {
    let price = quote.price;
    if (Number(quote.open) <= 0 && Number(price) <= 0) {
      price = quote.yestclose;
    }

    const yestclose = Number(quote.yestclose);
    const diff = Number(price) - yestclose;
    const safeDiff = Number.isFinite(diff) ? diff : 0;
    const percent =
      Number.isFinite(yestclose) && yestclose !== 0
        ? `${safeDiff >= 0 ? '+' : '-'}${formatNumber((Math.abs(safeDiff) / yestclose) * 100, 2, false)}`
        : '+0.00';

    return {
      ...quote,
      updown: formatNumber(safeDiff, fixed, false),
      percent
    };
  }

  private noDataQuote(code: string, name = `接口不支持该股票 ${code}`): StockQuote {
    return {
      code,
      name,
      open: '',
      yestclose: '',
      price: '--',
      low: '',
      high: '',
      volume: '',
      amount: '',
      time: '',
      percent: '+0.00',
      updown: '',
      type: 'nodata',
      symbol: code,
      error: name
    };
  }
}
