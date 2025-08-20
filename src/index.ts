type Cfg = {
	paintKeyCode: string;
	colorPickerKeyCode: string;
	colorPickerSelector: string;
	autoClickColorPicker: boolean;
};

const DEFAULTS: Cfg = {
	paintKeyCode: "KeyE",
	colorPickerKeyCode: "KeyQ",
	colorPickerSelector: 'button svg path[d^="M120-120v-190"]',
	autoClickColorPicker: true
};

const STORE_KEY = "wplace_shortcuts_config_v2";

function readCfg(): Cfg {
	const stored = GM_getValue<Partial<Cfg>>(STORE_KEY, {});
	const cfg: Cfg = {
		...DEFAULTS,
		...stored
	} as Cfg;
	return cfg;
}

function writeCfg(config: Cfg): void {
	GM_setValue(STORE_KEY, config);
}

function normKey(inputRaw: string | null | undefined): string | null {
	const input = (inputRaw || "").trim();
	if (!input) return null;
	const lower = input.toLowerCase();

	if (lower === "space" || input === " ") return "Space";

	if (/^(Key[A-Z]|Digit[0-9]|Space)$/.test(input)) return input;

	if (/^[a-z]$/.test(lower)) return `Key${lower.toUpperCase()}`;
	if (/^[0-9]$/.test(lower)) return `Digit${lower}`;

	return null;
}

function isInput(target: EventTarget | null): boolean {
	const el = target as HTMLElement | null;
	if (!el) return false;
	const tag = el.tagName;
	if (!tag) return false;
	const tagUpper = tag.toUpperCase();
	if (tagUpper === "INPUT" || tagUpper === "TEXTAREA") return true;
	if ((el as HTMLElement).isContentEditable) return true;
	return false;
}

function isKey(event: KeyboardEvent, normalizedCode: string): boolean {
	if (normalizedCode === "Space") {
		return event.code === "Space" || event.key === " ";
	}
	if (normalizedCode.startsWith("Key")) {
		const letter = normalizedCode.slice(3).toLowerCase();
		return event.code === normalizedCode || event.key.toLowerCase() === letter;
	}
	if (normalizedCode.startsWith("Digit")) {
		const digit = normalizedCode.slice(5);
		return event.code === normalizedCode || event.key === digit;
	}
	return event.code === normalizedCode || event.key === normalizedCode;
}

function emitSpace(type: "keydown" | "keyup", repeat = false): void {
	const init: KeyboardEventInit = {
		key: " ",
		code: "Space",
		bubbles: true,
		cancelable: true,
		repeat
	};
	const ev = new KeyboardEvent(type, init);
	window.dispatchEvent(ev);
	document.dispatchEvent(ev);
	document.body?.dispatchEvent(ev);
}

function findPickerBtn(selector: string): HTMLButtonElement | null {
	const pathEl = document.querySelector(selector) as SVGPathElement | null;
	if (pathEl) {
		const btn = pathEl.closest("button") as HTMLButtonElement | null;
		if (btn) return btn;
	}

	const ariaBtn = document.querySelector(
		'button[aria-label*="color" i], button[title*="color" i]'
	) as HTMLButtonElement | null;
	if (ariaBtn) return ariaBtn;

	const candidates = Array.from(
		document.querySelectorAll<HTMLButtonElement>("button.btn.btn-circle.btn-sm.btn-ghost")
	);
	for (const c of candidates) {
		if (c.querySelector("svg")) return c;
	}

	return null;
}

function openPicker(selector: string): boolean {
	const btn = findPickerBtn(selector);
	if (btn) {
		btn.click();
		return true;
	}
	console.warn(
		"[wplace-shortcuts] color picker button not found"
	);
	return false;
}

let cx = 0;
let cy = 0;
window.addEventListener(
	"mousemove",
	(e) => {
		cx = e.clientX;
		cy = e.clientY;
	},
	true
);

function getCanvas(): HTMLCanvasElement | null {
	const canvases = Array.from(document.querySelectorAll<HTMLCanvasElement>("canvas"));
	if (canvases.length === 0) return null;
	let best: HTMLCanvasElement | null = null;
	let bestArea = 0;
	for (const c of canvases) {
		const r = c.getBoundingClientRect();
		const area = r.width * r.height;
		if (area > bestArea && r.width >= 100 && r.height >= 100) {
			best = c;
			bestArea = area;
		}
	}
	return best;
}

function clickAt(x: number, y: number): void {
	const target = getCanvas() ?? (document.elementFromPoint(x, y) as HTMLElement | null);
	if (!target) return;

	const firePointer = (type: string, buttons: number) => {
		const ev = new PointerEvent(type, {
			bubbles: true,
			cancelable: true,
			pointerId: 1,
			pointerType: "mouse",
			button: 0,
			buttons,
			clientX: x,
			clientY: y
		});
		target.dispatchEvent(ev);
	};

	const fireMouse = (type: string, buttons: number) => {
		const ev = new MouseEvent(type, {
			bubbles: true,
			cancelable: true,
			button: 0,
			buttons,
			clientX: x,
			clientY: y
		});
		target.dispatchEvent(ev);
	};

	firePointer("pointermove", 0);
	fireMouse("mousemove", 0);
	firePointer("pointerdown", 1);
	fireMouse("mousedown", 1);
	firePointer("pointerup", 0);
	fireMouse("mouseup", 0);
	target.dispatchEvent(
		new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y })
	);
}

function queuePick(): void {
	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			clickAt(cx, cy);
		});
	});
}

const PANEL_ID = "wplace-shortcuts-panel";

function injectStyle(): void {
	if (document.getElementById("wplace-shortcuts-style")) return;
	const style = document.createElement("style");
	style.id = "wplace-shortcuts-style";
	style.textContent = `
  #${PANEL_ID} { position: fixed; top: 12px; right: 12px; z-index: 2147483647; font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; font-size: 12px; color: var(--color-base-content); background: var(--color-base-200); border: 1px solid color-mix(in oklab, var(--color-base-300), black 10%); border-radius: 10px; box-shadow: 0 8px 30px rgba(0,0,0,.35); min-width: 260px; }
  #${PANEL_ID} header { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border-bottom: 1px solid color-mix(in oklab, var(--color-base-300), black 10%); font-weight: 600; }
  #${PANEL_ID} .content { padding: 10px; display: grid; gap: 10px; }
  #${PANEL_ID} .row { display: grid; grid-template-columns: 1fr auto; gap: 6px; align-items: center; }
  #${PANEL_ID} .hint { color: color-mix(in oklab, var(--color-base-content), transparent 40%); font-size: 11px; }
  #${PANEL_ID} button { padding: 6px 8px; border: 1px solid color-mix(in oklab, var(--color-base-300), black 10%); background: color-mix(in oklab, var(--color-base-200), white 7%); color: var(--color-base-content); border-radius: 8px; cursor: pointer; transition: background .12s ease, transform .06s ease; }
  #${PANEL_ID} button:hover { background: color-mix(in oklab, var(--color-base-200), white 12%); }
  #${PANEL_ID} button:active { transform: translateY(1px); }
  #${PANEL_ID} .key { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; padding: 2px 6px; border-radius: 6px; background: var(--color-base-100); border: 1px solid var(--color-base-300); }
  #${PANEL_ID} .footer { display: flex; gap: 8px; justify-content: flex-end; padding: 8px 10px; border-top: 1px solid color-mix(in oklab, var(--color-base-300), black 10%); }
  #${PANEL_ID}.hidden { display: none; }
  `;
	document.head.appendChild(style);
}

function fmtKey(code: string): string {
	if (code === "Space") return "Space";
	if (code.startsWith("Key")) return code.slice(3);
	if (code.startsWith("Digit")) return code.slice(5);
	return code;
}

function createSettingsPanel(config: Cfg, onChange: (c: Cfg) => void): HTMLElement {
	injectStyle();
	let panel = document.getElementById(PANEL_ID);
	if (panel) return panel;

	panel = document.createElement("div");
	panel.id = PANEL_ID;
	panel.className = "hidden";
	panel.innerHTML = `
    <header>
      <div>WPlace Shortcuts</div>
      <div>
        <button data-action="close">✕</button>
      </div>
    </header>
    <div class="content">
      <div class="row">
        <div>
          <div><strong>Paint key</strong> <span class="key" data-key="paint">${fmtKey(config.paintKeyCode)}</span></div>
          <div class="hint">Tap to place once; hold to paint continuously</div>
        </div>
        <div><button data-action="set-paint">Change</button></div>
      </div>
      <div class="row">
        <div>
          <div><strong>Color picker key</strong> <span class="key" data-key="picker">${fmtKey(config.colorPickerKeyCode)}</span></div>
        </div>
        <div><button data-action="set-picker">Change</button></div>
      </div>
      <div class="row">
        <div>
          <div><strong>Auto-pick at cursor</strong>
            <div class="hint">${config.autoClickColorPicker ? "Enabled (opens picker and picks at cursor)" : "Disabled (opens picker only)"}</div>
          </div>
        </div>
        <div><button data-action="toggle-picker-action">${config.autoClickColorPicker ? "On" : "Off"}</button></div>
      </div>
    </div>
    <div class="footer">
      <button data-action="reset">Reset</button>
      <button data-action="close">Close</button>
    </div>
  `;

	let capturing: null | "paint" | "picker" = null;
	function updateLabels(c: Cfg) {
		const paintEl = panel!.querySelector('[data-key="paint"]') as HTMLElement;
		const pickerEl = panel!.querySelector('[data-key="picker"]') as HTMLElement;
		if (paintEl) paintEl.textContent = fmtKey(c.paintKeyCode);
		if (pickerEl) pickerEl.textContent = fmtKey(c.colorPickerKeyCode);
		const hint = panel!.querySelector(".row:nth-of-type(3) .hint") as HTMLElement | null;
		const toggleBtn = panel!.querySelector(
			'[data-action="toggle-picker-action"]'
		) as HTMLButtonElement | null;
		if (hint)
			hint.textContent = c.autoClickColorPicker
				? "Enabled (opens picker and picks at cursor)"
				: "Disabled (opens picker only)";
		if (toggleBtn) toggleBtn.textContent = c.autoClickColorPicker ? "On" : "Off";
	}

	function beginCapture(which: "paint" | "picker") {
		if (capturing) return;
		capturing = which;
		const label = panel!.querySelector(
			`[data-key="${which === "paint" ? "paint" : "picker"}"]`
		) as HTMLElement;
		const originalText = label.textContent || "";
		label.textContent = "Press a key... (Esc to cancel)";

		const onKey = (e: KeyboardEvent) => {
			if (!capturing) return;
			e.preventDefault();
			e.stopPropagation();
			if (e.key === "Escape") {
				capturing = null;
				label.textContent = originalText;
				window.removeEventListener("keydown", onKey, true);
				return;
			}
			const ignoreCodes = new Set([
				"ShiftLeft",
				"ShiftRight",
				"ControlLeft",
				"ControlRight",
				"AltLeft",
				"AltRight",
				"MetaLeft",
				"MetaRight",
				"CapsLock",
				"NumLock",
				"ScrollLock"
			]);
			if (ignoreCodes.has(e.code)) return;

			const normalized = normKey(e.code) || normKey(e.key) || normKey(e.code);
			if (!normalized) return;

			const next: Cfg = { ...readCfg() };
			if (capturing === "paint") next.paintKeyCode = normalized;
			if (capturing === "picker") next.colorPickerKeyCode = normalized;
			writeCfg(next);
			onChange(next);
			updateLabels(next);
			capturing = null;
			window.removeEventListener("keydown", onKey, true);
		};
		window.addEventListener("keydown", onKey, true);
	}

	panel.addEventListener("click", (e) => {
		const target = e.target as HTMLElement;
		const action = target.getAttribute("data-action");
		if (!action) return;
		e.preventDefault();
		if (action === "close") panel!.classList.add("hidden");
		if (action === "reset") {
			writeCfg(DEFAULTS);
			onChange({ ...DEFAULTS });
			updateLabels(DEFAULTS);
		}
		if (action === "set-paint") beginCapture("paint");
		if (action === "set-picker") beginCapture("picker");
		if (action === "toggle-picker-action") {
			const next = { ...readCfg(), autoClickColorPicker: !readCfg().autoClickColorPicker };
			writeCfg(next);
			onChange(next);
			updateLabels(next);
		}
	});

	document.body.appendChild(panel);
	return panel;
}

function showSettingsPanel(config: Cfg, onChange: (c: Cfg) => void): void {
	const panel = createSettingsPanel(config, onChange);
	const position = () => {
		try {
			const el = panel as HTMLDivElement;
			const rightStack = document.querySelector(
				'.absolute.right-2.top-2.z-30, div[class*="right-2"][class*="top-2"]'
			) as HTMLElement | null;
			const margin = 8;

			if (rightStack) {
				const r = rightStack.getBoundingClientRect();
				const rect = el.getBoundingClientRect();
				const width = Math.round(rect.width) || 260;
				let left = Math.round(r.left - width - margin);
				const top = Math.max(8, Math.round(r.top));

				if (left < 8) {
					el.style.left = "auto";
					el.style.right = "12px";
					el.style.top = `${Math.round(r.bottom + margin)}px`;
				} else {
					el.style.left = `${left}px`;
					el.style.right = "auto";
					el.style.top = `${top}px`;
				}
			} else {
				el.style.right = "12px";
				el.style.left = "auto";
			}
		} catch {}
	};

	const el = panel as HTMLDivElement;
	el.style.visibility = "hidden";
	panel.classList.remove("hidden");
	void el.offsetWidth;
	position();
	el.style.visibility = "";

	const onWin = () => position();
	window.addEventListener("resize", onWin);
	window.addEventListener("scroll", onWin, true);
	const cleanup = () => {
		window.removeEventListener("resize", onWin);
		window.removeEventListener("scroll", onWin, true);
		panel.removeEventListener("transitionend", cleanup);
	};
	const observer = new MutationObserver(() => {
		if (panel.classList.contains("hidden")) {
			cleanup();
			observer.disconnect();
		}
	});
	observer.observe(panel, { attributes: true, attributeFilter: ["class"] });
}

function registerMenu(config: Cfg, onChange: (c: Cfg) => void) {
	GM_registerMenuCommand("Open settings", () => showSettingsPanel(config, onChange));
	GM_registerMenuCommand("Reset to defaults", () => {
		writeCfg(DEFAULTS);
		onChange({ ...DEFAULTS });
		alert("wplace-shortcuts: settings reset to defaults.");
	});
}

function main() {
	let config = readCfg();
	registerMenu(config, (next) => {
		config = next;
	});

	let painting = false;
	let raf: number | null = null;
	let firstWait: number | null = null;
	let lastAt = 0;
	const DELAY = 220;
	const STEP = 16;

	function startRepeat() {
		const loop = (ts: number) => {
			if (!painting) return;
			if (lastAt === 0) lastAt = ts;
			if (ts - lastAt >= STEP) {
				emitSpace("keydown", true);
				lastAt = ts;
			}
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
	}

	function stopRepeat() {
		if (raf != null) cancelAnimationFrame(raf);
		raf = null;
		if (firstWait != null) clearTimeout(firstWait);
		firstWait = null;
		lastAt = 0;
	}

	document.addEventListener(
		"keydown",
		(e) => {
			if (isInput(e.target)) return;
			const panel = document.getElementById(PANEL_ID);
			if (panel && !panel.classList.contains("hidden")) {
				if (panel.contains(e.target as Node)) return;
			}

			if (isKey(e, config.colorPickerKeyCode)) {
				e.preventDefault();
				e.stopPropagation();
				const ok = openPicker(config.colorPickerSelector);
				if (ok && config.autoClickColorPicker) {
					queuePick();
				}
				return;
			}

			if (isKey(e, config.paintKeyCode)) {
				if (config.paintKeyCode === "Space") return;
				e.preventDefault();
				e.stopPropagation();
				if (!painting) {
					painting = true;
					emitSpace("keydown", false);
					firstWait = setTimeout(() => {
						if (!painting) return;
						startRepeat();
					}, DELAY) as unknown as number;
				}
			}
		},
		true
	);

	document.addEventListener(
		"keyup",
		(e) => {
			if (isInput(e.target)) return;
			const panel = document.getElementById(PANEL_ID);
			if (panel && !panel.classList.contains("hidden")) {
				if (panel.contains(e.target as Node)) return;
			}

			if (isKey(e, config.paintKeyCode)) {
				if (config.paintKeyCode === "Space") return;
				if (painting) {
					e.preventDefault();
					e.stopPropagation();
					stopRepeat();
					painting = false;
					emitSpace("keyup", false);
				}
			}
		},
		true
	);

	window.addEventListener("blur", () => {
		if (!painting) return;
		stopRepeat();
		painting = false;
		emitSpace("keyup", false);
	});
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState !== "visible" && painting) {
			stopRepeat();
			painting = false;
			emitSpace("keyup", false);
		}
	});

	console.info("[wplace-shortcuts] ready. use menu → Open settings to configure keys.");
}

main();
