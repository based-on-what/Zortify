import React, { useState, useEffect, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import PlaylistView from './components/PlaylistView/PlaylistView';
import resultsData from './results.json';
import './theme.css';
import './animations.css';
import { ThemeContext, ThemeProvider } from './context/ThemeContext';
import ThemeSwitch from './components/ThemeSwitch/ThemeSwitch';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
// import axios from 'axios'; // Comentado para propósitos de debug, puedes descomentar cuando sea necesario

const App = () => {
  const [accessToken, setAccessToken] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const { theme } = useContext(ThemeContext);
  const [showScrollTopButton, setShowScrollTopButton] = useState(false);
  const [showScrollBottomButton, setShowScrollBottomButton] = useState(false);

  const invertPlaylists = () => {
    setIsAnimating(true);
    setTimeout(() => {
      const reversed = [...playlists].reverse();
      setPlaylists(reversed);
      setTimeout(() => {
        setIsAnimating(false);
      }, 100);
    }, 100);
  };

  // Temporalmente comentado para propósitos de debug, puedes descomentar cuando sea necesario
  // const sendTokenToBackend = async (token) => {
  //   try {
  //     console.log('Enviando token:', token);
  //     const response = await axios.post('http://localhost:4000/store-token', { token }, {
  //       headers: {
  //         'Authorization': `Bearer ${token}`,
  //         'Content-Type': 'application/json',
  //       },
  //     });
  //     console.log('Respuesta del servidor:', response.data);
  //   } catch (error) {
  //     console.log('Detalles del error:', error.response); 
  //   }
  // };

  const handleScroll = () => {

    // Mostrar siempre ambos botones
    setShowScrollBottomButton(true); // Siempre mostrar el botón de ir abajo
    setShowScrollTopButton(true);
  };

  useEffect(() => {
    const playlistsArray = Object.keys(resultsData).map((key) => ({
      name: key,
      ...resultsData[key],
    }));
    setPlaylists(playlistsArray);

    const hash = new URLSearchParams(location.hash.replace('#', ''));
    const token = hash.get('access_token');

    if (token) {
      setAccessToken(token);
      localStorage.setItem('spotify_access_token', token);
      setIsLoggedIn(true);
      // Temporalmente comentado para propósitos de debug, puedes descomentar cuando sea necesario
      // sendTokenToBackend(token); // Envía el token al backend
    } else {
      const savedToken = localStorage.getItem('spotify_access_token');
      if (savedToken) {
        setAccessToken(savedToken);
        setIsLoggedIn(true);
      }
    }
  }, [location.hash, navigate]);

  useEffect(() => {
    document.body.classList.add(`${theme}-theme`);
    return () => {
      document.body.classList.remove(`${theme}-theme`);
    };
  }, [theme]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
  
      setShowScrollTopButton(true);
      setShowScrollBottomButton(true); // Siempre mostrar el botón de ir abajo
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

  const scrollToBottom = () => {
    window.scrollTo({
      top: document.body.scrollHeight,
      behavior: 'smooth',
    });
  };

  return (
    <div className="App">
      <ThemeSwitch
        key={theme}
        id="theme-switch"
        switchClass="custom-switch-class"
        sliderClass="custom-slider-class"
      />
      <header className={`App-header ${theme}-theme`}>
        <div className="container">
          <div className="row">
            <div className="col-md-6">
              <h1>Welcome to Sortify</h1>
              <p>Sortify is an app that allows you to sort your Spotify playlists.</p>
              <button className="btn btn-primary btn-lg" onClick={invertPlaylists}>Reverse Playlists</button>
              {isLoggedIn && (
                <Link to="/" className="btn btn-secondary btn-lg">Sort Playlists</Link>
              )}
            </div>
            <div className="col-md-6 d-flex justify-content-end align-items-center">
              {showScrollTopButton && (
                <button className="btn btn-primary scroll-top-button" onClick={scrollToTop}>
                  <i className="bi bi-arrow-up-short"></i>
                </button>
              )}
             
            </div>
            <div className="col-md-6 d-flex justify-content-end align-items-center">
            {showScrollBottomButton && (
                <button className="btn btn-primary scroll-bottom-button" onClick={scrollToBottom}>
                  <i className="bi bi-arrow-down-short"></i>
                </button>
              )}
              </div>
          </div>
        </div>
      </header>
      <div className="container">
        <Routes>
          <Route path="/" element={<PlaylistView playlists={playlists} isAnimating={isAnimating} />} />
          <Route path="/Sortify" element={<PlaylistView playlists={playlists} isAnimating={isAnimating} />} />
          <Route path="/Sortify/callback" element={<div>Loading...</div>} /> {/* Ruta para manejar el callback */}
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
