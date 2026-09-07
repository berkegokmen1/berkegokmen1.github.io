// Each section refreshes independently; generated HTML survives failed requests.
(() => {
  const activateVideo = (video) => {
    if (video.dataset.src) {
      video.src = video.dataset.src;
      delete video.dataset.src;
      video.load();
    }
    video.muted = true;
    video.play().catch(() => {});
  };
  const videoObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
      entries.forEach(({ target, isIntersecting }) => {
        if (isIntersecting && !document.hidden) activateVideo(target);
        else target.pause();
      });
    }, { rootMargin: '150px 0px' }) : null;
  const observeVideos = () => {
    videoObserver?.disconnect();
    document.querySelectorAll('video.pub-preview').forEach((video) => {
      if (videoObserver) videoObserver.observe(video);
      else activateVideo(video);
    });
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) document.querySelectorAll('video.pub-preview').forEach((video) => video.pause());
    else observeVideos();
  });
  const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const authors = (pub) => {
    const text = escape(pub.authors);
    const featured = pub.featuredAuthor && escape(pub.featuredAuthor);
    return featured ? text.split(featured).join(`<strong>${featured}</strong>`) : text;
  };
  const preview = (pub) => {
    const media = pub.media || {};
    if (!media.src) return '';
    const src = escape(media.src);
    const alt = escape(media.alt || pub.title);
    if (media.type === 'video') {
      const poster = media.poster ? ` poster="${escape(media.poster)}"` : '';
      return `<video class="pub-preview" data-src="${src}" aria-label="${alt}" width="144" height="108" autoplay muted loop playsinline preload="none"${poster}></video>`;
    }
    return `<img class="pub-preview" src="${src}" alt="${alt}" width="144" height="108" loading="lazy" decoding="async">`;
  };
  const newsRows = (items) => items.map((item) =>
    `<li><time datetime="${escape(item.date.replace('.', '-'))}">${escape(item.date)}</time><span>${item.text}</span></li>`
  ).join('');
  const renderers = {
    photos(data) {
      const roll = Math.random();
      const egg = data.easterEgg;
      const isEasterEgg = roll < egg.probability;
      const index = Math.min(data.portraits.length - 1,
        Math.floor((roll - egg.probability) / (1 - egg.probability) * data.portraits.length));
      const photo = document.querySelector('.portrait');
      const caption = document.querySelector('#photo-caption');
      photo.src = isEasterEgg ? egg.src : data.portraits[index];
      photo.alt = isEasterEgg ? egg.alt : 'A. Berke Gökmen';
      photo.classList.toggle('portrait-nohut', isEasterEgg);
      caption.textContent = isEasterEgg ? egg.caption : '';
      caption.hidden = !isEasterEgg;
    },
    bio(data) {
      // Bio and news deliberately support trusted HTML from this repository.
      document.querySelector('#bio').innerHTML = `<p>${data.lead}</p><p>${data.secondary}</p>`;
    },
    email(data) {
      document.querySelector('#email').innerHTML = 'E-mail: ' + escape(data.display)
        .replaceAll('[at]', '<strong>[at]</strong>')
        .replaceAll('[dot]', '<strong>[dot]</strong>');
    },
    undergraduates(data) {
      document.querySelector('#undergraduates-content').innerHTML = data.map((item) =>
        `<p lang="${escape(item.lang)}">${escape(item.text)}</p>`
      ).join('');
    },
    news(data) {
      const container = document.querySelector('#news-content');
      const open = container.querySelector('details')?.open;
      const older = data.length > 3
        ? `<details class="news-archive"${open ? ' open' : ''}><summary>Older news</summary><ul class="news">${newsRows(data.slice(3))}</ul></details>` : '';
      container.innerHTML = `<ul class="news">${newsRows(data.slice(0, 3))}</ul>${older}`;
    },
    publications(data) {
      document.querySelector('.publications').innerHTML = data.map((pub) => {
        const media = preview(pub);
        const links = pub.links.map((link) => `<a href="${escape(link.href)}">${escape(link.label)}</a>`).join('');
        return `<li class="${media ? 'has-preview' : 'text-only'}">${media}<div class="pub-info">
          <h3 class="pub-title">${escape(pub.title)}</h3>
          <p class="pub-authors">${authors(pub)}</p>
          <div class="pub-meta"><span class="pub-venue">${escape(pub.venue)}</span><span class="pub-links">${links}</span></div>
        </div></li>`;
      }).join('');
      observeVideos();
    },
    experience(data) {
      document.querySelector('#experience-content').innerHTML = [
        ['roles', 'Research & work'], ['education', 'Education'], ['schools', 'Short-term schools']
      ].map(([key, title]) => {
        const rows = data[key].map((item) => {
          const logo = item.logo ? `<img class="institution-logo" src="${escape(item.logo)}" alt="" width="40" height="40" loading="lazy" decoding="async">` : '';
          const position = item.title ? ` · ${escape(item.title)}` : '';
          const dates = escape([item.date, item.location].filter(Boolean).join(' · '));
          return `<li>${logo}<div><strong>${escape(item.name)}</strong>${position}<span class="dates">${dates}</span></div></li>`;
        }).join('');
        return `<h3>${title}</h3><ul>${rows}</ul>`;
      }).join('');
    }
  };
  observeVideos();
  Object.entries(renderers).forEach(async ([name, render]) => {
    try {
      const response = await fetch(`data/${name}.json`, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`${name}: ${response.status}`);
      render(await response.json());
    } catch (error) {
      console.warn(`Keeping generated ${name} content.`, error);
    }
  });
})();
