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
    .cpft-media-toggle { display: inline-flex; align-items: center; gap: 6px;
      margin: 10px 0 4px; padding: 0 14px 0 11px; height: 30px;
      width: fit-content; max-width: 100%; align-self: flex-start;
      color: color-mix(in srgb, currentColor 62%, transparent);
      background: color-mix(in srgb, currentColor 4%, transparent);
      border: 1px solid color-mix(in srgb, currentColor 16%, transparent);
      border-radius: 9999px; cursor: pointer;
      font-family: TwitterChirp, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 600; line-height: 1; letter-spacing: 0.01em;
      transition: color .15s ease, background-color .15s ease, border-color .15s ease; }
    .cpft-media-toggle svg { width: 16px; height: 16px; flex: none; }
    .cpft-media-toggle:hover { color: rgb(29, 155, 240);
      background: rgba(29, 155, 240, 0.1); border-color: rgba(29, 155, 240, 0.45); }
    .cpft-media-toggle:active { background: rgba(29, 155, 240, 0.18); }
    .cpft-media-toggle:focus-visible { outline: 2px solid rgb(29, 155, 240); outline-offset: 2px; }
    .cpft-media-toggle[aria-expanded="true"] { background: transparent; }
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
        record?.button.remove()
        record = {identity, revealed: false, button: document.createElement('button')}
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
        if (record.button.textContent !== label) {
          const text = document.createElement('span')
          text.textContent = label
          record.button.replaceChildren(icon(record.revealed ? 'hide' : 'show'), text)
        }
        record.button.setAttribute('aria-expanded', String(record.revealed))
        if (!record.button.isConnected) {
          const actions = tweet.querySelector('[role="group"]')
          if (actions) actions.before(record.button)
          else tweet.append(record.button)
        }
        if (hidden) for (const video of tweet.querySelectorAll('video')) {
          if (!video.paused) video.pause()
        }
      } else {
        record.button.remove()
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
