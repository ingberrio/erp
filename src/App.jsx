import React, { useState, useEffect } from "react";
import axios from "axios";
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
  CircularProgress,
} from "@mui/material";
import BusinessIcon from "@mui/icons-material/Business";
import LogoutIcon from "@mui/icons-material/Logout";
import PeopleIcon from "@mui/icons-material/People";
import EventNoteIcon from "@mui/icons-material/EventNote"; // Importar icono para Calendario

import LoginComponent from "./components/LoginComponent";
import EmpresasCrud from "./components/EmpresasCrud";
import RolesPermisosCrud from "./components/RolesPermisosCrud";
import CalendarioModuleWrapper from './components/CalendarioModuleWrapper'; // Importar el wrapper del calendario

// --- Configuración Global de Axios ---
export const api = axios.create({
  baseURL: "http://127.0.0.1:8000/api",
  headers: {
    "Accept": "application/json",
  },
});

// setGlobalAxiosHeaders se usa para inicializar y limpiar los headers por defecto
export const setGlobalAxiosHeaders = (token, tenantId) => {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common["Authorization"];
  }

  if (tenantId) {
    api.defaults.headers.common["X-Tenant-ID"] = tenantId;
  } else {
    delete api.defaults.headers.common["X-Tenant-ID"];
  }
  console.log("App.jsx: setGlobalAxiosHeaders llamado. Token:", token ? "presente" : "ausente", "Tenant ID:", tenantId);
};

// --- Items del menú para navegación ---
const menuItems = [
  { key: "empresas", label: "Empresas", icon: <BusinessIcon /> },
  { key: "usuarios", label: "Usuarios", icon: <PeopleIcon /> },
  { key: "calendario", label: "Calendario", icon: <EventNoteIcon /> }, // Nuevo ítem de menú
];

const drawerWidth = 220;

export default function App() {
  const [token, setTokenState] = useState("");
  const [user, setUserState] = useState(null);
  const [appLoading, setAppLoading] = useState(true);
  const [isAppReady, setIsAppReady] = useState(false); // Indica si la aplicación está completamente lista y autenticada

  const [activeMenu, setActiveMenu] = useState("empresas");

  const updateToken = (newToken) => {
    setTokenState(newToken);
    localStorage.setItem("token", newToken);
    console.log("App.jsx: Token actualizado en estado y localStorage."); // Debug log
  };

  const updateUser = (newUser) => {
    setUserState(newUser);
    localStorage.setItem("user", JSON.stringify(newUser));
    console.log("App.jsx: Usuario actualizado en estado y localStorage. Tenant ID:", newUser?.tenant_id); // Debug log
  };

  const handleLogout = () => {
    console.log("App.jsx: Iniciando Logout."); // Debug log
    setTokenState("");
    setUserState(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    // Limpiamos los headers directamente al desloguearse
    setGlobalAxiosHeaders(null, null);
    setIsAppReady(false);
  };

  // --- useEffect para configurar el Interceptor de Axios y la carga inicial ---
  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    let initialToken = null;
    let initialUser = null;
    let initialTenantId = null;

    if (storedToken) {
      initialToken = storedToken;
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          initialUser = parsedUser;
          initialTenantId = parsedUser.tenant_id;
        } catch (e) {
          console.error("App.jsx: Error al parsear el usuario de localStorage:", e);
          localStorage.removeItem("user");
        }
      }
    }

    // Configura los headers de Axios con lo que se recuperó de localStorage INMEDIATAMENTE.
    // Esto es vital para la primera llamada a '/user' en el flujo de validación.
    setGlobalAxiosHeaders(initialToken, initialTenantId);


    // --- Axios Request Interceptor ---
    // Este interceptor se ejecutará ANTES de CADA petición saliente de la instancia 'api'.
    const requestInterceptor = api.interceptors.request.use(
      (config) => {
        // Obtener el token y tenantId más recientes DIRECTAMENTE de localStorage
        // Esto asegura que siempre usamos los valores más actualizados.
        const currentToken = localStorage.getItem("token");
        const currentUser = localStorage.getItem("user");
        let currentTenantId = null;
        if (currentUser) {
          try {
            currentTenantId = JSON.parse(currentUser).tenant_id;
          } catch (e) {
            // Error al parsear, dejar currentTenantId como null
          }
        }

        console.log("App.jsx [Interceptor]: Preparando request para URL:", config.url); // Debug log
        if (currentToken) {
          config.headers.Authorization = `Bearer ${currentToken}`;
          console.log("App.jsx [Interceptor]: Token de autorización adjuntado. Longitud:", currentToken.length); // Debug log
        } else {
          delete config.headers.Authorization;
          console.log("App.jsx [Interceptor]: No hay token, Authorization header limpiado."); // Debug log
        }

        if (currentTenantId) {
          config.headers["X-Tenant-ID"] = currentTenantId;
          console.log("App.jsx [Interceptor]: X-Tenant-ID adjuntado:", currentTenantId); // Debug log
        } else {
          delete config.headers["X-Tenant-ID"];
          console.log("App.jsx [Interceptor]: No hay Tenant ID, X-Tenant-ID header limpiado."); // Debug log
        }

        return config;
      },
      (error) => {
        console.error("App.jsx [Interceptor Error]:", error); // Debug log
        return Promise.reject(error);
      }
    );

    // --- Lógica de validación de sesión inicial ---
    if (initialToken && initialTenantId) {
      console.log("App.jsx: Token y Tenant ID iniciales encontrados. Validando sesión..."); // Debug log
      api.get("/user")
        .then(response => {
          const fetchedUser = response.data;
          setTokenState(initialToken);
          setUserState(fetchedUser);
          localStorage.setItem("user", JSON.stringify(fetchedUser));
          setAppLoading(false);
          setIsAppReady(true);
          console.log("App.jsx: Sesión validada y App lista."); // Debug log
        })
        .catch(error => {
          console.error("App.jsx: La sesión ha expirado o es inválida (error en /user):", error); // Debug log
          handleLogout();
          setAppLoading(false);
        });
    } else {
      console.log("App.jsx: No hay token o Tenant ID inicial. Mostrando pantalla de login."); // Debug log
      setAppLoading(false);
      setIsAppReady(false);
    }

    // Función de limpieza para remover el interceptor cuando el componente se desmonte
    return () => {
      console.log("App.jsx: Limpiando interceptor de Axios."); // Debug log
      api.interceptors.request.eject(requestInterceptor);
    };
  }, []); // Este useEffect solo se ejecuta una vez al montar

  // Este useEffect para sincronizar isAppReady con token/user
  useEffect(() => {
      if (token && user?.tenant_id && !isAppReady && !appLoading) {
          setIsAppReady(true);
          console.log("App.jsx: isAppReady establecido a TRUE."); // Debug log
      } else if ((!token || !user?.tenant_id) && isAppReady && !appLoading) {
          setIsAppReady(false);
          console.log("App.jsx: isAppReady establecido a FALSE."); // Debug log
      }
  }, [token, user, isAppReady, appLoading]);


  // Renderizar estado de carga
  if (appLoading) {
    console.log("App.jsx: Mostrando spinner de carga."); // Debug log
    return (
      <Box sx={{
        display: "flex", justifyContent: "center", alignItems: "center",
        minHeight: "100vh", bgcolor: "#1a1a1a", color: "#fff"
      }}>
        <CircularProgress color="inherit" sx={{ mr: 2 }} />
        <Typography variant="h5">Cargando aplicación...</Typography>
      </Box>
    );
  }

  // Renderizar LoginComponent si no hay token o usuario/tenant ID válido
  if (!token || !user || !user.tenant_id) {
    console.log("App.jsx: Mostrando LoginComponent (no autenticado)."); // Debug log
    return (
      <LoginComponent setToken={updateToken} setUser={updateUser} />
    );
  }

  // Contenido principal de la aplicación (después de autenticación exitosa)
  let mainContent = null;
  const currentTenantId = user.tenant_id;
  console.log("App.jsx: Usuario autenticado. Tenant ID actual:", currentTenantId, "App ready:", isAppReady); // Debug log

  if (activeMenu === "empresas") {
    mainContent = <EmpresasCrud tenantId={currentTenantId} isAppReady={isAppReady} />;
  } else if (activeMenu === "usuarios") {
    mainContent = <RolesPermisosCrud tenantId={currentTenantId} isAppReady={isAppReady} />;
  } else if (activeMenu === "calendario") { // Nueva condición para Calendario
    mainContent = <CalendarioModuleWrapper tenantId={currentTenantId} isAppReady={isAppReady} />;
  }

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "#1a1a1a" }}>
      <CssBaseline />
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, bgcolor: "#212224" }}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Cannabis ERP
          </Typography>
          {user && (
            <Typography sx={{ mr: 2 }}>
              {user.name} ({user.email})
            </Typography>
          )}
          <Button color="inherit" startIcon={<LogoutIcon />} onClick={handleLogout} sx={{ bgcolor: "#333", ":hover": { bgcolor: "#444" } }}>
            Salir
          </Button>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth, flexShrink: 0,
          [`& .MuiDrawer-paper`]: { width: drawerWidth, bgcolor: "#232325", color: "#fff", boxSizing: "border-box" },
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
                  sx={{
                    "&.Mui-selected": { bgcolor: "#4a4a4a", "&:hover": { bgcolor: "#5a5a5a" }, },
                    "&:hover": { bgcolor: "#3a3a3a" },
                  }}
                >
                  <ListItemIcon sx={{ color: "#fff" }}>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>

      <Box
        component="main"
        sx={{ flexGrow: 1, p: 3, bgcolor: "#18191b", minHeight: "100vh", width: { sm: `calc(100vw - ${drawerWidth}px)` }, }}
      >
        <Toolbar />
        {mainContent}
      </Box>
    </Box>
  );
}
