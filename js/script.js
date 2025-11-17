/**
 * script.js
 * ---------------------------------------------------------------
 * Carga y muestra el catálogo de Pokémon de Kanto.
 * Funcionalidades:
 *  - Consumir la API propia → /pokemons/kanto
 *  - Guardar caché local en localStorage
 *  - Filtrar Pokémon por nombre
 *  - Mostrar tarjetas (cards) dinámicas
 *  - Navegar al detalle de cada Pokémon
 * ---------------------------------------------------------------
 */

const API_URL = "http://127.0.0.1:8000"; // URL del backend (FastAPI)

// Referencias al DOM
const container = document.getElementById("pokemonContainer");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const resetBtn = document.getElementById("resetBtn");

// Lista completa de Pokémon cargados
let allPokemons = [];

/* ============================================================
 * 1. Cargar Pokémon desde el backend O desde caché
 * ============================================================ */
async function loadKanto() {

    // Avisar al usuario que se está cargando
    container.innerHTML = "<p>Cargando Pokémon de Kanto...</p>";

    // 1) Intentar cargar desde localStorage (caché)
    const cached = localStorage.getItem("kantoPokemons");
    if (cached) {
        try {
            allPokemons = JSON.parse(cached);
            console.log("📦 Datos cargados desde caché local.");
            displayPokemons(allPokemons);
            return; // No llamar al backend
        } catch (err) {
            console.warn("⚠️ Error leyendo la caché. Se usará el backend.", err);
        }
    }

    // 2) Si no hay caché, pedir al backend
    try {
        const res = await fetch(`${API_URL}/pokemons/kanto`);

        if (!res.ok) {
            throw new Error(`Error del servidor: ${res.status}`);
        }

        const data = await res.json();
        allPokemons = data;

        // Guardar caché para carga futura instantánea
        localStorage.setItem("kantoPokemons", JSON.stringify(allPokemons));

        console.log("✨ Pokémon cargados desde el backend.");
        displayPokemons(allPokemons);

    } catch (err) {
        container.innerHTML = `<p>Error al cargar Pokémon: ${err.message}</p>`;
        console.error("❌ Error:", err);
    }
}

/* ============================================================
 * 2. Mostrar lista de Pokémon en pantalla
 * ============================================================ */
function displayPokemons(list) {

    // Limpiar contenedor
    container.innerHTML = "";

    // Si no hay resultados
    if (!list || list.length === 0) {
        container.innerHTML = "<p>No se encontraron Pokémon.</p>";
        return;
    }

    // Crear una card por cada Pokémon
    list.forEach(pokemon => {

        const card = document.createElement("div");
        card.className = "pokemon-card";

        const img = pokemon.image || "https://via.placeholder.com/120";

        card.innerHTML = `
            <img src="${img}" alt="${pokemon.name}">
            <h3>${pokemon.name}</h3>
            <p>${(pokemon.types || []).join(", ")}</p>
        `;

        // Al hacer clic → ir a detalles
        card.addEventListener("click", () => {
            window.location.href = `detalles.html?id=${encodeURIComponent(pokemon.id)}`;
        });

        container.appendChild(card);
    });
}

/* ============================================================
 * 3. Buscar Pokémon por nombre
 * ============================================================ */
searchBtn.addEventListener("click", () => {
    const term = searchInput.value.trim().toLowerCase();

    if (!term) return;

    const resultado = allPokemons.filter(p =>
        p.name.toLowerCase().includes(term)
    );

    displayPokemons(resultado);
});

/* ============================================================
 * 4. Restablecer búsqueda
 * ============================================================ */
resetBtn.addEventListener("click", () => {
    searchInput.value = "";
    displayPokemons(allPokemons);
});

/* ============================================================
 * 5. Inicializar catálogo
 * ============================================================ */
loadKanto();
