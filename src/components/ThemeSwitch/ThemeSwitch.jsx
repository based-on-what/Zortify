import React, { useContext } from 'react';
import { ThemeContext } from '../../context/ThemeContext';
import { FaSun, FaMoon } from 'react-icons/fa';
import './ThemeSwitch.css';

const ThemeSwitch = ({ id }) => {
  const { theme, toggleTheme } = useContext(ThemeContext);

  return (
    <label className="theme-switch">
      <input
        type="checkbox"
        id={id}
        onChange={toggleTheme}
        checked={theme === 'dark'}
        style={{ display: 'none' }} // Ocultar el input checkbox
      />
      <div className="icon-container" onClick={toggleTheme} aria-label="Toggle theme">
        {theme === 'dark' ? <FaSun /> : <FaMoon />}
      </div>
    </label>
  );
};

export default ThemeSwitch;
