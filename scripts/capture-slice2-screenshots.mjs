/* eslint-disable no-console, no-undef */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { WebSocket } from "ws";

const PORT = 3001;
const outDir = path.resolve("docs/design/screenshots/slice2");
fs.mkdirSync(outDir, { recursive: true });

const artifactScreenshotsDir = "/home/amde/.gemini/antigravity-cli/brain/1f665419-62ae-4722-bbd2-fd07f8bb0a23/screenshots";
fs.mkdirSync(artifactScreenshotsDir, { recursive: true });

async function getCookiesForUser(email, password) {
  const loginUrl = `http://127.0.0.1:${PORT}/login`;
  const getResp = await fetch(loginUrl, { headers: { Host: `app.localhost:${PORT}` } });
  const html = await getResp.text();
  const csrfMatch = html.match(/csrf-token" content="([^"]+)"/u);
  if (!csrfMatch) throw new Error("Could not find CSRF token");
  const csrf = csrfMatch[1];

  const rawCookies = getResp.headers.getSetCookie ? getResp.headers.getSetCookie() : [];
  const cookieHeader = rawCookies.map((c) => c.split(";")[0]).join("; ");

  const body = new URLSearchParams({
    authenticity_token: csrf,
    "user[login_identifier]": email,
    "user[password]": password,
  }).toString();

  const postResp = await fetch(loginUrl, {
    method: "POST",
    headers: {
      Host: `app.localhost:${PORT}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookieHeader,
    },
    body,
    redirect: "manual",
  });

  const newCookies = postResp.headers.getSetCookie ? postResp.headers.getSetCookie() : [];
  const allCookies = [...rawCookies, ...newCookies];
  const cookieMap = {};
  for (const c of allCookies) {
    const parts = c.split(";")[0].split("=");
    if (parts.length >= 2) {
      cookieMap[parts[0].trim()] = parts.slice(1).join("=").trim();
    }
  }
  return cookieMap;
}

const PAGES = [
  {
    name: "product_page",
    url: (locale) => `http://seller.localhost:${PORT}/l/demo?locale=${locale}`,
    auth: "none",
  },
  {
    name: "storefront",
    url: (locale) => `http://seller.localhost:${PORT}/?locale=${locale}`,
    auth: "none",
  },
  {
    name: "library",
    url: (locale) => `http://app.localhost:${PORT}/library?locale=${locale}`,
    auth: "seller",
  },
];

const LOCALES = ["en", "am"];
const THEMES = ["light", "dark"];
const VIEWPORTS = [
  { name: "1280px", width: 1280, height: 800, mobile: false },
  { name: "375px", width: 375, height: 812, mobile: true },
];

async function main() {
  console.log("Authenticating test accounts...");
  const sellerCookies = await getCookiesForUser("seller@gumroad.com", "password");
  console.log("Seller auth OK. Cookies:", Object.keys(sellerCookies).join(", "));

  console.log("Launching headless chrome...");
  const chrome = spawn("google-chrome", [
    "--headless=new",
    "--remote-debugging-port=9222",
    "--disable-gpu",
    "--no-sandbox",
    "--hide-scrollbars",
    "--host-resolver-rules=MAP * 127.0.0.1",
  ]);

  await new Promise((r) => setTimeout(r, 1500));

  try {
    const vResp = await fetch("http://127.0.0.1:9222/json/version");
    const vData = await vResp.json();
    const ws = new WebSocket(vData.webSocketDebuggerUrl);
    await new Promise((resolve) => ws.on("open", resolve));

    let msgId = 1;
    function send(targetWs, method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = msgId++;
        const handler = (data) => {
          const res = JSON.parse(data.toString());
          if (res.id === id) {
            targetWs.off("message", handler);
            if (res.error) reject(new Error(res.error.message));
            else resolve(res.result);
          }
        };
        targetWs.on("message", handler);
        targetWs.send(JSON.stringify({ id, method, params }));
      });
    }

    const { targetId } = await send(ws, "Target.createTarget", { url: "about:blank" });
    const targetWs = new WebSocket(`ws://127.0.0.1:9222/devtools/page/${targetId}`);
    await new Promise((resolve) => targetWs.on("open", resolve));

    await send(targetWs, "Page.enable");
    await send(targetWs, "Runtime.enable");
    await send(targetWs, "Network.enable");

    // Warm-up request
    await send(targetWs, "Page.navigate", { url: `http://seller.localhost:${PORT}/l/demo?locale=en` });
    await new Promise((r) => setTimeout(r, 3000));

    let totalCaptured = 0;

    for (const page of PAGES) {
      for (const locale of LOCALES) {
        for (const theme of THEMES) {
          for (const vp of VIEWPORTS) {
            const filename = `${page.name}_${locale}_${theme}_${vp.name}.png`;
            const filepath = path.join(outDir, filename);
            const artifactFilepath = path.join(artifactScreenshotsDir, filename);

            console.log(`[${++totalCaptured}/24] Capturing: ${filename}...`);

            // Viewport
            await send(targetWs, "Emulation.setDeviceMetricsOverride", {
              width: vp.width,
              height: vp.height,
              deviceScaleFactor: 1,
              mobile: vp.mobile,
            });

            // Theme
            await send(targetWs, "Emulation.setEmulatedMedia", {
              features: [{ name: "prefers-color-scheme", value: theme }],
            });

            // Cookies
            await send(targetWs, "Network.clearBrowserCookies");

            // Set locale cookie for domains
            for (const d of ["localhost", "seller.localhost", "app.localhost"]) {
              await send(targetWs, "Network.setCookie", {
                name: "locale",
                value: locale,
                url: `http://${d}:${PORT}`,
              });
            }

            if (page.auth === "seller") {
              for (const [name, value] of Object.entries(sellerCookies)) {
                for (const d of ["app.localhost", "localhost"]) {
                  await send(targetWs, "Network.setCookie", {
                    name,
                    value,
                    url: `http://${d}:${PORT}`,
                  });
                }
              }
            }

            // Navigate
            const targetUrl = page.url(locale);
            await send(targetWs, "Page.navigate", { url: targetUrl });

            // Wait for DOM readiness, asset fetching and font rendering
            await new Promise((r) => setTimeout(r, 3500));

            // Force theme classes to align with media preference
            await send(targetWs, "Runtime.evaluate", {
              expression: `
                if ("${theme}" === "dark") {
                  document.documentElement.classList.add("dark");
                  document.documentElement.classList.remove("light");
                  document.body.classList.add("dark");
                  document.body.classList.remove("light");
                } else {
                  document.documentElement.classList.add("light");
                  document.documentElement.classList.remove("dark");
                  document.body.classList.add("light");
                  document.body.classList.remove("dark");
                }
              `,
            });
            await new Promise((r) => setTimeout(r, 500));

            // Screenshot without fromSurface
            const result = await send(targetWs, "Page.captureScreenshot", {
              format: "png",
              captureBeyondViewport: false,
            });

            const buf = Buffer.from(result.data, "base64");
            fs.writeFileSync(filepath, buf);
            fs.writeFileSync(artifactFilepath, buf);
            console.log(`Saved: ${filename} (${(buf.length / 1024).toFixed(1)} KB)`);
          }
        }
      }
    }

    console.log("All 24 Slice 2 screenshots captured successfully!");
  } finally {
    chrome.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error("Screenshot capture error:", err);
  process.exit(1);
});
