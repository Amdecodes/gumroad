/* eslint-disable no-console, no-undef */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { WebSocket } from "ws";

const PHASE = process.argv.includes("--after") ? "after" : "before";
const PORT = 3001;

async function getCookiesForUser(email, password) {
  const loginUrl = `http://app.localhost:${PORT}/login`;
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
  { name: "discover", url: `http://localhost:${PORT}/discover`, auth: "none" },
  { name: "product_page", url: `http://localhost:${PORT}/l/demo`, auth: "none" },
  { name: "library", url: `http://app.localhost:${PORT}/library`, auth: "seller" },
  { name: "seller_dashboard", url: `http://app.localhost:${PORT}/dashboard`, auth: "seller" },
  { name: "products_list", url: `http://app.localhost:${PORT}/products`, auth: "seller" },
  { name: "admin_overview", url: `http://app.localhost:${PORT}/admin`, auth: "admin" },
  { name: "login", url: `http://app.localhost:${PORT}/login`, auth: "none" },
];

const LOCALES = ["en", "am"];
const THEMES = ["light", "dark"];
const VIEWPORTS = [
  { name: "1280px", width: 1280, height: 800, mobile: false },
  { name: "375px", width: 375, height: 812, mobile: true },
];

async function main() {
  console.log(`Starting screenshot capture for phase: [${PHASE}]...`);
  const outDir = path.resolve(`docs/design/screenshots/${PHASE}`);
  fs.mkdirSync(outDir, { recursive: true });

  console.log("Authenticating test accounts...");
  const sellerCookies = await getCookiesForUser("seller@gumroad.com", "password");
  const adminCookies = await getCookiesForUser("admin@gumroad.com", "password");
  console.log("Authentication successful.");

  const chrome = spawn("google-chrome", [
    "--headless=new",
    "--remote-debugging-port=9222",
    "--disable-gpu",
    "--no-sandbox",
    "--hide-scrollbars",
    "--host-resolver-rules=MAP *.localhost 127.0.0.1, MAP localhost 127.0.0.1",
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
    await send(targetWs, "Network.enable");

    for (const page of PAGES) {
      console.log(`Capturing page: ${page.name}`);
      for (const locale of LOCALES) {
        for (const theme of THEMES) {
          for (const vp of VIEWPORTS) {
            const filename = `${page.name}_${locale}_${theme}_${vp.name}.png`;
            const filepath = path.join(outDir, filename);

            if (fs.existsSync(filepath) && fs.statSync(filepath).size > 1000) {
              process.stdout.write("s");
              continue;
            }

            // Configure viewport
            await send(targetWs, "Emulation.setDeviceMetricsOverride", {
              width: vp.width,
              height: vp.height,
              deviceScaleFactor: 1,
              mobile: vp.mobile,
            });

            // Configure theme
            await send(targetWs, "Emulation.setEmulatedMedia", {
              features: [{ name: "prefers-color-scheme", value: theme }],
            });

            // Clear and set cookies
            await send(targetWs, "Network.clearBrowserCookies");

            const domains = ["localhost", "app.localhost", "seller.localhost"];
            for (const d of domains) {
              await send(targetWs, "Network.setCookie", {
                name: "locale",
                value: locale,
                domain: d,
                path: "/",
              });
            }

            let authCookieSource = null;
            if (page.auth === "seller") authCookieSource = sellerCookies;
            else if (page.auth === "admin") authCookieSource = adminCookies;

            if (authCookieSource) {
              for (const [k, v] of Object.entries(authCookieSource)) {
                if (k !== "locale") {
                  for (const d of domains) {
                    await send(targetWs, "Network.setCookie", {
                      name: k,
                      value: v,
                      domain: d,
                      path: "/",
                    });
                  }
                }
              }
            }

            // Navigate
            const targetUrl = `${page.url}?locale=${locale}`;
            await send(targetWs, "Page.navigate", { url: targetUrl });
            // Allow hydration & rendering
            await new Promise((r) => setTimeout(r, 3000));

            const { data } = await send(targetWs, "Page.captureScreenshot", { format: "png" });
            fs.writeFileSync(filepath, Buffer.from(data, "base64"));
            process.stdout.write(".");
          }
        }
      }
      console.log(` done!`);
    }

    targetWs.close();
    ws.close();
  } finally {
    chrome.kill();
  }
  console.log(`\nSuccessfully captured all screenshots for [${PHASE}] in ${outDir}`);
}

main().catch((err) => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});
