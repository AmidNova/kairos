from playwright.async_api import async_playwright

async def scrape_product(url: str):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()
        await page.goto(url, wait_until="domcontentloaded")
        await page.wait_for_timeout(3000)

        name = None
        try:
            name = await page.locator('#productTitle').text_content(timeout=10000)
        except:
            pass

        price = None
        try:
            whole = await page.locator('.a-price-whole').first.text_content()
            fraction = await page.locator('.a-price-fraction').first.text_content()
            price = float(f"{whole.strip().replace(',', '').replace('.', '')}.{fraction.strip()}")
        except:
            pass

        in_stock = True
        try:
            stock_text = await page.locator('#availability').text_content()
            in_stock = 'En stock' in stock_text or 'In Stock' in stock_text or 'in stock' in stock_text.lower()
        except:
            pass

        image = None
        try:
            image = await page.locator('#landingImage').get_attribute('src')
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