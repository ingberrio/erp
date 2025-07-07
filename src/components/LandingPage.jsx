// src/components/LandingPage.jsx
import React from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';

const LandingPage = ({ setLoginDialogOpen }) => {
  const navigate = useNavigate();

  const handleLoginClick = () => {
    if (setLoginDialogOpen) {
      setLoginDialogOpen(true);
    } else {
      navigate('/login');
    }
  };

  const handleScheduleCallClick = () => {
    alert('Funcionalidad de "Agendar una Llamada" en desarrollo.');
  };

  return (
    // Contenedor principal con fondo oscuro y altura completa
    <div className="min-h-screen flex flex-col bg-app-bg text-white font-inter text-green-400">
      {/* Navbar */}
      <header className="bg-primary-dark p-4 shadow-lg border-b border-gray-700 text-gray-900">
        <div className="container mx-auto flex justify-between items-center px-4 md:px-8 py-3">
          {/* Nombre de la empresa */}
          <h1 className="text-3xl md:text-4xl font-extrabold header-text tracking-wide"> {/* CAMBIO AQUÍ: text-header-text */}
            Cannabis <span className="text-green-400">ERP</span>
          </h1>
          {/* Botón de Login */}
          <button
            onClick={handleLoginClick}
            className="bg-button-blue hover:bg-button-blue-dark text-header-text font-semibold py-2 px-7 rounded-full shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-button-blue-dark focus:ring-opacity-75"
          >
            Login
          </button>
        </div>
      </header>

      {/* Main Content Section (Hero) */}
      <main className="flex-grow flex items-center justify-center bg-gradient-to-br from-app-bg to-primary-dark p-6 md:p-12 text-center">
        <div className="max-w-5xl w-full px-6 py-16 bg-gray-800 bg-opacity-60 rounded-2xl shadow-2xl backdrop-blur-md border border-gray-700 transform transition-all duration-500 ease-in-out hover:shadow-3xl">
          {/* Título principal */}
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight mb-8 text-white drop-shadow-lg">
          Impulsa tu negocio de Cannabis<span className="text-green-400"> al máximo</span>
          </h2>
          {/* Párrafo descriptivo */}
          <p className="text-lg md:text-xl font-light mb-12 text-gray-300 max-w-3xl mx-auto leading-relaxed">
            Controla todas las operacionesde tu negocio. Reduce los costos laborales y mejora
            las operaciones.
          </p>
          {/* Botón de acción */}
          <button
            onClick={handleScheduleCallClick}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-10 rounded-full shadow-xl transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75 animate-bounce-once"
          >
            Agendar una Llamada
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-primary-dark p-6 text-center text-gray-400 text-sm border-t border-gray-700">
        <div className="container mx-auto">
          &copy; {new Date().getFullYear()} Cannabis ERP. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  );
};

LandingPage.propTypes = {
  setLoginDialogOpen: PropTypes.func.isRequired,
};

export default LandingPage;
