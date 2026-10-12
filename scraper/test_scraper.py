import pytest

from scraper import is_allowed_url, parse_amazon, parse_price, reduce_html_for_ai


@pytest.mark.parametrize(
    "raw, expected",
    [
        ("249,99 €", 249.99),
        ("1 299,99 €", 1299.99),
        ("1 299,99\xa0€", 1299.99),
        ("$1,299.99", 1299.99),
        ("1.299,00 €", 1299.0),
        ("1.299", 1299.0),
        ("12,49", 12.49),
        ("89", 89.0),
        ("€", None),
        ("", None),
    ],
)
def test_parse_price_handles_fr_us_de_formats(raw, expected):
    assert parse_price(raw) == expected


@pytest.mark.parametrize(
    "url, allowed",
    [
        ("https://www.amazon.fr/dp/B0C123", True),
        ("https://amazon.com/dp/B0C123", True),
        ("https://www.amazon.co.uk/dp/B0C123", True),
        ("http://evil.com/?q=amazon", False),
        ("https://amazon.fr.evil.com/dp/x", False),
        ("https://notamazon.fr/dp/x", False),
        ("file:///etc/passwd?amazon", False),
        ("javascript:alert('amazon')", False),
    ],
)
def test_is_allowed_url_rejects_non_amazon_hosts(url, allowed):
    assert is_allowed_url(url) is allowed


def _page(price_html: str, availability: str = "En stock") -> str:
    return f"""
    <html><body><div id="dp-container">
      <span id="productTitle">  Casque Bose QC Ultra  </span>
      {price_html}
      <div id="availability">{availability}</div>
      <img id="landingImage" data-old-hires="https://m.media-amazon.com/x.jpg" />
    </div></body></html>
    """


def test_parse_amazon_reads_full_price_from_offscreen():
    html = _page(
        '<div id="corePriceDisplay_desktop_feature_div"><span class="a-price">'
        '<span class="a-offscreen">449,95 €</span>'
        '<span class="a-price-whole">449,</span><span class="a-price-fraction">95</span>'
        "</span></div>"
    )
    result = parse_amazon(html, "https://www.amazon.fr/dp/x")
    assert result["status"] == "ok"
    assert result["name"] == "Casque Bose QC Ultra"
    assert result["price"] == 449.95
    assert result["in_stock"] is True
    assert result["image"] == "https://m.media-amazon.com/x.jpg"


def test_parse_amazon_keeps_cents_when_only_whole_and_fraction_exist():
    html = _page('<span class="a-price"><span class="a-price-whole">249,</span><span class="a-price-fraction">99</span></span>')
    assert parse_amazon(html, "u")["price"] == 249.99


def test_parse_amazon_detects_out_of_stock():
    html = _page('<span id="priceblock_ourprice">12,49 €</span>', availability="Actuellement indisponible.")
    assert parse_amazon(html, "u")["in_stock"] is False


def test_parse_amazon_flags_captcha():
    html = '<form action="/errors/validateCaptcha"></form>'
    assert parse_amazon(html, "u")["status"] == "captcha"


def test_parse_amazon_flags_amazon_404_page():
    html = '<center><a href="/ref=cs_404_logo"><img alt="Amazon"/></a>Vous cherchez quelque chose ?</center>'
    assert parse_amazon(html, "u")["status"] == "not_found"


def test_parse_amazon_reports_missing_data_without_price():
    assert parse_amazon(_page(""), "u")["status"] == "missing_data"


def test_reduce_html_for_ai_strips_scripts_and_keeps_product_block():
    html = (
        "<html><head><script>" + "x" * 50_000 + "</script></head><body>"
        '<div id="nav">menu</div><div id="dp-container"><span id="productTitle">Kindle</span></div>'
        "</body></html>"
    )
    reduced = reduce_html_for_ai(html)
    assert "Kindle" in reduced
    assert "<script" not in reduced
    assert "menu" not in reduced
    assert len(reduced) < 1000
