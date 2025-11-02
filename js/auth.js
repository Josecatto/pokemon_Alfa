const API_URL = "http://127.0.0.1:8000";

// Esperar a que el DOM cargue
document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ auth.js cargado correctamente");

  // ========== REGISTRO ==========
  // ========== REGISTRO ==========
const regBtn = document.getElementById("reg_btn");
if (regBtn) {
  regBtn.addEventListener("click", async () => {
    const nombre = document.getElementById("nombre").value.trim();
    const correo = document.getElementById("correo_reg").value.trim();
    const contrasena = document.getElementById("contrasena_reg").value.trim();


      if (!nombre || !correo || !contrasena) {
        alert("Por favor completa todos los campos");
        return;
      }

      try {
        const res = await fetch(`${API_URL}/registro`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre, correo, contrasena }),
        });

        const data = await res.json();

        if (!res.ok) {
          alert(data.detail || "Error al registrar usuario");
          return;
        }

        alert("✅ Registro exitoso. Ahora puedes iniciar sesión.");
      } catch (err) {
        console.error("Error en el registro:", err);
        alert("Error al conectar con el servidor.");
      }
    });
  }

  // ========== LOGIN (Versión combinada compatible con todo) ==========
  const logBtn = document.getElementById("log_btn");
  if (logBtn) {
    logBtn.addEventListener("click", async () => {
      const correo = document.getElementById("correo").value.trim();
      const contrasena = document.getElementById("contrasena").value.trim();

      if (!correo || !contrasena) {
        alert("Por favor ingresa correo y contraseña");
        return;
      }

      try {
        const res = await fetch(`${API_URL}/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ correo, contrasena }),
        });

        const data = await res.json();
        console.log("📦 Respuesta login:", data);

        if (!res.ok) {
          alert(data.detail || "Error al iniciar sesión");
          return;
        }

        // ✅ Guardar datos del usuario en ambos formatos para compatibilidad
        localStorage.setItem("nombre", data.nombre);
        localStorage.setItem("correo", data.correo);
        localStorage.setItem(
          "user",
          JSON.stringify({ nombre: data.nombre, correo: data.correo })
        );

        alert(`Bienvenido ${data.nombre}!`);

        // Redirige al catálogo (página principal después del login)
        window.location.href = "index.html";
      } catch (err) {
        console.error("Error al iniciar sesión:", err);
        alert("Error de conexión con el servidor.");
      }
    });
  }
});
