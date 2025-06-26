// src/components/ListsManagement.jsx
import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

const ListsManagement = ({ tenantId, isAppReady }) => {
  // Aquí irá la lógica para el CRUD de Listas:
  // - Listar todas las listas (quizás con filtros por tablero)
  // - Crear, editar, eliminar listas
  // - Podría ser una tabla similar a la de usuarios/roles/permisos.

  if (!isAppReady || !tenantId) {
    return <Typography>Cargando gestión de listas...</Typography>;
  }

  return (
    <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
      <Typography variant="h5" mb={2}>Gestión de Listas</Typography>
      <Typography variant="body1" color="text.secondary">
        Aquí podrás ver y gestionar todas las listas (columnas) de tus tableros de calendario.
        (Próximamente: Tabla de listas, botones de crear/editar/eliminar, filtros.)
      </Typography>
      <Box sx={{ mt: 3, p: 2, border: '1px dashed #ccc', borderRadius: 1 }}>
        <Typography variant="body2" color="text.disabled">
          Tenant ID: {tenantId} | App Ready: {isAppReady ? 'Sí' : 'No'}
        </Typography>
      </Box>
    </Paper>
  );
};

export default ListsManagement;
