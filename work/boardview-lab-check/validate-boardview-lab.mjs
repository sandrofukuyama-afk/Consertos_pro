import fs from "node:fs/promises";
import path from "node:path";

import { chromium, devices } from "playwright";
import { createClient } from "@supabase/supabase-js";

const PROJECT_ROOT = "C:/Users/User/Projetos_Antigravity/Consertos_pro";
const BOARD_PATH =
  "Z:/raid/Servidor/HDD4/Esquemas_Apple/macbook_proA1706/X362 MLB SCHEMATIC 820-00239.brd";
const APP_URL = "http://127.0.0.1:3011/boardview/lab";
const OUTPUT_DIR = path.join(PROJECT_ROOT, "work", "boardview-lab-check");
const STORAGE_STATE_PATH = path.join(OUTPUT_DIR, "boardview-auth-state.json");
const COOKIE_CHUNK_SIZE = 3180;

function parseDotEnv(raw) {
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }
  return env;
}

async function loadEnv() {
  const envPath = path.join(PROJECT_ROOT, ".env.local");
  const raw = await fs.readFile(envPath, "utf8");
  const parsed = parseDotEnv(raw);

  const url = parsed.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = parsed.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = parsed.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !publishableKey || !serviceRoleKey) {
    throw new Error("Supabase environment variables are missing.");
  }

  return { url, publishableKey, serviceRoleKey };
}

async function resolvePrimaryEmail(url, serviceRoleKey) {
  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let page = 1;

  while (page <= 5) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) {
      throw error;
    }

    const user = data.users.find(
      (entry) => entry.id.startsWith("7dfb5ac1") && entry.email?.toLowerCase().endsWith("@gmail.com"),
    );

    if (user?.email) {
      return { admin, email: user.email };
    }

    if (!data.users.length) {
      break;
    }

    page += 1;
  }

  throw new Error("Primary Sandro account not found.");
}

function createCookieChunks(name, value) {
  const encodedValue = encodeURIComponent(value);

  if (encodedValue.length <= COOKIE_CHUNK_SIZE) {
    return [{ name, value }];
  }

  const chunks = [];
  let remaining = encodedValue;

  while (remaining.length > 0) {
    let encodedChunkHead = remaining.slice(0, COOKIE_CHUNK_SIZE);
    const lastEscapePos = encodedChunkHead.lastIndexOf("%");

    if (lastEscapePos > COOKIE_CHUNK_SIZE - 3) {
      encodedChunkHead = encodedChunkHead.slice(0, lastEscapePos);
    }

    let valueHead = "";

    while (encodedChunkHead.length > 0) {
      try {
        valueHead = decodeURIComponent(encodedChunkHead);
        break;
      } catch (error) {
        if (
          error instanceof URIError &&
          encodedChunkHead.at(-3) === "%" &&
          encodedChunkHead.length > 3
        ) {
          encodedChunkHead = encodedChunkHead.slice(0, encodedChunkHead.length - 3);
          continue;
        }

        throw error;
      }
    }

    chunks.push(valueHead);
    remaining = remaining.slice(encodedChunkHead.length);
  }

  return chunks.map((chunk, index) => ({ name: `${name}.${index}`, value: chunk }));
}

function getSupabaseCookieName(url) {
  const projectRef = new URL(url).hostname.split(".")[0];
  return `sb-${projectRef}-auth-token`;
}

async function createSession(admin, url, publishableKey, email) {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: APP_URL,
    },
  });

  const emailOtp = data.properties?.email_otp;

  if (error || !emailOtp) {
    throw error ?? new Error("Magic link could not be generated.");
  }

  const client = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const verification = await client.auth.verifyOtp({
    email,
    token: emailOtp,
    type: "magiclink",
  });

  if (verification.error || !verification.data.session) {
    throw verification.error ?? new Error("OTP verification did not return a session.");
  }

  return verification.data.session;
}

async function authenticate(url, session) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const cookieName = getSupabaseCookieName(url);
  const cookieValue = `base64-${Buffer.from(JSON.stringify(session), "utf8").toString("base64url")}`;
  const cookies = createCookieChunks(cookieName, cookieValue).map((cookie) => ({
    ...cookie,
    url: "http://127.0.0.1:3011",
    httpOnly: false,
    sameSite: "Lax",
  }));

  console.log("auth:start");
  await context.addCookies(cookies);
  const page = await context.newPage();
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForURL("**/boardview/lab", { timeout: 30000 });
  await context.storageState({ path: STORAGE_STATE_PATH });
  await browser.close();
  console.log("auth:done");
}

async function openBoardview(page) {
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.locator('input[type="file"]').setInputFiles(BOARD_PATH);
  await page.getByText("Componentes:", { exact: false }).waitFor({ timeout: 120000 });
  await page.getByText("Detalhamento tecnico", { exact: false }).waitFor({ timeout: 120000 });
}

async function clickNetSearchResult(page, netName) {
  const button = page
    .locator("button")
    .filter({ hasText: new RegExp(`^${netName}\\d+ pads`, "i") })
    .first();
  await button.waitFor({ timeout: 30000 });
  await button.click();
}

async function validateDesktop() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    storageState: STORAGE_STATE_PATH,
  });
  const page = await context.newPage();

  console.log("desktop:start");
  await openBoardview(page);

  const zoomBefore = await page
    .locator("text=Zoom")
    .locator("..")
    .locator("p")
    .nth(1)
    .textContent();

  await page.getByPlaceholder("Buscar referencia ou net").fill("U1900");
  await page.getByRole("button", { name: /U1900/i }).first().click();
  await page.getByText("Referencia: U1900").waitFor({ timeout: 30000 });
  await page.getByText("Pads/pinos do componente").waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: /Net ligada:/i }).first().waitFor({ timeout: 30000 });

  const zoomAfterComponent = await page
    .locator("text=Zoom")
    .locator("..")
    .locator("p")
    .nth(1)
    .textContent();

  await page.getByPlaceholder("Buscar referencia ou net").fill("GND");
  await clickNetSearchResult(page, "GND");
  await page.getByText("Net: GND").waitFor({ timeout: 30000 });
  await page.getByText("Componentes conectados na net").waitFor({ timeout: 30000 });

  await page.screenshot({
    path: path.join(OUTPUT_DIR, "boardview-lab-desktop.png"),
    fullPage: true,
  });

  await browser.close();
  console.log("desktop:done");

  return {
    zoomBefore,
    zoomAfterComponent,
  };
}

async function validateIpad() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    ...devices["iPad Pro 11"],
    storageState: STORAGE_STATE_PATH,
  });
  const page = await context.newPage();

  console.log("ipad:start");
  await openBoardview(page);

  await page.getByPlaceholder("Buscar referencia ou net").fill("U1900");
  await page.getByRole("button", { name: /U1900/i }).first().click();
  await page.getByText("Referencia: U1900").waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: /Voltar ao componente selecionado/i }).click();

  await page.getByPlaceholder("Buscar referencia ou net").fill("GND");
  await clickNetSearchResult(page, "GND");
  await page.getByText("Net: GND").waitFor({ timeout: 30000 });

  await page.screenshot({
    path: path.join(OUTPUT_DIR, "boardview-lab-ipad.png"),
    fullPage: true,
  });

  await browser.close();
  console.log("ipad:done");
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const { url, publishableKey, serviceRoleKey } = await loadEnv();
  const { admin, email } = await resolvePrimaryEmail(url, serviceRoleKey);
  const session = await createSession(admin, url, publishableKey, email);

  await authenticate(url, session);
  const desktop = await validateDesktop();
  await validateIpad();

  console.log(
    JSON.stringify(
      {
        ok: true,
        desktop,
        screenshots: {
          desktop: path.join(OUTPUT_DIR, "boardview-lab-desktop.png"),
          ipad: path.join(OUTPUT_DIR, "boardview-lab-ipad.png"),
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
