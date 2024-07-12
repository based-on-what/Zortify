import React, { useState, useEffect, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import PlaylistView from './components/PlaylistView/PlaylistView';
import resultsData from './results.json';
import './theme.css';
import './animations.css';
import { ThemeContext, ThemeProvider } from './context/ThemeContext';
import ThemeSwitch from './components/ThemeSwitch/ThemeSwitch';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

const App = () => {
  const location = useLocation();
  const [playlists, setPlaylists] = useState([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const { theme } = useContext(ThemeContext);
  const [showScrollTopButton, setShowScrollTopButton] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [listenedMap, setListenedMap] = useState({}); // Mapa de playlists escuchadas

  const invertPlaylists = () => {
    setIsAnimating(true);
    setTimeout(() => {
      const reversed = [...playlists].reverse();
      setPlaylists(reversed);
      setIsAnimating(false);
    }, 100);
  };

  useEffect(() => {
    const playlistsArray = Object.keys(resultsData).map((key) => ({
      name: key,
      ...resultsData[key],
    }));
    setPlaylists(playlistsArray);

    // Cargar listenedMap desde localStorage
    const savedResults = localStorage.getItem('results');
    const initialListenedMap = {};

    if (savedResults) {
      const initialResults = JSON.parse(savedResults);
      Object.keys(initialResults).forEach(key => {
        initialListenedMap[initialResults[key].url] = initialResults[key].listened || false;
      });
    } else {
      playlistsArray.forEach(playlist => {
        initialListenedMap[playlist.url] = false; // Inicializa como no escuchadas
      });
    }

    setListenedMap(initialListenedMap);
  }, [location.hash]);

  useEffect(() => {
    document.body.classList.add(`${theme}-theme`);
    return () => {
      document.body.classList.remove(`${theme}-theme`);
    };
  }, [theme]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setShowScrollTopButton(scrollY > 200);
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const toggleListened = (playlistUrl) => {
    setListenedMap((prevMap) => {
      const newMap = { ...prevMap, [playlistUrl]: !prevMap[playlistUrl] };

      const updatedResults = { ...resultsData };
      const playlistKey = Object.keys(updatedResults).find(key => updatedResults[key].url === playlistUrl);
      if (playlistKey) {
        updatedResults[playlistKey].listened = newMap[playlistUrl];
        localStorage.setItem('results', JSON.stringify(updatedResults));
      }

      return newMap;
    });
  };

  // Filtrar playlists
  const filteredPlaylists = playlists.filter(playlist => {
    const isSelected = listenedMap[playlist.url]; // Verifica si está seleccionada
    if (filter === 'selected') {
      return isSelected; // Solo seleccionadas
    } else if (filter === 'not-selected') {
      return !isSelected; // Solo no seleccionadas
    }
    return true; // Mostrar todas
  }).filter(playlist =>
    playlist.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="App">
      <header className={`App-header ${theme}-theme`}>
        <div className="container text-center">
          <ThemeSwitch
            key={theme}
            id="theme-switch"
            switchClass="custom-switch-class"
            sliderClass="custom-slider-class"
          />
          <h1>Welcome to Sortify</h1>
          <p>Sortify is an app that allows you to sort your Spotify playlists.</p>
          <button className="btn btn-primary btn-lg" onClick={invertPlaylists}>Reverse Playlists</button>
          
          {/* Opciones de filtro */}
          <div className="mt-3">
            <button onClick={() => setFilter('all')} className="btn btn-secondary">Show All</button>
            <button onClick={() => setFilter('selected')} className="btn btn-success">Show Selected</button>
            <button onClick={() => setFilter('not-selected')} className="btn btn-danger">Show Not Selected</button>
          </div>

          <input
            type="text"
            placeholder="Search Playlists"
            value={searchTerm}
            onChange={handleSearchChange}
            className="form-control mt-3"
          />
        </div>
      </header>
      <div className="container">
        <Routes>
          <Route path="/" element={<PlaylistView playlists={filteredPlaylists} isAnimating={isAnimating} listenedMap={listenedMap} setListenedMap={setListenedMap} toggleListened={toggleListened} />} />
          <Route path="/Zortify" element={<PlaylistView playlists={filteredPlaylists} isAnimating={isAnimating} listenedMap={listenedMap} setListenedMap={setListenedMap} toggleListened={toggleListened} />} />
        </Routes>
      </div>
      {showScrollTopButton && (
        <button className="scroll-top-button btn btn-primary" onClick={scrollToTop}>
          ↑
        </button>
      )}
    </div>
  );
};

const AppWrapper = () => (
  <ThemeProvider>
    <Router>
      <App />
    </Router>
  </ThemeProvider>
);

export default AppWrapper;
