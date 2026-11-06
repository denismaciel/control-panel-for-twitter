import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {validateConfig} from './config.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const output = path.resolve(process.argv[2] || path.join(root, '.scratch/extension'))
if (output === root || root.startsWith(output + path.sep)) throw new Error('Output must not contain the source checkout')
const config = process.argv[3] ? JSON.parse(fs.readFileSync(process.argv[3], 'utf8')) : {settings: {}, upstreamSettings: {}}
validateConfig(config, fs.readFileSync(path.join(root, 'types.d.ts'), 'utf8'))
fs.mkdirSync(output, {recursive: true})
for (const name of ['_locales', 'icons', 'options.css', 'options-icon.png', 'script.js', 'LICENSE', 'NOTICE', 'personal/storage.js', 'personal/text-only.js', 'personal/options.js']) {
  fs.mkdirSync(path.dirname(path.join(output, name)), {recursive: true})
  fs.cpSync(path.join(root, name), path.join(output, name), {recursive: true})
}
fs.writeFileSync(path.join(output, 'personal/config.js'), `globalThis.cpftPersonal = ${JSON.stringify(config)}\n`)
// Keep upstream sources byte-for-byte intact. Guard every integration seam so an
// upstream change requires review instead of silently dropping Nix enforcement.
for (const [name, expected] of [['content.js', 5], ['options.js', 7], ['background.js', 2]]) {
  let source = fs.readFileSync(path.join(root, name), 'utf8')
  const count = (source.match(/chrome\.storage/g) || []).length
  if (count !== expected) throw new Error(`${name}: storage integration changed (${count} vs ${expected}); review upstream`)
  source = source.replaceAll('chrome.storage', 'globalThis.cpftStorage')
  if (name === 'content.js') {
    const hook = /^      globalThis\.cpftStorage\.onChanged\.addListener\(onConfigChange\)/gm
    if ([...source.matchAll(hook)].length !== 1) throw new Error('Page configuration bridge changed; review upstream')
    source = source.replace(hook, `$&
      // Restore declared values if the page's own UI tries to change them.
      const enforced = Object.fromEntries(Object.keys(event.data.changes)
        .filter(key => Object.hasOwn(globalThis.cpftPersonal.upstreamSettings, key))
        .map(key => [key, {newValue: globalThis.cpftPersonal.upstreamSettings[key]}]))
      if (Object.keys(enforced).length) onConfigChange(enforced)`)
  }
  if (name === 'background.js') source = `import './personal/config.js'\nimport './personal/storage.js'\n${source}`
  fs.writeFileSync(path.join(output, name), source)
}
let options = fs.readFileSync(path.join(root, 'options.html'), 'utf8')
const hook = '<script src="options.js"></script>'
if (options.split(hook).length !== 2) throw new Error('Options script integration changed; review upstream')
options = options.replace(hook, '<script src="personal/config.js"></script>\n  <script src="personal/storage.js"></script>\n  ' + hook + '\n  <script src="personal/options.js"></script>')
fs.writeFileSync(path.join(output, 'options.html'), options)
fs.writeFileSync(path.join(output, 'browser_action.html'), options.replace('<body>', '<body class="browserAction">'))
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.mv3.json'), 'utf8'))
if (manifest.content_scripts.length !== 1 || JSON.stringify(manifest.content_scripts[0].js) !== '["content.js"]') throw new Error('Content script integration changed; review upstream')
manifest.name = 'Control Panel for Twitter · Personal'
manifest.key = JSON.parse(fs.readFileSync(path.join(root, 'personal/identity.json'), 'utf8')).key
manifest.content_scripts[0].js = ['personal/config.js', 'personal/storage.js', 'content.js', 'personal/text-only.js']
fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(output)
