

let globalHourly = null;
let globalDaily = null;
let currentWeather = null;
let cityName = '';
let countryName = '';


const unitsTrigger = document.getElementById('units-trigger');
const unitsPanel = document.getElementById('units-panel');
unitsTrigger.addEventListener('click', () => unitsPanel.classList.toggle('active'));
document.addEventListener('click', (e) => {
  if (!unitsTrigger.contains(e.target) && !unitsPanel.contains(e.target)) {
    unitsPanel.classList.remove('active');
  }
});
const unitGroups = [["celsius","fahrenheit"],["kmh","mph"],["mm","inches"]];
unitGroups.forEach(group => {
  group.forEach(value => {
    const option = document.querySelector(`.option[data-value="${value}"]`);
    if (option) {
    option.addEventListener("click", () => {
  group.forEach(v => {
    const el = document.querySelector(`.option[data-value="${v}"]`);
    if (el) el.classList.remove("selected");
  });
  option.classList.add("selected");

  // tell which unit group changed
  let groupType = "temp";
  if (group.includes("kmh")) groupType = "wind";
  if (group.includes("mm")) groupType = "prec";
  updateUnits(groupType);
});

    }
  });
});

/* ---------------- DAY SELECT LOGIC ---------------- */
const dayTrigger = document.getElementById('day-trigger');
const dayPanel = document.getElementById('day-panel');
dayTrigger.addEventListener('click', () => dayPanel.classList.toggle('active'));

dayPanel.querySelectorAll('.option').forEach(opt => {
  opt.addEventListener('click', e => {
    const dayText = dayTrigger.querySelector('.selected-day');
    if (dayText) {
      dayText.textContent = e.target.textContent;
      localStorage.setItem('selectedDay', e.target.textContent);
    }
    dayPanel.classList.remove('active');
    updateHourlyForDay(e.target.textContent);
  });
});

async function getWeather() {
  const city = document.getElementById("city").value.trim();
  if (!city) return alert("Please enter a city name.");
  
  // Remove any existing "not found" message
  const oldMsg = document.querySelector('.not-found');
  if (oldMsg) oldMsg.remove();
  
  // Restore layout FIRST (before showing loader)
  restoreLayout();
  
  // Now show loader (elements exist now)
  showLoader();
  
  try {
    // 1️⃣ Get coordinates
    const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}`);
    const geoData = await geoRes.json();
    
    if (!geoData.length) {
      hideLoader();
      
      showNotFoundMessage();
      return;
    }

    const lat = geoData[0].lat;
    const lon = geoData[0].lon;
    const locationNameParts = geoData[0].display_name.split(",");
    cityName = (locationNameParts[0] || city).trim();
    countryName = (locationNameParts[locationNameParts.length - 1] || '').trim();

    // 2️⃣ Get weather data
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,wind_speed_10m,weathercode&hourly=temperature_2m,precipitation,relative_humidity_2m,wind_speed_10m,weathercode&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;
    const res = await fetch(url);
    const data = await res.json();

    const current = data.current;
    currentWeather = current;
    globalHourly = data.hourly;
    globalDaily = data.daily;

    // --- Update main card ---
    document.querySelector(".location").textContent = `${cityName}, ${countryName}`;
    const now = new Date();
    document.querySelector(".date").textContent = now.toLocaleDateString("en-US", {
      weekday: "long", month: "short", day: "numeric", year: "numeric"
    });
    document.querySelector(".temp").textContent = `${Math.round(current.temperature_2m)}°`;
    document.querySelector(".stat:nth-child(1) .value").textContent = `${Math.round(current.apparent_temperature)}°`;
    document.querySelector(".stat:nth-child(2) .value").textContent = `${current.relative_humidity_2m}%`;
    document.querySelector(".stat:nth-child(3) .value").textContent = `${Math.round(current.wind_speed_10m)} km/h`;
    document.querySelector(".stat:nth-child(4) .value").textContent = `${current.precipitation ?? 0} mm`;
    const code = current.weathercode ?? 0;
    const iconFile = weatherIcons[code] || "icon-partly-cloudy.webp";
    document.querySelector(".main-right img").src = `assets/images/${iconFile}`;

    // --- Update daily cards ---
    const dailyRow = document.querySelector(".daily-row");
    dailyRow.innerHTML = "";
    for (let i = 0; i < globalDaily.time.length; i++) {
      const dayName = new Date(globalDaily.time[i]).toLocaleDateString("en-US", { weekday: "short" });
      const max = Math.round(globalDaily.temperature_2m_max[i]);
      const min = Math.round(globalDaily.temperature_2m_min[i]);
      dailyRow.innerHTML += `
        <div class="day-card">
          <div class="dow">${dayName}</div>
          <div class="icon"><img src="assets/images/icon-sunny.webp" alt="icon"></div>
          <div class="range">${max}° <span style="opacity:.65">/ ${min}°</span></div>
        </div>`;
    }

    // --- Default: show today's hourly ---
    const today = new Date(globalHourly.time[0]).toLocaleDateString("en-US", { weekday: "long" });
    updateHourlyForDay(today);

    // Ensure units reflect current selected options
    updateUnits();

    hideLoader();
  } catch (err) {
    hideLoader();
    alert("Error: " + err.message);
    console.error(err);
  }
}

/* ---------------- RESTORE LAYOUT ---------------- */

function attachDaySelectorListeners() {
  const dayTrigger = document.getElementById('day-trigger');
  const dayPanel = document.getElementById('day-panel');
  
  if (!dayTrigger || !dayPanel) return;
  
  // Remove old listeners by cloning (prevents duplicate listeners)
  const newDayTrigger = dayTrigger.cloneNode(true);
  dayTrigger.parentNode.replaceChild(newDayTrigger, dayTrigger);
  
  const newDayPanel = dayPanel.cloneNode(true);
  dayPanel.parentNode.replaceChild(newDayPanel, dayPanel);
  
  // Add click listener to trigger
  newDayTrigger.addEventListener('click', () => {
    newDayPanel.classList.toggle('active');
  });
  
  // Add click listeners to options
  newDayPanel.querySelectorAll('.option').forEach(opt => {
    opt.addEventListener('click', e => {
      const dayText = newDayTrigger.querySelector('.selected-day');
      if (dayText) {
        dayText.textContent = e.target.textContent;
      }
      newDayPanel.classList.remove('active');
      updateHourlyForDay(e.target.textContent);
    });
  });
  
  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!newDayTrigger.contains(e.target) && !newDayPanel.contains(e.target)) {
      newDayPanel.classList.remove('active');
    }
  });
}

/* ---------------- RESTORE LAYOUT (improved — reuses nodes) ---------------- */
function restoreLayout() {
  const layout = document.querySelector('.layout');
  if (!layout) return;

  // Reset layout style (if it was forced when showing not-found)
  layout.style.minHeight = '';

  // Left panel: if exists, show it (was hidden by not-found); otherwise create it
  let leftPanel = layout.querySelector('.left');
  if (leftPanel) {
    leftPanel.style.display = ''; // un-hide
  } else {
    leftPanel = document.createElement('div');
    leftPanel.className = 'left';
    leftPanel.innerHTML = `
      <div class="main-card">
        <div class="main-left">
          <div class="location">Berlin, Germany</div>
          <div class="date">Tuesday, Aug 5, 2025</div>
        </div>
        <div class="main-right">
          <div class="main-sun">
            <img class="main-sun" src="assets/images/icon-sunny.webp" alt="">
          </div>
          <div class="temp">20°</div>
        </div>
      </div>
      <div class="stats">
        <div class="stat">
          <div class="label">Feels Like</div>
          <div class="value">18°</div>
        </div>
        <div class="stat">
          <div class="label">Humidity</div>
          <div class="value">46%</div>
        </div>
        <div class="stat">
          <div class="label">Wind</div>
          <div class="value">14 km/h</div>
        </div>
        <div class="stat">
          <div class="label">Precipitation</div>
          <div class="value">0 mm</div>
        </div>
      </div>
      <div class="daily-area">
        <div class="daily-title">Daily forecast</div>
        <div class="daily-row" aria-label="Daily forecast"></div>
      </div>
    `;
    layout.insertBefore(leftPanel, layout.firstChild);
  }

  // Hourly panel: show if hidden, otherwise create it and attach listeners
  let hourlyPanel = layout.querySelector('.hourly-panel');
  if (hourlyPanel) {
    hourlyPanel.style.display = '';
  } else {
    hourlyPanel = document.createElement('aside');
    hourlyPanel.className = 'hourly-panel';
    hourlyPanel.setAttribute('aria-label', 'Hourly forecast');
    hourlyPanel.innerHTML = `
      <div class="hourly-head">
        <div>Hourly forecast</div>
        <div class="day-select" id="day-trigger">
          <p class="selected-day">Tuesday</p>
          <span class="arrow-down">▼</span>
        </div>
        <div class="day-panel" id="day-panel">
          <div class="option" data-value="monday">Monday</div>
          <div class="option" data-value="tuesday">Tuesday</div>
          <div class="option" data-value="wednesday">Wednesday</div>
          <div class="option" data-value="thursday">Thursday</div>
          <div class="option" data-value="friday">Friday</div>
          <div class="option" data-value="saturday">Saturday</div>
          <div class="option" data-value="sunday">Sunday</div>
        </div>
      </div>
      <div class="hourly-list"></div>
    `;
    layout.appendChild(hourlyPanel);
    // attach listeners for the freshly created nodes
    attachDaySelectorListeners();
  }

  // Remove the "not found" message if present
  const oldMsg = document.querySelector('.not-found');
  if (oldMsg) oldMsg.remove();

  // Also reset suggestions / selection state to avoid stray UI
  const suggestionsBox = document.getElementById('suggestions');
  if (suggestionsBox) suggestionsBox.innerHTML = '';
  selectedIndex = -1;
}

/* ---------------- showNotFoundMessage (hide instead of remove) ---------------- */
function showNotFoundMessage() {
  const layout = document.querySelector('.layout');
  if (layout) {
    // Hide left & hourly panels instead of removing them (so listeners & nodes persist)
    const left = layout.querySelector('.left');
    const aside = layout.querySelector('.hourly-panel');
    if (left) left.style.display = 'none';
    if (aside) aside.style.display = 'none';

    // keep layout height stable
    layout.style.minHeight = '400px';
  }

  // Avoid duplicates
  const existing = document.querySelector('.not-found');
  if (existing) return;

  const msg = document.createElement('div');
  msg.className = 'not-found';
  msg.textContent = 'No search result found!';
  msg.style.color = 'white';
  msg.style.textAlign = 'center';
  msg.style.fontWeight = '600';
  msg.style.letterSpacing = '0.4px';
  msg.style.marginTop = '-10px';
  msg.style.fontSize = '22px';

  const searchWrap = document.querySelector('.search-wrap');
  if (searchWrap && searchWrap.parentNode) {
    searchWrap.parentNode.insertBefore(msg, searchWrap.nextSibling);
  }
}

/* ---------------- HOURLY UPDATE ---------------- */
function updateHourlyForDay(dayName) {
  if (!globalHourly || !globalDaily) return;
  const hourlyList = document.querySelector(".hourly-list");
  hourlyList.innerHTML = "";

  const times = globalHourly.time;
  const temps = globalHourly.temperature_2m;
  const codes = globalHourly.weathercode;

  const targetDay = dayName.toLowerCase();
  let hasAny = false;

  for (let i = 0; i < times.length; i++) {
    const date = new Date(times[i]);
    const weekday = date.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();

    if (weekday === targetDay) {
      hasAny = true;
      const iconFile = weatherIcons[codes ? codes[i] : 2] || "icon-partly-cloudy.webp";
      const celsiusVal = Math.round(temps[i]);

      hourlyList.innerHTML += `
        <div class="hour" data-temp-c="${celsiusVal}">
          <div class="mid"><img src="assets/images/${iconFile}" alt="weather"></div>
          <div class="time">${formatTo12Hour(date)}</div>
          <div class="temp-h">${celsiusVal}°</div>
        </div>`;
    }
  }

  if (!hasAny) {
    const fallbackDay = new Date(times[0]).toLocaleDateString("en-US", { weekday: "long" });
    updateHourlyForDay(fallbackDay);
  }

  updateUnits("temp"); // initialize correct display
}

function formatTo12Hour(date) {
  return date.toLocaleTimeString([], {
    hour: 'numeric',
    hour12: true
  });
}

const weatherIcons = {
  0: "icon-sunny.webp",
  1: "icon-sunny.webp",
  2: "icon-partly-cloudy.webp",
  3: "icon-overcast.webp",
  45: "icon-fog.webp",
  48: "icon-fog.webp",
  51: "icon-rain.webp",
  53: "icon-rain.webp",
  55: "icon-rain.webp",
  61: "icon-rain.webp",
  63: "icon-rain.webp",
  65: "icon-rain.webp",
  71: "icon-snow.webp",
  73: "icon-snow.webp",
  75: "icon-snow.webp",
  80: "icon-rain.webp",
  81: "icon-rain.webp",
  82: "icon-rain.webp",
  95: "icon-storm.webp",
  99: "icon-storm.webp"
};

/* ---------------- INPUT + SUGGESTIONS ---------------- */
const searchBtn = document.getElementById("search-btn");
const suggestionsBox = document.getElementById("suggestions");
const cityInput = document.getElementById("city");

let searchHistory = [];
let selectedIndex = -1;

function renderSuggestions() {
  if (searchHistory.length === 0) {
    suggestionsBox.innerHTML = '';
    return;
  }
  suggestionsBox.innerHTML = searchHistory.map((city, index) => `
    <div class="suggestion ${index === selectedIndex ? 'selected' : ''}" data-index="${index}">
      ${city}
    </div>
  `).join('');
}

function addCityToHistory(city) {
  if (!city) return;
  if (!searchHistory.includes(city)) {
    searchHistory.unshift(city);
    if (searchHistory.length > 10) searchHistory.pop();
  }
  renderSuggestions();
}

searchBtn.addEventListener("click", () => {
  const c = cityInput.value.trim();
  if (!c) return;
  addCityToHistory(c);
  suggestionsBox.innerHTML = '';
  selectedIndex = -1;
  getWeather();
});

cityInput.addEventListener("keydown", function(e){
  if (e.key === 'Enter') {
    const c = cityInput.value.trim();
    if (c) {
      getWeather();
      addCityToHistory(c);
      renderSuggestions();
    }
  }
});

cityInput.addEventListener("focus", renderSuggestions);

function showSuggestions(query) {
  const filtered = searchHistory.filter(city =>
    city.toLowerCase().includes(query.toLowerCase())
  );
  if (filtered.length === 0) {
    suggestionsBox.innerHTML = '';
    return;
  }
  suggestionsBox.innerHTML = filtered
    .map((city, i) => `<div class="suggestion ${i === selectedIndex ? 'selected' : ''}">${city}</div>`)
    .join('');
}

suggestionsBox.addEventListener("click", (e) => {
  if (e.target.classList.contains("suggestion")) {
    cityInput.value = e.target.textContent;
    suggestionsBox.innerHTML = '';
    getWeather();
  }
});

suggestionsBox.addEventListener("mousedown", (e) => {
  const suggestion = e.target.closest(".suggestion");
  if (!suggestion) return;
  const city = suggestion.textContent.trim();
  cityInput.value = city;
  suggestionsBox.innerHTML = "";
  getWeather();
});

/* ---------------- LOADER ---------------- */
/* ---------------- LOADER (FIXED) ---------------- */
function showLoader() {
  const mainCard = document.querySelector('.main-card');
  if (!mainCard) return; // Guard clause
  
  const stats = document.querySelectorAll('.stat .value');
  const dayCards = document.querySelectorAll('.day-card');
  const mids = document.querySelectorAll('.mid');
  const times = document.querySelectorAll('.time');
  const temps = document.querySelectorAll('.temp-h');
  const dayTrigger = document.getElementById('day-trigger');
  
  mainCard.classList.add('loading');

  // Safely update main card elements
  const locationEl = mainCard.querySelector('.main-left .location');
  const dateEl = mainCard.querySelector('.main-left .date');
  const tempEl = mainCard.querySelector('.main-right .temp');
  const imgEl = mainCard.querySelector('.main-right img');
  
  if (locationEl) locationEl.textContent = '';
  if (dateEl) dateEl.textContent = '';
  if (tempEl) tempEl.textContent = '';
  if (imgEl) imgEl.src = '';

  if (dayTrigger) {
    const dayText = dayTrigger.querySelector('.selected-day');
    if (dayText) dayText.textContent = '__';
  }

  stats.forEach(s => s.textContent = '___');
  dayCards.forEach(s => s.textContent = '');
  mids.forEach(s => s.textContent = '');
  times.forEach(s => s.textContent = '');
  temps.forEach(s => s.textContent = '');
}

function hideLoader() {
  const mainCard = document.querySelector('.main-card');
  if (!mainCard) return; // Guard clause
  
  mainCard.classList.remove('loading');
  
  const dayTrigger = document.getElementById('day-trigger');
  if (dayTrigger) {
    const dayText = dayTrigger.querySelector('.selected-day');
    if (dayText && !dayText.textContent) {
      dayText.textContent = 'Tuesday';
    }
  }
}

function hideLoader() {
  const mainCard = document.querySelector('.main-card');
  const dayTrigger = document.getElementById('day-trigger');
  const savedDay = localStorage.getItem('selectedDay');
  if (dayTrigger) {
    const dayText = dayTrigger.querySelector('.selected-day');
    if (dayText) dayText.textContent = savedDay || 'Tuesday';
  }
  mainCard.classList.remove('loading');
}

/* ---------------- UNIT CONVERSION HELPERS ---------------- */
function cToF(c) { return Math.round((c * 9/5) + 32); }
function kmhToMph(kmh) { return Math.round(kmh / 1.609); }
function mmToInches(mm) { return (mm / 25.4).toFixed(2); }

/* ---------------- UPDATE UNITS (fix) ---------------- */
function updateUnits(changedGroup = null) {
  const isF = document.querySelector('.option[data-value="fahrenheit"]')?.classList.contains('selected');
  const isMph = document.querySelector('.option[data-value="mph"]')?.classList.contains('selected');
  const isInches = document.querySelector('.option[data-value="inches"]')?.classList.contains('selected');

  // --- Temperature update ---
  if (!changedGroup || changedGroup === "temp") {
    if (currentWeather) {
      const tempC = Math.round(currentWeather.temperature_2m);
      const feelsC = Math.round(currentWeather.apparent_temperature);
      const tempEl = document.querySelector(".temp");
      const feelsEl = document.querySelector(".stat:nth-child(1) .value");
      if (tempEl) tempEl.textContent = isF ? `${cToF(tempC)}°` : `${tempC}°`;
      if (feelsEl) feelsEl.textContent = isF ? `${cToF(feelsC)}°` : `${feelsC}°`;
    }

    // hourly temps — convert from stored base Celsius
    document.querySelectorAll('.hour').forEach(hourEl => {
      const baseC = parseFloat(hourEl.dataset.tempC);
      if (isNaN(baseC)) return;
      const display = isF ? `${cToF(baseC)}°` : `${Math.round(baseC)}°`;
      const tempEl = hourEl.querySelector('.temp-h');
      if (tempEl) tempEl.textContent = display;
    });
  }

  // --- Wind update ---
  if (!changedGroup || changedGroup === "wind") {
    if (currentWeather) {
      const windKmh = Math.round(currentWeather.wind_speed_10m ?? 0);
      const windEl = document.querySelector(".stat:nth-child(3) .value");
      if (windEl) windEl.textContent = isMph ? `${kmhToMph(windKmh)} mph` : `${windKmh} km/h`;
    }
  }

  // --- Precipitation update ---
  if (!changedGroup || changedGroup === "prec") {
    if (currentWeather) {
      const precMm = currentWeather.precipitation ?? 0;
      const precEl = document.querySelector(".stat:nth-child(4) .value");
      if (precEl) precEl.textContent = isInches ? `${mmToInches(precMm)} in` : `${precMm} mm`;
    }
  }
}









