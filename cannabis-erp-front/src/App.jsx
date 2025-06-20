import React, { useState } from "react";
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Button,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  CssBaseline,
} from "@mui/material";
import BusinessIcon from "@mui/icons-material/Business";
import SecurityIcon from "@mui/icons-material/Security"; // No usado directamente en el menú, pero para el icono de permisos
import LogoutIcon from "@mui/icons-material/Logout";
import PeopleIcon from "@mui/icons-material/People";

import LoginComponent from "./components/LoginComponent";
import EmpresasCrud from "./components/EmpresasCrud";
import RolesPermisosCrud from "./components/RolesPermisosCrud";
// import UsuariosCrud from "./components/UsuariosCrud"; // <--- ELIMINA ESTA LÍNEA

// --- Para navegación simple entre secciones ---
const menuItems = [
  { key: "empresas", label: "Empresas", icon: <BusinessIcon /> },
  { key: "usuarios", label: "Usuarios", icon: <PeopleIcon /> }, // El componente RolesPermisosCrud se encargará de esto
];

const drawerWidth = 220;

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [user, setUser] = useState(null);
  const [activeMenu, setActiveMenu] = useState("empresas");

  // -- Logout handler --
  const handleLogout = () => {
    setToken("");
    setUser(null);
    localStorage.removeItem("token");
  };

  // -- Si no hay sesión, mostrar login --
  if (!token) {
    return (
      <LoginComponent setToken={setToken} setUser={setUser} />
    );
  }

  // -- Renderiza contenido según el menú --
  let mainContent = null;

  if (activeMenu === "empresas") {
    mainContent = <EmpresasCrud token={token} tenantId={user?.tenant_id} />;
  } else if (activeMenu === "usuarios") {
    // <--- ¡AQUÍ ESTÁ EL CAMBIO CLAVE!
    // Usamos RolesPermisosCrud para gestionar Usuarios, Roles y Permisos en una sola vista
    mainContent = <RolesPermisosCrud token={token} tenantId={user?.tenant_id} />;
  }
  // No necesitas un else if (activeMenu === "roles") separado,
  // ya que RolesPermisosCrud cubre toda la sección de "Usuarios, Roles & Permisos".

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "#1a1a1a" }}>
      <CssBaseline />
      {/* AppBar superior */}
      <AppBar
        position="fixed"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          bgcolor: "#212224",
        }}
      >
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Cannabis ERP
          </Typography>
          {user && (
            <Typography sx={{ mr: 2 }}>
              {user.name} ({user.email})
            </Typography>
          )}
          <Button
            color="inherit"
            startIcon={<LogoutIcon />}
            onClick={handleLogout}
            sx={{ bgcolor: "#333", ":hover": { bgcolor: "#444" } }}
          >
            Salir
          </Button>
        </Toolbar>
      </AppBar>

      {/* Drawer lateral */}
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            bgcolor: "#232325",
            color: "#fff",
            boxSizing: "border-box",
          },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: "auto", mt: 2 }}>
          <List>
            {menuItems.map((item) => (
              <ListItem key={item.key} disablePadding>
                <ListItemButton
                  selected={activeMenu === item.key}
                  onClick={() => setActiveMenu(item.key)}
                >
                  <ListItemIcon sx={{ color: "#fff" }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          bgcolor: "#18191b",
          minHeight: "100vh",
          width: { sm: `calc(100vw - ${drawerWidth}px)` },
        }}
      >
        <Toolbar />
        {mainContent}
      </Box>
    </Box>
  );
}