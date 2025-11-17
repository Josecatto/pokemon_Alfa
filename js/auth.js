/**
 * auth.js
 * --------------------------------------------
 * Maneja el registro y el inicio de sesión.
 * Se comunica con el backend FastAPI mediante fetch.
 * Guarda los datos del usuario autenticado en localStorage.
 * --------------------------------------------
 */

const API_URL = "http://127.0.0.1:8000";

// Esperar a que el HTML termine de cargar
document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ auth.js cargado correctamente");

  /* =====================================================
   * 1. REGISTRO DE USUARIO
   * ===================================================== */

  const regBtn = document.getElementById("reg_btn");

  if (regBtn) {
    regBtn.addEventListener("click", async () => {
      // Tomar valores del formulario de registro
      const nombre = document.getElementById("nombre_reg").value.trim();
      const correo = document.getElementById("correo_reg").value.trim();
      const contrasena = document.getElementById("contrasena_reg").value.trim();

      // Validación mínima
      if (!nombre || !correo || !contrasena) {
        alert("Por favor completa todos los campos.");
        return;
      }

      try {
        // Enviar solicitud al backend
        const res = await fetch(`${API_URL}/registro`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre, correo, contrasena }),
        });

        const data = await res.json();

        // Si hubo error, mostrar mensaje del backend
if (!res.ok) {
    // Mostrar errores de FastAPI correctamente
    if (data.detail) {
        if (typeof data.detail === "string") {
            alert(data.detail);
        } else if (Array.isArray(data.detail)) {
            alert(data.detail[0].msg);  // Muestra la validación exacta
        } else {
            alert("Error al registrar usuario.");
        }
    }
    return;
}


        alert("✅ Registro exitoso. Ahora puedes iniciar sesión.");

      } catch (err) {
        console.error("❌ Error en el registro:", err);
        alert("Error al conectar con el servidor.");
      }
    });
  }

/* =====================================================
 * 2. LOGIN DE USUARIO
 * ===================================================== */

const logBtn = document.getElementById("log_btn");

if (logBtn) {
  logBtn.addEventListener("click", async () => {
    const correo = document.getElementById("correo").value.trim();
    const contrasena = document.getElementById("contrasena").value.trim();

    if (!correo || !contrasena) {
      alert("Por favor ingresa correo y contraseña.");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo, contrasena }),
      });

      const data = await res.json();
      console.log("📦 Respuesta del login:", data);

      if (!res.ok) {
        alert(data.detail || "Error al iniciar sesión.");
        return;
      }

      // Guardar datos en localStorage
      localStorage.setItem("nombre", data.nombre);
      localStorage.setItem("correo", data.correo);
      localStorage.setItem("rol", data.rol);

      localStorage.setItem(
        "user",
        JSON.stringify({
          nombre: data.nombre,
          correo: data.correo,
          rol: data.rol,
        })
      );

      alert(`Bienvenido ${data.nombre}!`);

      // 🔥 Redirección según rol
      if (data.rol === "admin") {
        window.location.href = "admin.html";
      } else {
        window.location.href = "index.html";
      }

    } catch (err) {
      console.error("❌ Error al iniciar sesión:", err);
      alert("Error de conexión con el servidor.");
    }
  });
}
});