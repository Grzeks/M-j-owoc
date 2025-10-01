const API_URL = "https://script.google.com/macros/s/AKfycbz2LLyrqIxneWKTODuzWog0EJiTs8Z7CtxTbTUAX2xYPSeeh211qJcWoRZIq9iIO2eGdw/exec";

const monthSelect = document.getElementById("month-select");
const monthTitle = document.getElementById("month-title");
const totalMonth = document.getElementById("total-month");
const leftToGoal = document.getElementById("left-to-goal");
const avgDaily = document.getElementById("avg-daily");
const entriesDiv = document.getElementById("entries");
const form = document.getElementById("form");
const datetimeInput = document.getElementById("datetime");
const czasInput = document.getElementById("czas");

let currentMonth = "";
let entries = [];
const MONTHLY_GOAL = 30; // godzin

// --- pomocnicze ---
function formatTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${m.toString().padStart(2, "0")}`;
}

function safeJson(res) {
  return res.text().then(text => {
    try {
      return JSON.parse(text);
    } catch (e) {
      console.warn("API nie zwróciło JSON:", text);
      return { ok: false, offline: true, raw: text };
    }
  });
}

async function apiGet(params = {}) {
  const url = new URL(API_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
  try {
    const res = await fetch(url);
    return safeJson(res);
  } catch (err) {
    console.error("Błąd GET", err);
    return { ok: false, offline: true };
  }
}

async function apiPost(body = {}) {
  console.log("POST →", API_URL, body);
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      // usuń nagłówek application/json
      body: JSON.stringify(body)
    });
    return safeJson(res);
  } catch (err) {
    console.error("Błąd POST", err);
    return { ok: false, offline: true };
  }
}

// --- render ---
function render() {
  entriesDiv.innerHTML = "";
  let sum = 0;

  entries.forEach(e => {
    const div = document.createElement("div");
    div.className = "entry";
    const d = new Date(e.date);
    const dateStr =
      d.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" }) +
      ", " +
      d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
    div.innerHTML = `${dateStr} <strong>${e.time}</strong>`;
    entriesDiv.appendChild(div);

    const [h, m] = e.time.split(":").map(Number);
    sum += h * 60 + m;
  });

  totalMonth.innerText = formatTime(sum);
  leftToGoal.innerText = formatTime(MONTHLY_GOAL * 60 - sum);
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  avgDaily.innerText = formatTime(Math.max(0, Math.ceil((MONTHLY_GOAL * 60 - sum) / daysInMonth)));
}

// --- inicjalizacja ---
async function loadMonths() {
  const data = await apiGet({ action: "months" });
  if (!data.ok) {
    alert("Błąd pobierania miesięcy");
    return;
  }
  monthSelect.innerHTML = "";
  data.data.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    monthSelect.appendChild(opt);
  });

  const now = new Date();
  const monthName = now.toLocaleString("pl-PL", { month: "long", year: "numeric" });
  if (data.data.includes(monthName)) {
    currentMonth = monthName;
  } else {
    currentMonth = data.data[data.data.length - 1];
  }
  monthSelect.value = currentMonth;
  monthTitle.innerText = currentMonth;
  loadEntries();
}

async function loadEntries() {
  // UWAGA: backend oczekuje parametru sheet, nie month
  const data = await apiGet({ action: "list", sheet: currentMonth });
  if (!data.ok) {
    const offline = localStorage.getItem(currentMonth);
    entries = offline ? JSON.parse(offline) : [];
    alert("Błąd pobierania wpisów (offline)");
  } else {
    entries = data.data;
    localStorage.setItem(currentMonth, JSON.stringify(entries));
  }
  render();
}

// --- obsługa formularza ---
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const datetime = datetimeInput.value;
  const czas = czasInput.value;
  if (!datetime || !czas) return;

  const newEntry = { date: datetime, time: czas };

  const res = await apiPost({ action: "create", sheet: currentMonth, date: datetime, time: czas });
  if (res.ok) {
    entries.push(newEntry);
    localStorage.setItem(currentMonth, JSON.stringify(entries));
    render();
  } else {
    alert("Nie udało się zapisać: " + (res.raw || "Offline"));
    entries.push(newEntry);
    localStorage.setItem(currentMonth, JSON.stringify(entries));
    render();
  }

  form.reset();
});

// --- zmiana miesiąca ---
monthSelect.addEventListener("change", () => {
  currentMonth = monthSelect.value;
  monthTitle.innerText = currentMonth;
  loadEntries();
});

// start
loadMonths();













