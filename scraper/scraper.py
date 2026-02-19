from playwright.async_api import async_playwright
import random

async def scrape_product(url: str):
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-blink-features=AutomationControlled']
        )
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 720},
            locale="fr-FR",
            timezone_id="Europe/Paris",
        )

        await context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        """)

        page = await context.new_page()
        await page.route("**/*", lambda route: route.abort() 
        if route.request.resource_type in ["image", "media", "font", "stylesheet"]
        else route.continue_())
        await page.goto(url, wait_until="domcontentloaded")
        await page.wait_for_selector('#productTitle', timeout=15000)
        name = None
        try:
            name = await page.locator('#productTitle').text_content(timeout=15000)
        except:
            pass

        price = None
        try:
            whole = await page.locator('.a-price-whole').first.text_content(timeout=5000)
            fraction = await page.locator('.a-price-fraction').first.text_content(timeout=5000)
            price = float(f"{whole.strip().replace(',', '').replace('.', '')}.{fraction.strip()}")
        except:
            pass

        in_stock = True
        try:
            stock_text = await page.locator('#availability').text_content(timeout=5000)
            in_stock = 'in stock' in stock_text.lower() or 'en stock' in stock_text.lower()
        except:
            pass

        image = None
        try:
            image = await page.locator('#landingImage').get_attribute('src', timeout=5000)
        except:
            pass

        await browser.close()

        return {
            "url": url,
            "name": name.strip() if name else None,
            "price": price,
            "in_stock": in_stock,
            "image": image
        }