import React, { useState, useEffect } from 'react';
import './PlaylistView.css'; 
import '../../theme.css'; // Importa tu archivo de estilos

const handlePlaylistClick = (url) => {
  window.open(url, '_blank');
};

const PlaylistView = ({ playlists, isAnimating }) => {
  const [listenedMap, setListenedMap] = useState(() => {
    // Función para inicializar listenedMap desde localStorage, o un objeto vacío si no hay datos
    const storedListened = localStorage.getItem('listenedMap');
    return storedListened ? JSON.parse(storedListened) : {};
  });

  useEffect(() => {
    // Guardar listenedMap en localStorage cuando cambie
    localStorage.setItem('listenedMap', JSON.stringify(listenedMap));
  }, [listenedMap]);

  const toggleListened = (index) => {
    setListenedMap((prevMap) => ({
      ...prevMap,
      [index]: !prevMap[index]
    }));
  };

  const handleCheckboxClick = (event) => {
    event.stopPropagation(); // Detener la propagación del evento para evitar que llegue al div padre
  };

  return (
    <div className={`playlist-grid ${isAnimating ? 'animate-reverse' : ''}`}>
      {playlists.map((playlist, index) => (
        <div 
          key={index} 
          className={`playlist-item border ${listenedMap[index] ? 'listened' : ''}`} 
          style={{ cursor: 'pointer' }} 
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
              checked={listenedMap[index] || false} 
              onChange={() => toggleListened(index)}  // No necesitamos pasar el evento como parámetro
              onClick={handleCheckboxClick}  // Manejar el clic del checkbox para detener la propagación
            />
            <label>Mark as listened</label>
          </div>
        </div>
      ))}
    </div>
  );
};

export default PlaylistView;
