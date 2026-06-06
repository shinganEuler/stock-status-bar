const assert = require('assert');
const { StockService } = require('../out/stockService');
const utils = require('../out/utils');

const amdParams = [
  'AMD',
  '521.5400',
  '2.24',
  '2026-06-03 08:14:55',
  '11.4100',
  '506.3000',
  '522.4900',
  '501.2200',
  '527.2000',
  '113.2800',
  '24293209',
  '32695060',
  '850423457264',
  '3.08',
  '169.330000',
  '0.00',
  '0.00',
  '0.00',
  '0.00',
  '1630600639',
  '73',
  '518.7500',
  '-0.53',
  '-2.79',
  'Jun 02 07:59PM EDT',
  'Jun 02 04:00PM EDT',
  '510.1300',
  '1417948',
  '1',
  '2026',
  '12496182118.0000',
  '522.6600',
  '201.2825',
  '738547849.4419',
  '521.2400',
  '510.1300'
];

const service = new StockService();

const mainQuote = service.parseUsStockQuote('usr_amd', amdParams, 'main');
assert.strictEqual(mainQuote.price, '521.54');
assert.strictEqual(mainQuote.percent, '+2.24');
assert.strictEqual(mainQuote.time, '2026-06-03 08:14:55');
assert.strictEqual(mainQuote.afterPrice, '');

const afterQuote = service.parseUsStockQuote('usr_amd', amdParams, 'after');
assert.strictEqual(afterQuote.price, '518.75');
assert.strictEqual(afterQuote.percent, '-0.53');
assert.strictEqual(afterQuote.updown, '-2.79');
assert.strictEqual(afterQuote.time, 'Jun 02 07:59PM EDT');
assert.strictEqual(afterQuote.extendedLabel, '盘后');

const closedQuote = service.parseUsStockQuote('usr_amd', amdParams, 'closed');
assert.strictEqual(closedQuote.price, '518.75');
assert.strictEqual(closedQuote.percent, '-0.53');
assert.strictEqual(closedQuote.updown, '-2.79');
assert.strictEqual(closedQuote.time, 'Jun 02 07:59PM EDT');
assert.strictEqual(closedQuote.extendedLabel, '盘后');

const regularOnlyParams = [...amdParams];
regularOnlyParams[21] = '0.0000';
regularOnlyParams[22] = '0.00';
regularOnlyParams[23] = '0.00';
regularOnlyParams[24] = '';

const regularOnlyClosedQuote = service.parseUsStockQuote('usr_amd', regularOnlyParams, 'closed');
assert.strictEqual(regularOnlyClosedQuote.price, '521.54');
assert.strictEqual(regularOnlyClosedQuote.percent, '+2.24');
assert.strictEqual(regularOnlyClosedQuote.updown, '11.41');
assert.strictEqual(regularOnlyClosedQuote.time, '2026-06-03 08:14:55');
assert.strictEqual(regularOnlyClosedQuote.afterPrice, '');

const cachedService = new StockService([afterQuote]);
const selectedClosedQuote = cachedService.selectClosedUsQuote(regularOnlyClosedQuote, afterQuote);
assert.strictEqual(selectedClosedQuote.price, '518.75');
assert.strictEqual(selectedClosedQuote.extendedLabel, '盘后');

const cachedNightQuote = cachedService.getCachedOrNoDataQuote('usr_amd', '当前数据源不支持美股夜盘行情');
assert.strictEqual(cachedNightQuote.price, '518.75');
assert.strictEqual(cachedNightQuote.percent, '-0.53');
assert.strictEqual(cachedNightQuote.updown, '-2.79');
assert.strictEqual(cachedNightQuote.time, 'Jun 02 07:59PM EDT');
assert.strictEqual(cachedNightQuote.error, undefined);

const persistedQuotes = cachedService.getCachedQuotes();
assert.strictEqual(persistedQuotes.length, 1);
assert.strictEqual(persistedQuotes[0].code, 'usr_amd');
assert.strictEqual(persistedQuotes[0].price, '518.75');

const originalGetUsMarketPhase = utils.getUsMarketPhase;

(async () => {
  try {
    utils.getUsMarketPhase = () => 'closed';

    const closedService = new StockService([afterQuote]);
    closedService.getSinaQuotes = async () => [regularOnlyClosedQuote];
    closedService.getTencentHKQuotes = async () => [];

    const quotes = await closedService.getQuotes(['usr_amd']);
    assert.strictEqual(quotes.length, 1);
    assert.strictEqual(quotes[0].price, '518.75');
    assert.strictEqual(quotes[0].extendedLabel, '盘后');

    const closedPersistedQuotes = closedService.getCachedQuotes();
    assert.strictEqual(closedPersistedQuotes.length, 1);
    assert.strictEqual(closedPersistedQuotes[0].price, '518.75');
    assert.strictEqual(closedPersistedQuotes[0].extendedLabel, '盘后');
  } finally {
    utils.getUsMarketPhase = originalGetUsMarketPhase;
  }

  console.log('stockService tests passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
