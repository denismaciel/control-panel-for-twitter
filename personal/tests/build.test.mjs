import {test} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
test('built artifact boots configuration/storage in manifest order and has its resources', () => {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'twitter-build-test-'))
  try {
    execFileSync(process.execPath,[fileURLToPath(new URL('../scripts/build.mjs',import.meta.url)),directory])
    const manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'))
    const sandbox=vm.createContext({chrome:{storage:{}}})
    for(const script of manifest.content_scripts[0].js) {
      assert.ok(fs.existsSync(path.join(directory,script)))
      if(script==='content.js') break
      vm.runInContext(fs.readFileSync(path.join(directory,script),'utf8'),sandbox)
    }
    assert.equal(typeof sandbox.cpftStorage.local.get,'function')
    assert.equal(typeof sandbox.cpftPersonal.settings,'object')
    for(const resource of [manifest.background.service_worker,manifest.options_ui.page,manifest.action.default_popup,...manifest.web_accessible_resources.flatMap(r=>r.resources)]) assert.ok(fs.existsSync(path.join(directory,resource)),resource)
  } finally {fs.rmSync(directory,{recursive:true,force:true})}
})
