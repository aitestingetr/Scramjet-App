"use strict";

const form = document.getElementById("sj-form");
const address = document.getElementById("sj-address");
const searchEngine = document.getElementById("sj-search-engine");
const error = document.getElementById("sj-error");
const errorCode = document.getElementById("sj-error-code");
const evrNewtab = document.getElementById("evr-newtab");
const evrFrameWrap = document.getElementById("evr-frame-wrap");
const tabNew = document.getElementById("tab-new");
const tabList = document.querySelector(".tab-list");
const omniboxText = document.getElementById("chrome-omnibox-text");

const { ScramjetController } = $scramjetLoadController();

const scramjet = new ScramjetController({
  files: {
    wasm: "/scram/scramjet.wasm.wasm",
    all: "/scram/scramjet.all.js",
    sync: "/scram/scramjet.sync.js",
  },
});

scramjet.init();

const connection = new BareMux.BareMuxConnection("/baremux/worker.js");

/* ----- Tab + viewport helpers ----- */

function showNewTab() {
  evrNewtab.classList.remove("hidden");
  evrFrameWrap.style.display = "none";
  document.querySelectorAll(".tab").forEach((t) => {
    t.classList.toggle("active", t.id === "tab-new");
  });
  if (omniboxText) omniboxText.textContent = "EVR Proxy • powered by Scramjet";
}

function showPageTab(label, url) {
  evrNewtab.classList.add("hidden");
  evrFrameWrap.style.display = "block";
  document.querySelectorAll(".tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.tab === "page");
  });
  const pageTab = document.getElementById("tab-page");
  if (pageTab) pageTab.querySelector(".tab-label").textContent = label;
  if (omniboxText) omniboxText.textContent = url || label;
}

function addPageTab(label, url) {
  const existing = document.getElementById("tab-page");
  if (existing) {
    existing.querySelector(".tab-label").textContent = label;
    showPageTab(label, url);
    return;
  }
  const tab = document.createElement("div");
  tab.id = "tab-page";
  tab.className = "tab active";
  tab.dataset.tab = "page";
  tab.title = label;
  tab.innerHTML = `
    <span class="tab-label">${label}</span>
    <button class="tab-close" aria-label="Close" tabindex="-1">×</button>
  `;
  tabList.insertBefore(tab, tabList.querySelector(".tab-add"));
  tabNew.classList.remove("active");
  tab.querySelector(".tab-close").addEventListener("click", (e) => {
    e.stopPropagation();
    goBackToNewTab();
  });
  tab.addEventListener("click", () => showPageTab(label, url));
  showPageTab(label, url);
}

function goBackToNewTab() {
  const frame = document.getElementById("sj-frame");
  if (frame) frame.remove();
  const tabPage = document.getElementById("tab-page");
  if (tabPage) tabPage.remove();
  showNewTab();
}

tabNew.addEventListener("click", () => goBackToNewTab());

document.querySelector(".tab-add").addEventListener("click", () => {
  goBackToNewTab();
  address.focus();
});

/* ----- Proxy submit ----- */

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    await registerSW();
  } catch (err) {
    error.textContent = "Failed to register service worker.";
    errorCode.textContent = err.toString();
    throw err;
  }

  const url = search(address.value, searchEngine.value);

  let label;
  try {
    label = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    label = "Page";
  }

  addPageTab(label, url);

  let wispUrl =
    (location.protocol === "https:" ? "wss" : "ws") +
    "://" +
    location.host +
    "/wisp/";
  if ((await connection.getTransport()) !== "/libcurl/index.mjs") {
    await connection.setTransport("/libcurl/index.mjs", [
      { websocket: wispUrl },
    ]);
  }

  const frameWrap = document.getElementById("evr-frame-wrap");
  const frame = scramjet.createFrame();
  frame.frame.id = "sj-frame";
  frameWrap.appendChild(frame.frame);
  frame.go(url);
});

/* ----- EVR UI: clock ----- */

(function () {
  const clockEl = document.getElementById("evr-clock");
  if (clockEl) {
    const updateClock = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, "0");
      const mins = now.getMinutes().toString().padStart(2, "0");
      clockEl.textContent = `${hours}:${mins}`;
    };
    updateClock();
    setInterval(updateClock, 30000);
  }
})();

/* ----- EVR UI: real battery ----- */

(function () {
  const batteryFill = document.getElementById("evr-battery-fill");
  const batteryText = document.getElementById("evr-battery-text");
  const batteryCharging = document.getElementById("evr-battery-charging");

  if (!batteryFill || !batteryText) return;

  function applyLevel(level, charging) {
    const pct = Math.round(level * 100);
    batteryFill.style.width = `${pct}%`;
    batteryText.textContent = `${pct}%`;

    batteryFill.classList.remove("battery-green", "battery-yellow", "battery-red");
    if (pct <= 20) batteryFill.classList.add("battery-red");
    else if (pct <= 55) batteryFill.classList.add("battery-yellow");
    else batteryFill.classList.add("battery-green");

    if (batteryCharging) {
      batteryCharging.textContent = charging ? " ⚡" : "";
    }
  }

  if (navigator.getBattery) {
    navigator.getBattery().then((battery) => {
      applyLevel(battery.level, battery.charging);
      battery.addEventListener("levelchange", () =>
        applyLevel(battery.level, battery.charging)
      );
      battery.addEventListener("chargingchange", () =>
        applyLevel(battery.level, battery.charging)
      );
    }).catch(() => {
      batteryText.textContent = "—";
      batteryFill.style.width = "100%";
    });
  } else {
    batteryText.textContent = "—";
    batteryFill.style.width = "100%";
  }
})();
