#!/usr/bin/env python3
import json
import os
import re

# Helper to escape HTML characters
def escape_html(val):
    return (str(val)
            .replace('&', '&amp;')
            .replace('<', '&lt;')
            .replace('>', '&gt;')
            .replace('"', '&quot;')
            .replace("'", '&#039;'))

# Helper to bold the featured author
def render_authors(authors, featured):
    safe_authors = escape_html(authors)
    if not featured:
        return safe_authors
    safe_featured = escape_html(featured)
    return safe_authors.replace(safe_featured, f"<strong>{safe_featured}</strong>")

def get_media_html_simple(pub):
    media = pub.get("media", {})
    src = escape_html(media.get("src", ""))
    alt = escape_html(media.get("alt", pub.get("title", "")))
    if media.get("type") == "video":
        poster = f' poster="{escape_html(media["poster"])}"' if "poster" in media else ''
        return f'<video class="pub-video" src="{src}" muted loop playsinline autoplay preload="none"{poster}><p>Your browser does not support the video tag.</p></video>'
    return f'<img class="pub-image" src="{src}" alt="{alt}" loading="lazy" />'

def get_media_html_fancy(pub):
    media = pub.get("media", {})
    src = escape_html(media.get("src", ""))
    alt = escape_html(media.get("alt", pub.get("title", "")))
    if media.get("type") == "video":
        poster = f' poster="{escape_html(media["poster"])}"' if "poster" in media else ''
        return f'<video class="pub-video" data-src="{src}" muted loop playsinline autoplay preload="none"{poster}><p>Your browser does not support the video tag.</p></video>'
    return f'<img class="pub-image" src="{src}" alt="{alt}" loading="lazy" />'

def get_links_simple(links):
    formatted = []
    for l in links:
        ext = ' target="_blank" rel="noopener"' if l['href'].startswith('http') or l['href'].endswith('.pdf') else ''
        formatted.append(f'<a href="{escape_html(l["href"])}"{ext}>{escape_html(l["label"])}</a>')
    return " &nbsp;/&nbsp; ".join(formatted)

def get_links_fancy(links):
    formatted = []
    for l in links:
        ext = ' target="_blank" rel="noopener"' if l['href'].startswith('http') or l['href'].endswith('.pdf') else ''
        formatted.append(f'<a href="{escape_html(l["href"])}"{ext}>{escape_html(l["label"])}</a>')
    return "\n                ".join(formatted)

def render_xp_list_simple(items):
    formatted = []
    for item in items:
        detailsText = f"<strong>{escape_html(item['name'])}</strong>"
        if item.get("title"):
            detailsText += f" — {escape_html(item['title'])}"
        dateLoc = " · ".join(filter(None, [item.get("date"), item.get("location")]))
        if dateLoc:
            if item.get("title"):
                detailsText += f" · {escape_html(dateLoc)}"
            else:
                detailsText += f" — {escape_html(dateLoc)}"
        
        formatted.append(
            f'            <li class="xp-item">\n'
            f'              <img class="xp-logo" src="{escape_html(item["logo"])}" alt="{escape_html(item["name"])}" />\n'
            f'              <span class="xp-text">{detailsText}</span>\n'
            f'            </li>'
        )
    return "\n".join(formatted)

def render_xp_list_fancy(items):
    formatted = []
    for item in items:
        detailsText = f"{escape_html(item['name'])}"
        if item.get("title"):
            detailsText += f" — {escape_html(item['title'])}"
        dateLoc = " · ".join(filter(None, [item.get("date"), item.get("location")]))
        if dateLoc:
            if item.get("title"):
                detailsText += f" · {escape_html(dateLoc)}"
            else:
                detailsText += f" — {escape_html(dateLoc)}"
        
        formatted.append(
            f'              <li class="xp-item">\n'
            f'                <img src="{escape_html(item["logo"])}" alt="{escape_html(item["name"])}" />\n'
            f'                <span class="xp-text">{detailsText}</span>\n'
            f'              </li>'
        )
    return "\n".join(formatted)

def replace_between_markers(content, marker_start, marker_end, replacement):
    pattern = re.compile(
        rf"({re.escape(marker_start)}).*?({re.escape(marker_end)})",
        re.DOTALL
    )
    return pattern.sub(rf"\1\n{replacement}\n\2", content)

def build():
    print("Loading JSON data files...")
    with open("data/bio.json", "r", encoding="utf-8") as f:
        bio = json.load(f)
    with open("data/news.json", "r", encoding="utf-8") as f:
        news = json.load(f)
    with open("data/publications.json", "r", encoding="utf-8") as f:
        publications = json.load(f)
    with open("data/experience.json", "r", encoding="utf-8") as f:
        experience = json.load(f)

    # 1. Generate HTML snippets for Simple index.html
    print("Generating HTML for Simple Site (index.html)...")
    
    # Bio
    bio_html_simple = (
        f'          <p class="profile-bio">\n            {bio["lead"]}\n          </p>\n'
        f'          <p class="profile-bio">\n            {bio["secondary"]}\n          </p>'
    )
    
    # News
    news_items = []
    for item in news:
        news_items.append(
            f'          <li class="news-item">\n'
            f'            <span class="news-date">[{escape_html(item["date"])}]</span>\n'
            f'            <span class="news-text">{item["text"]}</span>\n'
            f'          </li>'
        )
    news_html_simple = "\n".join(news_items)

    # Publications
    pub_items_simple = []
    for pub in publications:
        pub_items_simple.append(
            f'          <li class="pub-item">\n'
            f'            <div class="pub-media">\n'
            f'              {get_media_html_simple(pub)}\n'
            f'            </div>\n'
            f'            <div class="pub-info">\n'
            f'              <div class="pub-title">{escape_html(pub["title"])}</div>\n'
            f'              <div class="pub-authors">{render_authors(pub["authors"], pub["featuredAuthor"])}</div>\n'
            f'              <div class="pub-venue">{escape_html(pub["venue"])}</div>\n'
            f'              <div class="pub-links">\n'
            f'                {get_links_simple(pub["links"])}\n'
            f'              </div>\n'
            f'            </div>\n'
            f'          </li>'
        )
    pub_html_simple = "\n".join(pub_items_simple)

    # Experience Simple
    xp_html_simple = (
        f'        <div class="xp-group">\n'
        f'          <h3 class="xp-group-title">Roles</h3>\n'
        f'          <ul class="xp-list">\n'
        f'{render_xp_list_simple(experience["roles"])}\n'
        f'          </ul>\n'
        f'        </div>\n'
        f'        <div class="xp-group">\n'
        f'          <h3 class="xp-group-title">Education</h3>\n'
        f'          <ul class="xp-list">\n'
        f'{render_xp_list_simple(experience["education"])}\n'
        f'          </ul>\n'
        f'        </div>\n'
        f'        <div class="xp-group">\n'
        f'          <h3 class="xp-group-title">Short-term Schools</h3>\n'
        f'          <ul class="xp-list">\n'
        f'{render_xp_list_simple(experience["schools"])}\n'
        f'          </ul>\n'
        f'        </div>'
    )

    # 2. Generate HTML snippets for Fancy fancy.html
    print("Generating HTML for Fancy Site (fancy.html)...")
    
    # Bio
    bio_html_fancy = (
        f'            <p class="lead">\n              {bio["lead"]}\n            </p>\n'
        f'            <p>\n              {bio["secondary"]}\n            </p>'
    )
    
    # Publications
    pub_items_fancy = []
    for pub in publications:
        pub_items_fancy.append(
            f'          <li class="pub" data-venue="{escape_html(pub["venueKey"])}">\n'
            f'            <div class="pub-media">\n'
            f'              {get_media_html_fancy(pub)}\n'
            f'            </div>\n'
            f'            <div class="pub-body">\n'
            f'              <div class="pub-header">\n'
            f'                <span class="pub-badge">{escape_html(pub["venue"])}</span>\n'
            f'                <span class="pub-title">{escape_html(pub["title"])}</span>\n'
            f'              </div>\n'
            f'              <p class="pub-authors">{render_authors(pub["authors"], pub["featuredAuthor"])}</p>\n'
            f'              <div class="pub-links">\n'
            f'                {get_links_fancy(pub["links"])}\n'
            f'              </div>\n'
            f'            </div>\n'
            f'          </li>'
        )
    pub_html_fancy = "\n".join(pub_items_fancy)

    # Experience Fancy
    xp_html_fancy = (
        f'        <div class="experience-wrap">\n'
        f'          <div class="experience-group">\n'
        f'            <h3>Roles</h3>\n'
        f'            <ul class="experience-list">\n'
        f'{render_xp_list_fancy(experience["roles"])}\n'
        f'            </ul>\n'
        f'          </div>\n'
        f'          <div class="experience-group">\n'
        f'            <h3>Education</h3>\n'
        f'            <ul class="experience-list">\n'
        f'{render_xp_list_fancy(experience["education"])}\n'
        f'            </ul>\n'
        f'          </div>\n'
        f'          <div class="experience-group">\n'
        f'            <h3>Short-term Schools</h3>\n'
        f'            <ul class="experience-list">\n'
        f'{render_xp_list_fancy(experience["schools"])}\n'
        f'            </ul>\n'
        f'          </div>\n'
        f'        </div>'
    )

    # 3. Apply changes to index.html
    if os.path.exists("index.html"):
        print("Writing fallback content into index.html...")
        with open("index.html", "r", encoding="utf-8") as f:
            content = f.read()
        
        content = replace_between_markers(content, "<!-- BIO_FALLBACK_START -->", "<!-- BIO_FALLBACK_END -->", bio_html_simple)
        content = replace_between_markers(content, "<!-- NEWS_FALLBACK_START -->", "<!-- NEWS_FALLBACK_END -->", news_html_simple)
        content = replace_between_markers(content, "<!-- PUB_FALLBACK_START -->", "<!-- PUB_FALLBACK_END -->", pub_html_simple)
        content = replace_between_markers(content, "<!-- XP_FALLBACK_START -->", "<!-- XP_FALLBACK_END -->", xp_html_simple)
        
        with open("index.html", "w", encoding="utf-8") as f:
            f.write(content)

    # 4. Apply changes to fancy.html
    if os.path.exists("fancy.html"):
        print("Writing fallback content into fancy.html...")
        with open("fancy.html", "r", encoding="utf-8") as f:
            content = f.read()
        
        content = replace_between_markers(content, "<!-- BIO_FALLBACK_START -->", "<!-- BIO_FALLBACK_END -->", bio_html_fancy)
        content = replace_between_markers(content, "<!-- PUB_FALLBACK_START -->", "<!-- PUB_FALLBACK_END -->", pub_html_fancy)
        content = replace_between_markers(content, "<!-- XP_FALLBACK_START -->", "<!-- XP_FALLBACK_END -->", xp_html_fancy)
        
        with open("fancy.html", "w", encoding="utf-8") as f:
            f.write(content)

    print("Success! Static fallbacks are fully updated and synchronized.")

if __name__ == "__main__":
    build()
