import { describe, expect, it, vi } from "vitest";
import { resolveScrape, type ScraperResponse } from "./scrape";

const base: ScraperResponse = {
  url: "https://www.amazon.fr/dp/B0TEST",
  name: "Kindle Paperwhite",
  price: 169.99,
  in_stock: true,
  image: "https://m.media-amazon.com/k.jpg",
  status: "ok",
};

describe("resolveScrape", () => {
  it("returns the DOM result without calling the AI when parsing succeeded", async () => {
    const extract = vi.fn();
    const result = await resolveScrape(base, extract);
    expect(result).toEqual({
      ok: true,
      product: {
        url: base.url,
        name: base.name,
        price: 169.99,
        in_stock: true,
        image: base.image,
        source: "dom_parser",
      },
    });
    expect(extract).not.toHaveBeenCalled();
  });

  it("maps captcha to 503 and Amazon 404 to 404", async () => {
    const extract = vi.fn();
    expect(await resolveScrape({ ...base, status: "captcha" }, extract)).toMatchObject({
      ok: false,
      status: 503,
    });
    expect(await resolveScrape({ ...base, status: "not_found" }, extract)).toMatchObject({
      ok: false,
      status: 404,
    });
    expect(extract).not.toHaveBeenCalled();
  });

  it("uses the AI fallback on missing_data and keeps DOM values the AI lacks", async () => {
    const extract = vi.fn().mockResolvedValue({
      name: null,
      price: 149.99,
      in_stock: null,
      image: null,
    });
    const result = await resolveScrape(
      { ...base, price: null, status: "missing_data", html: "<div>reduced</div>" },
      extract,
    );
    expect(extract).toHaveBeenCalledWith("<div>reduced</div>");
    expect(result).toEqual({
      ok: true,
      product: {
        url: base.url,
        name: "Kindle Paperwhite",
        price: 149.99,
        in_stock: true,
        image: base.image,
        source: "ai_fallback",
      },
    });
  });

  it("fails with 422 instead of returning an empty card when no price is found", async () => {
    const extract = vi.fn().mockResolvedValue(null);
    const result = await resolveScrape(
      { ...base, name: null, price: null, status: "missing_data", html: "<div/>" },
      extract,
    );
    expect(result).toMatchObject({ ok: false, status: 422 });
  });
});
