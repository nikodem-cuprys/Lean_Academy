import { test, expect } from "@playwright/test";
import { prisma } from "@lean-academy/db";

// Verifies the i18n card in docs/kanban.md (English, Polish, Spanish,
// German, French, Simplified Chinese) end to end in a real browser:
// Accept-Language detection, the language switcher's NEXT_LOCALE cookie,
// and User.locale persistence following the account to a device that
// has no cookie yet. Key-set parity across the six message files is
// enforced at compile time instead (src/i18n/messages-parity.ts).

test.describe("Locale detection", () => {
  test("a Polish browser gets the Polish UI and <html lang>", async ({ browser }) => {
    const context = await browser.newContext({ locale: "pl-PL" });
    const page = await context.newPage();
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Witaj ponownie" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "pl");
    await context.close();
  });

  test("a Simplified Chinese browser gets the Chinese UI", async ({ browser }) => {
    const context = await browser.newContext({ locale: "zh-CN" });
    const page = await context.newPage();
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "欢迎回来" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
    await context.close();
  });

  test("a Traditional Chinese browser falls back to English rather than Simplified", async ({ browser }) => {
    const context = await browser.newContext({ locale: "zh-TW" });
    const page = await context.newPage();
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await context.close();
  });
});

test.describe("Language switcher", () => {
  test("switching on the login page re-renders in that language and remembers it", async ({ page, context }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();

    await page.getByTestId("language-switcher").selectOption("de");
    await expect(page.getByRole("heading", { name: "Willkommen zurück" })).toBeVisible();

    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === "NEXT_LOCALE")?.value).toBe("de");

    await page.reload();
    await expect(page.getByRole("heading", { name: "Willkommen zurück" })).toBeVisible();
  });

  test("the switcher lists every language by its own name", async ({ page }) => {
    await page.goto("/login");
    const options = await page.getByTestId("language-switcher").locator("option").allTextContents();
    expect(options).toEqual(["English", "Polski", "Español", "Deutsch", "Français", "简体中文"]);
  });
});

test.describe("Account language", () => {
  const email = `e2e-i18n-${Date.now()}@example.com`;
  const password = "correcthorsebattery123";

  test.afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
  });

  test("signup saves the language in use, the switcher updates it, and a new device picks it up", async ({ browser }) => {
    // Device 1: pick French before signing up.
    const device1 = await browser.newContext({ locale: "en-US" });
    const page1 = await device1.newPage();
    await page1.goto("/signup");
    await page1.getByTestId("language-switcher").selectOption("fr");
    await expect(page1.getByRole("heading", { name: "Créez votre compte" })).toBeVisible();

    await page1.getByPlaceholder("Nom").fill("E2E Bot");
    await page1.getByPlaceholder("E-mail").fill(email);
    await page1.getByPlaceholder("Mot de passe").fill(password);
    await page1.getByRole("button", { name: "Créer un compte" }).click();
    await expect(page1).toHaveURL("/");
    await expect(page1.getByRole("heading", { name: /Bon retour/ })).toBeVisible();

    const afterSignup = await prisma.user.findUnique({ where: { email }, select: { locale: true } });
    expect(afterSignup?.locale).toBe("fr");

    // Switch to Spanish from the signed-in settings screen — saved on the account.
    await page1.goto("/settings/exercises");
    await page1.getByTestId("language-switcher").selectOption("es");
    await expect(page1.getByRole("heading", { name: "Personalizar ejercicios" })).toBeVisible();
    await expect
      .poll(async () => (await prisma.user.findUnique({ where: { email }, select: { locale: true } }))?.locale)
      .toBe("es");
    await device1.close();

    // Device 2: an English browser with no NEXT_LOCALE cookie. The login
    // page is English (nobody is signed in yet); after login the account's
    // saved Spanish takes over.
    const device2 = await browser.newContext({ locale: "en-US" });
    const page2 = await device2.newPage();
    await page2.goto("/login");
    await expect(page2.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await page2.getByPlaceholder("Email").fill(email);
    await page2.getByPlaceholder("Password").fill(password);
    await page2.locator("form").getByRole("button", { name: "Log in" }).click();
    await expect(page2).toHaveURL("/");
    await expect(page2.getByRole("heading", { name: /Hola de nuevo/ })).toBeVisible();
    await expect(page2.locator("html")).toHaveAttribute("lang", "es");
    await device2.close();
  });
});
