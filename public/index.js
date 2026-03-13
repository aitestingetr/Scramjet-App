"use strict";

const form = document.getElementById("sj-form");
const address = document.getElementById("sj-address");
const searchEngine = document.getElementById("sj-search-engine");
const error = document.getElementById("sj-error");
const errorCode = document.getElementById("sj-error-code");
const evrNewtab = document.getElementById("evr-newtab");
const evrFrames = document.getElementById("evr-frames");
const tabList = document.getElementById("tab-list");
const tabAddBtn = document.getElementById("tab-add-btn");
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

const tabs = [];
let activeTabId = null;

function createTabId() {
  return "tab-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
}

function getActiveTab() {
  return tabs.find(function (t) {
    return t.id === activeTabId;
  });
}

function addNewTab() {
  const id = createTabId();
  const tab = {
    id: id,
    type: "new",
    label: "New Tab",
    url: null,
    frameWrap: null,
    frameController: null,
  };
  tabs.push(tab);

  const tabEl = document.createElement("div");
  tabEl.className = "tab active";
  tabEl.dataset.tabId = id;
  tabEl.innerHTML =
    '<span class="tab-label">New Tab</span><button class="tab-close" aria-label="Close" type="button">×</button>';

  tabList.insertBefore(tabEl, tabAddBtn);

  tabEl.querySelector(".tab-label").addEventListener("click", function () {
    switchToTab(id);
  });
  tabEl.querySelector(".tab-close").addEventListener("click", function (e) {
    e.stopPropagation();
    closeTab(id);
  });

  switchToTab(id);
  address.value = "";
  address.focus();
  return tab;
}

function closeTab(id) {
  const idx = tabs.findIndex(function (t) {
    return t.id === id;
  });
  if (idx === -1) return;

  const tab = tabs[idx];
  if (tab.frameWrap) tab.frameWrap.remove();

  tabs.splice(idx, 1);
  const tabEl = tabList.querySelector('[data-tab-id="' + id + '"]');
  if (tabEl) tabEl.remove();

  if (activeTabId === id) {
    if (tabs.length > 0) {
      switchToTab(tabs[Math.min(idx, tabs.length - 1)].id);
    } else {
      activeTabId = null;
      evrNewtab.classList.remove("hidden");
      var wraps = evrFrames.querySelectorAll(".frame-wrap");
      for (var i = 0; i < wraps.length; i++) {
        wraps[i].style.display = "none";
      }
      if (omniboxText)
        omniboxText.textContent = "EVR Proxy • powered by Scramjet";
    }
  }
}

function switchToTab(id) {
  activeTabId = id;
  const tab = getActiveTab();
  if (!tab) return;

  var allTabs = document.querySelectorAll(".tab");
  for (var i = 0; i < allTabs.length; i++) {
    allTabs[i].classList.toggle("active", allTabs[i].dataset.tabId === id);
  }

  if (tab.type === "new") {
    evrNewtab.classList.remove("hidden");
    var wraps = evrFrames.querySelectorAll(".frame-wrap");
    for (var j = 0; j < wraps.length; j++) {
      wraps[j].classList.remove("active");
      wraps[j].style.display = "none";
    }
    if (omniboxText)
      omniboxText.textContent = "EVR Proxy • powered by Scramjet";
  } else {
    evrNewtab.classList.add("hidden");
    var frameWraps = evrFrames.querySelectorAll(".frame-wrap");
    for (var k = 0; k < frameWraps.length; k++) {
      var isActive = frameWraps[k].dataset.tabId === id;
      frameWraps[k].classList.toggle("active", isActive);
      frameWraps[k].style.display = isActive ? "block" : "none";
    }
    if (omniboxText) omniboxText.textContent = tab.url || tab.label;
  }
}

function navigateTab(tab, url, label) {
  tab.type = "page";
  tab.url = url;
  tab.label = label;

  const tabEl = tabList.querySelector('[data-tab-id="' + tab.id + '"]');
  if (tabEl) tabEl.querySelector(".tab-label").textContent = label;

  const wrap = document.createElement("div");
  wrap.className = "frame-wrap active";
  wrap.dataset.tabId = tab.id;
  wrap.style.display = "block";
  evrFrames.appendChild(wrap);

  tab.frameWrap = wrap;

  const frame = scramjet.createFrame();
  frame.frame.id = "sj-frame-" + tab.id;
  wrap.appendChild(frame.frame);
  tab.frameController = frame;
  frame.go(url);

  evrNewtab.classList.add("hidden");
  var allWraps = evrFrames.querySelectorAll(".frame-wrap");
  for (var i = 0; i < allWraps.length; i++) {
    allWraps[i].classList.remove("active");
    allWraps[i].style.display =
      allWraps[i].dataset.tabId === tab.id ? "block" : "none";
  }
  if (omniboxText) omniboxText.textContent = url;
}

tabAddBtn.addEventListener("click", function () {
  addNewTab();
});

form.addEventListener("submit", async function (event) {
  event.preventDefault();

  try {
    await registerSW();
  } catch (err) {
    error.textContent = "Failed to register service worker.";
    errorCode.textContent = err.toString();
    throw err;
  }

  const url = search(address.value, searchEngine.value);

  var label;
  try {
    label = new URL(url).hostname.replace(/^www\./, "");
  } catch (e) {
    label = "Page";
  }

  var tab = getActiveTab();
  if (!tab) {
    tab = addNewTab();
  }
  if (tab.type === "new") {
    navigateTab(tab, url, label);
  } else {
    if (tab.frameController) {
      tab.frameController.go(url);
    }
    tab.url = url;
    tab.label = label;
    const tabEl = tabList.querySelector('[data-tab-id="' + tab.id + '"]');
    if (tabEl) tabEl.querySelector(".tab-label").textContent = label;
    if (omniboxText) omniboxText.textContent = url;
  }

  var wispUrl =
    (location.protocol === "https:" ? "wss" : "ws") +
    "://" +
    location.host +
    "/wisp/";
  if ((await connection.getTransport()) !== "/libcurl/index.mjs") {
    await connection.setTransport("/libcurl/index.mjs", [
      { websocket: wispUrl },
    ]);
  }
});

(function () {
  const clockEl = document.getElementById("evr-clock");
  if (clockEl) {
    const updateClock = function () {
      const now = new Date();
      clockEl.textContent =
        now.getHours().toString().padStart(2, "0") +
        ":" +
        now.getMinutes().toString().padStart(2, "0");
    };
    updateClock();
    setInterval(updateClock, 30000);
  }
})();

(function () {
  const batteryFill = document.getElementById("evr-battery-fill");
  const batteryText = document.getElementById("evr-battery-text");
  const batteryCharging = document.getElementById("evr-battery-charging");

  if (!batteryFill || !batteryText) return;

  function applyLevel(level, charging) {
    const pct = Math.round(level * 100);
    batteryFill.style.width = pct + "%";
    batteryText.textContent = pct + "%";

    batteryFill.classList.remove(
      "battery-green",
      "battery-yellow",
      "battery-red"
    );
    if (pct <= 20) batteryFill.classList.add("battery-red");
    else if (pct <= 55) batteryFill.classList.add("battery-yellow");
    else batteryFill.classList.add("battery-green");

    if (batteryCharging) {
      batteryCharging.textContent = charging ? " ⚡" : "";
    }
  }

  if (navigator.getBattery) {
    navigator
      .getBattery()
      .then(function (battery) {
        applyLevel(battery.level, battery.charging);
        battery.addEventListener("levelchange", function () {
          applyLevel(battery.level, battery.charging);
        });
        battery.addEventListener("chargingchange", function () {
          applyLevel(battery.level, battery.charging);
        });
      })
      .catch(function () {
        batteryText.textContent = "—";
        batteryFill.style.width = "100%";
      });
  } else {
    batteryText.textContent = "—";
    batteryFill.style.width = "100%";
  }
})();

addNewTab();
