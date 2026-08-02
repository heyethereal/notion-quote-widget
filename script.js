/* =========================================================
   测试模式 TEST MODE
   TEST_MODE = true 时为 10 秒测试，验证通过后设为 false 即可
   ========================================================= */
const TEST_MODE = false;

const REAL_FOCUS_MINUTES = 50;
const REAL_BREAK_MINUTES = 10;

const TEST_FOCUS_SECONDS = 10;
const TEST_BREAK_SECONDS = 10;

const FOCUS_TITLE = { main: "I can make something good", deco: "～ʚ◡̈ɞ",         decoBefore: false };
const BREAK_TITLE = { main: "Enjoy～",               deco: "꒰ঌ( * ˊ ᵕ ˋ* )੭==🍵 ", decoBefore: true  };

/* ---------------------------------------------------------- */

const titleMainEl   = document.getElementById("titleMain");
const titleDecoEl   = document.getElementById("titleDeco");
const timerEl       = document.getElementById("timerDisplay");
const timerMinutesEl = document.getElementById("timerMinutes");
const secondSlots   = {
  s0: timerEl.querySelector('[data-slot="s0"] .digit-roll'),
  s1: timerEl.querySelector('[data-slot="s1"] .digit-roll'),
};
let lastMinutes = null;
let lastSecondDigits = { s0: null, s1: null };
const glowDawnEl    = document.getElementById("glowDawn");
const glowDuskEl    = document.getElementById("glowDusk");
const startButton   = document.getElementById("startButton");
const sound         = document.getElementById("notificationSound");

const themeToggle    = document.getElementById("themeToggle");
const paletteSlider  = document.getElementById("paletteSlider");
const paletteNameEl  = document.getElementById("paletteName");

/* 新增字体 Toggle */
const fontToggleBtn  = document.getElementById("fontToggleBtn");

const settingsToggle = document.getElementById("settingsToggle");
const settingsPanel  = document.getElementById("settingsPanel");

const focusSlider    = document.getElementById("focusSlider");
const focusInput     = document.getElementById("focusInput");
const focusUnitEl    = document.getElementById("focusUnit");

const breakSlider    = document.getElementById("breakSlider");
const breakInput     = document.getElementById("breakInput");
const breakUnitEl    = document.getElementById("breakUnit");

let mode        = "focus"; // "focus" | "break"
let secondsLeft;
let focusSeconds;         // 专注阶段总时长（秒）
let breakSeconds;         // 休息阶段总时长（秒）
let interval    = null;
let buttonState = "idle"; // idle | running | ringing

/* =========================================================
   深浅模式、配色主题及字体
   ========================================================= */
const THEME_KEY   = "pomodoro:theme";
const PALETTE_KEY = "pomodoro:palette";
const FONT_KEY    = "pomodoro:font";

function readStored(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

function writeStored(key, val) {
  try {
    window.localStorage.setItem(key, val);
  } catch (e) {
    /* 无痕模式等场景下静默忽略，仅本次会话生效 */
  }
}

function getSystemPreferredTheme() {
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  themeToggle.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
}

const PALETTE_NAMES = ["gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"];
const PALETTE_LABELS = {
  gray: "灰", brown: "棕", orange: "橙", yellow: "黄", green: "绿",
  blue: "蓝", purple: "紫", pink: "粉", red: "红",
};
const DEFAULT_PALETTE = "blue";

function applyPalette(palette) {
  document.documentElement.setAttribute("data-palette", palette);

  const idx = PALETTE_NAMES.indexOf(palette);
  if (idx >= 0) paletteSlider.value = idx;

  const label = PALETTE_LABELS[palette] || "";
  paletteNameEl.textContent = label;
  paletteSlider.setAttribute("aria-valuetext", label);
}

/* ---- 字体切换功能 ---- */
const FONTS = {
  bhutuka: { id: "bhutuka", label: "BhuTuka" },
  moirai: { id: "moirai", label: "Moirai" }
};
const DEFAULT_FONT = "bhutuka";

function applyFont(fontId) {
  document.documentElement.setAttribute("data-font", fontId);
}

function initThemePaletteAndFont() {
  const storedTheme   = readStored(THEME_KEY);
  const storedPalette = readStored(PALETTE_KEY);
  const storedFont    = readStored(FONT_KEY);

  applyTheme(storedTheme === "light" || storedTheme === "dark" ? storedTheme : getSystemPreferredTheme());
  applyPalette(PALETTE_NAMES.includes(storedPalette) ? storedPalette : DEFAULT_PALETTE);
  
  // 初始化字体
  const initialFont = FONTS[storedFont] ? storedFont : DEFAULT_FONT;
  applyFont(initialFont);
}

themeToggle.addEventListener("click", () => {
  const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  applyTheme(next);
  writeStored(THEME_KEY, next);
});

paletteSlider.addEventListener("input", () => {
  const next = PALETTE_NAMES[parseInt(paletteSlider.value, 10)];
  applyPalette(next);
  writeStored(PALETTE_KEY, next);
});

fontToggleBtn.addEventListener("click", () => {
  const currentFont = document.documentElement.getAttribute("data-font");
  const nextFont = currentFont === "bhutuka" ? "moirai" : "bhutuka";
  applyFont(nextFont);
  writeStored(FONT_KEY, nextFont);
});

/* ---------------------------------------------------------- */

function initDurations() {
  if (TEST_MODE) {
    focusSeconds = TEST_FOCUS_SECONDS;
    breakSeconds = TEST_BREAK_SECONDS;
  } else {
    focusSeconds = REAL_FOCUS_MINUTES * 60;
    breakSeconds = REAL_BREAK_MINUTES * 60;
  }

  const unitText = "min";
  focusUnitEl.textContent = unitText;
  breakUnitEl.textContent = unitText;

  const maxVal = TEST_MODE ? 60 : 120;
  focusSlider.max = maxVal;
  focusInput.max = maxVal;
  breakSlider.max = maxVal;
  breakInput.max = maxVal;

  syncControlsFromValues();
}

function currentDuration() {
  return mode === "focus" ? focusSeconds : breakSeconds;
}

function renderDigits(total, animate) {
  const clamped = Math.max(0, total);
  const m = Math.floor(clamped / 60);
  const s = Math.floor(clamped % 60);
  const minutesStr = String(m).padStart(2, "0");
  const secStr = String(s).padStart(2, "0");

  if (lastMinutes !== minutesStr) {
    timerMinutesEl.textContent = minutesStr;
    if (animate) {
      timerMinutesEl.classList.remove("is-flipping");
      void timerMinutesEl.offsetWidth; 
      timerMinutesEl.classList.add("is-flipping");
    }
    lastMinutes = minutesStr;
  }

  const nextSeconds = { s0: secStr[0], s1: secStr[1] };
  Object.keys(nextSeconds).forEach((key) => {
    const val = nextSeconds[key];
    if (lastSecondDigits[key] === val) return; 

    const rollEl = secondSlots[key];
    const span = document.createElement("span");
    span.className = "d";
    span.textContent = val;
    rollEl.innerHTML = "";
    rollEl.appendChild(span);

    if (animate) {
      rollEl.classList.remove("is-flipping");
      void rollEl.offsetWidth; 
      rollEl.classList.add("is-flipping");
    }
    lastSecondDigits[key] = val;
  });
}

function toDisplayValue(seconds) {
  return TEST_MODE ? seconds : Math.round(seconds / 60);
}

function toSeconds(val) {
  return TEST_MODE ? val : val * 60;
}

function syncControlsFromValues() {
  const fVal = toDisplayValue(focusSeconds);
  focusSlider.value = fVal;
  focusInput.value = fVal;

  const bVal = toDisplayValue(breakSeconds);
  breakSlider.value = bVal;
  breakInput.value = bVal;
}

function renderPhase(animate = true) {
  const t = mode === "focus" ? FOCUS_TITLE : BREAK_TITLE;
  titleMainEl.textContent = t.main;
  titleDecoEl.textContent = t.deco;
  titleEl_setOrder(t.decoBefore);
  renderDigits(secondsLeft, animate);

  const total = currentDuration();
  const elapsedPct = total > 0 ? 1 - secondsLeft / total : 1;
  const clamped = Math.max(0, Math.min(1, elapsedPct));
  glowDuskEl.style.opacity = clamped;
  glowDawnEl.style.opacity = 1 - clamped;
}

function titleEl_setOrder(decoBefore) {
  titleDecoEl.classList.toggle("deco-before", decoBefore);
  titleDecoEl.classList.toggle("deco-after", !decoBefore);
  if (decoBefore) {
    titleMainEl.parentNode.insertBefore(titleDecoEl, titleMainEl);
  } else {
    titleMainEl.parentNode.insertBefore(titleDecoEl, titleMainEl.nextSibling);
  }
}

function setButtonState(state) {
  buttonState = state;
  startButton.setAttribute("data-state", state);

  const idle = state === "idle";
  focusSlider.disabled = !idle;
  focusInput.disabled = !idle;
  breakSlider.disabled = !idle;
  breakInput.disabled = !idle;
}

function enterMode(newMode) {
  mode = newMode;
  secondsLeft = currentDuration();
  renderPhase();
}

function openSettings(open) {
  settingsPanel.classList.toggle("is-open", open);
  settingsToggle.setAttribute("aria-expanded", String(open));
}

settingsToggle.addEventListener("click", () => {
  openSettings(!settingsPanel.classList.contains("is-open"));
});

document.addEventListener("click", (e) => {
  if (!settingsPanel.classList.contains("is-open")) return;
  if (settingsPanel.contains(e.target) || settingsToggle.contains(e.target)) return;
  openSettings(false);
});

function updateDuration(targetMode, rawVal) {
  if (buttonState !== "idle") return;

  let val = parseInt(rawVal, 10);
  const maxVal = TEST_MODE ? 60 : 120;
  if (isNaN(val) || val < 1) val = 1;
  if (val > maxVal) val = maxVal;

  const newSec = toSeconds(val);

  if (targetMode === "focus") {
    focusSeconds = newSec;
    focusSlider.value = val;
    focusInput.value = val;
  } else {
    breakSeconds = newSec;
    breakSlider.value = val;
    breakInput.value = val;
  }

  if (targetMode === mode) {
    secondsLeft = newSec;
    renderPhase(false);
  }
}

focusSlider.addEventListener("input", (e) => updateDuration("focus", e.target.value));
focusInput.addEventListener("change", (e) => updateDuration("focus", e.target.value));

breakSlider.addEventListener("input", (e) => updateDuration("break", e.target.value));
breakInput.addEventListener("change", (e) => updateDuration("break", e.target.value));

function tick() {
  secondsLeft--;
  if (secondsLeft <= 0) {
    secondsLeft = 0;
    renderPhase();
    onTimeUp();
    return;
  }
  renderPhase();
}

function onTimeUp() {
  clearInterval(interval);
  interval = null;

  sound.loop = true;
  sound.currentTime = 0;
  sound.play().catch(() => {});
  setButtonState("ringing");
}

function handleRingingConfirm() {
  sound.pause();
  sound.currentTime = 0;

  if (mode === "focus") {
    enterMode("break");
    startRunning();
  } else {
    enterMode("focus");
    setButtonState("idle");
  }
}

function startRunning() {
  setButtonState("running");
  interval = setInterval(tick, 1000);
}

function pauseRunning() {
  clearInterval(interval);
  interval = null;
  setButtonState("idle");
}

startButton.addEventListener("click", () => {
  if (buttonState === "idle") {
    startRunning();
  } else if (buttonState === "running") {
    pauseRunning();
  } else if (buttonState === "ringing") {
    handleRingingConfirm();
  }
});

/* ---- 初始化 ---- */
initThemePaletteAndFont();
initDurations();
secondsLeft = focusSeconds;
setButtonState("idle");
renderPhase(false);