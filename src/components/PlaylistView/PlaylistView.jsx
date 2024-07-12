import React, { useState, useEffect } from 'react';
import './PlaylistView.css';
import '../../theme.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import results from '../../results.json';

const handlePlaylistClick = (url) => {
  window.open(url, '_blank');
};

const updateResults = (updatedResults) => {
  localStorage.setItem('results', JSON.stringify(updatedResults));
};

const PlaylistView = ({ playlists, searchTerm = '', isAnimating }) => {
  const [visiblePlaylists, setVisiblePlaylists] = useState(30);
  const [isLoading, setIsLoading] = useState(false);
  const [listenedMap, setListenedMap] = useState({});

  // Cargar listenedMap desde localStorage al iniciar el componente
  useEffect(() => {
    const savedResults = localStorage.getItem('results');
    if (savedResults) {
      const initialResults = JSON.parse(savedResults);
      const initialListenedMap = {};
      Object.keys(initialResults).forEach((key) => {
        initialListenedMap[initialResults[key].url] = initialResults[key].listened || false;
      });
      setListenedMap(initialListenedMap);
    } else {
      // Inicializar listenedMap si no hay datos en localStorage
      const initialListenedMap = {};
      playlists.forEach(playlist => {
        initialListenedMap[playlist.url] = false;
      });
      setListenedMap(initialListenedMap);
    }
  }, [playlists]);

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

      const updatedResults = { ...results };
      const playlistKey = Object.keys(updatedResults).find(key => updatedResults[key].url === playlistUrl);
      if (playlistKey) {
        updatedResults[playlistKey].listened = newMap[playlistUrl];
        updateResults(updatedResults);
      }

      return newMap;
    });
  };

  const handleCheckboxClick = (event) => {
    event.stopPropagation();
  };

  const filteredPlaylists = playlists.filter((playlist) =>
    playlist.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={`playlist-grid ${isAnimating ? 'animate-reverse' : ''}`}>
      {filteredPlaylists.slice(0, visiblePlaylists).map((playlist) => {
        const playlistUrl = playlist.url;
        const isSelected = listenedMap[playlistUrl];

        return (
          <div 
            key={playlistUrl} 
            className={`playlist-item border ${isSelected ? 'listened' : ''} row-animation`} 
            style={{ cursor: 'pointer', backgroundColor: isSelected ? '#d3f9d8' : 'transparent' }}
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
