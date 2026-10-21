/* eslint-disable no-console */
import { spawn } from "node:child_process";
import { WebSocket } from "ws";

const PORT = 3001;

async function runAudit() {
  console.log("Launching headless chrome for performance and layout audit...");
  const chrome = spawn("google-chrome", [
    "--headless=new",
    "--remote-debugging-port=9224",
    "--disable-gpu",
    "--no-sandbox",
    "--hide-scrollbars",
    "--host-resolver-rules=MAP *.localhost 127.0.0.1, MAP localhost 127.0.0.1",
  ]);

  await new Promise((r) => setTimeout(r, 1500));

  try {
    const vResp = await fetch("http://127.0.0.1:9224/json/version");
    const vData = await vResp.json();
    const browserWs = new WebSocket(vData.webSocketDebuggerUrl);
    await new Promise((resolve) => browserWs.on("open", resolve));

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

    const { targetId } = await send(browserWs, "Target.createTarget", { url: "about:blank" });
    const ws = new WebSocket(`ws://127.0.0.1:9224/devtools/page/${targetId}`);
    await new Promise((resolve) => ws.on("open", resolve));

    await send(ws, "Page.enable");
    await send(ws, "Network.enable");
    await send(ws, "Performance.enable");

    // Set mobile viewport 375x812
    await send(ws, "Emulation.setDeviceMetricsOverride", {
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      mobile: true,
    });

    // 1. Measure transferred bytes by category on /discover
    const resources = {
      Script: 0,
      Stylesheet: 0,
      Image: 0,
      Font: 0,
      Document: 0,
      Other: 0,
    };

    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.method === "Network.responseReceived") {
        const type = msg.params.type;
        const length = msg.params.response.encodedDataLength || 0;
        if (resources[type] !== undefined) {
          resources[type] += length;
        } else {
          resources.Other += length;
        }
      }
    });

    console.log("Navigating to http://localhost:3001/discover (mobile 375px)...");
    await send(ws, "Page.navigate", { url: `http://localhost:${PORT}/discover` });
    await new Promise((r) => setTimeout(r, 4000));

    // Get Web Vitals (LCP, CLS, FCP) via PerformanceObserver
    const vitalsResult = await send(ws, "Runtime.evaluate", {
      expression: `(() => {
        return new Promise((resolve) => {
          let lcp = 0;
          let cls = 0;
          let fcp = 0;

          const poLcp = new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries();
            if (entries.length > 0) lcp = entries[entries.length - 1].startTime;
          });
          try { poLcp.observe({ type: 'largest-contentful-paint', buffered: true }); } catch (e) {}

          const poCls = new PerformanceObserver((entryList) => {
            for (const entry of entryList.getEntries()) {
              if (!entry.hadRecentInput) cls += entry.value;
            }
          });
          try { poCls.observe({ type: 'layout-shift', buffered: true }); } catch (e) {}

          const paintEntries = performance.getEntriesByType('paint');
          const fcpEntry = paintEntries.find((e) => e.name === 'first-contentful-paint');
          if (fcpEntry) fcp = fcpEntry.startTime;

          setTimeout(() => {
            resolve({ lcp, cls, fcp });
          }, 1000);
        });
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });

    console.log("\n=======================================================");
    console.log("     ARIFDROP MOBILE PERFORMANCE METRICS (375px)       ");
    console.log("=======================================================");
    const vitals = vitalsResult.result.value || {};
    console.log(`LCP (Largest Contentful Paint) : ${(vitals.lcp / 1000).toFixed(2)}s`);
    console.log(`FCP (First Contentful Paint)   : ${(vitals.fcp / 1000).toFixed(2)}s`);
    console.log(`CLS (Cumulative Layout Shift)  : ${vitals.cls.toFixed(4)}`);

    console.log("\n--- Transferred Bytes on /discover ---");
    let totalBytes = 0;
    for (const [cat, bytes] of Object.entries(resources)) {
      totalBytes += bytes;
      console.log(`${cat.padEnd(12)}: ${(bytes / 1024).toFixed(1)} KB`);
    }
    console.log(`Total Transferred: ${(totalBytes / 1024).toFixed(1)} KB`);

    // 2. Smoke layout checks: en, am, pseudo at 375px
    console.log("\n=======================================================");
    console.log("     LAYOUT SMOKE CHECK (375px: EN, AM, PSEUDO)        ");
    console.log("=======================================================");

    const locales = ["en", "am", "pseudo"];
    for (const loc of locales) {
      await send(ws, "Network.setCookie", {
        name: "locale",
        value: loc,
        domain: "localhost",
        path: "/",
      });

      await send(ws, "Page.navigate", { url: `http://localhost:${PORT}/discover` });
      await new Promise((r) => setTimeout(r, 2500));

      const layoutEval = await send(ws, "Runtime.evaluate", {
        expression: `(() => {
          const scrollWidth = document.documentElement.scrollWidth;
          const clientWidth = document.documentElement.clientWidth;
          const overflow = scrollWidth > clientWidth;

          // Find any elements sticking out beyond 375px
          const overflowingElements = [];
          document.querySelectorAll('*').forEach((el) => {
            const rect = el.getBoundingClientRect();
            if (rect.right > clientWidth + 2) {
              overflowingElements.push({
                tag: el.tagName,
                className: el.className?.toString?.().slice(0, 50) || '',
                right: rect.right,
              });
            }
          });

          return { scrollWidth, clientWidth, overflow, overflowingCount: overflowingElements.length };
        })()`,
        returnByValue: true,
      });

      const res = layoutEval.result.value;
      const status = res.overflow ? "FAIL (Horizontal overflow)" : "PASS (No horizontal overflow)";
      console.log(
        `Locale: ${loc.padEnd(8)} | ScrollWidth: ${res.scrollWidth}px (Client: ${res.clientWidth}px) | ${status}`,
      );
    }

    browserWs.close();
  } finally {
    chrome.kill();
  }
}

runAudit().catch((err) => {
  console.error("Audit error:", err);
  process.exit(1);
});
