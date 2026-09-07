#!/usr/bin/env python3
"""Render the academic and fancy pages from templates and shared JSON content."""
import json
from html import escape
from pathlib import Path
from urllib.parse import urljoin, urlparse

from legacy_render import get_media_html_fancy, get_links_fancy, render_authors, render_xp_list_fancy, replace_between_markers

ROOT = Path(__file__).resolve().parents[1]


def load(name):
    return json.loads((ROOT / 'data' / f'{name}.json').read_text(encoding='utf-8'))


def news_rows(items):
    return '\n'.join(f'<li><time datetime="{escape(item["date"].replace(".", "-"))}">{escape(item["date"])}</time><span>{item["text"]}</span></li>' for item in items)


def publication_preview(pub):
    media = pub.get('media', {})
    if not media.get('src'):
        return ''
    src = escape(media['src'], quote=True)
    alt = escape(media.get('alt', pub['title']), quote=True)
    if media.get('type') == 'video':
        poster = f' poster="{escape(media["poster"], quote=True)}"' if media.get('poster') else ''
        return f'<video class="pub-preview" data-src="{src}" aria-label="{alt}" width="144" height="108" muted loop autoplay playsinline preload="none"{poster}>Your browser does not support this video.</video>'
    return f'<img class="pub-preview" src="{src}" alt="{alt}" width="144" height="108" loading="lazy" decoding="async">'


def build():
    bio, news, pubs, experience = (load(name) for name in ('bio', 'news', 'publications', 'experience'))
    email = load('email')['display']
    site = load('site')
    schema = {
        '@context': 'https://schema.org', '@type': 'ProfilePage',
        '@id': site['url'] + '#profile', 'url': site['url'], 'name': site['title'],
        'mainEntity': {
            '@type': 'Person', '@id': site['url'] + '#person',
            'name': site['name'], 'alternateName': site['alternateName'],
            'url': site['url'], 'image': urljoin(site['url'], site['image']),
            'description': site['description'], 'sameAs': site['sameAs'],
        },
    }
    metadata = '\n'.join([
        f'<title>{escape(site["title"])}</title>',
        f'<meta name="description" content="{escape(site["description"], quote=True)}">',
        f'<link rel="canonical" href="{escape(site["url"], quote=True)}">',
        '<meta property="og:type" content="profile">',
        f'<meta property="og:title" content="{escape(site["title"], quote=True)}">',
        f'<meta property="og:description" content="{escape(site["description"], quote=True)}">',
        f'<meta property="og:url" content="{escape(site["url"], quote=True)}">',
        '<meta name="twitter:card" content="summary">',
        f'<meta name="twitter:title" content="{escape(site["title"], quote=True)}">',
        f'<meta name="twitter:description" content="{escape(site["description"], quote=True)}">',
        '<script type="application/ld+json">' + json.dumps(schema, ensure_ascii=False).replace('<', '\\u003c') + '</script>',
    ])
    publications = []
    for pub in pubs:
        links = ''.join(f'<a href="{escape(link["href"], quote=True)}">{escape(link["label"])}</a>' for link in pub['links'])
        preview = publication_preview(pub)
        publications.append(f'''<li class="{'has-preview' if preview else 'text-only'}">
          {preview}
          <div class="pub-info">
          <h3 class="pub-title">{escape(pub['title'])}</h3>
          <p class="pub-authors">{render_authors(pub['authors'], pub.get('featuredAuthor'))}</p>
          <div class="pub-meta"><span class="pub-venue">{escape(pub['venue'])}</span><span class="pub-links">{links}</span></div>
          </div>
        </li>''')
    groups = []
    for key, title in [('roles', 'Research & work'), ('education', 'Education'), ('schools', 'Short-term schools')]:
        rows = []
        for item in experience[key]:
            position = f' · {escape(item["title"])}' if item.get('title') else ''
            dates = escape(' · '.join(filter(None, [item.get('date'), item.get('location')])))
            logo = f'<img class="institution-logo" src="{escape(item["logo"], quote=True)}" alt="" width="40" height="40" loading="lazy" decoding="async">' if item.get('logo') else ''
            rows.append(f'<li>{logo}<div><strong>{escape(item["name"])}</strong>{position}<span class="dates">{dates}</span></div></li>')
        groups.append(f'<h3>{title}</h3><ul>{"".join(rows)}</ul>')
    context = {
        'metadata': metadata,
        'bio': f'<p>{bio["lead"]}</p><p>{bio["secondary"]}</p>',
        'email': 'E-mail: ' + escape(email, quote=True).replace('[at]', '<strong>[at]</strong>').replace('[dot]', '<strong>[dot]</strong>'),
        'undergraduates': '\n'.join(f'<p lang="{escape(item["lang"], quote=True)}">{escape(item["text"])}</p>' for item in load('undergraduates')),
        'news': news_rows(news[:3]),
        'older_news': f'<details class="news-archive"><summary>Older news</summary><ul class="news">{news_rows(news[3:])}</ul></details>' if len(news) > 3 else '',
        'publications': '\n'.join(publications),
        'experience': '\n'.join(groups),
    }
    page = (ROOT / 'templates/academic.html').read_text(encoding='utf-8')
    for key, value in context.items():
        token = '{{' + key + '}}'
        if token not in page:
            raise ValueError(f'Missing template field: {key}')
        page = page.replace(token, value)
    (ROOT / 'index.html').write_text(page, encoding='utf-8')
    routes = ['', 'explore/', 'trip/', 'map/']
    for pub in pubs:
        for link in pub['links']:
            if link['label'] == 'Project' and not urlparse(link['href']).scheme:
                routes.append(link['href'])
    locations = '\n'.join(f'  <url><loc>{escape(urljoin(site["url"], route))}</loc></url>' for route in dict.fromkeys(routes))
    (ROOT / 'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + locations + '\n</urlset>\n', encoding='utf-8')
    (ROOT / 'robots.txt').write_text(f'User-agent: *\nAllow: /\n\nSitemap: {urljoin(site["url"], "sitemap.xml")}\n', encoding='utf-8')

    # Preserve Fancy mode's interactions and keep its static content synchronized.
    fancy = (ROOT / 'templates/fancy.html').read_text(encoding='utf-8')
    fancy = fancy.replace('<base href="../" />', '<base href="../" />\n    <link rel="canonical" href="' + escape(site['url'], quote=True) + '" />')
    fancy_pubs = []
    for pub in pubs:
        fancy_pubs.append(f'''<li class="pub" data-venue="{escape(pub['venueKey'])}">
          <div class="pub-media">{get_media_html_fancy(pub)}</div>
          <div class="pub-body"><div class="pub-header"><span class="pub-badge">{escape(pub['venue'])}</span><span class="pub-title">{escape(pub['title'])}</span></div>
          <p class="pub-authors">{render_authors(pub['authors'], pub.get('featuredAuthor'))}</p>
          <div class="pub-links">{get_links_fancy(pub['links'])}</div></div></li>''')
    fancy_xp = '<div class="experience-wrap">' + ''.join(
        f'<div class="experience-group"><h3>{title}</h3><ul class="experience-list">{render_xp_list_fancy(experience[key])}</ul></div>'
        for key, title in [('roles', 'Roles'), ('education', 'Education'), ('schools', 'Short-term Schools')]
    ) + '</div>'
    for name, content in [('BIO', f'<p class="lead">{bio["lead"]}</p><p>{bio["secondary"]}</p>'), ('PUB', '\n'.join(fancy_pubs)), ('XP', fancy_xp)]:
        fancy = replace_between_markers(fancy, f'<!-- {name}_FALLBACK_START -->', f'<!-- {name}_FALLBACK_END -->', content)
    (ROOT / 'explore/fancy.html').write_text(fancy, encoding='utf-8')
    print('Built index.html and explore/fancy.html from templates and data.')


if __name__ == '__main__':
    build()
