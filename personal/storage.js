// A narrow storage adapter: Nix overrides never overwrite browser preferences.
(() => {
  const overrides = globalThis.cpftPersonal.upstreamSettings
  const listeners = new Map()
  const onChanged = {
    addListener(listener) {
      if (listeners.has(listener)) return
      const wrapped = (changes, area) => {
        if (area !== 'local') return
        const effective = Object.fromEntries(Object.entries(changes).filter(([key]) =>
          key !== 'personalTextOnly' && !Object.hasOwn(overrides, key)))
        if (Object.keys(effective).length) listener(effective, area)
      }
      listeners.set(listener, wrapped)
      chrome.storage.onChanged.addListener(wrapped)
    },
    removeListener(listener) {
      const wrapped = listeners.get(listener)
      if (wrapped) chrome.storage.onChanged.removeListener(wrapped)
      listeners.delete(listener)
    },
  }
  globalThis.cpftStorage = {
    onChanged,
    local: {
      onChanged,
      get(keys, callback) {
        if (typeof keys === 'function') { callback = keys; keys = null }
        chrome.storage.local.get(keys, stored => {
          const selected = Object.fromEntries(Object.entries(overrides).filter(([key]) =>
            keys == null || (typeof keys === 'string' ? keys === key :
              Array.isArray(keys) ? keys.includes(key) : Object.hasOwn(keys, key))))
          const effective = {...stored, ...selected}
          delete effective.personalTextOnly
          callback(effective)
        })
      },
      set(changes, callback) {
        chrome.storage.local.set(Object.fromEntries(Object.entries(changes).filter(([key]) =>
          !Object.hasOwn(overrides, key))), callback)
      },
    },
  }
})()
