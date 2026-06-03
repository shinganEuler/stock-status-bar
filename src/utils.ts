import * as http from 'http';
import * as https from 'https';
import { decode } from 'iconv-lite';

const directHttpAgent = new http.Agent({ keepAlive: false });
const directHttpsAgent = new https.Agent({ keepAlive: false });

export function calcFixedPriceNumber(
  open = '0',
  yestclose = '0',
  price = '0',
  high = '0',
  low = '0'
): number {
  const trimZeros = (value: string) => (value || '0').replace(/0+$/g, '') || '0';
  const precision = (value: string) => {
    const trimmed = trimZeros(value);
    return trimmed.indexOf('.') === -1 ? 0 : trimmed.length - trimmed.indexOf('.') - 1;
  };

  let max = Math.max(
    precision(open),
    precision(yestclose),
    precision(price),
    precision(high),
    precision(low)
  );
  if (max > 3) {
    max = 2;
  }
  return max;
}

export function formatNumber(value: string | number = 0, fixed = 2, compact = true): string {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return Number(0).toFixed(fixed);
  }

  if (compact) {
    if (num > 1000 * 10000) {
      return `${(num / (10000 * 10000)).toFixed(fixed)}亿`;
    }
    if (num > 1000) {
      return `${(num / 10000).toFixed(fixed)}万`;
    }
  }

  return num.toFixed(fixed);
}

export function formatLabelString(template: string, params: Record<string, unknown>): string {
  return template.replace(/\$\{(.*?)\}/g, (_, key: string) => {
    const value = params[key.trim()];
    return value === undefined || value === null ? '' : String(value);
  });
}

export function randHeader(): Record<string, string> {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0'
  ];

  return {
    Connection: 'Keep-Alive',
    Accept: 'text/html, application/xhtml+xml, */*',
    'Accept-Language': 'zh-CN,en-US;q=0.8,en;q=0.6',
    'User-Agent': userAgents[Math.floor(Math.random() * userAgents.length)]
  };
}

export function requestText(
  url: string,
  encoding = 'utf8',
  headers: Record<string, string> = {},
  redirectCount = 0,
  direct = false
): Promise<string> {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const client = target.protocol === 'https:' ? https : http;
    const agent = direct
      ? target.protocol === 'https:'
        ? directHttpsAgent
        : directHttpAgent
      : undefined;
    const request = client.get(
      target,
      {
        agent,
        headers,
        timeout: 15000
      },
      (response) => {
        const statusCode = response.statusCode || 0;
        const location = response.headers.location;

        if (statusCode >= 300 && statusCode < 400 && location && redirectCount < 3) {
          response.resume();
          const redirectUrl = new URL(location, url).toString();
          requestText(redirectUrl, encoding, headers, redirectCount + 1, direct).then(
            resolve,
            reject
          );
          return;
        }

        if (statusCode >= 400) {
          response.resume();
          reject(new Error(`Request failed with status ${statusCode}: ${url}`));
          return;
        }

        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer | string) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on('end', () => {
          resolve(decode(Buffer.concat(chunks), encoding));
        });
      }
    );

    request.on('timeout', () => {
      request.destroy(new Error(`Request timeout: ${url}`));
    });
    request.on('error', reject);
  });
}

export function getUsMarketPhase(): 'pre' | 'main' | 'after' | 'closed' {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date());

  const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0);
  const current = hour * 60 + minute;

  if (current >= 4 * 60 && current < 9 * 60 + 30) {
    return 'pre';
  }
  if (current >= 9 * 60 + 30 && current < 16 * 60) {
    return 'main';
  }
  if (current >= 16 * 60 && current < 20 * 60) {
    return 'after';
  }
  return 'closed';
}

export function formatTencentTime(value: string): string {
  if (/^\d{14}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)} ${value.slice(
      8,
      10
    )}:${value.slice(10, 12)}:${value.slice(12, 14)}`;
  }
  return value;
}
