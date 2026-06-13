import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { StockQuote } from './types';

interface QuoteCachePayload {
  fetchedAt: number;
  requestCodes: string[];
  quotes: StockQuote[];
}

const LOCK_TTL_MS = 15000;
const WAIT_STEP_MS = 200;
const WAIT_TIMEOUT_MS = 8000;

export class SharedQuoteCache {
  constructor(private readonly storageDir: string) {}

  async getQuotes(
    codes: string[],
    maxAgeMs: number,
    fetchQuotes: () => Promise<StockQuote[]>
  ): Promise<StockQuote[]> {
    if (!codes.length) {
      return [];
    }

    await fs.promises.mkdir(this.storageDir, { recursive: true });

    const key = this.getCacheKey(codes);
    const cacheFile = path.join(this.storageDir, `${key}.json`);
    const lockFile = path.join(this.storageDir, `${key}.lock`);
    const cached = await this.readFreshCache(cacheFile, codes, maxAgeMs);
    if (cached) {
      return cached;
    }

    const lockHandle = await this.tryAcquireLock(lockFile);
    if (lockHandle) {
      try {
        const refreshedCache = await this.readFreshCache(cacheFile, codes, maxAgeMs);
        if (refreshedCache) {
          return refreshedCache;
        }

        const quotes = await fetchQuotes();
        await this.writeCache(cacheFile, {
          fetchedAt: Date.now(),
          requestCodes: codes,
          quotes
        });
        return quotes;
      } finally {
        await lockHandle.close().catch(() => undefined);
        await fs.promises.unlink(lockFile).catch(() => undefined);
      }
    }

    const waitedCache = await this.waitForFreshCache(cacheFile, codes, maxAgeMs);
    if (waitedCache) {
      return waitedCache;
    }

    const quotes = await fetchQuotes();
    await this.writeCache(cacheFile, {
      fetchedAt: Date.now(),
      requestCodes: codes,
      quotes
    });
    return quotes;
  }

  private getCacheKey(codes: string[]): string {
    const signature = codes.map((code) => code.trim().toLowerCase()).sort().join(',');
    return crypto.createHash('sha1').update(signature).digest('hex');
  }

  private async readFreshCache(
    cacheFile: string,
    codes: string[],
    maxAgeMs: number
  ): Promise<StockQuote[] | null> {
    const payload = await this.readCache(cacheFile);
    if (!payload || Date.now() - payload.fetchedAt > maxAgeMs) {
      return null;
    }
    if (this.getCacheKey(payload.requestCodes) !== this.getCacheKey(codes)) {
      return null;
    }
    return payload.quotes.map((quote) => ({ ...quote }));
  }

  private async readCache(cacheFile: string): Promise<QuoteCachePayload | null> {
    try {
      const raw = await fs.promises.readFile(cacheFile, 'utf8');
      const payload = JSON.parse(raw) as QuoteCachePayload;
      if (
        typeof payload.fetchedAt !== 'number' ||
        !Array.isArray(payload.requestCodes) ||
        !Array.isArray(payload.quotes)
      ) {
        return null;
      }
      return payload;
    } catch {
      return null;
    }
  }

  private async writeCache(cacheFile: string, payload: QuoteCachePayload): Promise<void> {
    const tempFile = `${cacheFile}.${process.pid}.${Date.now()}.tmp`;
    await fs.promises.writeFile(tempFile, JSON.stringify(payload), 'utf8');
    await fs.promises.rename(tempFile, cacheFile);
  }

  private async tryAcquireLock(lockFile: string): Promise<fs.promises.FileHandle | null> {
    await this.removeExpiredLock(lockFile);
    try {
      const handle = await fs.promises.open(lockFile, 'wx');
      await handle.writeFile(JSON.stringify({ pid: process.pid, createdAt: Date.now() }));
      return handle;
    } catch {
      return null;
    }
  }

  private async removeExpiredLock(lockFile: string): Promise<void> {
    try {
      const stat = await fs.promises.stat(lockFile);
      if (Date.now() - stat.mtimeMs > LOCK_TTL_MS) {
        await fs.promises.unlink(lockFile);
      }
    } catch {
      return;
    }
  }

  private async waitForFreshCache(
    cacheFile: string,
    codes: string[],
    maxAgeMs: number
  ): Promise<StockQuote[] | null> {
    const deadline = Date.now() + WAIT_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await this.sleep(WAIT_STEP_MS);
      const cached = await this.readFreshCache(cacheFile, codes, maxAgeMs);
      if (cached) {
        return cached;
      }
    }
    return null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
