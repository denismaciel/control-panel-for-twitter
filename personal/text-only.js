(() => {
  const tweetSelector = 'article[data-testid="tweet"]'
  const mediaSelector = '[data-testid="tweetPhoto"], [data-testid="videoPlayer"], [data-testid="videoComponent"], [data-testid="card.wrapper"], [data-testid="nestedQuotePreviewMedia"]'
  const records = new WeakMap()
  let enabled = false
  let scheduled = false
  const style = document.createElement('style')
  style.textContent = `
    [data-cpft-text-only] [data-cpft-media] { display: none !important; }
    .cpft-card-link { display: none; }
    [data-cpft-text-only] .cpft-card-link { display: block; margin: 8px 0; color: inherit; font: 14px/1.4 system-ui, sans-serif; }
    /* An icon-only peer of X's reply/repost/like actions. */
    .cpft-media-slot { display: flex; flex: 1 1 0%; align-items: center; justify-content: flex-start; }
    .cpft-media-toggle { position: relative; display: flex; align-items: center; justify-content: center;
      width: 20px; height: 20px; padding: 0; margin: 0; border: 0; background: none;
      color: rgb(113, 118, 123); cursor: pointer; transition: color .2s ease; }
    .cpft-media-toggle::before { content: ""; position: absolute; inset: -8px; border-radius: 9999px;
      background: transparent; transition: background-color .2s ease; }
    .cpft-media-toggle svg { position: relative; width: 18.75px; height: 18.75px; }
    .cpft-media-toggle:hover, .cpft-media-toggle:focus-visible,
    .cpft-media-toggle[aria-expanded="true"] { color: rgb(29, 155, 240); }
    .cpft-media-toggle:hover::before { background: rgba(29, 155, 240, 0.1); }
    .cpft-media-toggle:focus-visible { outline: none; }
    .cpft-media-toggle:focus-visible::before { box-shadow: 0 0 0 2px rgb(29, 155, 240); }
  `
  document.documentElement.append(style)

  const svgNs = 'http://www.w3.org/2000/svg'
  // Built with DOM APIs, not innerHTML, so X's Trusted Types CSP cannot reject it.
  const icons = {
    show: ['M3 5.5A2.5 2.5 0 0 1 5.5 3h13A2.5 2.5 0 0 1 21 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 18.5z', 'M3 16l5-5 4 4 3-3 6 6', 'M15.5 8.5h.01'],
    hide: ['M3 3l18 18', 'M10.6 5.1A10 10 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-2.6 3.4', 'M6.6 6.6C3.9 8.4 2.5 12 2.5 12S6 19 12 19a9.6 9.6 0 0 0 5.4-1.6', 'M9.9 9.9a3 3 0 0 0 4.2 4.2'],
  }
  function icon(name) {
    const svg = document.createElementNS(svgNs, 'svg')
    svg.setAttribute('viewBox', '0 0 24 24')
    svg.setAttribute('fill', 'none')
    svg.setAttribute('stroke', 'currentColor')
    svg.setAttribute('stroke-width', '2')
    svg.setAttribute('stroke-linecap', 'round')
    svg.setAttribute('stroke-linejoin', 'round')
    svg.setAttribute('aria-hidden', 'true')
    for (const d of icons[name]) {
      const path = document.createElementNS(svgNs, 'path')
      path.setAttribute('d', d)
      svg.append(path)
    }
    return svg
  }

  function scan() {
    scheduled = false
    for (const tweet of document.querySelectorAll(tweetSelector)) {
      // React can recycle an article for another tweet. Never carry reveal state over.
      const identity = tweet.querySelector('a[href*="/status/"]:has(time)')?.getAttribute('href')
        || tweet.querySelector('[data-testid="tweetText"]')?.textContent || ''
      let record = records.get(tweet)
      if (!record || record.identity !== identity) {
        record?.slot.remove()
        record = {identity, revealed: false, slot: document.createElement('div'), button: document.createElement('button')}
        record.slot.className = 'cpft-media-slot'
        record.slot.append(record.button)
        record.button.type = 'button'
        record.button.className = 'cpft-media-toggle'
        record.button.addEventListener('click', event => {
          event.preventDefault()
          event.stopPropagation()
          record.revealed = !record.revealed
          schedule()
        })
        records.set(tweet, record)
      }
      for (const stale of tweet.querySelectorAll('[data-cpft-media]')) stale.removeAttribute('data-cpft-media')
      for (const link of tweet.querySelectorAll('.cpft-card-link')) {
        if (!link.nextElementSibling?.matches('[data-testid="card.wrapper"]')) link.remove()
      }
      const media = [...tweet.querySelectorAll(mediaSelector)]
      for (let element of media) {
        if (element.matches('[data-testid="card.wrapper"]')) {
          const source = element.querySelector('a[href]')
          if (source) {
            let link = element.previousElementSibling
            if (!link?.classList.contains('cpft-card-link')) {
              link = document.createElement('a')
              link.className = 'cpft-card-link'
              element.before(link)
            }
            link.href = source.href
            link.target = '_blank'
            link.rel = 'noopener noreferrer'
            const title = source.getAttribute('aria-label') || source.textContent.trim() || new URL(source.href).hostname
            if (link.textContent !== title) link.textContent = title
          }
        } else {
          // Collapse the media's aspect-ratio wrappers too, stopping before text,
          // authors, actions or quotes. Do not rely on X's generated CSS classes.
          while (element.parentElement && element.parentElement !== tweet) {
            const parent = element.parentElement
            if (parent.querySelector('[data-testid="tweetText"], [data-testid="User-Name"], [data-testid="Tweet-User-Avatar"], time, [role="group"], .cpft-media-toggle, .cpft-card-link')) break
            if (parent.textContent.trim() !== element.textContent.trim()) break
            element = parent
          }
        }
        if (!element.hasAttribute('data-cpft-media')) element.setAttribute('data-cpft-media', '')
      }
      const hidden = enabled && !record.revealed && media.length > 0
      if (tweet.hasAttribute('data-cpft-text-only') !== hidden) tweet.toggleAttribute('data-cpft-text-only', hidden)
      if (enabled && media.length) {
        const label = record.revealed ? 'Hide media' : 'Show media'
        if (record.button.getAttribute('aria-label') !== label) {
          record.button.setAttribute('aria-label', label)
          record.button.title = label
          record.button.replaceChildren(icon(record.revealed ? 'hide' : 'show'))
        }
        record.button.setAttribute('aria-expanded', String(record.revealed))
        if (!record.slot.isConnected) {
          // Sit after like, before the bookmark/share cluster.
          const actions = tweet.querySelector('[role="group"]')
          const bookmark = actions && [...actions.children].find(slot => slot.querySelector('[data-testid="bookmark"], [data-testid="removeBookmark"]'))
          if (bookmark) bookmark.before(record.slot)
          else if (actions) actions.append(record.slot)
          else tweet.append(record.slot)
        }
        if (hidden) for (const video of tweet.querySelectorAll('video')) {
          if (!video.paused) video.pause()
        }
      } else {
        record.slot.remove()
        record.revealed = false
      }
    }
  }
  function schedule() {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(scan)
  }
  function refresh() {
    cpftStorage.local.get({enabled: true}, config => {
      chrome.storage.local.get({personalTextOnly: false}, local => {
        enabled = config.enabled && (cpftPersonal.settings.textOnly ?? local.personalTextOnly)
        schedule()
      })
    })
  }
  new MutationObserver(schedule).observe(document.documentElement, {childList: true, subtree: true})
  chrome.storage.onChanged.addListener((_, area) => { if (area === 'local') refresh() })
  // Stop hidden videos if the site tries to autoplay them after our scan.
  document.addEventListener('play', event => {
    if (event.target instanceof HTMLMediaElement && event.target.closest('[data-cpft-text-only]')) event.target.pause()
  }, true)
  refresh()
})()
