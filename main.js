const API_URL = "https://script.google.com/macros/s/AKfycbx97zY6EBYGH-yxHofy1fzIbxghwbfm4UHjySiFZyJ82smQdvQY0yeZxCsNDJ5TensD2w/exec";

// --- Elementy DOM ---
const monthSelect = document.getElementById("month-select");
const monthTitle = document.getElementById("month-title");
const entriesDiv = document.getElementById("entries");
const totalMonthEl = document.getElementById("total-month");
const leftGoalEl = document.getElementById("left-to-goal");
const avgDailyEl = document.getElementById("avg-daily");
const form = document.getElementById("form");
const dateInput = document.getElementById("datetime");
const timeInput = document.getElementById("czas");

// --- Konfiguracja ---
const GOAL_HOURS = 30;
let currentMonth = "";

// --- API helper ---
async function apiGet(params = {}) {
  const url = new URL(API_URL);
  Object.keys(params).forEach(k => url.searchParams.append(k, params[k]));
  const res = await fetch(url);
  return res.json();
}

async function apiPost(body = {}) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return res.json();
}

// --- Rysowanie wpisów ---
function renderEntries(entries) {
  entriesDiv.innerHTML = "";
  if (!entries.length) {
    entriesDiv.innerHTML = "<p>Brak wpisów</p>";
    return;
  }

  entries.forEach(e => {
    const row = document.createElement("div");
    row.className = "entry";

    const date = new Date(e.date);
    const dateStr = date.toLocaleString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

    row.innerHTML = `
      <span>${dateStr}</span>
      <strong>${e.time}</strong>
    `;

    entriesDiv.appendChild(row);
  });

  updateSummary(entries);
}

// --- Podsumowanie ---
function updateSummary(entries) {
  let totalMinutes = 0;
  entries.forEach(e => {
    const [h, m] = e.time.split(":").map(Number);
    totalMinutes += h * 60 + m;
  });

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  totalMonthEl.textContent = `${hours}:${minutes.toString().padStart(2, "0")}`;

  const left = GOAL_HOURS * 60 - totalMinutes;
  if (left > 0) {
    const lh = Math.floor(left / 60);
    const lm = left % 60;
    leftGoalEl.textContent = `${lh}:${lm.toString().padStart(2, "0")}`;

    const daysLeft = new Date(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      0
    ).getDate() - new Date().getDate() + 1;

    const avg = Math.ceil(left / daysLeft);
    const ah = Math.floor(avg / 60);
    const am = avg % 60;
    avgDailyEl.textContent = `${ah}:${am.toString().padStart(2, "0")}`;
  } else {
    leftGoalEl.textContent = "0:00";
    avgDailyEl.textContent = "0:00";
  }
}

// --- Ładowanie miesięcy ---
async function loadMonths() {
  try {
    const res = await apiGet({ action: "months" });
    if (!res.ok) throw new Error("Błąd API (months)");

    monthSelect.innerHTML = "";
    res.data.forEach(m => {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      monthSelect.appendChild(opt);
    });

    // ustawiamy aktualny miesiąc
    const now = new Date();
    const monthName = now.toLocaleString("pl-PL", { month: "long" });
    const current = `${monthName} ${now.getFullYear()}`;
    currentMonth = res.data.includes(current) ? current : res.data[0];

    monthSelect.value = currentMonth;
    monthTitle.textContent = currentMonth;

    loadEntries(currentMonth);
  } catch (err) {
    alert("Błąd pobierania miesięcy: " + err.message);
  }
}

// --- Ładowanie wpisów ---
async function loadEntries(month) {
  try {
    const res = await apiGet({ action: "list", sheet: month });
    if (!res.ok) throw new Error("Błąd API (list)");
    renderEntries(res.data);
  } catch (err) {
    alert("Błąd pobierania wpisów: " + err.message);
  }
}

// --- Zapis nowego wpisu ---
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const dateVal = dateInput.value;
  const timeVal = timeInput.value;
  if (!dateVal || !timeVal) return;

  try {
    const res = await apiPost({
      action: "create",
      sheet: currentMonth,
      date: dateVal,
      time: timeVal
    });
    if (!res.ok) throw new Error("Błąd API (create)");

    loadEntries(currentMonth);
    form.reset();
  } catch (err) {
    alert("Nie udało się zapisać: " + err.message);
  }
});

// --- Zmiana miesiąca ---
monthSelect.addEventListener("change", () => {
  currentMonth = monthSelect.value;
  monthTitle.textContent = currentMonth;
  loadEntries(currentMonth);
});

// --- Start ---
loadMonths();
