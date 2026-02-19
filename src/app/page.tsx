"use client";

import Image from "next/image";
import { useState } from "react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [product, setProduct] = useState<null | {
    name: string;
    price: number;
    in_stock: boolean;
    image: string;
    url: string;
  }>(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [targetPrice, setTargetPrice] = useState("");

  const handleSubmit = async () => {
    if (!url) return;
    setLoading(true);

    const scrapeRes = await fetch(`/api/scrape?url=${encodeURIComponent(url)}`);
    const data = await scrapeRes.json();

    await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
        email,
        target_price: parseFloat(targetPrice) || 0,
      }),
    });

    setProduct(data);
    setLoading(false);
  };
  const handleConfirm = async () => {
    console.log("handleConfirm appelé", email, targetPrice, product);
    if (!email || !targetPrice || !product) return;

    await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        target_price: parseFloat(targetPrice),
        product,
      }),
    });

    alert(
      "Surveillance confirmée ! Tu recevras un email quand le prix baisse.",
    );
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-2">Kairos</h1>
      <p className="text-gray-500 mb-8">
        Surveille les prix et les stocks pour toi
      </p>

      <div className="flex gap-2 w-full max-w-2xl">
        <input
          type="text"
          placeholder="Colle un lien produit..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1 border rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-black"
        />
        <button
          onClick={handleSubmit}
          className="bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800"
        >
          {loading ? "Chargement..." : "Surveiller"}
        </button>
      </div>

      {product && (
        <div className="mt-8 border rounded-lg p-6 w-full max-w-2xl flex gap-4">
          {product.image && (
            <Image
              src={product.image}
              alt={product.name ?? "Produit"}
              width={96}
              height={96}
              className="object-contain"
            />
          )}
          <div>
            <h2 className="font-semibold text-lg">{product.name}</h2>
            <p className="text-2xl font-bold mt-1">{product.price}€</p>
            <p className={product.in_stock ? "text-green-500" : "text-red-500"}>
              {product.in_stock ? "En stock" : "Rupture de stock"}
            </p>
          </div>
        </div>
      )}
      {product && (
        <div className="mt-4 w-full max-w-2xl flex flex-col gap-3">
          <input
            type="email"
            placeholder="Votre email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-black"
          />
          <input
            type="number"
            placeholder="Prix cible (€)"
            value={targetPrice}
            onChange={(e) => setTargetPrice(e.target.value)}
            className="border rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-black"
          />
          <button
            onClick={handleConfirm}
            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700"
          >
            Confirmer la surveillance
          </button>
        </div>
      )}
    </main>
  );
}
