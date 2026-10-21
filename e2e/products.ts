/**
 * E2E smoke test for the products CRUD flow:
 * create → filter → edit first row → verify the new description.
 *
 * Requires the dev server with authentication off:
 *   AUTH_DISABLED="1" in .env, then `bun run dev:wrangler` (app on :8787).
 *
 * Run with:  bun run e2e
 * Options:   E2E_BASE_URL=http://localhost:8787  E2E_HEADLESS=0 (watch the browser)
 */
import assert from 'node:assert/strict'
import { chromium, type Page } from 'playwright'

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:8787'
const HEADLESS = process.env.E2E_HEADLESS !== '0'

const name = `pw-${Date.now().toString(36)}`
const originalDescription = 'Created by the Playwright e2e script'
const updatedDescription = `Updated by the Playwright e2e script ${Date.now().toString(36)}`

const row = (page: Page, text: string) => page.locator('table.table tbody tr', { hasText: text }).first()
const rowCells = (page: Page, text: string) => row(page, text).locator('td')

function step(message: string) {
  console.log(`\n— ${message}`)
}

async function waitFor(condition: () => Promise<boolean>, what: string, timeout = 10_000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (await condition()) return
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out after ${timeout}ms waiting for: ${what}`)
}

async function expectFlash(page: Page, message: string) {
  const flash = page.locator('.flash-success.flash--visible span')
  await flash.waitFor({ state: 'visible' })
  assert.equal((await flash.textContent())?.trim(), message)
}

async function filterByName(page: Page, searchText: string) {
  await page.fill('#search-element', searchText)
  await waitFor(async () => (await row(page, searchText).isVisible()), `row for "${searchText}" in the list`)
}

async function main() {
  const browser = await chromium.launch({ headless: HEADLESS })
  const page = await browser.newPage()
  page.setDefaultTimeout(15_000)

  try {
    step(`Open ${BASE_URL}/products`)
    await page.goto(`${BASE_URL}/products`)
    if (new URL(page.url()).pathname.startsWith('/auth/login')) {
      throw new Error(
        'Redirected to the login page: authentication is still on. '
        + 'Set AUTH_DISABLED="1" in .env and restart `bun run dev:wrangler`.',
      )
    }
    await page.locator('.page-header').waitFor().catch(() => {
      throw new Error(
        'The page did not hydrate. In dev mode the app is served by Vite on :5173 — '
        + 'run `bun dev` (wrangler + Vite) with AUTH_DISABLED="1" in .env.',
      )
    })
    await page.locator('table.table').waitFor()

    step(`Add product "${name}"`)
    await page.click('.form-actions a[href="/products/new"]')
    await page.fill('#edit-name', name)
    await page.fill('#edit-description', originalDescription)
    await page.fill('#edit-price', '12.34')
    await page.click('button.btn.btn-primary:has-text("Create")')
    await page.waitForURL(`${BASE_URL}/products`)
    await expectFlash(page, 'Product created successfully')

    step(`Filter the list on "${name}"`)
    await filterByName(page, name)
    await waitFor(
      async () => (await page.locator('table.table tbody tr').count()) === 1,
      'the filter to narrow the list to the new product only',
    )

    step('Edit the first row and change the description')
    await row(page, name).locator('a.btn.btn-warning.btn-xs').click()
    await page.waitForURL(/\/products\/\d+\/edit$/)
    assert.equal(await page.inputValue('#edit-name'), name, 'the edit form must show the filtered product')
    await page.fill('#edit-description', updatedDescription)
    await page.click('button.btn.btn-primary:has-text("Save")')
    await page.waitForURL(`${BASE_URL}/products`)
    await expectFlash(page, 'Product updated successfully')

    step('Verify the new description is shown in the list')
    await waitFor(async () => (await row(page, name).isVisible()), 'the product row after saving')
    const description = (await rowCells(page, name).nth(1).innerText()).replace(/\s+/g, ' ').trim()
    assert.equal(description, updatedDescription, 'the list must show the updated description')
    assert.equal(await page.locator('table.table tbody tr').count(), 1, 'the filter must still be applied')
    assert.equal((await rowCells(page, name).nth(0).innerText()).trim(), name)

    console.log('\nPASS: created, filtered, edited and verified the updated description.')
  } finally {
    await cleanup(page).catch(error => console.warn(`Cleanup skipped: ${(error as Error).message}`))
    await browser.close()
  }
}

/** Best-effort removal of the product created by this run. */
async function cleanup(page: Page) {
  await page.goto(`${BASE_URL}/products`)
  await page.fill('#search-element', name)
  await waitFor(async () => (await row(page, name).isVisible()), `row for "${name}" to delete`)
  await row(page, name).locator('a.btn.btn-danger.btn-xs').click()
  await page.waitForURL(/\/products\/\d+\/delete$/)
  await page.click('button.btn.btn-danger:has-text("Delete")')
  await page.waitForURL(`${BASE_URL}/products`)
  await waitFor(async () => !(await row(page, name).isVisible()), 'the product to disappear from the list')
}

main().catch((error) => {
  console.error(`\nFAIL: ${(error as Error).message}`)
  process.exitCode = 1
})
