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
  const [listenedMap, setListenedMap] = useState({});
  const [reversed, setReversed] = useState(false);

  // Inicializa los datos de playlists y listenedMap
  useEffect(() => {
    const playlistsArray = Object.keys(resultsData).map((key) => {
      const playlist = { name: key, ...resultsData[key] };
      if (playlist.url) return playlist;
      console.warn(`Playlist "${key}" no tiene una URL válida`, playlist);
      return null;
    }).filter(Boolean); // Filtra valores nulos

    const savedOrder = localStorage.getItem('playlistsOrder');
    if (savedOrder) {
      const order = JSON.parse(savedOrder);
      const orderedPlaylists = order.map(url => playlistsArray.find(p => p.url === url)).filter(Boolean);
      setPlaylists(orderedPlaylists);
    } else {
      setPlaylists(playlistsArray);
    }

    const savedResults = localStorage.getItem('results');
    const initialListenedMap = {};
    if (savedResults) {
      const initialResults = JSON.parse(savedResults);
      Object.keys(initialResults).forEach((key) => {
        const { url, listened } = initialResults[key];
        if (url) {
          initialListenedMap[url] = listened || false;
        }
      });
    } else {
      playlistsArray.forEach((playlist) => {
        if (playlist.url) {
          initialListenedMap[playlist.url] = false;
        }
      });
    }
    setListenedMap(initialListenedMap);
  }, [location.hash]);

  // Actualiza el tema
  useEffect(() => {
    document.body.classList.add(`${theme}-theme`);
    return () => {
      document.body.classList.remove(`${theme}-theme`);
    };
  }, [theme]);

  // Maneja el botón de scroll hacia arriba
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTopButton(window.scrollY > 200);
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Invierte la lista de playlists
  const handleReversePlaylists = () => {
    const newPlaylists = [...playlists].reverse();
    setPlaylists(newPlaylists);
    localStorage.setItem('playlistsOrder', JSON.stringify(newPlaylists.map(p => p.url)));
    setReversed(!reversed);
  };

  // Filtra las playlists
  const filteredPlaylists = playlists.filter((playlist) => {
    if (!playlist || !playlist.url) {
      console.warn('Objeto de playlist inválido encontrado:', playlist);
      return false;
    }
    const isSelected = listenedMap[playlist.url];
    if (filter === 'selected') {
      return isSelected;
    } else if (filter === 'not-selected') {
      return !isSelected;
    }
    return true;
  }).filter((playlist) =>
    playlist.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="App">
      <header className={`App-header ${theme}-theme`}>
        <div className="container text-center">
          <ThemeSwitch key={theme} id="theme-switch" switchClass="custom-switch-class" sliderClass="custom-slider-class" />
          <h1>Welcome to Sortify</h1>
          <p>Sortify is an app that allows you to sort your Spotify playlists.</p>
          <button className="btn btn-primary btn-lg" onClick={handleReversePlaylists}>Reverse Playlists</button>
          
          <div className="mt-3">
            <button onClick={() => setFilter('all')} className="btn btn-secondary">Show All</button>
            <button onClick={() => setFilter('selected')} className="btn btn-success">Show Selected</button>
            <button onClick={() => setFilter('not-selected')} className="btn btn-danger">Show Not Selected</button>
          </div>

          <input type="text" placeholder="Search Playlists" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="form-control mt-3" />
        </div>
      </header>
      <div className="container">
        <Routes>
          <Route path="/" element={<PlaylistView playlists={filteredPlaylists} isAnimating={isAnimating} listenedMap={listenedMap} setListenedMap={setListenedMap} />} />
        </Routes>
      </div>
      {showScrollTopButton && (
        <button className="scroll-top-button btn btn-primary" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          ↑
        </button>
      )}
    </div>
  );
};

const AppWrapper = () => (
  <ThemeProvider>
    <Router basename="/Zortify">
      <App />
    </Router>
  </ThemeProvider>
);

export default AppWrapper;
