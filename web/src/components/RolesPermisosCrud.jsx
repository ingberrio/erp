// src/components/RolesPermisosCrud.jsx

import React, { useState } from "react";
// Importa los componentes internos.
import UsuariosCrudInternal from "./UsuariosCrudInternal";
import RolesCrudInternal from "./RolesCrudInternal";
import PermissionsCrudInternal from "./PermissionsCrudInternal";

import {
  Box, Paper, Typography, Divider, Tabs, Tab, // Asegúrate de que Tabs y Tab estén importados
} from "@mui/material";
import SecurityIcon from "@mui/icons-material/Security"; // Icono para Roles/Permisos
import PeopleIcon from "@mui/icons-material/People"; // Icono para Usuarios
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd"; // Icono para asignar roles/permisos

// El componente RolesPermisosCrud ahora recibe 'tenantId' e 'isAppReady' como props.
const RolesPermisosCrud = ({ tenantId, isAppReady }) => {
  // Estado para la pestaña activa (0: Usuarios, 1: Roles, 2: Permisos)
  const [activeTab, setActiveTab] = useState(0);

  // Log de las props recibidas
  console.log("RolesPermisosCrud: Props received - tenantId:", tenantId, "isAppReady:", isAppReady);

  // Manejador del cambio de pestaña
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
          Users, Roles and Permissions Management
        </Typography>
        <Divider sx={{ my: 2 }} />

        {/* Pestañas para navegar entre Usuarios, Roles y Permisos */}
        {/* Este bloque de Tabs es el que renderiza el submenu */}
        <Tabs value={activeTab} onChange={handleChangeTab} aria-label="Management sections"
              sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="Users" icon={<PeopleIcon />} iconPosition="start" />
          <Tab label="Roles" icon={<AssignmentIndIcon />} iconPosition="start" />
          <Tab label="Permissions" icon={<SecurityIcon />} iconPosition="start" />
        </Tabs>

        {/* Contenido de las pestañas, pasando tenantId e isAppReady a los hijos */}
        {/* Cada uno de estos se renderiza condicionalmente según la pestaña activa */}
        {activeTab === 0 && (
          <UsuariosCrudInternal tenantId={tenantId} isAppReady={isAppReady} />
        )}
        {activeTab === 1 && (
          <RolesCrudInternal tenantId={tenantId} isAppReady={isAppReady} />
        )}
        {activeTab === 2 && (
          <PermissionsCrudInternal tenantId={tenantId} isAppReady={isAppReady} />
        )}

      </Paper>
    </Box>
  );
};

export default RolesPermisosCrud;
