"""Rendering helpers retained for the optional Fancy mode."""
import re

def escape_html(val):
    return (str(val)
            .replace('&', '&amp;')
            .replace('<', '&lt;')
            .replace('>', '&gt;')
            .replace('"', '&quot;')
            .replace("'", '&#039;'))


def render_authors(authors, featured):
    safe_authors = escape_html(authors)
    if not featured:
        return safe_authors
    safe_featured = escape_html(featured)
    return safe_authors.replace(safe_featured, f"<strong>{safe_featured}</strong>")


def get_media_html_fancy(pub):
    media = pub.get("media", {})
    src = escape_html(media.get("src", ""))
    alt = escape_html(media.get("alt", pub.get("title", "")))
    if media.get("type") == "video":
        poster = f' poster="{escape_html(media["poster"])}"' if "poster" in media else ''
        return f'<video class="pub-video" data-src="{src}" muted loop playsinline autoplay preload="none"{poster}><p>Your browser does not support the video tag.</p></video>'
    return f'<img class="pub-image" src="{src}" alt="{alt}" loading="lazy" />'


def get_links_fancy(links):
    formatted = []
    for l in links:
        ext = ' target="_blank" rel="noopener"' if l['href'].startswith('http') or l['href'].endswith('.pdf') else ''
        formatted.append(f'<a href="{escape_html(l["href"])}"{ext}>{escape_html(l["label"])}</a>')
    return "\n                ".join(formatted)


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
    return pattern.sub(lambda match: match[1] + "\n" + replacement + "\n" + match[2], content)

