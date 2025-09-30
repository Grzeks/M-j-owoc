/*****  OWOC – FRONTEND (Netlify/PWA)  *****/

const API_URL = "https://script.google.com/macros/s/AKfycbwLsxlwQMdSVJaHZ9pqKFxSHekHUlcdwdkadKHX9oOE0hBjEbNQP0RnTbbb_PBsQ7vVNA/exec"; // np. https://script.google.com/macros/s/AKfyc.../exec

// PWA SW (opcjonalnie – jeśli masz sw.js na stronie):
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(()=>{});
}

document.addEventListener("DOMContentLoaded", () => {
  // UI
  const form = document.getElementById("form");
  const datetimeInput = document.getElementById("datetime");
  const czasInput = document.getElementById("czas");
  const entriesTable = document.getElementById("entries");

  const totalEl = document.getElementById("total-month");
  const leftEl  = document.getElementById("left-to-goal");
  const avgEl   = document.getElementById("avg-daily");
  const summaryBox = document.getElementById("summary");

  const monthSelect = document.getElementById("month-select");

  const GOAL_HOURS = 30;

  // Stan
  let currentSheet = "";       // "wrzesień 2025"
  let entries = [];            // [{id, date:"YYYY-MM-DDTHH:MM", time:"HH:MM"}]
  let editingId = null;        // ID edytowanego wpisu albo null

  // ====== Miesiące PL (tożsame z backendem)
  const PL_MONTHS = ["styczeń","luty","marzec","kwiecień","maj","czerwiec","lipiec","sierpień","wrzesień","październik","listopad","grudzień"];
  function sheetNameFor(date) {
    return `${PL_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  }

  // ====== API helpers
  async function apiGet(paramsObj) {
    const url = new URL(API_URL);
    Object.entries(paramsObj||{}).forEach(([k,v]) => url.searchParams.set(k,v));
    const res = await fetch(url.toString(), { method:"GET" });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Błąd GET");
    return json.data;
  }
  async function apiPost(body) {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(body)
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Błąd POST");
    return json.data;
  }
  async function apiPut(body) {
    const res = await fetch(API_URL, {
      method: "PUT",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(body)
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Błąd PUT");
    return json.data;
  }
  async function apiDelete(body) {
    const res = await fetch(API_URL, {
      method: "DELETE",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(body)
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Błąd DELETE");
    return json.data;
  }

  // ====== UI render
  function renderSummary() {
    // policz z entries dla bieżącej karty
    let totalMin = 0;
    for (const e of entries) {
      const [h, m] = String(e.time||"0:00").split(":").map(Number);
      totalMin += h*60 + (+m||0);
    }
    const goalMin = GOAL_HOURS*60;
    const leftMin = Math.max(0, goalMin - totalMin);

    const now = new Date();
    // Jeśli karta to miesiąc bieżący -> licz dni do końca; jeśli inna, liczymy dla całego miesiąca
    const shown = monthSelect.value;
    let monthIdx = PL_MONTHS.findIndex(m => shown.startsWith(m));
    let year = parseInt(shown.split(" ")[1], 10);
    const lastDay = new Date(year, monthIdx+1, 0).getDate();
    const todayDay = (now.getMonth()===monthIdx && now.getFullYear()===year) ? now.getDate() : 1;
    const daysLeft = lastDay - todayDay + 1;
    const avgPerDay = daysLeft>0 ? Math.ceil(leftMin/daysLeft) : 0;

    totalEl.textContent = `${Math.floor(totalMin/60)}:${String(totalMin%60).padStart(2,"0")}`;
    leftEl.textContent  = `${Math.floor(leftMin/60)}:${String(leftMin%60).padStart(2,"0")}`;
    avgEl.textContent   = `${Math.floor(avgPerDay/60)}:${String(avgPerDay%60).padStart(2,"0")}`;

    summaryBox.classList.remove("green","orange","red");
    if (avgPerDay <= 60) summaryBox.classList.add("green");
    else if (avgPerDay <= 120) summaryBox.classList.add("orange");
    else summaryBox.classList.add("red");
  }

  function renderEntries() {
    entriesTable.innerHTML = "";
    for (const e of entries) {
      const tr = document.createElement("tr");

      const tdDate = document.createElement("td");
      // pokazuj  dd.mm.rrrr, HH:MM
      const d = e.date ? new Date(e.date.replace("T"," ") + ":00") : null;
      if (d && !isNaN(d)) {
        tdDate.textContent = d.toLocaleString("pl-PL", { year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit" });
      } else {
        tdDate.textContent = e.date || "";
      }

      const tdTime = document.createElement("td");
      tdTime.textContent = e.time || "";

      const tdActions = document.createElement("td");
      const btnEdit = document.createElement("button");
      btnEdit.textContent = "✏️";
      btnEdit.style.background = "#ffc107";
      btnEdit.style.border = "none";
      btnEdit.style.borderRadius = "4px";
      btnEdit.style.padding = "0.2em 0.5em";
      btnEdit.addEventListener("click", () => {
        // wypełnij formularz i ustaw edycję
        datetimeInput.value = e.date || "";
        czasInput.value = e.time || "";
        editingId = e.id;
        renderEntries(); // podświetlenie
        tr.classList.add("editing");
      });

      const btnDel = document.createElement("button");
      btnDel.textContent = "🗑️";
      btnDel.className = "delete-btn";
      btnDel.addEventListener("click", async () => {
        if (!confirm("Usunąć wpis?")) return;
        try {
          await apiDelete({ sheet: currentSheet, id: e.id });
          // usuń lokalnie
          entries = entries.filter(x => x.id !== e.id);
          renderEntries();
          renderSummary();
        } catch(err) {
          alert("Błąd usuwania: " + err.message);
        }
      });

      tdActions.appendChild(btnEdit);
      tdActions.appendChild(btnDel);

      tr.appendChild(tdDate);
      tr.appendChild(tdTime);
      tr.appendChild(tdActions);
      entriesTable.appendChild(tr);
    }
    renderSummary();
  }

  // ====== Ładowanie miesięcy i danych
  async function loadMonths() {
    monthSelect.innerHTML = "";
    let months = [];
    try {
      months = await apiGet({ action:"months" });
    } catch {
      // fallback – 6 mcy do tyłu i 6 do przodu
      const now = new Date();
      for (let k=-6; k<=6; k++) {
        const d = new Date(now.getFullYear(), now.getMonth()+k, 1);
        months.push(sheetNameFor(d));
      }
    }

    // Usuń duplikaty i posortuj logicznie
    const uniq = Array.from(new Set(months));

    uniq.forEach(name => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name[0].toUpperCase() + name.slice(1);
      monthSelect.appendChild(opt);
    });

    const todayName = sheetNameFor(new Date());
    currentSheet = uniq.includes(todayName) ? todayName : uniq[uniq.length-1];
    monthSelect.value = currentSheet;

    await loadEntriesFor(currentSheet);
  }

  async function loadEntriesFor(sheetName) {
    currentSheet = sheetName;
    editingId = null;
    try {
      entries = await apiGet({ action:"list", sheet: sheetName });
    } catch(err) {
      entries = [];
      console.error(err);
    }
    renderEntries();
  }

  // ====== Zapis/edycja
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const date = datetimeInput.value;         // "YYYY-MM-DDTHH:MM"
    const time = czasInput.value;             // "HH:MM"
    if (!date || !time) return;

    try {
      if (editingId != null) {
        // UPDATE
        const saved = await apiPut({ sheet: currentSheet, id: editingId, date, time });
        // podmień lokalnie
        const i = entries.findIndex(x => x.id === editingId);
        if (i >= 0) entries[i] = saved;
        editingId = null;
      } else {
        // CREATE
        const saved = await apiPost({ sheet: currentSheet, date, time });
        entries.push(saved);
        // posortuj po dacie
        entries.sort((a,b) => String(a.date).localeCompare(String(b.date)));
      }
      form.reset();
      renderEntries();
    } catch(err) {
      alert("Błąd zapisu: " + err.message);
    }
  });

  // ====== Zmiana miesiąca
  monthSelect.addEventListener("change", async () => {
    await loadEntriesFor(monthSelect.value);
  });

  // start
  loadMonths();
});
