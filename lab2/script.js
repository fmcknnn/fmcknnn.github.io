mapboxgl.accessToken =
  "pk.eyJ1IjoibWNrbm5uIiwiYSI6ImNta2NpYm13ejAxMWwzY3M4dmFhbHk4bWgifQ.lVoYdrFS401tyEMR3be8_A";

const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mcknnn/cmkmldzav00h901qu53rs0rhf",
  center: [-4.2518, 55.8642], // Glasgow
  zoom: 10
});

map.on("load", () => {
  map.on("mousemove", (event) => {
    const dzone = map.queryRenderedFeatures(event.point, {
      layers: ["glasgow-smid-98sa99"]
    });
    document.getElementById("pd").innerHTML = dzone.length
      ? `<h3>${dzone[0].properties.DZName}</h3>
         <p>Rank: <strong>${dzone[0].properties.Percentv2}</strong> %</p>`
      : "<p>Hover over a data zone!</p>";
    map.getSource("hover").setData({
      type: "FeatureCollection",
      features: dzone.map(function (f) {
        return { type: "Feature", geometry: f.geometry };
      })
    });
  });
});

map.on("load", () => {
  const layers = [
    "<10",
    "20 ",
    "30 ",
    "40 ",
    "50 ",
    "60 ",
    "70 ",
    "80 ",
    "90 ",
    "100"
  ];

  const colors = [
    "#67001f",
    "#b2182b",
    "#d6604d",
    "#f4a582",
    "#fddbc7",
    "#d1e5f0",
    "#92c5de",
    "#4393c3",
    "#2166ac",
    "#053061"
  ];

  // Convert hex → rgba with 80% opacity
  function hexToRgba(hex, alpha = 0.8) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // create legend
  const legend = document.getElementById("legend");

  layers.forEach((layer, i) => {
    const key = document.createElement("div");

    // white text on darkest colours
    if (i <= 1 || i >= 8) {
      key.style.color = "white";
    }

    key.className = "legend-key";
    key.style.backgroundColor = hexToRgba(colors[i], 0.8);
    key.innerHTML = `${layer}`;
    legend.appendChild(key);
  });

  map.addSource("hover", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] }
  });

  map.addLayer({
    id: "dz-hover",
    type: "line",
    source: "hover",
    layout: {},
    paint: {
      "line-color": "yellow",
      "line-width": 1.25
    }
  });
});

map.addControl(new mapboxgl.NavigationControl(), "top-left");
map.addControl(
  new mapboxgl.GeolocateControl({
    positionOptions: {
      enableHighAccuracy: true
    },
    trackUserLocation: true,
    showUserHeading: true
  }),
  "top-left"
);
const geocoder = new MapboxGeocoder({
  // Initialize the geocoder
  accessToken: mapboxgl.accessToken, // Set the access token
  mapboxgl: mapboxgl, // Set the mapbox-gl instance
  marker: false, // Do not use the default marker style
  placeholder: "Search for places in Glasgow", // Placeholder text for the search bar
  proximity: {
    longitude: 55.8642,
    latitude: 4.2518
  } // Coordinates of Glasgow center
});
map.addControl(geocoder, "top-left");