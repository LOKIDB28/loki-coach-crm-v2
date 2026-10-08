import { test, expect, type Page } from "@playwright/test";

/**
 * Anti-drift guard for globals.css's two dark-mode blocks (system-media and
 * manual [data-theme="dark"]) - see the comments linking them there. They're
 * hand-duplicated on purpose (no CSS custom-property-based de-dup exists for
 * a media-query-guarded block vs an attribute selector), so nothing catches
 * a future edit to one without the other except this test. Runs against
 * /login - no auth, no app data, same page login.spec.ts uses.
 */

const TOKENS = ["--bg", "--surface", "--surface-2", "--border", "--text", "--text-soft", "--amber-banner-text"];

async function readTokens(page: Page) {
  return page.evaluate((tokens) => {
    const cs = getComputedStyle(document.documentElement);
    return Object.fromEntries(tokens.map((t) => [t, cs.getPropertyValue(t).trim()]));
  }, TOKENS);
}

async function setUp(page: Page, colorScheme: "light" | "dark", dataTheme: "light" | "dark" | null) {
  await page.emulateMedia({ colorScheme });
  await page.goto("/login");
  await page.evaluate((dataTheme) => {
    if (dataTheme) document.documentElement.setAttribute("data-theme", dataTheme);
    else document.documentElement.removeAttribute("data-theme");
  }, dataTheme);
  // Re-apply after navigation settles - attribute set before goto wouldn't
  // survive the navigation; the sequence above (goto then set) is correct.
  return readTokens(page);
}

test("system-dark (no stored choice) computes identically to manual data-theme=dark", async ({ page }) => {
  const systemDark = await setUp(page, "dark", null);
  const manualDark = await setUp(page, "light", "dark");

  expect(manualDark).toEqual(systemDark);
});

test("system-light (no stored choice) computes identically to manual data-theme=light", async ({ page }) => {
  const systemLight = await setUp(page, "light", null);
  const manualLight = await setUp(page, "dark", "light");

  expect(manualLight).toEqual(systemLight);
});
