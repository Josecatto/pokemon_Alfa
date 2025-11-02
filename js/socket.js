// === js/socket.js (CORREGIDO Y UNIFICADO) ===
// Conecta el chat al backend vía WebSocket y gestiona la sesión.

const API_WS = "ws://127.0.0.1:8000/ws";

// 🧩 1. Verificar sesión y obtener el usuario
const user = localStorage.getItem("nombre") || localStorage.getItem("correo");
console.log(`Usuario extraído del LocalStorage: ${user}`); 

// Si no hay sesión activa, redirigir al login
if (!user) {
    alert("Debes iniciar sesión para acceder al chat.");
    window.location.replace("login.html"); 
}

// 🧩 2. Conectar al servidor WebSocket
// Usamos 'user' para identificar la conexión en la URL
const ws = new WebSocket(`${API_WS}/${encodeURIComponent(user)}`);

// 🧩 3. Referencias a Elementos del DOM
const chatDiv = document.getElementById("chat");
const input = document.getElementById("mensaje");
const enviarBtn = document.getElementById("enviarBtn"); // ID correcto del botón
const logoutBtn = document.getElementById("logoutBtn"); // Debe existir en el HTML

// Función para enviar mensaje
function enviarMensaje() {
    const texto = input.value.trim();
    if (!texto) return;

    // El JSON de envío debe usar la clave 'text' que espera el receive_json en Python
    ws.send(JSON.stringify({ text: texto })); 
    input.value = "";
}

// Evento cuando se abre la conexión
ws.onopen = () => {
    console.log(`✅ Conectado como ${user}`);
    if (chatDiv) {
        // Muestra el mensaje de conexión en el chat
        chatDiv.innerHTML = "<p style='text-align:center; color:#999;'>Conectado al chat como <b>" + user + "</b></p>";
    }
};

// Evento al recibir mensaje
ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    const div = document.createElement("div");

    // Usa las claves corregidas del backend: msg.usuario y msg.texto
    div.classList.add("chat-msg");
    div.classList.add(msg.usuario === user ? "me" : "other");
    div.innerHTML = `<strong>${msg.usuario}:</strong> ${msg.texto}`;
    chatDiv.appendChild(div);

    // Auto scroll hacia abajo
    chatDiv.scrollTop = chatDiv.scrollHeight;
};

// Evento al cerrar conexión
ws.onclose = () => {
    console.warn("⚠️ Conexión con el chat cerrada.");
};

// 🧩 4. Asignación de Eventos de Envío (Botón y Enter)
if (enviarBtn) {
    enviarBtn.onclick = enviarMensaje;
}

if (input) {
    input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            e.preventDefault(); // Evita el comportamiento por defecto del formulario
            enviarMensaje();
        }
    });
}

// 🧩 5. Cerrar sesión
if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        // Borra solo las claves de sesión para evitar conflictos
        localStorage.removeItem("nombre");
        localStorage.removeItem("correo");
        window.location.replace("login.html");
    });
}