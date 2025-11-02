// perfil.js (CÓDIGO CORREGIDO)
const API_URL = "http://127.0.0.1:8000";

document.addEventListener("DOMContentLoaded", async () => {
    const perfilContainer = document.getElementById("perfilContainer");
    
    // 🔑 CORRECCIÓN: Lee las claves de sesión separadas
    const nombreUsuario = localStorage.getItem("nombre");
    const correoUsuario = localStorage.getItem("correo");
    
    let user = null;
    if (nombreUsuario && correoUsuario) {
        user = {
            nombre: nombreUsuario,
            correo: correoUsuario
        };
    }

    // 🧩 Si no hay usuario logueado
    if (!user) {
        perfilContainer.innerHTML = `
            <div class="perfil-error">
                <p>No estás logueado. <a href="login.html">Inicia sesión</a></p>
            </div>
        `;
        return;
    }

    try {
        // 🧠 Petición al backend para obtener el perfil (usa user.correo)
        const res = await fetch(`${API_URL}/perfil/${encodeURIComponent(user.correo)}`);
        if (!res.ok) throw new Error("Error al obtener el perfil");

        const data = await res.json();

        // 🧩 Mostrar datos del usuario
        perfilContainer.innerHTML = `
            <div class="perfil-card">
                <h2><i class="fa-solid fa-user"></i> Usuario: ${data.nombre || user.nombre}</h2>
                <p><strong>Correo:</strong> ${data.correo}</p>

                <div class="pokemon-fav">
                    <h3>Pokémon favorito:</h3>
                    ${
                        data.pokemon_favorito
                          ? `
                            <div class="poke-info">
                                <img src="${data.pokemon_favorito.imagen}" 
                                     alt="${data.pokemon_favorito.nombre}" 
                                     class="poke-fav-img">
                                <p>${data.pokemon_favorito.nombre}</p>
                            </div>`
                          : `
                            <p>No has seleccionado un Pokémon favorito aún.</p>
                            <button id="goCatalogBtn" class="btn-catalogo">Ir al catálogo</button>
                            `
                    }
                </div>

                <button id="logoutBtn" class="btn-logout">Cerrar sesión</button>
            </div>
        `;

        // 🔹 Eventos
        const goCatalogBtn = document.getElementById("goCatalogBtn");
        if (goCatalogBtn) {
            goCatalogBtn.addEventListener("click", () => {
                window.location.href = "catalogo.html";
            });
        }

        const logoutBtn = document.getElementById("logoutBtn");
        // 🔑 CORRECCIÓN: El logout debe eliminar las claves que usamos para guardar la sesión
        logoutBtn.addEventListener("click", () => {
            localStorage.removeItem("nombre");
            localStorage.removeItem("correo");
            window.location.href = "login.html";
        });

    } catch (e) {
        perfilContainer.innerHTML = `<p>Error al cargar perfil: ${e.message}</p>`;
    }
});