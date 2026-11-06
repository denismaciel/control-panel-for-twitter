export function validateConfig(config, types) {
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  if (!object(config)) throw new Error('Configuration must be an object')
  for (const key of Object.keys(config)) if (!['settings', 'upstreamSettings'].includes(key)) throw new Error(`Unknown configuration section: ${key}`)
  for (const section of ['settings', 'upstreamSettings']) if (!object(config[section])) throw new Error(`${section} must be an object`)
  for (const [key, value] of Object.entries(config.settings)) {
    if (key !== 'textOnly' || typeof value !== 'boolean') throw new Error(`Invalid personal setting: ${key}`)
  }
  const configType = types.match(/export type Config = \{([\s\S]*?)\r?\n\}/)?.[1]
  if (!configType) throw new Error('Upstream Config type changed; review validation')
  const fields = new Map([...configType.matchAll(/^  (\w+)\??: ([^\r\n]+)/gm)].map(([, key, type]) => [key, type.trim()]))
  for (const [key, value] of Object.entries(config.upstreamSettings)) {
    let type = fields.get(key)
    if (type && /^\w+$/.test(type) && !['boolean', 'string'].includes(type)) {
      type = types.match(new RegExp(`export type ${type} = ([^\\r\\n]+)`))?.[1]?.trim()
    }
    const valid = type === 'boolean' ? typeof value === 'boolean'
      : type === 'string' ? typeof value === 'string'
      : type === 'string[]' ? Array.isArray(value) && value.every(v => typeof v === 'string')
      : type && /^'[^']+'(?: \| '[^']+')*$/.test(type) ? type.split(' | ').map(v => v.slice(1, -1)).includes(value)
      : false
    // Runtime-derived platform and mutable per-tweet state are not preferences.
    if (!valid || ['version', 'mutedQuotes'].includes(key)) throw new Error(`Invalid or unsupported upstream setting: ${key}`)
  }
}
