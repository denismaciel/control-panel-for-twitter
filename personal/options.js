(() => {
  const section = document.createElement('section')
  section.className = 'group'
  section.style.padding = '12px'
  const label = document.createElement('label')
  const toggle = document.createElement('input')
  toggle.type = 'checkbox'
  label.append(toggle, ' Text-only tweets')
  section.append(label)
  const managed = Object.hasOwn(cpftPersonal.settings, 'textOnly')
  toggle.disabled = managed
  if (managed) label.append(' — managed by Nix')
  function refresh() {
    chrome.storage.local.get({personalTextOnly: false}, values => {
      toggle.checked = cpftPersonal.settings.textOnly ?? values.personalTextOnly
    })
  }
  toggle.addEventListener('change', () => chrome.storage.local.set({personalTextOnly: toggle.checked}))
  document.querySelector('form').before(section)
  for (const key of Object.keys(cpftPersonal.upstreamSettings)) {
    for (const control of document.querySelectorAll(`[name="${key}"]`)) {
    control.disabled = true
    control.title = 'Managed by Nix'
    control.setAttribute('aria-description', 'Managed by Nix')
    const note = document.createElement('small')
    note.textContent = ' — managed by Nix'
    control.parentElement.append(note)
    // Group checkboxes can modify several settings at once. Disable groups which
    // contain a managed option, while keeping their unmanaged children editable.
    for (let parent = control.parentElement; parent; parent = parent.parentElement) {
      if (!parent.matches('section.checkbox')) continue
      const group = parent.querySelector(':scope > label > input[type="checkbox"]')
      if (group && group !== control) { group.disabled = true; group.title = 'Contains settings managed by Nix' }
    }
  }
  }
  chrome.storage.onChanged.addListener((_, area) => { if (area === 'local') refresh() })
  refresh()
})()
