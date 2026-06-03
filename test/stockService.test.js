const assert = require('assert');
const { StockService } = require('../out/stockService');

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
assert.strictEqual(closedQuote.price, '521.54');
assert.strictEqual(closedQuote.percent, '+2.24');
assert.strictEqual(closedQuote.updown, '11.41');
assert.strictEqual(closedQuote.time, '2026-06-03 08:14:55');
assert.strictEqual(closedQuote.afterPrice, '');

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

console.log('stockService tests passed');
