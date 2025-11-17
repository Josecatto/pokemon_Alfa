const API_URL = "http://127.0.0.1:8000";

document.addEventListener("DOMContentLoaded", () => {

    // ============================================================
    // 1. Verificar que el usuario sea ADMIN
    // ============================================================
    const rol = localStorage.getItem("rol");

    if (rol !== "admin") {
        alert("Acceso denegado. Solo administradores.");
        window.location.href = "index.html";
        return;
    }

    cargarUsuarios();
});


// ============================================================
// 2. Cargar usuarios desde el backend
// ============================================================
async function cargarUsuarios() {
    try {
        const res = await fetch(`${API_URL}/admin/usuarios`, {
            headers: { "x-rol": localStorage.getItem("rol") }
        });

        const usuarios = await res.json();

        mostrarUsuarios(usuarios);

    } catch (err) {
        console.error("❌ Error cargando usuarios:", err);
        alert("No se pudieron cargar los usuarios.");
    }
}


// ============================================================
// 3. Mostrar usuarios en la tabla
// ============================================================
function mostrarUsuarios(lista) {
    const contenedor = document.getElementById("usuarios_table_body");
    contenedor.innerHTML = "";

    lista.forEach(u => {
        const fila = document.createElement("tr");

        fila.innerHTML = `
            <td>${u.id}</td>
            <td>${u.nombre}</td>
            <td>${u.correo}</td>
            <td>
                <select onchange="cambiarRol(${u.id}, this.value)">
                    <option value="user" ${u.rol === "user" ? "selected" : ""}>Usuario</option>
                    <option value="admin" ${u.rol === "admin" ? "selected" : ""}>Admin</option>
                </select>
            </td>
            <td>
                <button class="delete-btn" onclick="eliminarUsuario(${u.id})">Eliminar</button>
            </td>
        `;
        contenedor.appendChild(fila);
    });
}
// ============================================================
// 4. Cambiar rol de un usuario
// ============================================================
async function cambiarRol(id, nuevoRol) {
    try {
        const res = await fetch(`${API_URL}/admin/usuarios/${id}/rol`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "x-rol": localStorage.getItem("rol")
            },
            body: JSON.stringify({ rol: nuevoRol })
        });
        const data = await res.json();
        if (!res.ok) {
            alert(data.detail || "Error cambiando rol");
            return;
        }
        alert("Rol actualizado correctamente");
    } catch (err) {
        console.error("❌ Error cambiando rol:", err);
    }
}
// ============================================================
// 5. Eliminar usuario
// ============================================================
async function eliminarUsuario(id) {
    const adminEmail = localStorage.getItem("correo");
    // Evita que el admin se borre a sí mismo
    if (id == localStorage.getItem("usuario_id")) {
        alert("No puedes eliminar tu propia cuenta (Admin).");
        return;
    }
    if (!confirm("¿Seguro que deseas eliminar este usuario?")) return;
    try {
        const res = await fetch(`${API_URL}/admin/usuarios/${id}`, {
            method: "DELETE",
            headers: { "x-rol": localStorage.getItem("rol") }
        });
        const data = await res.json();
        if (!res.ok) {
            alert(data.detail || "Error eliminando usuario");
            return;
        }
        alert("Usuario eliminado");
        cargarUsuarios();
    } catch (err) {
        console.error("❌ Error eliminando usuario:", err);
    }
}
