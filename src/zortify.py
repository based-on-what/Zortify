from flask import Flask, jsonify
from flask_cors import CORS
from spotipy.oauth2 import SpotifyOAuth
import spotipy
import os
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv
import json
import time
from functools import lru_cache
from typing import Dict, List, Optional, Tuple
import logging
import signal
import sys
import threading
import queue
from datetime import datetime, timedelta

# Configuración de logging para mejor diagnóstico
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('zortify.log', encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}})

# Cargar las variables de entorno
load_dotenv()

# Constantes configurables
def load_config():
    return {
        "BATCH_SIZE": 50,
        "MAX_RETRIES": 3,
        "MAX_WORKERS": 2,
        "RETRY_DELAY": [1, 2, 4],
        "REQUEST_DELAY": 0.5,
        "TOKEN_REFRESH_INTERVAL": 3000,
        "SESSION_TIMEOUT": 600,
        "TIMEOUT": 30  # Tiempo máximo permitido para procesar una playlist
    }
CONFIG = load_config()

# Inicialización de Spotify
auth_manager = SpotifyOAuth(
    client_id=os.getenv('SPOTIPY_CLIENT_ID'),
    client_secret=os.getenv('SPOTIPY_CLIENT_SECRET'),
    redirect_uri=os.getenv('SPOTIPY_REDIRECT_URI'),
    scope="playlist-read-private"
)

class SpotifyAPIError(Exception):
    """Clase personalizada para errores de la API de Spotify"""
    def __init__(self, message: str, error_type: str = None, status_code: int = None):
        self.message = message
        self.error_type = error_type
        self.status_code = status_code
        super().__init__(self.message)

# Diccionario global para almacenar resultados
all_results = {}

def save_to_results(playlist_data: Dict):
    """
    Guarda los datos de una playlist en results.json
    """
    try:
        # Crear el archivo si no existe
        if not os.path.exists('results.json'):
            existing_results = {}
        else:
            with open('results.json', 'r', encoding='utf-8') as f:
                existing_results = json.load(f)
        
        # Actualizar con los nuevos datos
        existing_results.update(playlist_data)

        # Ordenar los resultados por duración (de mayor a menor)
        sorted_results = dict(sorted(existing_results.items(), key=lambda item: item[1]['duration']['days'] * 86400 + item[1]['duration']['hours'] * 3600 + item[1]['duration']['minutes'] * 60 + item[1]['duration']['seconds'], reverse=True))
        
        # Guardar el archivo actualizado
        with open('results.json', 'w', encoding='utf-8') as f:
            json.dump(sorted_results, f, ensure_ascii=False, indent=4)
        logger.info(f"✅ Guardado en results.json: {list(playlist_data.keys())[0]}")
    except json.JSONDecodeError as e:
        logger.error(f"❌ Error de formato en results.json: {str(e)}")
    except Exception as e:
        logger.error(f"❌ Error guardando resultados: {str(e)}")

class RateLimiter:
    """Control de velocidad para solicitudes a la API"""
    def __init__(self, requests_per_second: float = 2.0):
        self.last_request = 0
        self.min_interval = 1.0 / requests_per_second

    def wait(self):
        now = time.time()
        elapsed = now - self.last_request
        if elapsed < self.min_interval:
            time.sleep(self.min_interval - elapsed)
        self.last_request = time.time()

rate_limiter = RateLimiter()

def convertir_miliseconds(miliseconds: int) -> Dict[str, int]:
    seconds = miliseconds / 1000
    minutes, seconds = divmod(seconds, 60)
    hours, minutes = divmod(minutes, 60)
    days, hours = divmod(hours, 24)
    return {
        "days": int(days),
        "hours": int(hours),
        "minutes": int(minutes),
        "seconds": int(seconds)
    }

def retry_with_backoff(func):
    def wrapper(*args, **kwargs):
        for i, delay in enumerate(CONFIG['RETRY_DELAY']):
            try:
                return func(*args, **kwargs)
            except SpotifyAPIError as e:
                if e.status_code == 429:
                    logger.warning(f"Rate limit alcanzado, esperando {delay} segundos")
                    time.sleep(delay)
                elif e.status_code in [500, 502, 503, 504]:
                    logger.warning(f"Error de servidor: {e.message}, reintento {i+1}")
                    time.sleep(delay)
                else:
                    raise
            except Exception as e:
                if i == len(CONFIG['RETRY_DELAY']) - 1:
                    logger.error(f"Error final después de {len(CONFIG['RETRY_DELAY'])} intentos: {e}")
                    raise
                logger.warning(f"Error general: {e}, reintento {i+1}")
                time.sleep(delay)
        return None
    return wrapper

class SpotifySessionManager:
    """Gestor de sesión Spotify"""
    def __init__(self, auth_manager):
        self.auth_manager = auth_manager
        self.sp = None
        self.last_refresh = 0
        self.initialize_session()

    def initialize_session(self):
        self.sp = spotipy.Spotify(auth_manager=self.auth_manager)
        self.last_refresh = time.time()
        logger.info("🔄 Sesion inicializada/refrescada")

    def check_and_refresh(self):
        if time.time() - self.last_refresh > CONFIG['TOKEN_REFRESH_INTERVAL']:
            logger.info("🔄 Refrescando token Spotify")
            self.initialize_session()

    def get_client(self):
        self.check_and_refresh()
        return self.sp

session_manager = SpotifySessionManager(auth_manager)

@retry_with_backoff
def get_playlist_tracks_batch(playlist_id: str, offset: int = 0):
    """
    Obtiene un lote de tracks de una playlist
    """
    rate_limiter.wait()
    try:
        fields = (
            'items(track(duration_ms,is_playable,type,name,track_number,'
            'album(album_type))),'
            'total,next'
        )
        return session_manager.get_client().playlist_items(
            playlist_id,
            offset=offset,
            limit=CONFIG['BATCH_SIZE'],
            fields=fields
        )
    except spotipy.SpotifyException as e:
        raise SpotifyAPIError(message=str(e), error_type=e.msg, status_code=e.http_status)

def get_playlist_tracks(playlist: Dict) -> Optional[Dict]:
    """
    Obtiene todos los tracks de una playlist, filtrando podcasts desde el inicio
    """
    global all_results  # Usar el diccionario global
    try:
        current_progress['last_playlist'] = playlist['name']
        logger.info("=" * 50)
        logger.info(f"🎵 Iniciando procesamiento de playlist: {playlist['name']}")
        
        start_time = time.time()  # Tiempo de inicio para la playlist
        total_duration_ms = 0
        offset = 0
        tracks_processed = 0
        podcasts_found = 0
        total_tracks = playlist['tracks']['total']
        logger.info(f"📝 Playlist: {total_tracks} tracks totales")
        
        has_processed_any_track = False
        last_progress_time = time.time()  # Tiempo de la última actualización de progreso

        while tracks_processed + podcasts_found < total_tracks:
            batch_start_time = time.time()  # Tiempo de inicio del lote
            batch = get_playlist_tracks_batch(playlist['id'], offset)
            if not batch:
                logger.warning("⚠️ No se pudo obtener el lote")
                break

            # Filtrar los podcasts y tracks no reproducibles antes del procesamiento
            valid_tracks = []
            for item in batch['items']:
                track = item.get('track')
                if not track:
                    logger.info(f"🚫 Elemento no es un track: {item.get('name', 'Desconocido')}")
                    continue

                # Verificar si es un podcast
                if track['type'] == 'episode':
                    logger.info(f"🎙️ Saltando podcast: {track.get('name', 'Desconocido')}")
                    continue

                if not track.get('is_playable', True):
                    logger.warning(f"❌ Canción no disponible: {track.get('name', 'Desconocido')}")
                    continue  # Saltar si la canción no es reproducible

                valid_tracks.append(track)

            # Procesar solo los tracks válidos
            for track in valid_tracks:
                total_duration_ms += track['duration_ms']
                tracks_processed += 1
                has_processed_any_track = True
                last_progress_time = time.time()  # Actualizar el tiempo de progreso

                if tracks_processed % 10 == 0:
                    logger.info(f"⏳ Procesando... {tracks_processed} tracks de música procesados")

            offset += CONFIG['BATCH_SIZE']
            time.sleep(CONFIG['REQUEST_DELAY'])

            # Verificar si han pasado más de 30 segundos sin avanzar
            if time.time() - last_progress_time > 30:
                logger.warning("⏳ Tiempo de espera excedido, pasando a la siguiente playlist.")
                break  # Salir del bucle si se excede el tiempo de espera

        # Resumen final
        duration = convertir_miliseconds(total_duration_ms)
        result = {
            playlist['name']: {
                "id": playlist['id'],
                "duration": duration,
                "url": playlist['external_urls']['spotify'],
                "image": playlist['images'][0]['url'] if playlist['images'] else None,
                "total_tracks": tracks_processed,
                "podcasts_filtered": podcasts_found
            }
        }

        # Actualizar el diccionario global con los resultados
        all_results.update(result)

        logger.info(f"✅ Playlist procesada: {playlist['name']}")
        return result

    except Exception as e:
        logger.error(f"❌ Error procesando playlist: {str(e)}")
        return None

# Variables globales
start_time = None
current_progress = {
    'last_playlist': None,
    'playlists_processed': [],
    'total_playlists': 0
}

def format_elapsed_time(seconds):
    """Formatea el tiempo transcurrido en un formato legible"""
    return str(timedelta(seconds=int(seconds)))

def show_elapsed_time():
    """Muestra el tiempo transcurrido cada 5 segundos"""
    global start_time
    while True:
        elapsed = time.time() - start_time
        logger.info(f"⏱️ Tiempo transcurrido: {format_elapsed_time(elapsed)}")
        time.sleep(5)

def load_existing_results() -> Dict:
    """Carga los resultados existentes desde results.json y devuelve un conjunto de IDs de playlists."""
    if os.path.exists('results.json'):
        with open('results.json', 'r', encoding='utf-8') as f:
            existing_results = json.load(f)
            # Extraer las IDs de las playlists ya procesadas
            processed_playlists = {details['id'] for details in existing_results.values()}
            return existing_results, processed_playlists
    return {}, set()  # Retornar un diccionario vacío y un conjunto vacío si no existe

def get_playlists() -> List[Dict]:
    """
    Obtiene y procesa todas las playlists del usuario, sin límite de 50.
    """
    global start_time
    start_time = time.time()
    
    logger.info("\n" + "=" * 50)
    logger.info("🚀 INICIANDO PROCESO DE ANÁLISIS DE PLAYLISTS")
    
    existing_results, processed_playlists = load_existing_results()  # Cargar resultados existentes

    playlists = []  # Inicializar la lista de playlists

    def api_call(q):
        try:
            logger.info("🔄 Intentando conectar con Spotify...")
            sp = spotipy.Spotify(
                auth_manager=auth_manager,
                requests_timeout=10,
                retries=3
            )
            offset = 0
            while True:
                results = sp.current_user_playlists(limit=50, offset=offset)
                playlists.extend(results['items'])  # Agregar las playlists obtenidas
                if results['next'] is None:
                    break
                offset += 50  # Incrementar el offset para la siguiente página
            q.put(playlists)
        except Exception as e:
            q.put(e)
    
    try:
        logger.info("📥 Iniciando obtención de playlists...")
        q = queue.Queue()
        thread = threading.Thread(target=api_call, args=(q,))
        thread.daemon = True
        thread.start()
        
        # Esperar respuesta con timeout
        for i in range(6):
            if thread.is_alive():
                logger.warning(f"⏳ Esperando respuesta de Spotify... ({(i+1)*5} segundos)")
                thread.join(timeout=5)
            else:
                break
        
        if thread.is_alive():
            total_time = time.time() - start_time
            logger.error("❌ Timeout - No se recibió respuesta de Spotify después de 30 segundos")
            logger.info(f"⏱️ Tiempo total transcurrido: {format_elapsed_time(total_time)}")
            return []

        result = q.get_nowait()
        if isinstance(result, Exception):
            logger.error(f"❌ Error al obtener playlists: {str(result)}")
            return []
        
        logger.info(f"✅ Conexión establecida - Total de playlists encontradas: {len(playlists)}")

        # Filtrar playlists ya procesadas
        playlists_to_process = [pl for pl in playlists if pl['id'] not in processed_playlists]

        if not playlists_to_process:
            logger.info("📂 No hay nuevas playlists para procesar.")
            return []  # No hay playlists nuevas para procesar

        return playlists_to_process  # Devolver solo las playlists que no han sido procesadas

    except KeyboardInterrupt:
        total_time = time.time() - start_time
        logger.info("\n" + "=" * 50)
        logger.info("👋 Programa interrumpido por el usuario")
        logger.info(f"⏱️ Tiempo total de ejecución: {format_elapsed_time(total_time)}")
        sys.exit(0)
    except Exception as e:
        total_time = time.time() - start_time
        logger.error(f"❌ Error: {str(e)}")
        logger.info(f"⏱️ Tiempo total de ejecución: {format_elapsed_time(total_time)}")
        return []

def check_and_display_existing_results(existing_results: Dict) -> bool:
    """
    Lee y muestra las playlists existentes en results.json si el archivo existe.
    Retorna True si el archivo existe, False si no existe.
    """
    if not existing_results:
        logger.info("\n" + "=" * 50)
        logger.info("📂 No se encontró archivo results.json - Procediendo con el escaneo de playlists")
        logger.info("=" * 50 + "\n")
        return False

    try:
        logger.info("\n" + "=" * 50)
        logger.info("📂 PLAYLISTS EXISTENTES EN RESULTS.JSON:")
        logger.info("=" * 50)
        
        for playlist_name, details in existing_results.items():
            duration = details['duration']
            logger.info(f"🎵 {playlist_name}")
            logger.info(f"   ⏱️ Duración: {duration['days']}d {duration['hours']}h "
                        f"{duration['minutes']}m {duration['seconds']}s")
            logger.info(f"   📊 Tracks totales: {details['total_tracks']}")
            logger.info(f"   🔗 URL: {details['url']}")
            logger.info("-" * 30)
            
        logger.info(f"📝 Total de playlists en results.json: {len(existing_results)}")
        logger.info("=" * 50)
        logger.info("✨ Archivo results.json encontrado y leído - Continuando con el proceso")
        logger.info("=" * 50 + "\n")
        return True
        
    except Exception as e:
        logger.error(f"❌ Error leyendo results.json: {str(e)}")
        logger.info("🔄 Continuando con el escaneo de playlists...")
        return False

def signal_handler(signum, frame):
    """Manejador para Ctrl+C"""
    total_time = time.time() - start_time
    logger.info("\n" + "=" * 50)
    logger.info("👋 Programa interrumpido por el usuario")
    logger.info(f"⏱️ Tiempo total de ejecución: {format_elapsed_time(total_time)}")
    sys.exit(0)

# Registrar el manejador de señales
signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

def process_playlists():
    playlists = get_playlists()
    if playlists:  # Solo procesar si hay playlists para analizar
        with ThreadPoolExecutor(max_workers=CONFIG['MAX_WORKERS']) as executor:
            futures = {executor.submit(get_playlist_tracks, pl): pl for pl in playlists}
            for future in futures:
                try:
                    future.result()  # Esperar a que se complete el procesamiento de cada playlist
                except Exception as e:
                    logger.error(f"❌ Error procesando playlist {futures[future]['name']}: {str(e)}")
    else:
        logger.info("📂 No se encontraron playlists nuevas para procesar.")

def save_all_results():
    """
    Guarda todos los resultados acumulados en results.json al finalizar el procesamiento.
    """
    try:
        # Ordenar los resultados por duración (de mayor a menor)
        sorted_results = dict(sorted(all_results.items(), key=lambda item: item[1]['duration']['days'] * 86400 + item[1]['duration']['hours'] * 3600 + item[1]['duration']['minutes'] * 60 + item[1]['duration']['seconds'], reverse=True))
        
        # Guardar el archivo actualizado
        with open('results.json', 'w', encoding='utf-8') as f:
            json.dump(sorted_results, f, ensure_ascii=False, indent=4)
        logger.info("✅ Todos los resultados guardados en results.json")
    except Exception as e:
        logger.error(f"❌ Error guardando resultados: {str(e)}")

if __name__ == '__main__':
    logger.info("🚀 Iniciando aplicación")
    
    # Si existe results.json, mostrar contenido y continuar
    existing_results, processed_playlists = load_existing_results()
    check_and_display_existing_results(existing_results)  # Mostrar resultados existentes

    # Continuar con el proceso normal
    process_playlists()
    
    # Guardar todos los resultados al finalizar
    save_all_results()
    logger.info("✅ Todas las playlists procesadas y guardadas")
