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
  const { theme } = useContext(ThemeContext);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const playlistsArray = Object.keys(resultsData).map((key) => ({
      name: key,
      ...resultsData[key],
    }));
    setPlaylists(playlistsArray);
  }, [location.hash]);

  useEffect(() => {
    document.body.classList.add(`${theme}-theme`);
    return () => {
      document.body.classList.remove(`${theme}-theme`);
    };
  }, [theme]);

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const filteredPlaylists = playlists.filter(playlist =>
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
          <Route path="/" element={<PlaylistView playlists={filteredPlaylists} />} />
          <Route path="/Zortify" element={<PlaylistView playlists={filteredPlaylists} />} />
        </Routes>
      </div>
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
