import asyncio
import random
import re
import logging
from urllib.parse import urlparse
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

# Garder synchro avec ALLOWED_HOSTS dans src/lib/validation.ts
ALLOWED_HOSTS = (
    "amazon.fr",
    "amazon.com",
    "amazon.de",
    "amazon.co.uk",
    "amazon.it",
    "amazon.es",
    "amazon.ca",
    "amazon.be",
    "amazon.nl",
)

# Taille max du HTML envoyé au fallback IA (après nettoyage)
AI_HTML_BUDGET = 30_000

# Sélecteurs CSS du prix, du plus fiable au plus ancien.
# `.a-offscreen` contient le prix complet ("249,99 €"), contrairement à
# `.a-price-whole` qui n'a que la partie entière.
PRICE_SELECTORS = [
    "#corePriceDisplay_desktop_feature_div .a-price .a-offscreen",
    "#corePrice_feature_div .a-price .a-offscreen",
    "#apex_desktop .a-price .a-offscreen",
    ".apexPriceToPay .a-offscreen",
    "#priceblock_ourprice",
    "#priceblock_dealprice",
    "#price_inside_buybox",
]

READY_SELECTOR = '#productTitle, a[href*="cs_404"], form[action="/errors/validateCaptcha"]'

OUT_OF_STOCK_KEYWORDS = ["actuellement indisponible", "rupture", "unavailable", "out of stock"]

# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def is_allowed_url(url: str) -> bool:
    """Vrai si l'URL pointe vers un domaine Amazon connu (http/https)."""
    try:
        parsed = urlparse(url)
    except ValueError:
        return False
    if parsed.scheme not in ("http", "https"):
        return False
    host = (parsed.hostname or "").lower()
    return any(host == d or host.endswith("." + d) for d in ALLOWED_HOSTS)

# ---------------------------------------------------------------------------
# Parser
# ---------------------------------------------------------------------------

def parse_price(raw: str) -> float | None:
    """
    Convertit un prix affiché en float, formats FR / US / DE :
      "1 299,99 €" -> 1299.99   "$1,299.99" -> 1299.99   "1.299,00 €" -> 1299.0
    """
    cleaned = re.sub(r"[^\d.,]", "", raw)
    if not re.search(r"\d", cleaned):
        return None

    last_comma, last_dot = cleaned.rfind(","), cleaned.rfind(".")
    if last_comma != -1 and last_dot != -1:
        # Le dernier séparateur rencontré est le séparateur décimal
        decimal = "," if last_comma > last_dot else "."
        thousands = "." if decimal == "," else ","
        cleaned = cleaned.replace(thousands, "").replace(decimal, ".")
    elif last_comma != -1 or last_dot != -1:
        sep = "," if last_comma != -1 else "."
        decimals = cleaned.rsplit(sep, 1)[1]
        # "249,99" -> décimal ; "1.299" ou "1,299" -> milliers
        if len(decimals) == 3 or cleaned.count(sep) > 1:
            cleaned = cleaned.replace(sep, "")
        else:
            cleaned = cleaned.replace(sep, ".")

    try:
        return float(cleaned.strip("."))
    except ValueError:
        return None


def _extract_price(soup: BeautifulSoup) -> float | None:
    for selector in PRICE_SELECTORS:
        el = soup.select_one(selector)
        if el:
            price = parse_price(el.get_text(strip=True))
            if price is not None:
                return price

    # Dernier recours : partie entière + fraction affichées séparément
    whole = soup.select_one(".a-price .a-price-whole")
    if whole:
        fraction = soup.select_one(".a-price .a-price-fraction")
        whole_digits = re.sub(r"\D", "", whole.get_text())
        fraction_digits = re.sub(r"\D", "", fraction.get_text()) if fraction else ""
        if whole_digits:
            return float(f"{whole_digits}.{fraction_digits or '00'}")
    return None


def _extract_image(soup: BeautifulSoup) -> str | None:
    img_el = soup.find("img", {"id": "landingImage"})
    if img_el:
        image = img_el.get("data-old-hires") or img_el.get("src")
        if image:
            return image

    for script in soup.find_all("script", {"type": "text/javascript"}):
        if script.string and "ImageBlockATF" in script.string:
            match = re.search(r'"large":"(https://[^"]+)"', script.string)
            if match:
                return match.group(1)
    return None


def _extract_in_stock(soup: BeautifulSoup) -> bool:
    availability_el = soup.find("div", {"id": "availability"})
    if not availability_el:
        return True
    text = availability_el.get_text(strip=True).lower()
    return not any(kw in text for kw in OUT_OF_STOCK_KEYWORDS)


def reduce_html_for_ai(html: str) -> str:
    """
    Le HTML Amazon fait souvent > 1 Mo, dont l'essentiel en <head> et <script>.
    On ne garde que le bloc produit, sans scripts ni styles, pour que le prix
    tienne dans le budget envoyé au LLM.
    """
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript", "svg", "link", "meta", "iframe"]):
        tag.decompose()
    container = soup.select_one("#dp-container") or soup.select_one("#ppd") or soup.body or soup
    compact = re.sub(r"\s+", " ", str(container))
    return compact[:AI_HTML_BUDGET]


def _empty_result(url: str, status: str) -> dict:
    return {"url": url, "name": None, "price": None, "in_stock": None, "image": None, "status": status}


def parse_amazon(html: str, url: str) -> dict:
    """
    Parse une page produit Amazon.

    Statuts possibles :
      - "ok"            : extraction complète (nom + prix présents)
      - "captcha"       : Amazon a affiché un challenge
      - "not_found"     : page 404 Amazon (ASIN inexistant ou retiré)
      - "missing_data"  : la page a chargé mais le parser DOM n'a pas trouvé
                          les infos clés → Next bascule sur le fallback Gemini
    """
    soup = BeautifulSoup(html, "html.parser")

    if soup.find("form", {"action": "/errors/validateCaptcha"}):
        return _empty_result(url, "captcha")

    if soup.select_one('a[href*="cs_404"]'):
        return _empty_result(url, "not_found")

    name_el = soup.find("span", {"id": "productTitle"})
    name = name_el.get_text(strip=True) if name_el else None
    price = _extract_price(soup)

    return {
        "url": url,
        "name": name,
        "price": price,
        "in_stock": _extract_in_stock(soup),
        "image": _extract_image(soup),
        "status": "ok" if (name and price is not None) else "missing_data",
    }

# ---------------------------------------------------------------------------
# Scraper
# ---------------------------------------------------------------------------

async def _fetch_html(url: str) -> str:
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
        try:
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

            # Attend le premier signal utile : fiche produit, page 404 ou captcha.
            # Évite d'attendre 8s pour rien quand la page n'est pas une fiche.
            try:
                await page.wait_for_selector(READY_SELECTOR, timeout=8000)
            except PlaywrightTimeout:
                logger.warning("Aucun signal de page (produit/404/captcha) dans les 8s")

            return await page.content()
        finally:
            await browser.close()


async def scrape_amazon(url: str, retries: int = 3) -> dict:
    for attempt in range(1, retries + 1):
        logger.info(f"Tentative {attempt}/{retries} — {url}")
        try:
            html = await _fetch_html(url)
        except Exception as e:
            logger.error(f"Tentative {attempt} échouée : {e}")
            if attempt == retries:
                raise HTTPException(status_code=502, detail="Impossible de charger la page produit")
            wait = random.uniform(2.0, 5.0) * attempt
            logger.info(f"Attente {wait:.1f}s avant retry...")
            await asyncio.sleep(wait)
            continue

        result = parse_amazon(html, url)
        if result["status"] == "ok":
            logger.info(f"Parser DOM OK : {result['name']} — {result['price']}€")
        elif result["status"] == "missing_data":
            logger.warning("Parser DOM incomplet — HTML réduit renvoyé pour fallback IA")
            result["html"] = reduce_html_for_ai(html)
        return result

# ---------------------------------------------------------------------------
# API FastAPI
# ---------------------------------------------------------------------------

class ScrapeRequest(BaseModel):
    url: str


def _require_allowed(url: str) -> None:
    if not is_allowed_url(url):
        raise HTTPException(status_code=400, detail="Seules les URLs Amazon sont supportées pour l'instant")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/scrape")
async def scrape_get(url: str):
    _require_allowed(url)
    return await scrape_amazon(url)


@app.post("/scrape")
async def scrape_post(req: ScrapeRequest):
    _require_allowed(req.url)
    return await scrape_amazon(req.url)
