import puppeteer from 'puppeteer-core'
import { readFileSync } from 'node:fs'

const BASE = 'http://localhost:8080/dev/GymBuddy/'
const MAIL_LOG = '/tmp/gymtest/dev/GymBuddy/api/data/mail.log'
const EMAIL = `e2e_${Date.now()}@test.com`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const code = (email) => readFileSync(MAIL_LOG, 'utf8').trim().split('\n').filter((l) => l.includes(`to=${email}`)).at(-1).match(/code=(\d{6})/)[1]

const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--no-sandbox'] })
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()) })

const step = async (name, fn) => { try { await fn(); console.log('  ✓', name) } catch (e) { console.log('  ✗', name, '\n     ', e.message); throw e } }
const click = async (t) => {
  await page.waitForFunction((x) => [...document.querySelectorAll('button,a')].some((el) => el.textContent.trim().includes(x)), { timeout: 6000 }, t)
  await page.evaluate((x) => [...document.querySelectorAll('button,a')].find((el) => el.textContent.trim().includes(x)).click(), t)
}
const type = async (sel, val) => { await page.waitForSelector(sel, { visible: true }); await page.type(sel, val) }
const has = (t) => page.evaluate((x) => document.body.textContent.includes(x), t)
const gotoHash = async (hash) => { await page.evaluate((h) => { location.hash = h }, hash); await sleep(400) }

// Run one exercise to completion (handles all 3 types); fills any finish-panel numbers.
async function runOneExercise() {
  await page.waitForFunction(() => document.body.textContent.includes('Start'), { timeout: 6000 })
  await click('▶  Start'); await sleep(400)
  for (let i = 0; i < 14; i++) {
    if (await has('Log this exercise')) break
    if (await has('■  Done')) { await click('■  Done'); await sleep(300); break }
    if (await page.evaluate(() => [...document.querySelectorAll('button')].some((b) => /Next step|^Done$/.test(b.textContent.trim())))) {
      await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /Next step|^Done$/.test(b.textContent.trim())).click()); await sleep(220)
    } else await sleep(220)
  }
  await page.waitForFunction(() => document.body.textContent.includes('Log this exercise'), { timeout: 6000 })
  // fill numeric capture fields (weight / distance / calories / custom / time)
  await page.evaluate(() => document.querySelectorAll('.field input[type=number]').forEach((i, idx) => { if (i.value === '') i.value = String(7 + idx) }))
  await page.evaluate(() => { const b = document.querySelectorAll('.effort-btn')[6]; if (b) b.click() })
  await click('Save & continue'); await sleep(400)
}

try {
  await step('login', async () => {
    await page.goto(BASE, { waitUntil: 'networkidle0' })
    await page.waitForFunction(() => location.hash.includes('login'))
    await type('input[type=email]', EMAIL)
    await click('Send me a code'); await page.waitForSelector('input[autocomplete="one-time-code"]', { visible: true }); await sleep(300)
    await type('input[autocomplete="one-time-code"]', code(EMAIL))
    await click('Verify & sign in'); await page.waitForFunction(() => location.hash === '#/')
  })

  await step('create REPS exercise (default routine)', async () => {
    await gotoHash('#/exercises/new')
    await type('input', 'Leg Press')
    await page.waitForFunction(() => document.querySelectorAll('.step-row').length >= 3)
    await click('Save exercise')
    await page.waitForFunction(() => location.hash === '#/exercises' && document.body.textContent.includes('Leg Press'))
  })

  await step('create TIMED exercise (1 min, default metrics)', async () => {
    await gotoHash('#/exercises/new')
    await type('input', 'Indoor Cycling')
    await page.select('select[name=type]', 'timed'); await sleep(300)
    await page.evaluate(() => { document.querySelectorAll('input[type=number]')[0].value = '1' })
    await page.waitForFunction(() => document.querySelectorAll('.metric-row').length >= 2) // Distance + Calories defaults
    await click('Save exercise')
    await page.waitForFunction(() => location.hash === '#/exercises' && document.body.textContent.includes('Indoor Cycling'))
  })

  await step('create TARGET exercise with CUSTOM metric "Floors climbed"', async () => {
    await gotoHash('#/exercises/new')
    await type('input', 'Stair Machine')
    await page.select('select[name=type]', 'target'); await sleep(300)
    await page.evaluate(() => { document.querySelectorAll('input[type=number]')[0].value = '30' })
    await click('+ Custom')   // add a custom metric row
    await sleep(200)
    await page.evaluate(() => { const rows = document.querySelectorAll('.metric-row'); const last = rows[rows.length - 1].querySelector('input'); last.value = 'Floors climbed'; last.dispatchEvent(new Event('input', { bubbles: true })) })
    await click('Save exercise')
    await page.waitForFunction(() => location.hash === '#/exercises' && document.body.textContent.includes('Stair Machine'))
  })

  await step('edit REPS exercise: form is PRE-FILLED, history-safe', async () => {
    await page.evaluate(() => [...document.querySelectorAll('a')].find((a) => a.textContent.includes('Leg Press')).click())
    await page.waitForFunction(() => document.body.textContent.includes('Edit exercise'))
    // the name field must be populated, not blank
    const nameVal = await page.evaluate(() => document.querySelector('input')?.value)
    if (nameVal !== 'Leg Press') throw new Error(`edit form not populated (name="${nameVal}")`)
    await page.evaluate(() => { const w = [...document.querySelectorAll('input[type=number]')].find(Boolean); if (w) { w.value = '85' } })
    await click('Save exercise')
    await page.waitForFunction(() => location.hash === '#/exercises')
  })

  await step('build a workout with all three', async () => {
    await gotoHash('#/workouts/new')
    await type('input[name=name]', 'Full Session')
    await page.waitForFunction(() => [...document.querySelectorAll('button')].filter((b) => b.textContent.includes('+ add')).length >= 3)
    for (let i = 0; i < 3; i++) { await click('+ add'); await sleep(200) }
    await click('Save workout')
    await page.waitForFunction(() => location.hash === '#/workouts' && document.body.textContent.includes('Full Session'))
  })

  await step('run workout: any-order picker, all three', async () => {
    await click('▶ Run')
    await page.waitForFunction(() => document.body.textContent.includes('In this workout'))
    for (const nm of ['Indoor Cycling', 'Leg Press', 'Stair Machine']) {
      await page.evaluate((n) => [...document.querySelectorAll('.card')].find((c) => c.textContent.includes(n)).click(), nm)
      await runOneExercise()
      await page.waitForFunction(() => document.body.textContent.includes('In this workout'))
    }
    await click('Finish & save session')
    await page.waitForFunction(() => document.body.textContent.includes('Save & finish'))
    await click('Save & finish')
    await page.waitForFunction(() => location.hash === '#/history' && document.body.textContent.includes('Full Session'))
  })

  await step('pause & resume works mid-exercise', async () => {
    await gotoHash('#/run')
    await page.waitForFunction(() => document.body.textContent.includes('Choose an exercise'))
    await page.evaluate(() => [...document.querySelectorAll('.card')].find((c) => c.textContent.includes('Leg Press')).click())
    await page.waitForFunction(() => document.body.textContent.includes('Start')); await click('▶  Start')
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent.includes('Pause')))
    await click('Pause')
    const frozen = await page.evaluate(() => document.querySelector('#tnum')?.textContent)
    await sleep(1300)
    const still = await page.evaluate(() => document.querySelector('#tnum')?.textContent)
    if (frozen !== still) throw new Error(`paused timer advanced: ${frozen} -> ${still}`)
    await click('Resume')
    // resuming shows a get-ready countdown with a "Resume now" skip
    await page.waitForFunction(() => document.body.textContent.includes('Resuming') || document.body.textContent.includes('Get ready'))
    await click('Resume now')
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent.includes('Pause')))
    await gotoHash('#/'); await sleep(200)   // leave the run cleanly for the next step
  })

  await step('QUICK session (on the fly) logs an exercise', async () => {
    await gotoHash('#/run')
    await page.waitForFunction(() => document.body.textContent.includes('Choose an exercise'))
    await page.evaluate(() => [...document.querySelectorAll('.card')].find((c) => c.textContent.includes('Leg Press')).click())
    await runOneExercise()
    await page.waitForFunction(() => document.body.textContent.includes('exercise') && document.body.textContent.includes('Finish'))
    await click('Finish')
    await page.waitForFunction(() => document.body.textContent.includes('Workout complete'))
    await click('Save & finish')
    await page.waitForFunction(() => location.hash === '#/history')
  })

  await step('LEGACY string-format metrics still label + save (no crash)', async () => {
    // Simulate an exercise created by the previous build (metrics as strings).
    await page.evaluate(async () => {
      const t = localStorage.getItem('gymbuddy.token')
      await fetch('/dev/GymBuddy/api/exercises', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify({ name: 'Old Bike', type: 'timed', default_duration_secs: 30, metrics: ['distance', 'calories'] }) })
    })
    await gotoHash('#/run'); await page.waitForFunction(() => document.body.textContent.includes('Choose an exercise'))
    await page.evaluate(() => [...document.querySelectorAll('.card')].find((c) => c.textContent.includes('Old Bike')).click())
    await page.waitForFunction(() => document.body.textContent.includes('Start')); await click('▶  Start')
    for (let i = 0; i < 14; i++) { if (await has('Log this exercise')) break; if (await page.evaluate(() => [...document.querySelectorAll('button')].some((b) => /^Done$/.test(b.textContent.trim())))) { await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /^Done$/.test(b.textContent.trim())).click()) } await sleep(250) }
    await page.waitForFunction(() => document.body.textContent.includes('Log this exercise'))
    // labels must be present (the legacy bug rendered them blank)
    const labels = await page.evaluate(() => [...document.querySelectorAll('.field label')].map((l) => l.textContent))
    if (!labels.some((l) => /Distance/i.test(l))) throw new Error('legacy metric label missing: ' + JSON.stringify(labels))
    await page.evaluate(() => document.querySelectorAll('.field input[type=number]').forEach((i) => { if (i.value === '') i.value = '5' }))
    await page.evaluate(() => { const b = document.querySelectorAll('.effort-btn')[5]; if (b) b.click() })
    await click('Save & continue'); await sleep(300)   // must not crash
    await page.waitForFunction(() => document.body.textContent.includes('Finish & save'))
    await click('Finish & save'); await page.waitForFunction(() => document.body.textContent.includes('Save & finish'))
    await click('Save & finish'); await page.waitForFunction(() => location.hash === '#/history')
  })

  await step('CSV export has Effort + custom "Floors climbed" columns', async () => {
    const csv = await page.evaluate(async () => {
      const t = localStorage.getItem('gymbuddy.token')
      return (await fetch('/dev/GymBuddy/api/export.csv?token=' + encodeURIComponent(t))).text()
    })
    if (!csv.includes('Effort')) throw new Error('no Effort column')
    if (!csv.includes('Floors climbed')) throw new Error('no custom metric column')
  })

  console.log('\nALL E2E STEPS PASSED')
} finally {
  const real = errors.filter((e) => !e.includes('favicon') && !e.includes('manifest'))
  if (real.length) console.log('\nBROWSER ERRORS:\n' + real.join('\n'))
  await browser.close()
  if (real.length) process.exitCode = 2
}
