// src/components/CardsManagement.jsx
import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

const CardsManagement = ({ tenantId, isAppReady }) => {
  // Aquí irá la lógica para el CRUD de Tarjetas:
  // - Listar todas las tarjetas (quizás con filtros por tablero/lista, fecha, asignado)
  // - Crear, editar, eliminar tarjetas
  // - Podría ser una tabla con búsqueda y paginación.

  if (!isAppReady || !tenantId) {
    return <Typography>Cargando gestión de tarjetas...</Typography>;
  }

  return (
    <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
      <Typography variant="h5" mb={2}>Gestión de Tarjetas</Typography>
      <Typography variant="body1" color="text.secondary">
        Aquí podrás ver y gestionar todas las tarjetas (tareas) de tus tableros de calendario.
        (Próximamente: Tabla de tarjetas, botones de crear/editar/eliminar, filtros avanzados.)
      </Typography>
      <Box sx={{ mt: 3, p: 2, border: '1px dashed #ccc', borderRadius: 1 }}>
        <Typography variant="body2" color="text.disabled">
          Tenant ID: {tenantId} | App Ready: {isAppReady ? 'Sí' : 'No'}
        </Typography>
      </Box>
    </Paper>
  );
};

export default CardsManagement;
