/**
 * Photo filter catalogue.
 *
 * Each filter exposes two equivalent representations:
 *  - `css`          → a CSS `filter` value for live DOM previews.
 *  - `canvasFilter` → the same look expressed with the filter functions that
 *                    `CanvasRenderingContext2D.filter` supports reliably.
 *
 * Canvas ignores `brightness()` / `opacity()` inconsistently across browsers
 * (Safari historically dropped them), so the canvas variants stick to
 * `sepia()`, `grayscale()`, `contrast()`, `saturate()` and `hue-rotate()`.
 */

/** Identifier of a built-in filter. */
export type FilterId =
  | 'none'
  | 'bw'
  | 'sepia'
  | 'vintage'
  | 'cool'
  | 'warm'
  | 'fade'
  | 'noir';

/** A single entry of the filter catalogue. */
export interface FilterDef {
  id: FilterId;
  /** Human readable label (Chinese UI copy lives with the app, but keep it generic). */
  label: string;
  /** CSS `filter` string usable on DOM elements. */
  css: string;
  /** Equivalent string for `ctx.filter`. */
  canvasFilter: string;
}

/** The full list of filters, in display order. */
export const FILTERS: FilterDef[] = [
  {
    id: 'none',
    label: '原图',
    css: 'none',
    canvasFilter: 'none',
  },
  {
    id: 'bw',
    label: '黑白',
    css: 'grayscale(1) contrast(1.08)',
    canvasFilter: 'grayscale(1) contrast(1.08)',
  },
  {
    id: 'sepia',
    label: '复古棕调',
    css: 'sepia(0.85) contrast(1.05) saturate(1.1)',
    canvasFilter: 'sepia(0.85) contrast(1.05) saturate(1.1)',
  },
  {
    id: 'vintage',
    label: '老照片',
    css: 'sepia(0.4) contrast(0.92) saturate(0.82) brightness(1.06) hue-rotate(-8deg)',
    canvasFilter: 'sepia(0.4) contrast(0.92) saturate(0.82) hue-rotate(-8deg)',
  },
  {
    id: 'cool',
    label: '冷调',
    css: 'saturate(1.05) contrast(1.05) hue-rotate(-12deg)',
    canvasFilter: 'saturate(1.05) contrast(1.05) hue-rotate(-12deg)',
  },
  {
    id: 'warm',
    label: '暖调',
    css: 'sepia(0.22) saturate(1.25) contrast(1.03) hue-rotate(-6deg)',
    canvasFilter: 'sepia(0.22) saturate(1.25) contrast(1.03) hue-rotate(-6deg)',
  },
  {
    id: 'fade',
    label: '褪色',
    css: 'contrast(0.82) saturate(0.68) sepia(0.18) brightness(1.08)',
    canvasFilter: 'contrast(0.82) saturate(0.68) sepia(0.18) brightness(1.08)',
  },
  {
    id: 'noir',
    label: '暗夜',
    css: 'grayscale(1) contrast(1.35) brightness(0.88)',
    canvasFilter: 'grayscale(1) contrast(1.35) brightness(0.88)',
  },
];

/** Fast lookup by id. */
export const FILTER_BY_ID: Record<FilterId, FilterDef> = FILTERS.reduce(
  (acc, filter) => {
    acc[filter.id] = filter;
    return acc;
  },
  {} as Record<FilterId, FilterDef>,
);

/**
 * Resolve the canvas filter string for a filter id.
 * Unknown ids degrade gracefully to `'none'` instead of throwing.
 */
export function canvasFilterFor(id: FilterId | string): string {
  const found = FILTER_BY_ID[id as FilterId];
  return found ? found.canvasFilter : 'none';
}

/**
 * Resolve the CSS filter string for a filter id.
 * Unknown ids degrade gracefully to `'none'` instead of throwing.
 */
export function cssFilterFor(id: FilterId | string): string {
  const found = FILTER_BY_ID[id as FilterId];
  return found ? found.css : 'none';
}
