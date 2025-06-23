// src/components/RolesPermisosCrud.jsx

import React, { useState } from "react";
// Importa la instancia global de Axios desde App.jsx
// Ya no es necesario importar 'api' aquí, ya que este componente solo contiene las pestañas
// y los componentes internos importan 'api' directamente.
// import { api } from "../App"; // <-- Puedes eliminar esta línea

import {
  Box, Paper, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, List, ListItem, ListItemText, IconButton, Snackbar, Alert, Divider,
  Tabs, Tab, CircularProgress,
  InputAdornment,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SecurityIcon from "@mui/icons-material/Security";
import PeopleIcon from "@mui/icons-material/People";
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import SearchIcon from '@mui/icons-material/Search';

// Importa los componentes internos que deben estar en archivos separados
import UsuariosCrudInternal from "./UsuariosCrudInternal";
import RolesCrudInternal from "./RolesCrudInternal";
import PermissionsCrudInternal from "./PermissionsCrudInternal";

const RolesPermisosCrud = () => {
  const [activeTab, setActiveTab] = useState(0);

  const handleChangeTab = (event, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <Box sx={{ width: "100%", flex: 1, display: "flex", flexDirection: "column" }}>
      <Paper
        sx={{
          p: { xs: 2, sm: 4 },
          maxWidth: 900,
          mx: "auto",
          width: "100%",
          mt: { xs: 2, sm: 6 },
          minHeight: 400
        }}
      >
        <Typography variant="h5" gutterBottom>
          <SecurityIcon sx={{ mr: 1, mb: -0.5 }} />
          Gestión de Usuarios, Roles y Permisos
        </Typography>
        <Divider sx={{ my: 2 }} />

        <Tabs value={activeTab} onChange={handleChangeTab} aria-label="Secciones de gestión"
              sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="Usuarios" icon={<PeopleIcon />} iconPosition="start" />
          <Tab label="Roles" icon={<AssignmentIndIcon />} iconPosition="start" />
          <Tab label="Permisos" icon={<SecurityIcon />} iconPosition="start" />
        </Tabs>

        {activeTab === 0 && (
          <UsuariosCrudInternal />
        )}
        {activeTab === 1 && (
          <RolesCrudInternal />
        )}
        {activeTab === 2 && (
          <PermissionsCrudInternal />
        )}

      </Paper>
    </Box>
  );
};

export default RolesPermisosCrud;
