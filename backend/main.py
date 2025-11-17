# ============================================================
#  main.py
#  Backend REST para la Pokédex – FastAPI + MySQL + OpenRouter
# ============================================================
#
#  Incluye:
#   ✔ API REST (Pokémon, Login, Registro, Favoritos, Perfil)
#   ✔ Consumo de PokeAPI externa
#   ✔ Hash seguro de contraseñas (bcrypt)
#   ✔ Validación robusta con Pydantic
#   ✔ Uso de OpenRouter para generar descripción ecológica
# ============================================================

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, field_validator
from dotenv import load_dotenv
from pathlib import Path
import os
import requests
import mysql.connector
from mysql.connector import Error
import bcrypt


# ============================================================
# CARGA DE VARIABLES DE ENTORNO (.env)
# ============================================================

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

POKE_API = "https://pokeapi.co/api/v2"
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME", "pokedex_db"),
}


# ============================================================
# INICIALIZAR FASTAPI
# ============================================================

app = FastAPI(title="Pokedex Catto - Backend Limpio (FastAPI + MySQL + OpenRouter)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Permitir frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# UTILIDAD – Conexión a la BD MySQL
# ============================================================

def get_db_connection():
    """Crea una nueva conexión MySQL."""
    return mysql.connector.connect(**DB_CONFIG)


def safe_get(url, timeout=8):
    """Wrapper seguro para consumir APIs externas (PokeAPI)."""
    try:
        r = requests.get(url, timeout=timeout)
        r.raise_for_status()
        return r.json()
    except:
        return None


# ============================================================
# MODELOS – Validación con Pydantic
# ============================================================

class RegistroModel(BaseModel):
    nombre: str
    correo: EmailStr
    contrasena: str

    # Validar contraseña fuerte
    @field_validator("contrasena")
    def validar_contrasena(cls, value):
        if len(value) < 8:
            raise ValueError("La contraseña debe tener mínimo 8 caracteres.")
        if not any(c.isupper() for c in value):
            raise ValueError("Debe contener al menos 1 MAYÚSCULA.")
        if not any(c.islower() for c in value):
            raise ValueError("Debe contener al menos 1 minúscula.")
        if not any(c.isdigit() for c in value):
            raise ValueError("Debe contener al menos 1 número.")
        if not any(c in "!@#$%^&*()_+-=¿?¡!{}[]" for c in value):
            raise ValueError("Debe contener 1 símbolo especial.")
        return value


class LoginModel(BaseModel):
    correo: EmailStr
    contrasena: str


class FavoritoModel(BaseModel):
    correo: EmailStr
    pokemon: str


# ============================================================
# ENDPOINT → Cargar 151 Pokémon de Kanto desde PokeAPI
# ============================================================

@app.get("/pokemons/kanto")
def get_kanto_pokemons():
    """Devuelve los 151 Pokémon de Kanto y los guarda si faltan."""

    data = safe_get(f"{POKE_API}/pokemon?limit=151")
    if not data or "results" not in data:
        raise HTTPException(status_code=502, detail="Error con PokeAPI")

    pokemons = []

    for item in data["results"]:
        poke = safe_get(item["url"])
        if not poke:
            continue

        # Guardar en BD solo si no existe
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM pokemons WHERE id = %s", (poke["id"],))
        exists = cursor.fetchone()

        if not exists:
            cursor.execute(
                """
                INSERT INTO pokemons (id, name, image, types, height, weight, abilities)
                VALUES (%s,%s,%s,%s,%s,%s,%s)
                """,
                (
                    poke["id"],
                    poke["name"].capitalize(),
                    poke["sprites"]["front_default"],
                    ", ".join([t["type"]["name"] for t in poke["types"]]),
                    round(poke["height"] / 10, 1),
                    round(poke["weight"] / 10, 1),
                    ", ".join([a["ability"]["name"] for a in poke["abilities"]]),
                ),
            )
            conn.commit()

        cursor.close()
        conn.close()

        pokemons.append({
            "id": poke["id"],
            "name": poke["name"].capitalize(),
            "image": poke["sprites"]["front_default"],
            "types": [t["type"]["name"] for t in poke["types"]],
        })

    return pokemons


# ============================================================
# ENDPOINT → Detalle por id o nombre
# ============================================================

@app.get("/pokemon/{identifier}")
def get_pokemon(identifier: str):
    """Devuelve un Pokémon desde BD o desde PokeAPI."""

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    if identifier.isdigit():
        cursor.execute("SELECT * FROM pokemons WHERE id = %s", (identifier,))
    else:
        cursor.execute("SELECT * FROM pokemons WHERE name = %s", (identifier.capitalize(),))

    row = cursor.fetchone()
    cursor.close()
    conn.close()

    if row:
        return row

    # Si no existe en BD → pedir a PokeAPI
    poke = safe_get(f"{POKE_API}/pokemon/{identifier.lower()}")
    if not poke:
        raise HTTPException(404, "Pokémon no encontrado")

    # Guardarlo
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO pokemons (id, name, image, types, height, weight, abilities)
        VALUES (%s,%s,%s,%s,%s,%s,%s)
        """,
        (
            poke["id"],
            poke["name"].capitalize(),
            poke["sprites"]["front_default"],
            ", ".join([t["type"]["name"] for t in poke["types"]]),
            round(poke["height"] / 10, 1),
            round(poke["weight"] / 10, 1),
            ", ".join([a["ability"]["name"] for a in poke["abilities"]]),
        ),
    )
    conn.commit()
    cursor.close()
    conn.close()

    return {
        "id": poke["id"],
        "name": poke["name"].capitalize(),
        "image": poke["sprites"]["front_default"],
        "types": ", ".join([t["type"]["name"] for t in poke["types"]]),
        "height": round(poke["height"] / 10, 1),
        "weight": round(poke["weight"] / 10, 1),
        "abilities": ", ".join([a["ability"]["name"] for a in poke["abilities"]]),
    }


# ============================================================
# ENDPOINT → IA Ambiental con OpenRouter
# ============================================================

@app.get("/descripcion/{name}")
def descripcion_pokemon(name: str):
    """Genera una descripción ecológica para la sustentación."""

    poke = safe_get(f"{POKE_API}/pokemon/{name.lower()}")
    if not poke:
        raise HTTPException(404, "Pokémon no encontrado")

    tipos = [t["type"]["name"] for t in poke["types"]]

    if not OPENROUTER_API_KEY:
        return {
            "descripcion": "Error: Configure OPENROUTER_API_KEY en el .env"
        }

    prompt = (
        f"Genera una descripción breve y educativa sobre por qué es importante "
        f"cuidar el hábitat natural de {name.capitalize()}, considerando que es de tipo "
        f"{', '.join(tipos)}. Explica su rol ecológico y cómo proteger el medio ambiente "
        f"beneficia a su ecosistema. Máximo 3 frases."
    )

    try:
        response = requests.post(
            OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": "Eres un experto en ecología Pokémon."},
                    {"role": "user", "content": prompt},
                ],
            },
        )

        data = response.json()
        descripcion = data["choices"][0]["message"]["content"]

        return {
            "pokemon": name.capitalize(),
            "descripcion": descripcion
        }

    except Exception as e:
        raise HTTPException(500, f"Error con IA: {e}")


# ============================================================
# ENDPOINT → Registro
# ============================================================
@app.post("/registro")
def registro(data: RegistroModel):
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Verificar si el correo existe
        cursor.execute("SELECT id FROM usuarios WHERE correo = %s", (data.correo,))
        if cursor.fetchone():
            raise HTTPException(400, "Correo ya registrado")

        # Hash de contraseña
        hashed = bcrypt.hashpw(data.contrasena.encode(), bcrypt.gensalt()).decode()

        # Insertar usuario con rol por defecto
        cursor.execute(
            "INSERT INTO usuarios (nombre, correo, contrasena_hash, rol) VALUES (%s, %s, %s, %s)",
            (data.nombre, data.correo, hashed, "cliente"),
        )
        conn.commit()

        return {"mensaje": "Usuario registrado correctamente"}

    finally:
        cursor.close()
        conn.close()

# ============================================================
# ENDPOINT → Login
# ============================================================

@app.post("/login")
def login(data: LoginModel):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT * FROM usuarios WHERE correo = %s", (data.correo,))
    usr = cursor.fetchone()

    cursor.close()
    conn.close()

    if not usr:
        raise HTTPException(404, "Usuario no encontrado")

    if not bcrypt.checkpw(data.contrasena.encode(), usr["contrasena_hash"].encode()):
        raise HTTPException(401, "Contraseña incorrecta")

    # DEVOLVER EL ROL
    return {
        "nombre": usr["nombre"],
        "correo": usr["correo"],
        "pokemon_favorito": usr.get("pokemon_favorito"),
        "rol": usr["rol"]
    }

# ============================================================
# ENDPOINT → Guardar favorito
# ============================================================

@app.post("/favorito")
def guardar_favorito(data: FavoritoModel):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        "UPDATE usuarios SET pokemon_favorito = %s WHERE correo = %s",
        (data.pokemon, data.correo),
    )
    conn.commit()

    cursor.close()
    conn.close()

    return {"mensaje": "Favorito actualizado"}


# ============================================================
# ENDPOINT → Perfil de usuario
# ============================================================
@app.get("/perfil/{correo}")
def perfil(correo: str):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    # Traer info básica del usuario
    cursor.execute("SELECT nombre, correo, pokemon_favorito FROM usuarios WHERE correo = %s", (correo,))
    perfil = cursor.fetchone()
    if not perfil:
        cursor.close()
        conn.close()
        raise HTTPException(404, "Usuario no encontrado")
    # Si NO tiene favorito → devolver perfil normal
    if not perfil["pokemon_favorito"]:
        cursor.close()
        conn.close()
        return {
            "nombre": perfil["nombre"],
            "correo": perfil["correo"],
            "pokemon_favorito": None
        }
    # Buscar el Pokémon en la tabla
    cursor.execute("SELECT id, name, image, types FROM pokemons WHERE name = %s",
                (perfil["pokemon_favorito"],))
    poke = cursor.fetchone()
    cursor.close()
    conn.close()
    # Si por alguna razón no existe en BD, enviar solo el nombre
    if not poke:
        return {
            "nombre": perfil["nombre"],
            "correo": perfil["correo"],
            "pokemon_favorito": {
                "nombre": perfil["pokemon_favorito"],
                "imagen": None
            }
        }
    return {
        "nombre": perfil["nombre"],
        "correo": perfil["correo"],
        "pokemon_favorito": {
            "nombre": poke["name"],
            "imagen": poke["image"],
            "types": poke["types"],
            "id": poke["id"]
        }
    }
# ============================
# GET → Lista de usuarios
# ============================
@app.get("/admin/usuarios")
def obtener_usuarios():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id, nombre, correo, rol FROM usuarios")
        usuarios = cursor.fetchall()
        return usuarios
    finally:
        cursor.close()
        conn.close()
# ======================================
# PUT → Cambiar rol de un usuario
# ======================================
from pydantic import BaseModel
class RolUpdate(BaseModel):
    rol: str  # "admin" o "user"
@app.put("/admin/usuarios/{usuario_id}/rol")
def cambiar_rol(usuario_id: int, data: RolUpdate):
    if data.rol not in ["admin", "user"]:
        raise HTTPException(400, "Rol inválido")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("UPDATE usuarios SET rol = %s WHERE id = %s", (data.rol, usuario_id))
        conn.commit()
        return {"mensaje": "Rol actualizado correctamente"}
    finally:
        cursor.close()
        conn.close()
# ============================
# DELETE → Eliminar usuario
# ============================
@app.delete("/admin/usuarios/{usuario_id}")
def eliminar_usuario(usuario_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM usuarios WHERE id = %s", (usuario_id,))
        conn.commit()
        return {"mensaje": "Usuario eliminado"}
    finally:
        cursor.close()
        conn.close()
