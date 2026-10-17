import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerTsResolver } from '../../../../test/register-ts-resolver.mjs';

registerTsResolver();

const { escapeAttr, escapeXml, formatNumber, normalizeStencilColor } = await import(
  './xml.ts'
);

test('the five markup-significant characters are all escaped', () => {
  assert.equal(escapeXml('&'), '&amp;');
  assert.equal(escapeXml('<'), '&lt;');
  assert.equal(escapeXml('>'), '&gt;');
  assert.equal(escapeXml('"'), '&quot;');
  assert.equal(escapeXml("'"), '&apos;');
});

test('escaping a title makes it inert, whichever quote style the caller used', () => {
  const hostile = `A & B <script>alert("x")</script>`;
  const escaped = escapeXml(hostile);

  assert.ok(!escaped.includes('<'), 'no raw angle bracket survives');
  assert.ok(!escaped.includes('>'), 'no raw angle bracket survives');
  assert.ok(!escaped.includes('"'), 'no raw double quote survives');
  assert.ok(!escaped.includes("'"), 'no raw single quote survives');
  assert.equal(
    escapeXml(`it's "fine"`),
    'it&apos;s &quot;fine&quot;',
    'a single quote is escaped even though it would be safe in a double-quoted attribute'
  );
});

test('escaping the ampersand first does not double-escape the entities it makes', () => {
  // The naive `replace('&').replace('<')` ordering bug produces `&amp;lt;`.
  assert.equal(escapeXml('<'), '&lt;');
  assert.equal(escapeXml('&lt;'), '&amp;lt;');
});

test('null and undefined become the empty string, not the words', () => {
  assert.equal(escapeXml(null), '');
  assert.equal(escapeXml(undefined), '');
  assert.equal(escapeXml(0), '0', 'zero is a value, not an absence');
});

test('a non-string is stringified before escaping', () => {
  assert.equal(escapeXml(42), '42');
  assert.equal(escapeXml(['<']), '&lt;');
});

test('escapeAttr is the same contract as escapeXml', () => {
  assert.equal(escapeAttr('<x>'), escapeXml('<x>'));
});

test('a hex colour is accepted in all four of its lengths', () => {
  for (const value of ['#fff', '#ffff', '#ffffff', '#ffffffff', '#AbC123']) {
    assert.equal(normalizeStencilColor(value), value);
  }
});

test('a colour keyword is accepted', () => {
  assert.equal(normalizeStencilColor('red'), 'red');
  assert.equal(normalizeStencilColor('transparent'), 'transparent');
  assert.equal(normalizeStencilColor('currentColor'), 'currentColor');
});

test('surrounding whitespace is trimmed rather than rejected', () => {
  assert.equal(normalizeStencilColor('  #abc  '), '#abc');
});

test('a colour function is rejected, because escaping would not have saved it', () => {
  // These are the reason this is an allow-list rather than an escaper: none of
  // them contains a character `escapeAttr` would touch.
  assert.equal(normalizeStencilColor('url(#gradient)'), undefined);
  assert.equal(normalizeStencilColor('expression(alert(1))'), undefined);
  assert.equal(normalizeStencilColor('javascript:alert(1)'), undefined);
});

test('a colour-like value that is not a colour is rejected', () => {
  assert.equal(normalizeStencilColor('#12345'), undefined, 'five hex digits is not a colour');
  assert.equal(normalizeStencilColor('#gggggg'), undefined);
  assert.equal(normalizeStencilColor('re d'), undefined);
  assert.equal(normalizeStencilColor('">'), undefined);
  assert.equal(normalizeStencilColor(undefined), undefined);
  assert.equal(normalizeStencilColor(null), undefined);
  assert.equal(normalizeStencilColor(123), undefined, 'a number is not a colour');
});

test('coordinates are rounded to hundredths', () => {
  assert.equal(formatNumber(1.23456), '1.23');
  assert.equal(formatNumber(1.236), '1.24');
  assert.equal(formatNumber(-0.004), '0');
  assert.equal(formatNumber(2), '2');
});

test('a non-finite coordinate falls back instead of writing NaN into the markup', () => {
  // `NaN` in one attribute invalidates the entire SVG, so this is a whole
  // document lost to one bad number.
  assert.equal(formatNumber(NaN), '0');
  assert.equal(formatNumber(Infinity), '0');
  assert.equal(formatNumber(-Infinity), '0');
  assert.equal(formatNumber(NaN, 7), '7');
});

test('formatting never emits exponent notation for a coordinate', () => {
  // Below 1e-7 `String()` would switch to `1e-7`, which SVG will not parse.
  assert.equal(formatNumber(1e-7), '0');
  assert.equal(formatNumber(0.0001), '0');
});
