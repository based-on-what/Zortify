from flask import Flask, jsonify
from flask_cors import CORS
from spotipy.oauth2 import SpotifyOAuth
import spotipy
import os
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv
import json
import time

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}})

# Cargar las variables de entorno
load_dotenv()

# Inicializa la autenticación de Spotify una sola vez
auth_manager = SpotifyOAuth(client_id=os.getenv('SPOTIPY_CLIENT_ID'),
                            client_secret=os.getenv('SPOTIPY_CLIENT_SECRET'),
                            redirect_uri=os.getenv('SPOTIPY_REDIRECT_URI'),
                            scope="playlist-read-private")
sp = spotipy.Spotify(auth_manager=auth_manager)

print(sp.current_user())

try:
    user = sp.current_user()
    print(user)
except Exception as e:
    print(f"Error de autenticación: {e}")


def convertir_miliseconds(miliseconds):
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

def get_playlist_tracks(playlist):
    tracks = []
    try:
        track_results = sp.playlist_items(playlist['id'], fields='items.track.duration_ms, next')
        tracks.extend(track_results['items'])
        while track_results['next']:
            track_results = sp.next(track_results)
            tracks.extend(track_results['items'])
    except Exception as e:
        print(f"Error obteniendo las canciones de la playlist {playlist['id']}: {e}")
        return None

    playlist_url = playlist['external_urls']['spotify']
    playlist_image = playlist['images'][0]['url'] if playlist['images'] else None

    total_duration_ms = sum(track['track']['duration_ms'] for track in tracks if track['track'] is not None)
    total_duration_formatted = convertir_miliseconds(total_duration_ms)

    return playlist['name'], total_duration_formatted, playlist_url, playlist_image

def get_playlists():
    orden = int(input("Ingrese '0' para ordenar de la más corta a la más larga, o '1' para ordenar de la más larga a la más corta: "))
    print(f"Obteniendo playlists del usuario actual...")
    playlists = []
    offset = 0
    while True:
        try:
            print('INGRESANDO...')

            results = sp.current_user_playlists(offset=offset)
            print(f"Obteniendo playlists... {offset} playlists obtenidas hasta ahora.")
            playlists.extend(results['items'])
            if results['next']:
                offset += len(results['items'])
            else:
                print("Todas las playlists han sido obtenidas.")
                break
        except Exception as e:
            print(f"Error obteniendo las playlists del usuario: {e}")

    print("Ahora usaremos multithreading para obtener las canciones de cada playlist...")
    with ThreadPoolExecutor(max_workers=20) as executor:
        playlist_durations = list(executor.map(get_playlist_tracks, playlists))

    # Filtrar None results
    playlist_durations = [result for result in playlist_durations if result is not None]

    print("Ordenando las playlists...")

    playlist_durations_dict = {name: {'duration': duration, 'url': url, 'image': image} for name, duration, url, image in playlist_durations}

    if orden == 0:
        playlist_durations_sorted = sorted(playlist_durations_dict.items(), key=lambda x: x[1]['duration']['days']*86400000 + x[1]['duration']['hours']*3600000 + x[1]['duration']['minutes']*60000 + x[1]['duration']['seconds']*1000)
    else:
        playlist_durations_sorted = sorted(playlist_durations_dict.items(), key=lambda x: x[1]['duration']['days']*86400000 + x[1]['duration']['hours']*3600000 + x[1]['duration']['minutes']*60000 + x[1]['duration']['seconds']*1000, reverse=True)
    
    playlist_durations_dict_sorted = {name: duration for name, duration in playlist_durations_sorted}

    current_dir = os.path.dirname(os.path.abspath(__file__))
    ruta_completa = os.path.join(current_dir, 'results.json')

    with open(ruta_completa, 'w', encoding='utf-8') as f:
        json.dump(playlist_durations_dict_sorted, f, ensure_ascii=False, indent=4)

if __name__ == '__main__':
    start_time = time.time()
    get_playlists()  # Aquí se obtiene todas las playlists del usuario actual
    end_time = time.time()
    elapsed_time = end_time - start_time
    print(f"La función get_playlists() tardó {elapsed_time} segundos en ejecutarse.")
