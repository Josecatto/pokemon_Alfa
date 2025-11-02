const API_URL = "http://127.0.0.1:8000";
const nombreUsuario =
  localStorage.getItem("nombre") || localStorage.getItem("correo") || "Anónimo";

// === Crear mapa centrado en Bogotá (por defecto) ===
const map = L.map("map").setView([4.6097, -74.0817], 13);

// Cargar capa base (OpenStreetMap)
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

// === Diccionario de marcadores ===
const marcadores = {};

// === Íconos personalizados ===

// Pokéball (otros usuarios)
const pokeIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -28],
});

// Great Ball (usuario actual)
const myIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/great-ball.png",
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -30],
});

// === Conectarse al WebSocket ===
const ws = new WebSocket(`ws://127.0.0.1:8000/ws/${nombreUsuario}`);

ws.onopen = () => {
  console.log(`🛰️ Conectado al servidor WebSocket como ${nombreUsuario}`);

  // Enviar ubicación inicial si el navegador lo permite
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      enviarUbicacion(latitude, longitude);
      map.setView([latitude, longitude], 14);

      // Mostrar tu propio marcador inmediatamente
      agregarOMoverMarcador(nombreUsuario, latitude, longitude);
    });
  }
};

// === Enviar ubicación al servidor ===
function enviarUbicacion(lat, lng) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        tipo: "ubicacion",
        usuario: nombreUsuario,
        lat,
        lng,
      })
    );
  }
}

// === Manejar mensajes entrantes del servidor ===
ws.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);

    if (data.tipo === "ubicacion") {
      const { usuario, lat, lng } = data;
      console.log(`📍 ${usuario}: ${lat}, ${lng}`);

      // Mostrar o actualizar marcador
      agregarOMoverMarcador(usuario, lat, lng);
    }
  } catch (err) {
    console.error("⚠️ Error procesando mensaje WebSocket:", err);
  }
};

// === Función auxiliar para crear o mover marcadores ===
function agregarOMoverMarcador(usuario, lat, lng) {
  const icono = usuario === nombreUsuario ? myIcon : pokeIcon;

  if (marcadores[usuario]) {
    marcadores[usuario].setLatLng([lat, lng]);
  } else {
    marcadores[usuario] = L.marker([lat, lng], { icon: icono })
      .addTo(map)
      .bindPopup(`<b>${usuario}</b>`);
  }
}

// === Actualizar ubicación cada 15 segundos (simulación o movimiento real) ===
setInterval(() => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      enviarUbicacion(latitude, longitude);
      agregarOMoverMarcador(nombreUsuario, latitude, longitude);
    });
  }
}, 15000);
