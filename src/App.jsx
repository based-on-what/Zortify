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
  const [listenedMap, setListenedMap] = useState([]);
  const [reversed, setReversed] = useState(false);

  useEffect(() => {
    const savedOrder = localStorage.getItem('playlistsOrder');
    const playlistsArray = Object.keys(resultsData).map((key) => ({
      name: key,
      ...resultsData[key],
    }));
    
    if (savedOrder) {
      const order = JSON.parse(savedOrder);
      const orderedPlaylists = order.map(url => playlistsArray.find(p => p.url === url));
      setPlaylists(orderedPlaylists);
    } else {
      setPlaylists(playlistsArray);
    }

    const savedResults = localStorage.getItem('results');
    const initialListenedMap = {};
    if (savedResults) {
      const initialResults = JSON.parse(savedResults);
      Object.keys(initialResults).forEach(key => {
        initialListenedMap[initialResults[key].url] = initialResults[key].listened || false;
      });
    } else {
      playlistsArray.forEach(playlist => {
        initialListenedMap[playlist.url] = false;
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

  const handleReversePlaylists = () => {
    const newPlaylists = [...playlists].reverse();
    setPlaylists(newPlaylists);
    localStorage.setItem('playlistsOrder', JSON.stringify(newPlaylists.map(p => p.url)));
    setReversed(!reversed);
  };

  const filteredPlaylists = playlists.filter(playlist => {
    const isSelected = listenedMap[playlist.url];
    if (filter === 'selected') {
      return isSelected;
    } else if (filter === 'not-selected') {
      return !isSelected;
    }
    return true;
  }).filter(playlist =>
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
          <Route path="/Zortify" element={<PlaylistView playlists={filteredPlaylists} isAnimating={isAnimating} listenedMap={listenedMap} setListenedMap={setListenedMap} />} />
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
    <Router>
      <App />
    </Router>
  </ThemeProvider>
);

export default AppWrapper;
