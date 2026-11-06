import {test} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {validateConfig} from '../scripts/config.mjs'
const types = fs.readFileSync(new URL('../../types.d.ts', import.meta.url), 'utf8')
test('validates supported upstream preferences against upstream types', () => {
  validateConfig({settings: {textOnly: true}, upstreamSettings: {hideGrokNav: true, retweets: 'hide', hideQuotesFrom: ['example']}}, types)
  for (const upstreamSettings of [{typo:true}, {hideGrokNav:'true'}, {retweets:'invalid'}, {hideQuotesFrom:[1]}, {version:'desktop'}]) {
    assert.throws(() => validateConfig({settings:{},upstreamSettings},types))
  }
  assert.throws(() => validateConfig({settings:{textOnly:1},upstreamSettings:{}},types))
})
function storage(overrides = {}) {
  const data = {hideGrokNav:false, enabled:true, personalTextOnly:true}
  const listeners = new Set()
  const chrome = {storage: {onChanged: {addListener: fn=>listeners.add(fn),removeListener:fn=>listeners.delete(fn)}, local: {
    get(keys, cb) {
      cb(keys == null ? {...data} : typeof keys === 'object' && !Array.isArray(keys) ? {...keys,...Object.fromEntries(Object.keys(keys).filter(k=>k in data).map(k=>[k,data[k]]))} : Object.fromEntries((Array.isArray(keys)?keys:[keys]).filter(k=>k in data).map(k=>[k,data[k]])))
    },
    set(changes,cb) { Object.assign(data,changes); cb?.() },
  }}}
  const context = vm.createContext({chrome,cpftPersonal:{upstreamSettings:overrides}})
  vm.runInContext(fs.readFileSync(new URL('../storage.js', import.meta.url), 'utf8'),context)
  return {adapter:context.cpftStorage,data,emit:(changes,area='local')=>{for(const fn of listeners)fn(changes,area)},listeners}
}
test('Nix wins on reads without overwriting saved settings; unrelated settings remain mutable', () => {
  const {adapter,data}=storage({hideGrokNav:true})
  adapter.local.get(values=>assert.equal(values.hideGrokNav,true))
  adapter.local.get({enabled:false},values=>assert.deepEqual(Object.keys(values),['enabled']))
  adapter.local.set({hideGrokNav:true,enabled:false})
  assert.equal(data.hideGrokNav,false)
  assert.equal(data.enabled,false)
  // Removing the override restores the retained browser preference.
  storage().adapter.local.get(values=>assert.equal(values.hideGrokNav,false))
})
test('change listeners filter other storage areas, managed fields and personal settings; unsubscribe works', () => {
  const {adapter,emit,listeners}=storage({hideGrokNav:true})
  let events=[]
  const listener=changes=>events.push(changes)
  adapter.onChanged.addListener(listener)
  adapter.onChanged.addListener(listener)
  emit({enabled:{newValue:false}},'sync')
  emit({hideGrokNav:{newValue:false},personalTextOnly:{newValue:false}})
  assert.equal(events.length,0)
  emit({enabled:{newValue:false},hideGrokNav:{newValue:false}})
  assert.deepEqual(Object.keys(events[0]),['enabled'])
  adapter.onChanged.removeListener(listener)
  assert.equal(listeners.size,0)
})
