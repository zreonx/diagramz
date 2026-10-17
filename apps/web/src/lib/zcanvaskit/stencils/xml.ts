/**
 * The escaping and validation helpers that keep generated markup well-formed.
 *
 * Stencil renderers receive no user text, so nothing here is load-bearing for
 * the built-in artwork. It is load-bearing for everything the *host* draws —
 * node titles, badges, table field names — which is interpolated into the same
 * documents and does come from the user.
 */

const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

/**
 * Escapes a value for an XML text node or a double-quoted attribute value.
 *
 * Deliberately escapes single quotes too, so the result is safe in either
 * quoting style and a caller never has to remember which one it used.
 */
export function escapeXml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (char) => XML_ESCAPES[char]);
}

/**
 * Escapes a whole attribute, quotes included, for embedding after `="`.
 *
 * A thin alias of {@link escapeXml} that reads better at the call site and
 * gives the intent somewhere to live if the two ever need to diverge.
 */
export function escapeAttr(value: unknown): string {
  return escapeXml(value);
}

/** `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`. */
const HEX_COLOR = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/** A bare CSS colour keyword: `red`, `transparent`, `currentColor`. */
const NAMED_COLOR = /^[a-zA-Z]{3,20}$/;

/**
 * Accepts a colour only if it is one, and returns `undefined` otherwise.
 *
 * This is the one place a colour crosses into a render context, so it is where
 * the check belongs: an allow-list beats escaping for a value that is
 * interpolated straight into a style attribute, because `url(...)`,
 * `javascript:` and `expression(...)` all survive naive escaping. Only hex
 * literals and plain colour keywords get through, which is everything the
 * application actually produces.
 */
export function normalizeStencilColor(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (HEX_COLOR.test(trimmed)) return trimmed;
  if (NAMED_COLOR.test(trimmed)) return trimmed;
  return undefined;
}

/**
 * Formats a number for embedding in markup.
 *
 * Coordinates are rounded to hundredths to keep a document small, and a
 * non-finite value falls back rather than writing `NaN` into the output — which
 * would silently invalidate the whole SVG rather than one attribute.
 */
export function formatNumber(value: number, fallback = 0): string {
  if (!Number.isFinite(value)) return String(fallback);
  return String(Math.round(value * 100) / 100);
}
