// Capture README screenshots of a running instance using the locally installed Edge.
// Usage: BASE_URL=http://localhost:3000 SLUG=la-80 node scripts/screenshots.mjs
// Note: the last step makes a real booking; cancel it afterwards from the panel.
import { chromium } from "playwright-core";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const slug = process.env.SLUG ?? "la-80";
const out = "docs";

const browser = await chromium.launch({ channel: "msedge" });

async function shoot(name, viewport, steps) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2, locale: "es-CO" });
  await steps(page);
  await page.screenshot({ path: `${out}/${name}.png` });
  await page.close();
}

await shoot("home", { width: 1280, height: 760 }, async (page) => {
  await page.goto(base);
});

await shoot("booking", { width: 1280, height: 900 }, async (page) => {
  await page.goto(`${base}/b/${slug}`);
  await page.getByRole("button", { name: /Corte \+ barba/ }).click();
  await page.getByRole("button", { name: "Mañana" }).click();
  await page
    .getByRole("button", { name: /a\. m\.$/ })
    .first()
    .waitFor();
});

await shoot("booking-mobile", { width: 390, height: 844 }, async (page) => {
  await page.goto(`${base}/b/${slug}`);
  await page.getByRole("button", { name: /Corte de cabello/ }).click();
  await page.getByRole("button", { name: "Mañana" }).click();
  await page
    .getByRole("button", { name: /p\. m\.$/ })
    .first()
    .click();
  await page.getByLabel("Nombre").fill("Laura Gómez");
  await page.getByLabel("Celular").fill("300 123 4567");
  await page.getByRole("button", { name: "Confirmar reserva" }).click();
  await page.getByText("¡Tu cita quedó reservada!").waitFor();
});

await browser.close();
console.log("Saved screenshots to", out);
