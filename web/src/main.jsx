import React from 'react';
import ReactDOM from 'react-dom/client';
import AppWrapper from './App'; // Importa AppWrapper
import { BrowserRouter } from 'react-router-dom'; // Importa BrowserRouter
import './index.css'; // Importa tu archivo CSS principal

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter> {/* <-- ¡AQUÍ ES DONDE DEBE ESTAR EL ÚNICO ROUTER! */}
      <AppWrapper />
    </BrowserRouter>
  </React.StrictMode>,
);