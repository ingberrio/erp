// src/components/CalendarioModuleWrapper.jsx
import React, { useState } from 'react';
import { Box, Typography, Tabs, Tab, Paper } from '@mui/material';
import CalendarPage from './CalendarPage';
import ListsManagement from './ListsManagement'; // Asegúrate de que estos imports existan o ajústalos
import CardsManagement from './CardsManagement'; // Asegúrate de que estos imports existan o ajústalos

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
    <Box sx={{ width: '100%' }}>
      <Paper elevation={2} sx={{ mb: 3, borderRadius: 2 }}>
        <Tabs
          value={activeTab}
          onChange={handleChange}
          aria-label="Navegación de Módulo de Calendario"
          indicatorColor="primary"
          textColor="primary"
          centered
          sx={{
            '& .MuiTabs-flexContainer': {
              flexWrap: 'wrap',
            },
          }}
        >
          <Tab label="Tableros" {...a11yProps(0)} />
          <Tab label="Listas" {...a11yProps(1)} />
          <Tab label="Tarjetas" {...a11yProps(2)} />
        </Tabs>
      </Paper>

      {/* Contenido de las pestañas */}
      <TabPanel value={activeTab} index={0}>
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

export default CalendarioModuleWrapper;
