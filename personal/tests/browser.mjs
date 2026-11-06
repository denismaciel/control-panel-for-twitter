import fs from 'node:fs'
import assert from 'node:assert/strict'
export async function run({context}) {
  const page = await context.newPage()
  try {
    await page.goto('about:blank')
    await page.setContent(`<main>
      <div data-testid="tweetTextarea_0"><img alt="composer" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"></div>
      <article data-testid="tweet"><a href="/test/status/1"><time>Now</time></a>
        <div data-testid="Tweet-User-Avatar"><img alt="avatar"></div>
        <div data-testid="tweetText">Hello <a href="https://example.com">world</a></div>
        <div data-testid="tweetPhoto"><img alt="photo"></div>
        <div data-testid="videoComponent"><div data-testid="videoPlayer"><video></video></div></div>
        <div data-testid="card.wrapper"><img alt="preview"><a href="https://example.com">Article headline</a></div>
        <div role="link"><div data-testid="tweetText">Quoted text</div><div data-testid="tweetPhoto"><img alt="quote photo"></div></div>
        <div role="group"><button>Reply</button></div>
      </article>
    </main>`)
    await page.evaluate(() => {
      globalThis.fixtureState={enabled:true,personalTextOnly:true,listeners:[]}
      globalThis.cpftPersonal={settings:{},upstreamSettings:{}}
      globalThis.cpftStorage={local:{get:(defaults,cb)=>cb({...defaults,enabled:fixtureState.enabled})}}
      globalThis.chrome={storage:{local:{get:(defaults,cb)=>cb({...defaults,personalTextOnly:fixtureState.personalTextOnly})},onChanged:{addListener:fn=>fixtureState.listeners.push(fn)}}}
    })
    await page.evaluate(fs.readFileSync(new URL('../text-only.js',import.meta.url),'utf8'))
    const toggle=page.getByRole('button',{name:'Show media',exact:true})
    await toggle.waitFor()
    assert.equal(await page.getByAltText('photo',{exact:true}).isVisible(),false)
    assert.equal(await page.getByAltText('quote photo').isVisible(),false)
    assert.equal(await page.locator('[data-testid=videoPlayer]').isVisible(),false)
    assert.equal(await page.getByAltText('preview').isVisible(),false)
    assert.equal(await page.getByText('Quoted text').isVisible(),true)
    assert.equal(await page.getByRole('link',{name:'Article headline'}).last().isVisible(),true)
    assert.equal(await page.getByAltText('avatar').isVisible(),true)
    assert.equal(await page.getByAltText('composer').isVisible(),true)
    await toggle.click()
    await page.getByRole('button',{name:'Hide media'}).waitFor()
    assert.equal(await page.getByAltText('photo',{exact:true}).isVisible(),true)
    // A recycled tweet must not inherit the previous tweet's reveal state.
    await page.locator('time').evaluate(el=>el.parentElement.setAttribute('href','/test/status/2'))
    await page.locator('[data-testid="tweetText"]').first().evaluate(el=>el.textContent='Replacement tweet')
    await toggle.waitFor()
    assert.equal(await page.getByAltText('photo',{exact:true}).isVisible(),false)
    // An asynchronously inserted media-only tweet remains discoverable.
    await page.locator('main').evaluate(el=>el.insertAdjacentHTML('beforeend','<article data-testid="tweet"><a href="/test/status/3"><time>Now</time></a><div data-testid="tweetPhoto"><img alt="dynamic photo"></div></article>'))
    await page.getByRole('button',{name:'Show media',exact:true}).nth(1).waitFor()
    assert.equal(await page.getByAltText('dynamic photo').isVisible(),false)
    await page.evaluate(()=>{fixtureState.enabled=false;fixtureState.listeners.forEach(fn=>fn({},'local'))})
    await page.getByRole('button',{name:'Show media',exact:true}).first().waitFor({state:'detached'})
    assert.equal(await page.getByAltText('dynamic photo').isVisible(),true)
    await page.evaluate(()=>{fixtureState.enabled=true;fixtureState.personalTextOnly=false;fixtureState.listeners.forEach(fn=>fn({},'local'))})
    assert.equal(await page.getByAltText('photo',{exact:true}).isVisible(),true)
    await page.evaluate(()=>{cpftPersonal.settings.textOnly=true;fixtureState.listeners.forEach(fn=>fn({},'local'))})
    await page.getByRole('button',{name:'Show media',exact:true}).first().waitFor()
    assert.equal(await page.getByAltText('photo',{exact:true}).isVisible(),false)
    return 'PASS: photos, video containers, preview imagery, quotes, text/links/avatar/composer preservation, reveal, recycled nodes, dynamic media-only tweets, disable/restore, Nix override'
  } finally { await page.close() }
}
