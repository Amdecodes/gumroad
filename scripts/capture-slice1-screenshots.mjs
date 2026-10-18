/* eslint-disable no-console, no-undef */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { WebSocket } from "ws";

const PORT = 3001;
const outDir = path.resolve("docs/design/screenshots/slice1");
fs.mkdirSync(outDir, { recursive: true });

const LOCALES = ["en", "am"];
const THEMES = ["light", "dark"];
const VIEWPORTS = [
  { name: "1280px", width: 1280, height: 800, mobile: false },
  { name: "375px", width: 375, height: 812, mobile: true },
];

async function main() {
  console.log("Launching headless chrome...");
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

    // Warm-up request to let Vite and Rails finish compiling
    await send(targetWs, "Page.navigate", { url: `http://localhost:${PORT}/discover?locale=en` });
    await new Promise((r) => setTimeout(r, 5000));

    for (const locale of LOCALES) {
      for (const theme of THEMES) {
        for (const vp of VIEWPORTS) {
          const filename = `discover_${locale}_${theme}_${vp.name}.png`;
          const filepath = path.join(outDir, filename);

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

          // Set cookies
          await send(targetWs, "Network.clearBrowserCookies");
          await send(targetWs, "Network.setCookie", {
            name: "locale",
            value: locale,
            domain: "localhost",
            path: "/",
          });

          // Navigate to Discover
          const targetUrl = `http://localhost:${PORT}/discover?locale=${locale}`;
          await send(targetWs, "Page.navigate", { url: targetUrl });

          // Wait for DOM readiness
          for (let i = 0; i < 20; i++) {
            await new Promise((r) => setTimeout(r, 500));
            try {
              const res = await send(targetWs, "Runtime.evaluate", {
                expression: "Boolean(document.querySelector('h1') && document.querySelector('header'))",
                returnByValue: true,
              });
              if (res.result?.value) break;
            } catch (_) {}
          }
          await new Promise((r) => setTimeout(r, 1000));

          const { data } = await send(targetWs, "Page.captureScreenshot", { format: "png" });
          fs.writeFileSync(filepath, Buffer.from(data, "base64"));
          console.log(`Captured: ${filename} (${fs.statSync(filepath).size} bytes)`);
        }
      }
    }

    targetWs.close();
    ws.close();
  } finally {
    chrome.kill();
  }
  console.log(`\nSuccessfully captured Slice 1 screenshots in ${outDir}`);
}

main().catch((err) => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});
