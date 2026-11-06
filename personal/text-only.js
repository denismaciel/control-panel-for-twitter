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
    .cpft-media-toggle { display: block; margin: 8px 0; padding: 5px 10px;
      color: inherit; background: transparent; border: 1px solid currentColor;
      border-radius: 16px; cursor: pointer; font: 13px/1.4 system-ui, sans-serif;
      width: fit-content; max-width: 100%; align-self: flex-start; }
  `
  document.documentElement.append(style)

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
        if (record.button.textContent !== label) record.button.textContent = label
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
