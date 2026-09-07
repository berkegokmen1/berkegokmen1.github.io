# A. Berke Gökmen — personal website

A small, static academic website for GitHub Pages. No dependencies are required beyond Python 3 for building; the homepage works without JavaScript.

## Edit content

The homepage fetches its bio, email, news, publications (including previews), and experience (including logos) from `data/` on each visit. Videos autoplay silently in a loop without controls. Edit those JSON files to update the page. Also rebuild the static fallback content for visitors without JavaScript:

```sh
python3 build.py
```

This generates `index.html` and `explore/fancy.html`. Commit the generated pages along with the data and templates when publishing with the existing GitHub Pages workflow. Do not edit the generated pages directly.

- `data/bio.json`: introduction (trusted HTML).
- `data/email.json`: contact address and plain-text obfuscated display for the academic homepage.
- `data/undergraduates.json`: English and Turkish undergraduate invitations, with language tags.
- `data/news.json`: news, newest first; three entries appear initially and the remainder sit under “Older news” (trusted HTML).
- `data/publications.json`: publications in display order, authors, venues, and links.
- `data/experience.json`: the expandable experience and education section.
- `data/visited-map.json`: shared map content.
- `data/site.json`: canonical site address, search/social metadata, and structured profile identity.

## Search and performance

The build includes all academic text and paper links in the initial HTML, independently of the browser's JSON requests. Always run `python3 build.py` after changing content so that search engines and visitors without JavaScript receive the same current information.

The build also generates `sitemap.xml`, `robots.txt`, canonical metadata, social text metadata, and ProfilePage/Person JSON-LD. Fancy mode points to the academic homepage as its canonical version. The sitemap includes the homepage, Explore, travel, map, and local research project pages, excluding redirects and duplicate modes. Update `data/site.json` if the production domain changes.

Images and logos use native lazy loading, asynchronous decoding, and explicit dimensions. The above-the-fold portrait has high fetch priority. Video sources are attached only near the viewport through IntersectionObserver; previews play silently without controls and pause offscreen or in hidden tabs. Academic text is never deferred until scrolling. Without JavaScript, video previews do not play, but all academic content and paper links remain available.

## Organization

```text
index.html                  Generated academic homepage
explore/                    Directory of personal pages and alternate modes
  index.html                Edit this to add another personal tool
  fancy.html                Generated animated academic page
  3d.html                   Interactive 3D portfolio
trip/                       Self-contained travel log and route app
map/                        Self-contained visited-places map
templates/                  Academic and Fancy HTML source templates
assets/css/                 Academic and Fancy stylesheets
assets/js/                  3D world JavaScript
assets/img, logos, teaser/  Shared images and research media
data/                       Shared content
scripts/                    Build implementation and Fancy rendering helpers
build.py                    Convenient build entry point
```

Research project folders (`com4d/`, `RoPECraft/`, `dual-enc-3d-gan-inv/`, and the other paper sites) retain their published paths. Travel and map folders also retain their existing URLs and relative assets. The old `fancy.html` and `3d.html` addresses redirect into `explore/`, preserving queries and fragments when JavaScript is available.

The two alternate modes use a `../` base URL so their shared data and research links continue to resolve from the site root. Local section links in Fancy mode explicitly target `explore/fancy.html#…`.

## Preview

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Open http://127.0.0.1:8765/. The same static files are served by GitHub Pages; no hosting migration or new framework is required.
