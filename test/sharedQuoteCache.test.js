const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { SharedQuoteCache } = require('../out/sharedQuoteCache');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vscstock-cache-test-'));

(async () => {
  try {
    const cacheA = new SharedQuoteCache(tempDir);
    const cacheB = new SharedQuoteCache(tempDir);
    let fetchCount = 0;
    const quote = {
      code: 'sh000001',
      name: '上证指数',
      open: '1',
      yestclose: '1',
      price: '1',
      low: '1',
      high: '1',
      volume: '1',
      amount: '1',
      time: '2026-06-13 10:00:00',
      percent: '+0.00',
      updown: '0.00',
      type: 'stock',
      symbol: 'sh000001'
    };

    const fetchQuotes = async () => {
      fetchCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 300));
      return [quote];
    };

    const [quotesA, quotesB] = await Promise.all([
      cacheA.getQuotes(['sh000001'], 5000, fetchQuotes),
      cacheB.getQuotes(['sh000001'], 5000, fetchQuotes)
    ]);

    assert.strictEqual(fetchCount, 1);
    assert.deepStrictEqual(quotesA, [quote]);
    assert.deepStrictEqual(quotesB, [quote]);

    console.log('sharedQuoteCache tests passed');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
