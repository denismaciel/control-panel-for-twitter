import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'
import {spawnSync} from 'node:child_process'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const output = process.env.TWITTER_PERSONAL_OUTPUT || path.join(os.homedir(),'.local/share/twitter-personal')
const config = process.env.TWITTER_PERSONAL_CONFIG || path.join(os.homedir(),'.config/twitter-personal/config.json')
const endpoint = process.env.TWITTER_PERSONAL_CDP || '127.0.0.1:9226'
function run(command,args,options={}) {
  const result=spawnSync(command,args,{cwd:root,encoding:'utf8',...options})
  if(result.status!==0) throw new Error(result.stderr || result.stdout || result.error?.message || `${command} failed`)
  return result.stdout
}
let session
if (!process.argv.includes('--build-only')) {
  const result=run('playwriter',['session','new','--direct',endpoint])
  session=result.match(/Session (\S+) created/)?.[1]
  if(!session) throw new Error(result)
}
function build() {
  console.log(run(process.execPath,['--test',...fs.readdirSync(path.join(root,'personal/tests')).filter(n=>n.endsWith('.test.mjs')).map(n=>'personal/tests/'+n)]))
  console.log(run(process.execPath,['personal/scripts/build.mjs',output,...(fs.existsSync(config)?[config]:[])]))
  if(session) {
    const code=fs.readFileSync(path.join(root,'personal/scripts/reload.js'),'utf8').replace('__TWITTER_PERSONAL_IDENTITY__',fs.readFileSync(path.join(root,'personal/identity.json'),'utf8')).replace('__TWITTER_PERSONAL_BROWSER_TEST__',JSON.stringify(pathToFileURL(path.join(root,'personal/tests/browser.mjs')).href))
    console.log(run('playwriter',['-s',session,'--timeout','30000','-e',code]))
  }
}
build()
if (!process.argv.includes('--once') && !process.argv.includes('--build-only')) {
  let timer
  fs.watch(root,{recursive:true},(_,name)=>{
    if(!name || /^(\.git|\.scratch|node_modules|web-ext-artifacts)\//.test(name))return
    clearTimeout(timer)
    timer=setTimeout(()=>{try{build()}catch(error){console.error(error.message)}},250)
  })
  console.log(`Watching ${root}; edit, save, inspect the Twitter test tab. Ctrl-C stops the watcher.`)
}
