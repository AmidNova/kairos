from scraper import app  # noqa: F401

# Point d'entrée FastAPI : `uvicorn main:app --reload`
# Toute la logique vit dans scraper.py (FastAPI + Playwright + parser Amazon).