// Verifies offline logging: queue while offline, auto-sync when back online.
import puppeteer from 'puppeteer-core'
import { readFileSync } from 'node:fs'
const BASE = 'http://localhost:8080/dev/GymBuddy/'
const EMAIL = `off_${Date.now()}@test.com`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const code = (email) => readFileSync('/tmp/gymtest/dev/GymBuddy/api/data/mail.log', 'utf8')
  .trim().split('\n').filter((l) => l.includes(`to=${email}`)).at(-1).match(/code=(\d{6})/)[1]

const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--no-sandbox'] })
const p = await b.newPage()
const click = async (t) => { await p.waitForFunction((x) => [...document.querySelectorAll('button,a')].some((e) => e.textContent.includes(x)), { timeout: 6000 }, t); await p.evaluate((x) => [...document.querySelectorAll('button,a')].find((e) => e.textContent.includes(x)).click(), t) }
const has = (t) => p.evaluate((x) => document.body.textContent.includes(x), t)

try {
  await p.goto(BASE, { waitUntil: 'networkidle0' })
  await p.type('input[type=email]', EMAIL)
  await click('Send me a code'); await p.waitForSelector('input[autocomplete="one-time-code"]', { visible: true }); await sleep(300)
  await p.type('input[autocomplete="one-time-code"]', code(EMAIL))
  await click('Verify & sign in'); await p.waitForFunction(() => location.hash === '#/')

  // make an exercise + workout (online)
  await p.evaluate(() => location.hash = '#/exercises/new'); await sleep(400)
  await p.type('input', 'Plank'); await click('Save exercise'); await p.waitForFunction(() => location.hash === '#/exercises')
  await p.evaluate(() => location.hash = '#/workouts/new'); await sleep(400)
  await p.type('input[name=name]', 'Core'); await click('+ add'); await sleep(200); await click('Save workout')
  await p.waitForFunction(() => location.hash === '#/workouts')

  // GO OFFLINE
  await p.setOfflineMode(true)
  console.log('  ✓ went offline')

  await click('▶ Run')
  await p.waitForFunction(() => document.body.textContent.includes('In this workout'))
  await p.evaluate(() => [...document.querySelectorAll('.card')].find((c) => c.textContent.includes('Plank')).click())
  await p.waitForFunction(() => document.body.textContent.includes('Start'))
  await click('▶  Start'); await sleep(400)
  for (let i = 0; i < 12; i++) {
    if (await has('Log this exercise')) break
    if (await has('■  Done')) { await click('■  Done'); await sleep(300); break }
    if (await p.evaluate(() => [...document.querySelectorAll('button')].some((b) => /Next step|^Done$/.test(b.textContent.trim())))) {
      await p.evaluate(() => [...document.querySelectorAll('button')].find((b) => /Next step|^Done$/.test(b.textContent.trim())).click()); await sleep(250)
    } else await sleep(250)
  }
  await p.waitForFunction(() => document.body.textContent.includes('Log this exercise'))
  await p.evaluate(() => { const b = document.querySelectorAll('.effort-btn')[5]; if (b) b.click() })
  await click('Save & continue'); await sleep(400)
  await p.waitForFunction(() => document.body.textContent.includes('Finish & save'))
  await click('Finish & save'); await p.waitForFunction(() => document.body.textContent.includes('Save & finish'))
  await click('Save & finish'); await sleep(500)

  // Check the on-screen "to sync" badge appeared
  const badgeOffline = await has('to sync')
  console.log(badgeOffline ? '  ✓ session queued offline (sync badge shown)' : '  ✗ no sync badge while offline')

  // GO BACK ONLINE -> should auto-flush
  await p.setOfflineMode(false)
  await p.evaluate(() => window.dispatchEvent(new Event('online')))
  await sleep(1500)
  const badgeGone = !(await has('to sync'))
  console.log(badgeGone ? '  ✓ queue flushed after reconnect (badge gone)' : '  ✗ badge still present after reconnect')

  // Confirm it reached the server (navigate away then back to force a fresh fetch)
  await p.evaluate(() => location.hash = '#/'); await sleep(300)
  await p.evaluate(() => location.hash = '#/history'); await sleep(900)
  const inHistory = await has('Core')
  console.log(inHistory ? '  ✓ synced session visible in history' : '  ✗ session not in history')

  if (badgeOffline && badgeGone && inHistory) console.log('\nOFFLINE SYNC TEST PASSED')
  else { console.log('\nOFFLINE SYNC TEST FAILED'); process.exitCode = 2 }
} finally {
  await b.close()
}
