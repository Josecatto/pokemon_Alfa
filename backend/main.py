# backend/main.py
"""
FastAPI backend para la Pokédex de Catto (MySQL + OpenAI).
Endpoints principales:
 - /pokemons/kanto         GET  -> lista de 151 Pokemon (consulta PokeAPI, guarda en MySQL si no existen)
 - /pokemon/{name_or_id}   GET  -> detalle desde BD o PokeAPI
 - /descripcion/{name}     GET  -> descripción breve + debilidades (usa OpenAI)
 - /registro               POST -> registrar usuario (nombre, correo, contraseña)
 - /login                  POST -> iniciar sesión (correo + contraseña)
 - /favorito               POST -> guardar pokemon favorito (correo, pokemon)
 - /perfil/{correo}        GET  -> devuelve perfil de usuario
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from pathlib import Path
import os
import requests
import mysql.connector
from mysql.connector import Error
import bcrypt
from openai import OpenAI
from fastapi import FastAPI, WebSocket
from typing import List
from fastapi import WebSocket

connected_clients: List[WebSocket] = []

# ----------------------------
# Cargar .env
# ----------------------------
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

POKE_API = "https://pokeapi.co/api/v2"
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME", "pokedex_db"),
}

# Inicializar OpenAI client (si no hay clave, se queda None)
client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

app = FastAPI(title="Pokedex Catto - Backend (MySQL + OpenAI)")

# Permitir peticiones desde el frontend (ajusta en producción)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------------------
# Utilidades DB y PokeAPI
# ----------------------------
def get_db_connection():
    """Devuelve una conexión nueva a MySQL (mysql-connector-python)."""
    return mysql.connector.connect(**DB_CONFIG)


def safe_get(url, timeout=8):
    """Peticiones HTTP seguras a PokeAPI u otras."""
    try:
        r = requests.get(url, timeout=timeout)
        r.raise_for_status()
        return r.json()
    except requests.RequestException:
        return None


# ----------------------------
# Pydantic models para requests
# ----------------------------
class RegistroModel(BaseModel):
    nombre: str
    correo: str
    contrasena: str

class LoginModel(BaseModel):
    correo: str
    contrasena: str

class FavoritoModel(BaseModel):
    correo: str
    pokemon: str

# ----------------------------
# Helpers: insertar/leer pokemons en BD
# ----------------------------
def insertar_pokemon_en_bd(poke_obj):
    """Inserta un Pokémon (dict de PokeAPI) en la tabla pokemons (si no existe)."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        id_p = poke_obj["id"]
        name = poke_obj["name"].capitalize()
        image = poke_obj["sprites"]["front_default"]
        types = ", ".join([t["type"]["name"] for t in poke_obj.get("types", [])])
        height = round(poke_obj.get("height", 0) / 10, 1)
        weight = round(poke_obj.get("weight", 0) / 10, 1)
        abilities = ", ".join([a["ability"]["name"] for a in poke_obj.get("abilities", [])])

        # Guardar solo si no existe
        sql_check = "SELECT id FROM pokemons WHERE id = %s"
        cursor.execute(sql_check, (id_p,))
        if cursor.fetchone() is None:
            sql_insert = """
                INSERT INTO pokemons (id, name, image, types, height, weight, abilities)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """
            cursor.execute(sql_insert, (id_p, name, image, types, height, weight, abilities))
            conn.commit()
    finally:
        cursor.close()
        conn.close()


def obtener_pokemon_bd_por_id(id_p):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM pokemons WHERE id = %s", (id_p,))
        return cursor.fetchone()
    finally:
        cursor.close()
        conn.close()


def obtener_pokemon_bd_por_nombre(name):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM pokemons WHERE name = %s", (name.capitalize(),))
        return cursor.fetchone()
    finally:
        cursor.close()
        conn.close()


# ----------------------------
# Endpoint: Kanto (151 Pokémon)
# ----------------------------
@app.get("/pokemons/kanto")
def get_kanto_pokemons():
    """
    Devuelve lista de los 151 Pokémon de Kanto.
    Si un Pokémon no está en la BD, lo obtiene de PokeAPI y lo guarda.
    """
    data = safe_get(f"{POKE_API}/pokemon?limit=151")
    if not data or "results" not in data:
        raise HTTPException(status_code=502, detail="Error al contactar PokeAPI")

    pokemons = []
    for item in data["results"]:
        poke = safe_get(item["url"])
        if not poke:
            continue

        # Guardar en BD si no existe
        insertar_pokemon_en_bd(poke)

        pokemons.append({
            "id": poke["id"],
            "name": poke["name"].capitalize(),
            "image": poke["sprites"]["front_default"],
            "types": [t["type"]["name"] for t in poke.get("types", [])]
        })
    return pokemons


# ----------------------------
# Endpoint: detalle por id o nombre
# ----------------------------
@app.get("/pokemon/{identifier}")
def get_pokemon(identifier: str):
    """
    identifier puede ser id (numérico) o nombre.
    Devuelve la fila desde BD si existe; si no, intenta obtener desde PokeAPI y guardar.
    """
    # Si es dígito, buscar por id
    if identifier.isdigit():
        p = obtener_pokemon_bd_por_id(int(identifier))
        if p:
            return p
    else:
        p = obtener_pokemon_bd_por_nombre(identifier)
        if p:
            return p

    # Si no está en BD, pedir a PokeAPI y guardar
    poke = safe_get(f"{POKE_API}/pokemon/{identifier.lower()}")
    if not poke:
        raise HTTPException(status_code=404, detail="Pokémon no encontrado")

    insertar_pokemon_en_bd(poke)
    # Formatear respuesta similar a la tabla
    return {
        "id": poke["id"],
        "name": poke["name"].capitalize(),
        "image": poke["sprites"]["front_default"],
        "types": ", ".join([t["type"]["name"] for t in poke.get("types", [])]),
        "height": round(poke.get("height", 0) / 10, 1),
        "weight": round(poke.get("weight", 0) / 10, 1),
        "abilities": ", ".join([a["ability"]["name"] for a in poke.get("abilities", [])]),
    }


# ----------------------------
# Endpoint: descripción con IA (OpenAI)
# ----------------------------
@app.get("/descripcion/{name}")
def get_pokemon_description(name: str):
    """Genera descripción breve + debilidades con OpenAI."""
    # Obtener info de PokeAPI (para tipos/abilities)
    poke = safe_get(f"{POKE_API}/pokemon/{name.lower()}")
    if not poke:
        raise HTTPException(status_code=404, detail="Pokémon no encontrado")

    tipos = [t["type"]["name"] for t in poke.get("types", [])]
    habilidades = [a["ability"]["name"] for a in poke.get("abilities", [])]

    if not client:
        return {
            "name": name.capitalize(),
            "types": tipos,
            "abilities": habilidades,
            "descripcion": "OpenAI API Key no configurada.",
            "debilidades": None
        }

    prompt = (
        f"Describe brevemente (1-2 frases) al Pokémon {name.capitalize()} y lista sus principales "
        f"debilidades según sus tipos: {', '.join(tipos)}. Sé conciso y amistoso."
    )

    try:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Eres un experto en Pokémon y das respuestas breves."},
                {"role": "user", "content": prompt}
            ],
            # opcionales: temperature, max_tokens
        )
        raw = completion.choices[0].message.content.strip()
        # Intentar separar "Debilidades:" si el modelo lo devuelve así
        partes = raw.split("Debilidades:") if "Debilidades:" in raw else raw.split("Debilidades")
        descripcion = partes[0].strip()
        debilidades = partes[1].strip() if len(partes) > 1 else None
    except Exception as e:
        descripcion = f"Error generando descripción con IA: {e}"
        debilidades = None

    return {
        "name": name.capitalize(),
        "types": tipos,
        "abilities": habilidades,
        "descripcion": descripcion,
        "debilidades": debilidades
    }


# ----------------------------
# Endpoint: registro
# ----------------------------
@app.post("/registro")
def registro_usuario(data: RegistroModel):
    """Registra usuario con contraseña hasheada (bcrypt)."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # comprobar si correo existe
        cursor.execute("SELECT id FROM usuarios WHERE correo = %s", (data.correo,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Correo ya registrado")

        hashed = bcrypt.hashpw(data.contrasena.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        cursor.execute(
            "INSERT INTO usuarios (nombre, correo, contrasena_hash) VALUES (%s, %s, %s)",
            (data.nombre, data.correo, hashed)
        )
        conn.commit()
        return {"mensaje": "Usuario registrado correctamente"}
    except Error as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()


# ----------------------------
# Endpoint: login
# ----------------------------
@app.post("/login")
def login_usuario(data: LoginModel):
    """Login: verifica correo y contraseña. Devuelve nombre y correo si OK."""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM usuarios WHERE correo = %s", (data.correo,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        if not bcrypt.checkpw(data.contrasena.encode("utf-8"), user["contrasena_hash"].encode("utf-8")):
            raise HTTPException(status_code=401, detail="Contraseña incorrecta")

        # Retornamos datos básicos (no el hash)
        return {"nombre": user["nombre"], "correo": user["correo"], "pokemon_favorito": user.get("pokemon_favorito")}
    except Error as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()


# ----------------------------
# Endpoint: guardar favorito
# ----------------------------
@app.post("/favorito")
def guardar_favorito(data: FavoritoModel):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("UPDATE usuarios SET pokemon_favorito = %s WHERE correo = %s", (data.pokemon, data.correo))
        conn.commit()
        return {"mensaje": f"{data.pokemon} guardado como favorito para {data.correo}"}
    except Error as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()


# ----------------------------
# Endpoint: perfil
# ----------------------------
@app.get("/perfil/{correo}")
def obtener_perfil(correo: str):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT nombre, correo, pokemon_favorito FROM usuarios WHERE correo = %s", (correo,))
        perfil = cursor.fetchone()
        if not perfil:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        pokemon_favorito = perfil.get("pokemon_favorito")
        pokemon_imagen = None

        # Si el usuario tiene un Pokémon favorito, busca su imagen
        if pokemon_favorito:
            pokemon_nombre = pokemon_favorito.lower().strip()
            poke_data = safe_get(f"{POKE_API}/pokemon/{pokemon_nombre}")
            if poke_data and "sprites" in poke_data:
                pokemon_imagen = poke_data["sprites"]["other"]["official-artwork"]["front_default"]

        return {
    "nombre": perfil["nombre"],
    "correo": perfil["correo"],
    "pokemon_favorito": {
        "nombre": pokemon_favorito.capitalize() if pokemon_favorito else None,
        "imagen": pokemon_imagen
    }
}

    except Error as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

# ----------------------------
# ⚡ WebSocket con mensajes JSON y guardado en BD
# ----------------------------
from typing import List, Dict
from fastapi import WebSocket, WebSocketDisconnect

# Lista de clientes conectados (cada uno con su WebSocket y nombre/correo)
connected_clients: List[Dict] = []

@app.websocket("/ws/{usuario}")
async def websocket_endpoint(websocket: WebSocket, usuario: str):
    """
    WebSocket que maneja chat en tiempo real.
    Cada usuario se identifica con su nombre o correo en la URL.
    Ejemplo: ws://127.0.0.1:8000/ws/ash@pokedex.com
    """
    await websocket.accept()
    connected_clients.append({"socket": websocket, "usuario": usuario})
    print(f"⚡ Usuario conectado: {usuario}")

    # Enviar mensaje de bienvenida (en formato JSON)
    await websocket.send_json({
        "user": "Sistema",
        "text": f"Bienvenido {usuario}! 🧢"
    })

    try:
        while True:
            # Esperar mensaje entrante del cliente
            data = await websocket.receive_json()
            mensaje_texto = data.get("text", "").strip()

            if not mensaje_texto:
                continue

            print(f"📨 {usuario}: {mensaje_texto}")

            # Guardar mensaje en la base de datos
            try:
                conn = get_db_connection()
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT INTO mensajes (usuario, contenido) VALUES (%s, %s)",
                    (usuario, mensaje_texto),
                )
                conn.commit()
                cursor.close()
                conn.close()
            except Exception as db_err:
                print(f"⚠️ Error al guardar mensaje en la BD: {db_err}")

            # Reenviar el mensaje a todos los clientes conectados
            for client in connected_clients:
                await client["socket"].send_json({
                "usuario": usuario,        # <--- Corregido para coincidir con el frontend
                "texto": mensaje_texto     # <--- Corregido para coincidir con el frontend
                })

    except WebSocketDisconnect:
        print(f"❌ Usuario desconectado: {usuario}")
        connected_clients[:] = [
            c for c in connected_clients if c["socket"] != websocket
        ]

    except Exception as e:
        print(f"⚠️ Error en WebSocket ({usuario}): {e}")
        connected_clients[:] = [
            c for c in connected_clients if c["socket"] != websocket
        ]
