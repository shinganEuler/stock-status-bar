const assert = require('assert');
const {
  getStockGroupConfigKey,
  normalizeStockCode,
  normalizeStockCodeForAdd,
  normalizeStockCodeForGroup,
  normalizeStockCodes
} = require('../out/codeNormalizer');

assert.strictEqual(normalizeStockCode(' nf_if0 '), 'nf_IF0');
assert.strictEqual(normalizeStockCode('USR_AMD'), 'usr_amd');
assert.strictEqual(normalizeStockCode('hkHSTECH'), 'hkhstech');

assert.strictEqual(normalizeStockCodeForGroup('aStocks', '000001'), 'sh000001');
assert.strictEqual(normalizeStockCodeForGroup('aStocks', '399001'), 'sz399001');
assert.strictEqual(normalizeStockCodeForGroup('aStocks', '830000'), 'bj830000');
assert.strictEqual(normalizeStockCodeForGroup('hkStocks', '00700'), 'hk00700');
assert.strictEqual(normalizeStockCodeForGroup('usStocks', 'AMD'), 'usr_amd');

assert.deepStrictEqual(normalizeStockCodeForAdd('000001'), {
  key: 'aStocks',
  code: 'sh000001'
});
assert.deepStrictEqual(normalizeStockCodeForAdd('00700'), {
  key: 'hkStocks',
  code: 'hk00700'
});
assert.deepStrictEqual(normalizeStockCodeForAdd('hstech'), {
  key: 'hkStocks',
  code: 'hkhstech'
});
assert.deepStrictEqual(normalizeStockCodeForAdd('AMD'), {
  key: 'usStocks',
  code: 'usr_amd'
});
assert.deepStrictEqual(normalizeStockCodeForAdd('BRK.B'), {
  key: 'usStocks',
  code: 'usr_brk.b'
});
assert.deepStrictEqual(normalizeStockCodeForAdd('IF0'), {
  key: 'stocks',
  code: 'IF0'
});
assert.deepStrictEqual(normalizeStockCodeForAdd('nf_if0'), {
  key: 'stocks',
  code: 'nf_IF0'
});
assert.strictEqual(normalizeStockCodeForAdd('  '), null);

assert.deepStrictEqual(normalizeStockCodes(['sh000001', 'SH000001', ' hk00700 ']), [
  'sh000001',
  'hk00700'
]);

assert.strictEqual(getStockGroupConfigKey('sh600519'), 'aStocks');
assert.strictEqual(getStockGroupConfigKey('000001'), 'aStocks');
assert.strictEqual(getStockGroupConfigKey('hk00700'), 'hkStocks');
assert.strictEqual(getStockGroupConfigKey('00700'), 'hkStocks');
assert.strictEqual(getStockGroupConfigKey('hsi'), 'hkStocks');
assert.strictEqual(getStockGroupConfigKey('usr_tsla'), 'usStocks');
assert.strictEqual(getStockGroupConfigKey('dji'), 'usStocks');
assert.strictEqual(getStockGroupConfigKey('nf_IF0'), 'stocks');

console.log('codeNormalizer tests passed');
