import os
import json
import spotipy
from spotipy.oauth2 import SpotifyOAuth
from concurrent.futures import ThreadPoolExecutor
from functools import partial
import time
import logging

# Configuración inicial
CONFIG = {
    'MAX_WORKERS': 10,
    'LOG_LEVEL': 'INFO'
}

# Inicializar el logger
logging.basicConfig(
    level=CONFIG['LOG_LEVEL'],
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class SpotifyAnalyzer:
    def __init__(self):
        self.start_time = time.time()
        self.playlists_processed = set()
        self.results = {}
        self.auth_manager = None
        self.sp = None

    def initialize(self):
        """Inicia la sesión de Spotify y carga los resultados existentes."""
        try:
            # Inicializar el manager de autenticación
            self.auth_manager = SpotifyOAuth(
                client_id='tu_id_client',
                client_secret='tu_id_secret',
                redirect_uri='https://localhost:8080'
            )
            
            # Cargar los resultados existentes si es posible
            existing_results, processed_playlists = load_existing_results()
            self.results = existing_results
            self.playlists_processed = processed_playlists
            
        except Exception as e:
            logger.error(f"Error al inicializar el analizador: {str(e)}")

    async def process_playlist(self, playlist):
        """Procesa una playlist de manera asíncrona."""
        try:
            # Obtiene los tracks procesados
            tracks = await self.get_playlist_tracks(playlist)
            
            # Crea un resultado para la playlist
            result = {
                'id': playlist['id'],
                'duration': convertir_miliseconds(total_duration_ms),
                'url': playlist['external_urls']['spotify'],
                'image': playlist['images'][0]['url'] if playlist['images'] else None,
                'total_tracks': tracks_processed,
                'invalid_tracks': invalid_tracks,
                'processing_complete': True
            }
            
            # Actualiza los resultados
            self.results[playlist['name']] = result
            self.playlists_processed.add(playlist['id'])
            
            # Guarda el progreso parcial si es necesario
            self.save_partial_progress(playlist)
            
            logger.info(f"✅ Playlist completada: {playlist['name']} - {tracks_processed} tracks válidos, {invalid_tracks} inválidos")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error procesando playlist {playlist['name']}: {str(e)}")
            return False

    async def get_playlist_tracks(self, playlist):
        """Obtiene los tracks de una playlist."""
        try:
            # Implementación asíncrona del método original
            sp = await self.get_spotify_client()
            tracks_processed = 0
            invalid_tracks = 0
            
            for track in playlist['tracks']:
                try:
                    # Procesar el track
                    tracks_processed += 1
                    invalid_tracks = 0
                    
                    # Verificar si el track puede reproducirse
                    if not can_reproduce(track):
                        invalid_tracks += 1
                        logger.warning(f"❌ Track no reproducible: {track['name']}")
                        
                    # Agregar al resultado
                    self.results[playlist['name']]['tracks_processed'] = tracks_processed
                    self.results[playlist]['invalid_tracks'] = invalid_tracks
                    
                except Exception as e:
                    logger.error(f"❌ Error procesando track: {str(e)}")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Error obteniendo tracks: {str(e)}")
            return False

    def get_spotify_client(self):
        """Obtiene una sesión de Spotify."""
        try:
            self.sp = spotipy.Spotify(
                auth_manager=self.auth_manager,
                requests_timeout=10,
                retries=3
            )
            return self.sp
        except Exception as e:
            logger.error(f"❌ Error obteniendo la sesión de Spotify: {str(e)}")
            return None

def can_reproduce(track):
    """Verifica si un track puede reproducirse."""
    try:
        # Implementación básica - supongamos que los tracks con ciertos errores no pueden reproducirse
        if any(
            error['code'] in ['not_found', 'invalid', 'server_error']
            for error in track.get('errors', [])
        ):
            return False
        return True
    except Exception as e:
        logger.error(f"❌ Error verificando reproducción: {str(e)}")
        return False

def convertir_miliseconds(duration_ms):
    """Convierte milliseconds a formato humano."""
    days, hours = divmod(duration_ms // 86400000, 60)
    duration = {
        'days': days,
        'hours': divmod(duration_ms // 3600, 24)[1],
        'minutes': divmod(duration_ms // 60, 60)[1],
        'seconds': duration_ms % 60
    }
    return f"{duration['days']}d {duration['hours']}h {duration['minutes']}m {duration['seconds']}s"

def save_partial_progress(self, playlist_name: str, data: Dict):
    """Guarda el progreso parcial en un archivo temporal."""
    try:
        partial_file = f'partial_results_{playlist_name.replace("/", "_")}.json'
        with open(partial_file, 'w') as f:
            json.dump(data, f, indent=2)
        logger.info(f"✅ Progreso guardado para {playlist_name}")
    except Exception as e:
        logger.error(f"❌ Error guardando progreso: {str(e)}")

def load_existing_results():
    """Carga los resultados existentes si es posible."""
    try:
        if os.path.exists('results.json'):
            with open('results.json', 'r') as f:
                results = json.load(f)
            processed_playlists = set(results.keys())
            return results, processed_playlists
        return {}, set()
    except Exception as e:
        logger.error(f"❌ Error cargando resultados: {str(e)}")
        return {}, set()

if __name__ == '__main__':
    analyzer = SpotifyAnalyzer()
    analyzer.initialize()

    # Procesar las playlists en paralelo
    with ThreadPoolExecutor(max_workers=CONFIG['MAX_WORKERS']) as executor:
        for playlist in get_all_playlists(analyzer.sp):
            if playlist['id'] not in analyzer.playlists_processed:
                executor.submit(
                    analyzer.process_playlist,
                    playlist
                )

    # Guardar todos los resultados finalmente
    save_all_results(analyzer.results, analyzer.playlists_processed)
    logger.info("✅ Todas las playlists procesadas y guardadas")
