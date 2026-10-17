/**
 * The pointer, as a pencil.
 *
 * CSS has no built-in pencil cursor, so the pen's cursor is an inline SVG data
 * URI. The hotspot sits at the nib's tip — the bottom-left of the glyph — so
 * the ink starts where the pencil point is, not where the image was grabbed.
 *
 * The glyph carries its own white outline. A cursor is composited by the
 * browser over whatever is underneath it and cannot read the page's theme, so
 * a single-colour pencil would vanish on one background or the other. An
 * outlined one reads on the light canvas, the dark canvas and a dark browser
 * chrome alike.
 */

const PENCIL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
<g fill="none" stroke="#FFFFFF" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
<path d="M4.5 19.5 3 22l2.5-1.5L19 7l-2-2z"/>
<path d="M15.5 6.5l2 2"/>
</g>
<g fill="#1F2233" stroke="#1F2233" stroke-width="1" stroke-linejoin="round">
<path d="M4.5 19.5 3 22l2.5-1.5L19 7l-2-2z"/>
</g>
<path d="M15.5 6.5l2 2" fill="none" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round"/>
</svg>`;

/** The tip of the nib in the SVG above — where the ink should start. */
const HOTSPOT_X = 3;
const HOTSPOT_Y = 22;

/**
 * The pen's cursor: a pencil, falling back to a crosshair on any browser or OS
 * that refuses an SVG cursor.
 */
export const PEN_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(
  PENCIL_SVG
)}") ${HOTSPOT_X} ${HOTSPOT_Y}, crosshair`;

/**
 * The grab/pan cursor. A hand icon with a dark outline + white nib tip so it
 * reads on light and dark canvases alike, unlike the system grab cursor which
 * renders invisibly on one theme or the other.
 */
const GRAB_HAND_SVG = `<svg xmlns="http://www.org/2000svg" width="24" height="24" viewBox="0 0 24 24">
<g fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
<path d="M8 7V4a1.5 1.5 0 0 0-3 0v3"/>
<path d="M10.5 5.5a2 2 0 0 1 3 0v4l1.5 1.5-1.5 1.5a2 2 0 0 1-3 0 2 2 0 0 1-3 0z"/>
<path d="M14.5 6.5a2.5 2.5 0 0 1 3.5 0"/>
</g>
<g fill="#1F2233" stroke="#1F2233" stroke-width="1.2" stroke-linejoin="round">
<rect x="12.5" y="1.5" width="9" height="5.5" rx="0.5"/>
</g>
<g fill="#1F2233" stroke="#1F2233" stroke-width="0.5" stroke-linejoin="round">
<circle cx="13" cy="5" r="0.7"/><circle cx="16" cy="5" r="0.7"/>
<circle cx="14.5" cy="5.5" r="0.7"/><circle cx="17" cy="5.5" r="0.7"/>
<circle cx="14" cy="6" r="0.7"/><circle cx="17" cy="6" r="0.7"/>
<circle cx="13.5" cy="6.5" r="0.7"/><circle cx="16.5" cy="6.5" r="0.7"/>
</g>
</svg>`;

/** The grab/pan cursor (hand icon). */
export const GRAB_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(
  GRAB_HAND_SVG
)}") ${HOTSPOT_X} ${HOTSPOT_Y}, grab`;
