import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCsv, normalizeRow, validateRow, csvCell } from '../lib/event.ts';
test('Unstop-style CSV preserves quoted names, embedded commas and CRLF', () => {
  assert.deepEqual(parseCsv('\uFEFFname,email,phone\r\n"Rao, Asha",asha@example.invalid,+919999999991\r\n"A ""quoted"" name",b@example.invalid,919999999992'), [
    ['name','email','phone'], ['Rao, Asha','asha@example.invalid','+919999999991'], ['A "quoted" name','b@example.invalid','919999999992'],
  ]);
  assert.deepEqual(parseCsv('name,team\n"Asha\nRao",A'), [['name','team'],['Asha\nRao','A']]);
  assert.throws(()=>parseCsv('name\n"unfinished'));
});
test('contact normalization and import validation',()=>{
  const row=normalizeRow({name:' Asha ',email:' ASHA@EXAMPLE.INVALID ',phone:'+91 99999-99991',team:' Makers '});
  assert.equal(row.email,'asha@example.invalid');assert.equal(row.phone,'919999999991');assert.equal(validateRow(row),null);
  assert.ok(validateRow({...row,email:'not-an-email'}));assert.ok(validateRow({...row,phone:'9.19999999991E+11'}));
  assert.ok(validateRow({...row,name:''}));
});
test('export quotes CSV and neutralizes spreadsheet formulas',()=>{
  assert.equal(csvCell('=HYPERLINK("https://example.invalid")'),'"\'=HYPERLINK(""https://example.invalid"")"');
  assert.equal(csvCell('A,B'),'"A,B"');
});
