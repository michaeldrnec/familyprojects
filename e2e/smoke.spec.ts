import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

// The game list, read from the registry's source so this file doesn't pull
// every game's code into the Node-side type check.
const registry = readFileSync(new URL('../src/projects.ts', import.meta.url), 'utf-8')
const projects = [...registry.matchAll(/slug: '([^']+)',\n\s+title: '([^']+)'/g)].map(([, slug, title]) => ({ slug, title }))

// Fails the test on any uncaught exception or console error.
function watchErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  return errors
}

test('homepage lists every game', async ({ page }) => {
  expect(projects.length).toBeGreaterThan(10)
  const errors = watchErrors(page)
  await page.goto('/')
  for (const p of projects) await expect(page.locator(`a[href="/${p.slug}"]`).first()).toBeVisible()
  expect(errors).toEqual([])
})

for (const p of projects) {
  test(`${p.title} loads without errors`, async ({ page }) => {
    const errors = watchErrors(page)
    await page.goto(`/${p.slug}`)
    await expect(page).toHaveTitle(new RegExp(p.title))
    await expect(page.locator('.site-loading')).toHaveCount(0, { timeout: 15_000 })
    await expect(page.getByText("This game didn't load")).toHaveCount(0)
    await expect(page.locator('main')).not.toBeEmpty()
    // Give the game a moment to start its loops and effects.
    await page.waitForTimeout(500)
    expect(errors).toEqual([])
    // A canvas whose backing store keeps resizing is cleared every frame
    // and looks blank, so its size must hold steady.
    const sizes = new Set<string>()
    for (let i = 0; i < 4; i++) {
      sizes.add(await page.evaluate(() => [...document.querySelectorAll('canvas')].map((c) => `${c.width}x${c.height}`).join(',')))
      await page.waitForTimeout(100)
    }
    expect(sizes.size).toBe(1)
    // Full-screen games fill the whole width under the header.
    const widths = await page.evaluate(() => {
      const main = document.querySelector('.site-main.is-fullscreen')
      return main?.firstElementChild ? [main.clientWidth, main.firstElementChild.getBoundingClientRect().width] : null
    })
    if (widths) expect(Math.round(widths[1])).toBe(widths[0])
  })
}

test('unknown pages show a 404 with a way home', async ({ page }) => {
  await page.goto('/no-such-game')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
  await page.getByRole('link', { name: 'Back to all games' }).click()
  await expect(page).toHaveURL('/')
})

test('players can add a profile and switch between profiles', async ({ page }) => {
  await page.goto('/')
  await page.getByTitle('Switch player').click()
  await page.getByRole('button', { name: '+ Add player' }).click()
  await page.getByLabel('Name').fill('Robin')
  await page.getByRole('button', { name: 'Add and play' }).click()
  await expect(page.getByTitle('Switch player')).toContainText('🦊')
  await page.getByTitle('Switch player').click()
  await page.getByRole('button', { name: 'Player 1', exact: true }).click()
  await expect(page.getByTitle('Switch player')).toContainText('🙂')
})

test('the header mute button is remembered across visits', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Mute all games' }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Unmute all games' })).toBeVisible()
})

// Leaving mid-game (switching tabs or apps) must leave the game paused.
const pausing = [
  { slug: 'starwarden', start: 'Launch' },
  { slug: 'solar-ward', start: 'Launch' },
  { slug: 'xenofuse', start: 'Start Defusal' },
  { slug: 'graveyard-patch', start: 'Clock in' },
  { slug: 'haunt-and-seek', start: 'Start haunting' },
]
for (const g of pausing) {
  test(`${g.slug} pauses when the player leaves`, async ({ page }) => {
    await page.goto(`/${g.slug}`)
    await page.getByRole('button', { name: g.start }).click()
    await page.evaluate(() => window.dispatchEvent(new Event('blur')))
    await expect(page.getByText('Paused', { exact: false }).first()).toBeVisible()
    await page.getByRole('button', { name: 'Resume' }).click()
    await expect(page.getByRole('button', { name: 'Resume' })).toHaveCount(0)
  })
}
