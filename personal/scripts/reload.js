// Executed by Playwriter, in a dedicated session owned by twitter-personal-dev.
const identity = __TWITTER_PERSONAL_IDENTITY__
if (!state.extensions || state.extensions.isClosed()) {
  state.extensions = await context.newPage()
  await state.extensions.goto('chrome://extensions/', {waitUntil:'domcontentloaded'})
}
await state.extensions.evaluate(async id => {
  const installed = await chrome.developerPrivate.getExtensionsInfo({includeDisabled:true})
  if (!installed.some(extension => extension.id === id)) throw new Error('Personal extension is not installed; load the stable directory in chrome://extensions first')
  const error = await chrome.developerPrivate.reload(id, {failQuietly:true,populateErrorForUnpacked:true})
  if (error) throw new Error(JSON.stringify(error))
}, identity.id)
console.log(await getLatestLogs({page:state.extensions,sinceLastCall:true}))
if (!state.twitter || state.twitter.isClosed()) {
  state.twitter = await context.newPage()
  await state.twitter.goto('https://x.com/home', {waitUntil:'domcontentloaded'})
} else {
  await state.twitter.reload({waitUntil:'domcontentloaded'})
}
await state.twitter.locator('article[data-testid="tweet"]').first().waitFor({timeout:15000})
console.log(await snapshot({page:state.twitter,search:/Show media|Hide media|Log in|Something went wrong/}))
console.log(await getLatestLogs({page:state.twitter,sinceLastCall:true}))
