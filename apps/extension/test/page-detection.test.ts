import { afterEach, describe, expect, it } from "vitest";
import {
  isChartPage,
  isPineEditorPresent,
  isTradingViewHost,
  shouldEnablePanel,
} from "../src/lib/tradingview/page-detection.js";

describe("isTradingViewHost", () => {
  it("accepts tradingview.com and subdomains", () => {
    expect(isTradingViewHost("https://www.tradingview.com/chart/abc/")).toBe(
      true,
    );
    expect(isTradingViewHost("https://tradingview.com/")).toBe(true);
    expect(isTradingViewHost("https://in.tradingview.com/chart/")).toBe(true);
  });

  it("rejects other hosts and lookalikes", () => {
    expect(isTradingViewHost("https://example.com/")).toBe(false);
    expect(isTradingViewHost("https://nottradingview.com.evil.com/")).toBe(
      false,
    );
    expect(isTradingViewHost("not a url")).toBe(false);
  });
});

describe("isChartPage", () => {
  it("matches only chart routes", () => {
    expect(isChartPage("https://www.tradingview.com/chart/")).toBe(true);
    expect(isChartPage("https://www.tradingview.com/chart/xY12/")).toBe(true);
    expect(isChartPage("https://www.tradingview.com/")).toBe(false);
    expect(isChartPage("https://www.tradingview.com/screener/")).toBe(false);
  });
});

describe("shouldEnablePanel", () => {
  it("enables only on TradingView chart pages", () => {
    expect(shouldEnablePanel("https://www.tradingview.com/chart/xY12/")).toBe(
      true,
    );
    expect(shouldEnablePanel("https://www.tradingview.com/screener/")).toBe(
      false,
    );
    expect(shouldEnablePanel("https://example.com/chart/")).toBe(false);
  });
});

describe("isPineEditorPresent", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("detects the editor root when present", () => {
    document.body.innerHTML = `<div data-name="scripteditor"></div>`;
    expect(isPineEditorPresent(document)).toBe(true);
  });

  it("returns false when the editor is absent", () => {
    document.body.innerHTML = `<div class="chart"></div>`;
    expect(isPineEditorPresent(document)).toBe(false);
  });
});
