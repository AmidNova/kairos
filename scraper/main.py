from fastapi import FastAPI
from scraper import scrape_product

app = FastAPI()

@app.get("/scrape")
async def scrape(url: str):
    result = await scrape_product(url)
    return result