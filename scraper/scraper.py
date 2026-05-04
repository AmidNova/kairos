import asyncio
import random
import re
import json
import logging
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout
from bs4 import BeautifulSoup
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("kairos.scraper")

app = FastAPI()

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
]

BLOCKED_RESOURCES = {"image", "media", "font", "stylesheet"}

# ---------------------------------------------------------------------------
# Parser
# ---------------------------------------------------------------------------

def parse_amazon(html: str, url: str) -> dict:
    """
    Parse une page produit Amazon.

    Statuts possibles :
      - "ok"            : extraction complète (nom + prix présents)
      - "captcha"       : Amazon a affiché un challenge
      - "missing_data"  : la page a chargé mais le parser DOM n'a pas trouvé
                          les infos clés → Next bascule sur le fallback Gemini
    """
    soup = BeautifulSoup(html, "html.parser")

    if soup.find("form", {"action": "/errors/validateCaptcha"}):
        return {"url": url, "name": None, "price": None, "in_stock": None, "image": None, "status": "captcha"}

    name_el = soup.find("span", {"id": "productTitle"})
    name = name_el.get_text(strip=True) if name_el else None

    price = None
    price_selectors = [
        ("span", {"id": "priceblock_ourprice"}),
        ("span", {"id": "priceblock_dealprice"}),
        ("span", {"class": "a-price-whole"}),
        ("span", {"id": "price_inside_buybox"}),
        ("span", {"class": "apexPriceToPay"}),
    ]
    for tag, attrs in price_selectors:
        el = soup.find(tag, attrs)
        if el:
            raw = el.get_text(strip=True)
            raw = raw.replace("\xa0", "").replace(" ", "").replace(",", ".")
            match = re.search(r"[\d]+\.?[\d]*", raw)
            if match:
                price = float(match.group())
                break

    in_stock = True
    availability_el = soup.find("div", {"id": "availability"})
    if availability_el:
        availability_text = availability_el.get_text(strip=True).lower()
        out_of_stock_keywords = ["actuellement indisponible", "rupture", "unavailable", "out of stock"]
        if any(kw in availability_text for kw in out_of_stock_keywords):
            in_stock = False

    image = None
    img_el = soup.find("img", {"id": "landingImage"})
    if img_el:
        image = img_el.get("data-old-hires") or img_el.get("src")

    if not image:
        scripts = soup.find_all("script", {"type": "text/javascript"})
        for script in scripts:
            if script.string and "ImageBlockATF" in script.string:
                match = re.search(r'"large":"(https://[^"]+)"', script.string)
                if match:
                    image = match.group(1)
                    break

    status = "ok" if (name and price is not None) else "missing_data"

    return {
        "url": url,
        "name": name,
        "price": price,
        "in_stock": in_stock,
        "image": image,
        "status": status,
    }

# ---------------------------------------------------------------------------
# Scraper
# ---------------------------------------------------------------------------

async def scrape_amazon(url: str, retries: int = 3) -> dict:
    for attempt in range(1, retries + 1):
        logger.info(f"Tentative {attempt}/{retries} — {url}")
        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(
                    headless=True,
                    args=[
                        "--no-sandbox",
                        "--disable-blink-features=AutomationControlled",
                        "--disable-infobars",
                        "--disable-dev-shm-usage",
                        "--disable-extensions",
                    ],
                )

                context = await browser.new_context(
                    user_agent=random.choice(USER_AGENTS),
                    viewport={"width": random.randint(1200, 1920), "height": random.randint(700, 1080)},
                    locale="fr-FR",
                    timezone_id="Europe/Paris",
                    extra_http_headers={
                        "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
                        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                        "DNT": "1",
                    },
                )

                # Masque webdriver
                await context.add_init_script("""
                    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
                    Object.defineProperty(navigator, 'languages', { get: () => ['fr-FR', 'fr'] });
                    window.chrome = { runtime: {} };
                """)

                page = await context.new_page()

                # Bloque les ressources inutiles pour accélérer
                async def handle_route(route):
                    if route.request.resource_type in BLOCKED_RESOURCES:
                        await route.abort()
                    else:
                        await route.continue_()

                await page.route("**/*", handle_route)

                # Délai random pour simuler un humain
                await asyncio.sleep(random.uniform(1.0, 2.5))

                await page.goto(url, wait_until="domcontentloaded", timeout=30000)

                # Attend que le titre produit soit présent (ou timeout)
                try:
                    await page.wait_for_selector("#productTitle", timeout=8000)
                except PlaywrightTimeout:
                    logger.warning("Titre produit non trouvé dans les 8s")

                html = await page.content()
                await browser.close()

                result = parse_amazon(html, url)

                if result["status"] == "ok":
                    logger.info(f"Parser DOM OK : {result['name']} — {result['price']}€")
                else:
                    logger.warning(f"Parser DOM incomplet (status={result['status']}) — HTML renvoyé pour fallback IA")
                    result["html"] = html  # n'envoie le HTML brut que si fallback nécessaire

                return result

        except Exception as e:
            logger.error(f"Tentative {attempt} échouée : {e}")
            if attempt < retries:
                wait = random.uniform(2.0, 5.0) * attempt
                logger.info(f"Attente {wait:.1f}s avant retry...")
                await asyncio.sleep(wait)
            else:
                raise HTTPException(status_code=500, detail=str(e))

# ---------------------------------------------------------------------------
# API FastAPI
# ---------------------------------------------------------------------------

class ScrapeRequest(BaseModel):
    url: str

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/scrape")
async def scrape_get(url: str):
    if "amazon" not in url.lower():
        raise HTTPException(status_code=400, detail="Seules les URLs Amazon sont supportées pour l'instant")
    return await scrape_amazon(url)

@app.post("/scrape")
async def scrape_post(req: ScrapeRequest):
    if "amazon" not in req.url.lower():
        raise HTTPException(status_code=400, detail="Seules les URLs Amazon sont supportées pour l'instant")
    return await scrape_amazon(req.url)