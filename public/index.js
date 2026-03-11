"use strict";
/**
 * @type {HTMLFormElement}
 */
const form = document.getElementById("sj-form");
/**
 * @type {HTMLInputElement}
 */
const address = document.getElementById("sj-address");
/**
 * @type {HTMLInputElement}
 */
const searchEngine = document.getElementById("sj-search-engine");
/**
 * @type {HTMLParagraphElement}
 */
const error = document.getElementById("sj-error");
/**
 * @type {HTMLPreElement}
 */
const errorCode = document.getElementById("sj-error-code");

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
	const frame = scramjet.createFrame();
	frame.frame.id = "sj-frame";
	document.body.appendChild(frame.frame);
	frame.go(url);
});

/* ===== EVR UI: clock + battery (visual only) ===== */

(function () {
	const clockEl = document.getElementById("evr-clock");
	const batteryFill = document.getElementById("evr-battery-fill");
	const batteryText = document.getElementById("evr-battery-text");

	if (clockEl) {
		const updateClock = () => {
			const now = new Date();
			const hours = now.getHours().toString().padStart(2, "0");
			const mins = now.getMinutes().toString().padStart(2, "0");
			clockEl.textContent = `${hours}:${mins}`;
		};
		updateClock();
		setInterval(updateClock, 1000 * 30);
	}

	// Simulated battery level (visual only, no real device info)
	if (batteryFill && batteryText) {
		let level = 86; // starting %
		const applyLevel = () => {
			batteryFill.style.width = `${level}%`;
			batteryText.textContent = `${level}%`;

			batteryFill.classList.remove(
				"battery-green",
				"battery-yellow",
				"battery-red",
			);
			if (level <= 20) batteryFill.classList.add("battery-red");
			else if (level <= 55) batteryFill.classList.add("battery-yellow");
			else batteryFill.classList.add("battery-green");
		};

		applyLevel();

		// Small idle drift to make it feel alive
		setInterval(() => {
			const delta = Math.random() > 0.5 ? -1 : 1;
			level = Math.min(100, Math.max(15, level + delta));
			applyLevel();
		}, 15000);
	}
})();
