const CONTRACT_ADDRESS = "0xcomingsoon";
const HANTAVIRUS_ENDPOINTS = [
  "https://raw.githubusercontent.com/AntavGlobal/hantavirus-live-data/main/hantavirus.json",
  "./data/hantavirus.json",
];
const COUNTRIES_GEOJSON_URL =
  "./data/countries.geojson";

const COUNTRY_ALIASES = new Map([
  ["United States", "United States of America"],
  ["Russia", "Russian Federation"],
  ["South Korea", "Republic of Korea"],
  ["North Korea", "Democratic People's Republic of Korea"],
  ["Czech Republic", "Czechia"],
  ["Syria", "Syrian Arab Republic"],
  ["Laos", "Lao People's Democratic Republic"],
  ["Moldova", "Republic of Moldova"],
  ["Tanzania", "United Republic of Tanzania"],
  ["Vietnam", "Viet Nam"],
  ["Swaziland", "Eswatini"],
  ["Ivory Coast", "Cote d'Ivoire"],
  ["Brunei", "Brunei Darussalam"],
  ["Cape Verde", "Cabo Verde"],
]);

const copyButton = document.getElementById("copy-button");
const contractAddress = document.getElementById("contract-address");
const totalInfectedEl = document.getElementById("infected-total");
const totalDeathsEl = document.getElementById("death-total");
const latestUpdateEl = document.getElementById("latest-update");
const countryListEl = document.getElementById("country-list");
const sourceStatusEl = document.getElementById("source-status");
const communityCounterEl = document.getElementById("community-counter");
const intelHeadlineEl = document.getElementById("intel-headline");
const intelQuoteEl = document.getElementById("intel-quote");
const mobileMenuButton = document.getElementById("mobile-menu-button");
const mobileMenu = document.getElementById("mobile-menu");
const mobileMenuIcon = document.getElementById("mobile-menu-icon");
const mobileNavLinks = document.querySelectorAll(".mobile-nav-link");

let map;
let geoJsonLayer;

function normalizeCountryName(countryName) {
  return COUNTRY_ALIASES.get(countryName) || countryName;
}

function getSeverityColor(infected) {
  if (infected >= 6) {
    return "#ff3b30";
  }
  if (infected >= 3) {
    return "#d4231b";
  }
  if (infected >= 1) {
    return "#ff8b84";
  }
  return "#1d0d0d";
}

function formatDate(dateValue) {
  const date = new Date(dateValue);
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function renderCountryList(countries) {
  countryListEl.innerHTML = "";

  if (!countries.length) {
    countryListEl.innerHTML =
      '<p class="font-terminal-sm uppercase text-on-surface-variant">No active zones detected.</p>';
    return;
  }

  countries.forEach((country) => {
    const item = document.createElement("article");
    item.className =
      "border border-primary/10 bg-background/30 p-3 font-terminal-sm uppercase tracking-wide";
    item.innerHTML = `
      <strong>${country.country}</strong>
      <span class="mt-1 block text-on-surface-variant">${country.infected} confirmed cases</span>
      <span class="mt-1 block text-on-surface-variant">${country.deaths} confirmed deaths</span>
    `;
    countryListEl.appendChild(item);
  });
}

async function fetchFirstAvailable(urls) {
  const errors = [];

  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return { json: await response.json(), source: url };
    } catch (error) {
      errors.push(`${url}: ${error.message}`);
    }
  }

  throw new Error(errors.join(" | "));
}

function buildMap(casesByCountry, countriesGeoJson) {
  map = L.map("outbreak-map", {
    zoomControl: false,
    minZoom: 2,
    maxZoom: 6,
    worldCopyJump: true,
  }).setView([14, 0], 2);

  L.control.zoom({ position: "bottomright" }).addTo(map);

  geoJsonLayer = L.geoJSON(countriesGeoJson, {
    style(feature) {
      const countryName = feature.properties.ADMIN || feature.properties.name;
      const entry = casesByCountry.get(countryName) || { infected: 0 };

      return {
        fillColor: getSeverityColor(entry.infected),
        weight: 0.8,
        opacity: 1,
        color: "#5b2a2a",
        fillOpacity: 0.82,
      };
    },
    onEachFeature(feature, layer) {
      const countryName = feature.properties.ADMIN || feature.properties.name;
      const entry = casesByCountry.get(countryName) || { infected: 0, deaths: 0 };

      layer.bindPopup(
        `<strong>${countryName}</strong><br />Cases: ${entry.infected}<br />Deaths: ${entry.deaths}`
      );

      layer.on({
        mouseover() {
          layer.setStyle({
            weight: 1.8,
            color: "#fff5f3",
            fillOpacity: 0.95,
          });
        },
        mouseout() {
          geoJsonLayer.resetStyle(layer);
        },
      });
    },
  }).addTo(map);
}

async function loadOutbreakData() {
  try {
    const [{ json: data, source }, { json: countriesGeoJson }] = await Promise.all([
      fetchFirstAvailable(HANTAVIRUS_ENDPOINTS),
      fetchFirstAvailable([COUNTRIES_GEOJSON_URL]),
    ]);

    const countriesWithCases = (data.zones || [])
      .filter((zone) => (zone.infected || 0) > 0 || (zone.deaths || 0) > 0)
      .sort((a, b) => b.infected - a.infected);

    const casesByCountry = new Map(
      (data.zones || []).map((zone) => [
        normalizeCountryName(zone.country),
        { infected: zone.infected || 0, deaths: zone.deaths || 0 },
      ])
    );

    totalInfectedEl.textContent = String(data.infected ?? "-");
    totalDeathsEl.textContent = String(data.deaths ?? "-");
    latestUpdateEl.textContent = data.latestUpdateAt
      ? formatDate(data.latestUpdateAt)
      : data.latestUpdate || "-";

    if (intelHeadlineEl) {
      intelHeadlineEl.textContent = `The outbreak feed is flashing ${data.infected || 0} confirmed cases and ${
        data.deaths || 0
      } deaths as red zones continue to trigger across the global surveillance grid.`;
    }

    if (intelQuoteEl) {
      const leadZone = countriesWithCases[0];
      intelQuoteEl.textContent = leadZone
        ? `>> Field monitors place ${leadZone.country} at the center of the current scare cycle with ${leadZone.infected} reported cases and ${leadZone.deaths} deaths now locked into the bulletin.`
        : ">> Emergency monitors confirm the latest bulletin remains active as surveillance rooms continue tracking the spread.";
    }
    if (communityCounterEl) {
      communityCounterEl.textContent = Intl.NumberFormat("en-US").format(
        14000 + (data.infected || 0) * 26
      );
    }

    renderCountryList(countriesWithCases);
    sourceStatusEl.textContent = `Live feed loaded from ${source}. Dataset timestamp: ${
      data.latestUpdate || data.latestUpdateAt || "unknown"
    }.`;

    buildMap(casesByCountry, countriesGeoJson);
  } catch (error) {
    totalInfectedEl.textContent = "ERR";
    totalDeathsEl.textContent = "ERR";
    latestUpdateEl.textContent = "ERR";
    sourceStatusEl.textContent = `Feed unavailable: ${error.message}`;
    countryListEl.innerHTML =
      '<p class="font-terminal-sm uppercase text-on-surface-variant">The surveillance room lost signal.</p>';
  }
}

async function copyContractAddress() {
  if (!copyButton || !contractAddress) {
    return;
  }

  const selectContractText = () => {
    contractAddress.focus();
    contractAddress.select();
    contractAddress.setSelectionRange(0, contractAddress.value.length);
  };

  const copyFallback = () => {
    const textArea = document.createElement("textarea");
    textArea.value = CONTRACT_ADDRESS;
    textArea.setAttribute("readonly", "");
    textArea.style.position = "fixed";
    textArea.style.top = "-1000px";
    textArea.style.left = "-1000px";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, textArea.value.length);

    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }

    document.body.removeChild(textArea);
    return copied;
  };

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(CONTRACT_ADDRESS);
    } else if (!copyFallback()) {
      throw new Error("Clipboard unavailable");
    }

    copyButton.innerHTML = "<span aria-hidden=\"true\">OK</span>";
    copyButton.classList.add("copied");
    copyButton.setAttribute("aria-label", "Copied");
  } catch {
    selectContractText();
    window.prompt("Copy contract address:", CONTRACT_ADDRESS);
    copyButton.innerHTML = "<span aria-hidden=\"true\">⧉</span>";
    copyButton.setAttribute("aria-label", "Copy manually");
    return;
  }

  window.setTimeout(() => {
    copyButton.innerHTML = "<span aria-hidden=\"true\">⧉</span>";
    copyButton.classList.remove("copied");
    copyButton.setAttribute("aria-label", "Copy contract address");
  }, 1800);
}

window.copyContractAddress = copyContractAddress;

if (copyButton) {
  copyButton.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await copyContractAddress();
  });
}

if (contractAddress) {
  contractAddress.addEventListener("click", () => {
    contractAddress.select();
    contractAddress.setSelectionRange(0, contractAddress.value.length);
  });
}

function setMobileMenuState(isOpen) {
  if (!mobileMenuButton || !mobileMenu || !mobileMenuIcon) {
    return;
  }

  mobileMenu.classList.toggle("hidden", !isOpen);
  mobileMenuButton.setAttribute("aria-expanded", String(isOpen));
  mobileMenuButton.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
  mobileMenuIcon.textContent = isOpen ? "×" : "≡";
}

if (mobileMenuButton && mobileMenu) {
  mobileMenuButton.addEventListener("click", () => {
    const isOpen = mobileMenu.classList.contains("hidden");
    setMobileMenuState(isOpen);
  });
}

mobileNavLinks.forEach((link) => {
  link.addEventListener("click", () => {
    setMobileMenuState(false);
  });
});

loadOutbreakData();
