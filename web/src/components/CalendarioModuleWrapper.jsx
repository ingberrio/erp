// src/components/CalendarioModuleWrapper.jsx
import React, { useState } from 'react';
import PropTypes from 'prop-types'; // Importa PropTypes
import { Box, Typography, Tabs, Tab, Paper } from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'; // Icono para el calendario

// Asegúrate de que estos imports existan en tu proyecto o ajústalos según sea necesario
// Si no tienes estos componentes, necesitarás crearlos o adaptar el código.
import CalendarPage from './CalendarPage';
import ListsManagement from './ListsManagement';
import CardsManagement from './CardsManagement';

// Componente para el panel de cada pestaña
function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

TabPanel.propTypes = {
  children: PropTypes.node,
  index: PropTypes.number.isRequired,
  value: PropTypes.number.isRequired,
};

// Función para generar las props de accesibilidad para cada pestaña
function a11yProps(index) {
  return {
    id: `tab-${index}`,
    'aria-controls': `tabpanel-${index}`,
  };
}

const CalendarioModuleWrapper = ({ tenantId, isAppReady }) => {
  const [activeTab, setActiveTab] = useState(0);

  const handleChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <Box sx={{
      p: { xs: 2, sm: 3 },
      minHeight: 'calc(100vh - 64px)', // Ajusta a la altura de la AppBar
      bgcolor: '#004d80', // Color de fondo azul oscuro como Cultivo
      color: '#fff', // Color de texto blanco para contraste
    }}>
      {/* Título del Módulo */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <CalendarMonthIcon sx={{ fontSize: 32, color: '#fff', mr: 1 }} /> {/* Icono blanco */}
        <Typography variant="h5" sx={{ fontWeight: 600, color: '#fff' }}> {/* Título blanco */}
          Calendar Management
        </Typography>
      </Box>

      {/* Contenedor de Pestañas con estilo de Paper */}
      <Paper
        elevation={2}
        sx={{
          mb: 3,
          borderRadius: 2,
          bgcolor: '#283e51', // Fondo de Paper más oscuro que el fondo general
          boxShadow: '0 1px 0 rgba(9,30,66,.25)', // Sombra sutil
        }}
      >
        <Tabs
          value={activeTab}
          onChange={handleChange}
          aria-label="Navegación de Módulo de Calendario"
          indicatorColor="primary" // Puedes cambiar a 'secondary' o un color personalizado si lo defines
          textColor="inherit" // Hereda el color del padre (blanco)
          centered
          sx={{
            '& .MuiTabs-flexContainer': {
              flexWrap: 'wrap',
            },
            '& .MuiTab-root': {
              color: 'rgba(255,255,255,0.7)', // Color de texto de pestaña inactiva
              '&.Mui-selected': {
                color: '#fff', // Color de texto de pestaña activa
                fontWeight: 600,
              },
            },
            '& .MuiTabs-indicator': {
              backgroundColor: '#4CAF50', // Color del indicador de pestaña (verde como los botones)
            },
          }}
        >
          <Tab label="Boards" {...a11yProps(0)} />
          <Tab label="Lists" {...a11yProps(1)} />
          <Tab label="Cards" {...a11yProps(2)} />
        </Tabs>
      </Paper>

      {/* Contenido de las pestañas */}
      <TabPanel value={activeTab} index={0}>
        {/* Aquí puedes aplicar estilos adicionales si CalendarPage, ListsManagement, CardsManagement
            necesitan un fondo o color de texto específico para contrastar con el fondo azul oscuro.
            Por ejemplo, si son componentes que también usan Paper, asegúrate de que su Paper tenga un bgcolor adecuado.
            Si son solo texto, el color blanco heredado debería funcionar. */}
        <CalendarPage tenantId={tenantId} isAppReady={isAppReady} />
      </TabPanel>
      <TabPanel value={activeTab} index={1}>
        <ListsManagement tenantId={tenantId} isAppReady={isAppReady} />
      </TabPanel>
      <TabPanel value={activeTab} index={2}>
        <CardsManagement tenantId={tenantId} isAppReady={isAppReady} />
      </TabPanel>
    </Box>
  );
};

CalendarioModuleWrapper.propTypes = {
  tenantId: PropTypes.string.isRequired,
  isAppReady: PropTypes.bool.isRequired,
};

export default CalendarioModuleWrapper;
