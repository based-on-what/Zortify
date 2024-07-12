import React, { useState, useEffect } from 'react';
import './PlaylistView.css';
import '../../theme.css'; // Importa tu archivo de estilos
import 'bootstrap/dist/css/bootstrap.min.css';
import results from '../../results.json';

const handlePlaylistClick = (url) => {
  window.open(url, '_blank');
};

const updateResults = (updatedResults) => {
  localStorage.setItem('results', JSON.stringify(updatedResults));
};

const PlaylistView = ({ playlists, searchTerm = '', isAnimating }) => {
  const [listenedMap, setListenedMap] = useState(() => {
    const savedResults = localStorage.getItem('results');
    const initialResults = savedResults ? JSON.parse(savedResults) : results;

    const initialListenedMap = {};
    Object.keys(initialResults).forEach((key) => {
      initialListenedMap[initialResults[key].url] = initialResults[key].listened || false;
    });

    return initialListenedMap;
  });

  const [visiblePlaylists, setVisiblePlaylists] = useState(30);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500 && !isLoading) {
        loadMorePlaylists();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isLoading]);

  const loadMorePlaylists = () => {
    setIsLoading(true);
    setTimeout(() => {
      setVisiblePlaylists((prev) => prev + 30);
      setIsLoading(false);
    }, 500);
  };

  const toggleListened = (playlistUrl) => {
    setListenedMap((prevMap) => {
      const newMap = { ...prevMap, [playlistUrl]: !prevMap[playlistUrl] };

      // Actualizar results
      const updatedResults = { ...results }; // Copia de los resultados originales
      const playlistKey = Object.keys(updatedResults).find(key => updatedResults[key].url === playlistUrl);
      if (playlistKey) {
        updatedResults[playlistKey].listened = newMap[playlistUrl];
        updateResults(updatedResults); // Guarda los cambios en localStorage
      }

      return newMap;
    });
  };

  const handleCheckboxClick = (event) => {
    event.stopPropagation(); // Detener la propagación del evento para evitar que llegue al div padre
  };

  const filteredPlaylists = playlists.filter((playlist) =>
    playlist.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={`playlist-grid ${isAnimating ? 'animate-reverse' : ''}`}>
      {filteredPlaylists.slice(0, visiblePlaylists).map((playlist) => {
        const playlistUrl = playlist.url; // Usar la URL de la playlist como clave
        const isSelected = listenedMap[playlistUrl]; // Verifica si está seleccionada

        return (
          <div 
            key={playlistUrl} 
            className={`playlist-item border ${isSelected ? 'listened' : ''} row-animation`} 
            style={{ cursor: 'pointer', backgroundColor: isSelected ? '#d3f9d8' : 'transparent' }} // Cambiar el fondo si está seleccionada
            onClick={() => handlePlaylistClick(playlist.url)}
          >
            <div className="playlist-image">
              <img src={playlist.image} alt={playlist.name} />
            </div>
            <div className="playlist-name">
              {playlist.name}
            </div>
            <div className="playlist-duration">
              {`${playlist.duration.days} days, ${playlist.duration.hours} hours, ${playlist.duration.minutes} minutes, ${playlist.duration.seconds} seconds`}
            </div>
            <div className="listened-checkbox">
              <input 
                type="checkbox" 
                checked={isSelected || false} 
                onChange={() => toggleListened(playlistUrl)} 
                onClick={handleCheckboxClick} 
              />
              <label>Mark as listened</label>
            </div>
          </div>
        );
      })}
      {isLoading && (
        <div className="d-flex justify-content-center">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlaylistView;
