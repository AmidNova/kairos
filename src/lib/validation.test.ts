import { describe, expect, it } from "vitest";
import { isAllowedProductUrl, parseAlertInput } from "./validation";

describe("isAllowedProductUrl", () => {
  it.each([
    ["https://www.amazon.fr/dp/B0C123", true],
    ["https://amazon.com/dp/B0C123", true],
    ["https://smile.amazon.co.uk/dp/B0C123", true],
    ["http://evil.com/?q=amazon", false],
    ["https://amazon.fr.evil.com/dp/x", false],
    ["https://notamazon.fr/dp/x", false],
    ["javascript:alert('amazon.fr')", false],
    ["not a url", false],
  ])("%s -> %s", (url, expected) => {
    expect(isAllowedProductUrl(url)).toBe(expected);
  });

  it("rejects non-string input", () => {
    expect(isAllowedProductUrl(null)).toBe(false);
    expect(isAllowedProductUrl(42)).toBe(false);
  });
});

describe("parseAlertInput", () => {
  const valid = {
    email: "  Recruiter@Example.com ",
    target_price: 199.999,
    product: {
      url: "https://www.amazon.fr/dp/B0C123",
      name: "Kindle",
      price: 219.99,
      in_stock: true,
      image: "https://m.media-amazon.com/x.jpg",
    },
  };

  it("normalizes email and rounds target price to cents", () => {
    const result = parseAlertInput(valid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.email).toBe("recruiter@example.com");
    expect(result.value.targetPrice).toBe(200);
    expect(result.value.product.price).toBe(219.99);
  });

  it.each([
    ["missing body", null, "Corps de requête invalide"],
    ["bad email", { ...valid, email: "nope" }, "Email invalide"],
    ["NaN target", { ...valid, target_price: Number.NaN }, "Prix cible invalide"],
    ["negative target", { ...valid, target_price: -5 }, "Prix cible invalide"],
    ["string target", { ...valid, target_price: "10" }, "Prix cible invalide"],
    ["no product", { ...valid, product: undefined }, "Produit manquant"],
    [
      "foreign url",
      { ...valid, product: { ...valid.product, url: "https://evil.com" } },
      "URL produit non supportée",
    ],
  ])("rejects %s", (_label, body, error) => {
    expect(parseAlertInput(body)).toEqual({ ok: false, error });
  });

  it("drops non-https images and junk fields", () => {
    const result = parseAlertInput({
      ...valid,
      product: { ...valid.product, image: "javascript:alert(1)", price: "12", in_stock: "yes" },
    });
    expect(result.ok && result.value.product).toMatchObject({
      image: null,
      price: null,
      in_stock: null,
    });
  });
});
