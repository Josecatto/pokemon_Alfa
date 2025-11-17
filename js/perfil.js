/**
 * perfil.js
 * ---------------------------------------------------------------
 * Carga y muestra la información del usuario logueado.
 * Se conecta al endpoint `/perfil/{correo}` del backend.
 *
 * Funcionalidades:
 *  - Verificar sesión del usuario (localStorage)
 *  - Obtener datos del usuario desde FastAPI
 *  - Mostrar Pokémon favorito si existe
 *  - Botón "Ir al catálogo" cuando no tiene favorito
 *  - Cerrar sesión limpiando el localStorage
 * ---------------------------------------------------------------
 */

const API_URL = "http://127.0.0.1:8000";

document.addEventListener("DOMContentLoaded", async () => {

    const perfilContainer = document.getElementById("perfilContainer");

    /* ============================================================
     * 1. Recuperar usuario logueado desde localStorage
     *    (la información se guarda en login.js)
     * ============================================================ */
const user = JSON.parse(localStorage.getItem("user") || "null");

if (!user || !user.correo) {
    perfilContainer.innerHTML = `
        <div class="perfil-error">
            <p>No estás logueado. <a href="login.html">Inicia sesión</a></p>
        </div>`;
    return;
}


    // Si no está logueado, mostrar mensaje y detener ejecución
    if (!user) {
        perfilContainer.innerHTML = `
            <div class="perfil-error">
                <p>No estás logueado. <a href="login.html">Inicia sesión</a></p>
            </div>`;
        return;
    }

    /* ============================================================
     * 2. Consultar perfil en el backend
     * ============================================================ */
    try {
        const res = await fetch(`${API_URL}/perfil/${encodeURIComponent(user.correo)}`);

        if (!res.ok) {
            throw new Error("Error al obtener el perfil desde el servidor.");
        }

        const data = await res.json();

        /* ========================================================
         * 3. Dibujar tarjeta del perfil en pantalla
         * ======================================================== */
        perfilContainer.innerHTML = `
            <div class="perfil-card">
                
                <!-- Nombre del usuario -->
                <h2><i class="fa-solid fa-user"></i> Usuario: ${data.nombre}</h2>
                <p><strong>Correo:</strong> ${data.correo}</p>

                <!-- Pokémon favorito -->
                <div class="pokemon-fav">
                    <h3>Pokémon favorito:</h3>

                    ${
                        data.pokemon_favorito && data.pokemon_favorito.nombre
                        ? `
                            <div class="poke-info">
                                <img 
                                    src="${data.pokemon_favorito.imagen}" 
                                    alt="${data.pokemon_favorito.nombre}" 
                                    class="poke-fav-img"
                                >
                                <p>${data.pokemon_favorito.nombre}</p>
                            </div>`
                        : `
                            <p>No has seleccionado un Pokémon favorito aún.</p>`}`;

    } catch (err) {
        perfilContainer.innerHTML = `
            <p>Error al cargar perfil: ${err.message}</p>
        `;
    }
});
