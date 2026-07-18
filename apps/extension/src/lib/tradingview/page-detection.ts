import { TRADINGVIEW_SELECTORS, queryFirst } from "./selectors.js";

/** Is the given URL a TradingView host? (Kept pure for testing.) */
export function isTradingViewHost(href: string): boolean {
  try {
    const { hostname } = new URL(href);
    return (
      hostname === "tradingview.com" || hostname.endsWith(".tradingview.com")
    );
  } catch {
    return false;
  }
}

/**
 * Is the given URL a chart page? The Pine Editor only exists on chart pages
 * (e.g. https://www.tradingview.com/chart/<id>/), so we avoid mounting our
 * panel on marketing/screener/idea pages.
 */
export function isChartPage(href: string): boolean {
  try {
    const { pathname } = new URL(href);
    return pathname === "/chart" || pathname.startsWith("/chart/");
  } catch {
    return false;
  }
}

/**
 * Should the in-page panel be enabled for this URL? Combines host + chart-page
 * checks. DOM presence of the editor is detected separately by the adapter,
 * since the editor pane can be opened/closed after the page loads.
 */
export function shouldEnablePanel(href: string): boolean {
  return isTradingViewHost(href) && isChartPage(href);
}

/** Defensive check for whether the Pine Editor is currently in the DOM. */
export function isPineEditorPresent(root: ParentNode): boolean {
  return queryFirst(root, TRADINGVIEW_SELECTORS.pineEditorRoot) !== null;
}
