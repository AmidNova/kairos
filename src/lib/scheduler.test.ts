import { describe, expect, it } from "vitest";
import { escapeHtml } from "./html";
import { ApiError } from "@google/genai";
import { isRetryableAiError, toExtractedProduct } from "./ai";
import { groupByProduct, hasPriceChanged, shouldNotify, type WatchRow } from "./scheduler";

const row = (alert_id: number, product_id: number, target_price = "100"): WatchRow => ({
  alert_id,
  product_id,
  target_price,
  email: `u${alert_id}@example.com`,
  url: `https://www.amazon.fr/dp/${product_id}`,
  name: null,
  current_price: "120.00",
});

describe("groupByProduct", () => {
  it("scrapes each product once even with several alerts", () => {
    const rows = [row(1, 10), row(2, 20), row(3, 10)];
    const groups = groupByProduct(rows);
    expect(groups.size).toBe(2);
    expect(groups.get(10)?.map((r) => r.alert_id)).toEqual([1, 3]);
  });

  it("does not mutate input", () => {
    const rows = Object.freeze([row(1, 10)]);
    expect(() => groupByProduct(rows)).not.toThrow();
  });
});

describe("hasPriceChanged", () => {
  it("compares pg DECIMAL strings numerically", () => {
    expect(hasPriceChanged("249.99", 249.99)).toBe(false);
    expect(hasPriceChanged("249.990", 249.99)).toBe(false);
    expect(hasPriceChanged("249.99", 239.99)).toBe(true);
  });

  it("treats unknown previous price as a change", () => {
    expect(hasPriceChanged(null, 10)).toBe(true);
  });
});

describe("shouldNotify", () => {
  it("fires at or below target", () => {
    expect(shouldNotify(99.99, "100")).toBe(true);
    expect(shouldNotify(100, "100.00")).toBe(true);
    expect(shouldNotify(100.01, "100")).toBe(false);
  });
});

describe("escapeHtml", () => {
  it("neutralizes markup from scraped product names", () => {
    expect(escapeHtml(`<img src=x onerror="alert('x')">&`)).toBe(
      "&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;",
    );
  });
});

describe("toExtractedProduct", () => {
  it("keeps well-typed fields", () => {
    expect(
      toExtractedProduct({ name: "Kindle", price: 99.9, in_stock: true, image: "https://x" }),
    ).toEqual({ name: "Kindle", price: 99.9, in_stock: true, image: "https://x" });
  });

  it("nulls out hallucinated or malformed values", () => {
    expect(toExtractedProduct({ name: 3, price: "99", in_stock: "yes", image: null })).toEqual({
      name: null,
      price: null,
      in_stock: null,
      image: null,
    });
    expect(toExtractedProduct({ price: -1 })?.price).toBeNull();
    expect(toExtractedProduct("nope")).toBeNull();
  });
});

describe("isRetryableAiError", () => {
  it("retries on overload, quota and timeouts only", () => {
    expect(isRetryableAiError(new ApiError({ message: "high demand", status: 503 }))).toBe(true);
    expect(isRetryableAiError(new ApiError({ message: "quota", status: 429 }))).toBe(true);
    expect(isRetryableAiError(new DOMException("timeout", "TimeoutError"))).toBe(true);
    expect(isRetryableAiError(new ApiError({ message: "bad request", status: 400 }))).toBe(false);
    expect(isRetryableAiError(new SyntaxError("Unexpected token"))).toBe(false);
  });
});
