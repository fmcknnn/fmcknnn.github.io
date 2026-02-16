//--MAP INITIALISATION--//
mapboxgl.accessToken = "pk.eyJ1IjoibWNrbm5uIiwiYSI6ImNta2NpYm13ejAxMWwzY3M4dmFhbHk4bWgifQ.lVoYdrFS401tyEMR3be8_A";

const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mcknnn/cmkcmaz2w002n01sb1yl40fb1",
  center: [-4.1826, 56.8169],
  zoom: 5.5
});

let userCoords = null;
let userMarker = null;

const popup = new mapboxgl.Popup({
  closeButton: true,
  closeOnClick: false
});
popup.on("close", () => {
  if (map.getSource("route")) {
    map.removeLayer("route");
    map.removeSource("route");
  }

  map.flyTo({
    center: [-4.1826, 56.8169],
    zoom: 5.5,
    speed: 3,
    curve: 1.4
  });
});

//---NAVIGATION & ROUTING API---//
async function geocodeLocation(query) {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxgl.accessToken}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data.features && data.features.length ? data.features[0].center : null;
  } catch (err) {
    console.error("Geocoding error:", err);
    return null;
  }
}

async function getRoute(start, end) {
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${start[0]},${start[1]};${end[0]},${end[1]}?geometries=geojson&steps=true&overview=full&access_token=${mapboxgl.accessToken}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return (data.routes && data.routes.length) ? data.routes[0] : null;
  } catch (err) {
    console.error("Routing error:", err);
    return null;
  }
}

function drawRouteOnMap(route) {
  const geojson = {
    type: "Feature",
    geometry: route.geometry
  };

  if (map.getSource("route")) {
    map.getSource("route").setData(geojson);
  } else {
    map.addSource("route", { type: "geojson", data: geojson });
    map.addLayer({
      id: "route",
      type: "line",
      source: "route",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#556B2F",
        "line-width": 5,
        "line-opacity": 0.8
      }
    });
  }
}

function clearRoute() {
  if (map.getSource("route")) {
    map.getSource("route").setData({ type: "FeatureCollection", features: [] });
  }
  if (map.getSource("nearest-station")) {
    map.getSource("nearest-station").setData({ type: "FeatureCollection", features: [] });
  }
  document.getElementById("directions-widget").style.display = "none";
}

//---MAP EVENTS---//
map.on("load", () => {
  // Pale Yellow Station Highlight Source
  map.addSource("nearest-station", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] }
  });

  map.addLayer({
    id: "nearest-station-layer",
    type: "circle",
    source: "nearest-station",
    paint: {
      "circle-radius": 12,
      "circle-color": "#FFF9C4",
      "circle-opacity": 0.7,
      "circle-stroke-width": 2,
      "circle-stroke-color": "#FBC02D"
    }
  });

  map.on("idle", () => {
    const gardens = map.querySourceFeatures("composite", {
      sourceLayer: "Garden_Centroids_Scotland_2-8jwfy7"
    });
    if (gardens.length > 0) buildFilterPanel(gardens);
  });

  map.on("click", (event) => {
    const features = map.queryRenderedFeatures(event.point, {
      layers: ["Garden_Centroids_Scotland_2-8jwfy7"]
    });
    if (!features.length) {
      popup.remove();
      clearRoute();
      return;
    }
    selectGarden(features[0]);
  });
});

//---GARDEN SELECTION & DIRECTIONS---//
async function selectGarden(g) {
  const props = g.properties;
  const coords = g.geometry.coordinates;

  // 1. Station Calculation (Keep your existing logic)
  let stations = map.querySourceFeatures("composite", {
    sourceLayer: "Railway_Stations_Scotland_v2-1w0e00"
  });

  let nearestStation = null;
  let minDist = Infinity;

  if (stations.length > 0) {
    stations.forEach(st => {
      if (!st.geometry || !st.geometry.coordinates) return;
      const dist = turf.distance(turf.point(coords), turf.point(st.geometry.coordinates));
      if (dist < minDist) {
        minDist = dist;
        nearestStation = st;
      }
    });
  }

  // Update Station Highlight
  if (map.getSource("nearest-station")) {
    map.getSource("nearest-station").setData({
      type: "FeatureCollection",
      features: nearestStation ? [nearestStation] : []
    });
  }

  // 2. Garden Popup (Triggers regardless of user location)
  popup.setLngLat(coords)
    .setHTML(`
      <h3 style="margin:0;">${props.DES_TITLE}</h3>
      <a href="${props.LINK}" target="_blank" style="display:block; margin-top:5px;">View Details</a>
    `)
    .addTo(map);

  // 3. Routing vs Zoom Logic
  if (userCoords) {
    // IF USER LOCATION IS SET: Show Route and Widget
    const route = await getRoute(userCoords, coords);
    if (route) {
      drawRouteOnMap(route);

      const steps = route.legs[0].steps;
      let html = `<p style="margin-top:0; font-weight:bold; color:#556B2F;">Route Steps:</p><ol style="padding-left:18px; margin:0;">`;
      steps.forEach(s => {
        html += `<li style="margin-bottom:8px; border-bottom:1px solid rgba(85,107,47,0.1); padding-bottom:4px;">${s.maneuver.instruction}</li>`;
      });
      html += `</ol>`;

      const widget = document.getElementById("directions-widget");
      const content = document.getElementById("widget-directions-list");
      const title = document.getElementById("widget-title");

      if (widget && content) {
        if (title) title.textContent = `Directions to ${props.DES_TITLE}`; // UPDATED HEADER
        content.innerHTML = html;
        widget.style.display = "flex"; 
      }

      // Fit map to show user, route, and garden
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend(userCoords);
      bounds.extend(coords);
      map.fitBounds(bounds, { padding: 80 });
    }
  } else {
    map.flyTo({
      center: coords,
      zoom: 9,
      essential: true,
      speed: 1.2
    });
    
    document.getElementById("directions-widget").style.display = "none";
  }
}

//---UI CONTROL LISTENERS---//

// Set Location via Button
document.getElementById("set-location").addEventListener("click", async () => {
  const input = document.getElementById("user-location").value.trim();
  if (!input) return alert("Please enter a location.");

  const coords = await geocodeLocation(input);
  if (!coords) return alert("Location not found.");

  userCoords = coords;
  if (userMarker) userMarker.remove();
  userMarker = new mapboxgl.Marker({ color: "#556B2F" }).setLngLat(coords).addTo(map);
  map.flyTo({ center: coords, zoom: 8 });
});

// Set Location via Enter Key
document.getElementById("user-location").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    document.getElementById("set-location").click();
  }
});

// Widget Close logic
document.getElementById("close-widget").onclick = () => {
  document.getElementById("directions-widget").style.display = "none";
};

// Directory Panel toggle
document.getElementById("directory-toggle").onclick = () => {
  document.getElementById("directory-panel").classList.add("active");
};

document.getElementById("close-directory").onclick = () => {
  document.getElementById("directory-panel").classList.remove("active");
};

// Reset Location
document.getElementById("reset-location").onclick = () => {
  userCoords = null;
  if (userMarker) userMarker.remove();
  document.getElementById("user-location").value = "";
  clearRoute();
  popup.remove();
  map.flyTo({ center: [-4.1826, 56.8169], zoom: 5.5 });
};

//---DIRECTORY BUILDER & BUTTONS---//

// Expand All
document.getElementById("expand-all").addEventListener("click", () => {
  const lists = document.querySelectorAll(".garden-list");
  const icons = document.querySelectorAll(".la-header span");
  lists.forEach(list => (list.style.display = "block"));
  icons.forEach(icon => (icon.textContent = "-"));
});

// Collapse All
document.getElementById("collapse-all").addEventListener("click", () => {
  const lists = document.querySelectorAll(".garden-list");
  const icons = document.querySelectorAll(".la-header span");
  lists.forEach(list => (list.style.display = "none"));
  icons.forEach(icon => (icon.textContent = "+"));
});

function buildFilterPanel(features) {
  const container = document.getElementById("accordion-container");
  if (!container) return;
  container.innerHTML = "";

  const grouped = {};
  features.forEach(f => {
    const la = f.properties.LOCAL_AUTH || "Other";
    if (!grouped[la]) grouped[la] = [];
    if (!grouped[la].find(g => g.properties.DES_TITLE === f.properties.DES_TITLE)) {
      grouped[la].push(f);
    }
  });

  Object.keys(grouped).sort().forEach(la => {
    const laGroup = document.createElement("div");
    laGroup.className = "la-group";
    laGroup.innerHTML = `
      <div class="la-header">${la} <span>+</span></div>
      <div class="garden-list" style="display:none; padding-left:15px;"></div>
    `;

    const list = laGroup.querySelector(".garden-list");
    grouped[la].sort((a, b) => a.properties.DES_TITLE.localeCompare(b.properties.DES_TITLE));

    grouped[la].forEach(g => {
      const item = document.createElement("div");
      item.className = "garden-item";
      item.style.cursor = "pointer";
      item.textContent = g.properties.DES_TITLE;
      item.onclick = (e) => {
        e.stopPropagation();
        selectGarden(g);
        document.getElementById("directory-panel").classList.remove("active");
      };
      list.appendChild(item);
    });

    laGroup.querySelector(".la-header").onclick = () => {
      const isOpen = list.style.display === "block";
      list.style.display = isOpen ? "none" : "block";
      laGroup.querySelector("span").textContent = isOpen ? "+" : "-";
    };
    container.appendChild(laGroup);
  });
}