/**
 * detalle.js
 * ---------------------------------------------------------------
 * Muestra la información completa de un Pokémon.
 * Incluye:
 *  - Obtención de detalle desde el backend (BD o PokeAPI)
 *  - Llamado al endpoint de IA para descripción y debilidades
 *  - Guardar Pokémon favorito del usuario (si está logueado)
 * ---------------------------------------------------------------
 */

const API_URL = "http://127.0.0.1:8000";
const container = document.getElementById("detalleContainer");

// Obtener el ID o nombre del Pokémon desde la URL:
// ejemplo → detalle.html?id=25
const params = new URLSearchParams(window.location.search);
const id = params.get("id");

/**
 * Obtiene la información del usuario logueado desde localStorage.
 */
function getLoggedUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

/**
 * Función principal: carga el detalle del Pokémon.
 */
async function loadDetails() {
  if (!id) {
    container.innerHTML = "<p>No se indicó un Pokémon.</p>";
    return;
  }

  container.innerHTML = "<p>Cargando detalle...</p>";

  try {
    /* =========================================================
     * 1. Solicitar el Pokémon al backend
     * ========================================================= */
    const res = await fetch(`${API_URL}/pokemon/${encodeURIComponent(id)}`);

    if (!res.ok) {
      container.innerHTML = `<p>Pokémon no encontrado (error ${res.status}).</p>`;
      return;
    }

    const p = await res.json();

    /* =========================================================
     * 2. Renderizar información básica del Pokémon
     * ========================================================= */
    const types = Array.isArray(p.types) ? p.types.join(", ") : p.types;

    container.innerHTML = `
      <div class="card">
        <img src="${p.image || "https://via.placeholder.com/200"}" alt="${p.name}">
        <h2>${p.name}</h2>

        <p><strong>Tipos:</strong> ${types}</p>
        <p><strong>Altura:</strong> ${p.height ? p.height + " m" : "—"}</p>
        <p><strong>Peso:</strong> ${p.weight ? p.weight + " kg" : "—"}</p>
        <p><strong>Habilidades:</strong> ${p.abilities || "—"}</p>

        <!-- Área donde la IA colocará la descripción -->
        <div id="iaArea"><em>Generando descripción con IA...</em></div>

        <!-- Área donde se mostrará botón de favorito -->
        <div id="favArea"></div>
      </div>`;

    /* =========================================================
     * 3. Mostrar botón "Marcar como favorito"
     *    SOLO SI hay usuario logueado
     * ========================================================= */
    const user = getLoggedUser();
    const favArea = document.getElementById("favArea");

    if (user && user.correo) {
      // Mostrar botón
      favArea.innerHTML = `<button id="favBtn">Marcar como favorito</button>`;

      // Evento del botón
      document.getElementById("favBtn").addEventListener("click", async () => {
        const body = { correo: user.correo, pokemon: p.name };

        const r = await fetch(`${API_URL}/favorito`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });

        const j = await r.json();
        alert(j.mensaje || "Favorito guardado");
      });
    } else {
      // Si no hay usuario logueado, invitar a iniciar sesión
      favArea.innerHTML = `
        <p>
          <a href="login.html">Inicia sesión</a> para guardar favoritos
        </p>`;
    }

    /* =========================================================
     * 4. Solicitar descripción generada por IA
     * ========================================================= */
    try {
      const r2 = await fetch(`${API_URL}/descripcion/${encodeURIComponent(p.name)}`);

      if (!r2.ok) {
        document.getElementById("iaArea").innerHTML =
          "<p>No se pudo generar la descripción con IA.</p>";
        return;
      }

      const iaData = await r2.json();

      document.getElementById("iaArea").innerHTML = `
        <p>${iaData.descripcion}</p>
        ${
          iaData.debilidades
            ? `<p><strong>Debilidades:</strong> ${iaData.debilidades}</p>`
            : ""
        }
      `;
    } catch (errIA) {
      document.getElementById("iaArea").innerHTML =
        `<p>Error al contactar IA: ${errIA}</p>`;
    }
  } catch (err) {
    container.innerHTML = `<p>Error general: ${err}</p>`;
  }
}

// Ejecutar la función principal
loadDetails();
