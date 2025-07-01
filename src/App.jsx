// src/App.jsx
import React, { useState, useEffect, useCallback } from "react";
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
  Snackbar,
  Alert,
} from "@mui/material";
import { createTheme, ThemeProvider } from '@mui/material/styles';
import BusinessIcon from "@mui/icons-material/Business";
import LogoutIcon from "@mui/icons-material/Logout";
import PeopleIcon from "@mui/icons-material/People";
import EventNoteIcon from "@mui/icons-material/EventNote";
import GrassIcon from '@mui/icons-material/Grass';

// Importaciones de componentes
import LoginComponent from "./components/LoginComponent";
import EmpresasCrud from "./components/EmpresasCrud";
import CalendarioModuleWrapper from './components/CalendarioModuleWrapper';
import CultivationPage from './components/CultivationPage';
import UsuariosCrudInternal from './components/UsuariosCrudInternal'; // Asegúrate de que este sea el nombre correcto

import { BrowserRouter as Router, useNavigate } from 'react-router-dom';

// --- Configuración Global de Axios ---
export const api = axios.create({
  baseURL: "http://127.0.0.1:8000/api",
  headers: {
    "Accept": "application/json",
  },
  withCredentials: true,
});

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
  { key: "cultivo", label: "Cultivo", icon: <GrassIcon /> },
  { key: "calendario", label: "Calendario", icon: <EventNoteIcon /> },
  { key: "usuarios", label: "Usuarios", icon: <PeopleIcon /> },
];

const drawerWidth = 220;

// Tema de Material-UI
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#90caf9' },
    secondary: { main: '#f48fb1' },
    background: { default: '#121212', paper: '#1d1d1d' },
  },
  typography: { fontFamily: 'Inter, sans-serif' },
  components: {
    MuiButton: { styleOverrides: { root: { borderRadius: '8px' } } },
    MuiPaper: { styleOverrides: { root: { borderRadius: '12px' } } },
  },
});

function AppContent() {
  const [token, setTokenState] = useState(localStorage.getItem("token") || "");
  const [user, setUserState] = useState(() => {
    const storedUser = localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [appLoading, setAppLoading] = useState(true);
  const [isAppReady, setIsAppReady] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: "", severity: "success" });
  const [allFacilities, setAllFacilities] = useState([]);

  const [activeMenu, setActiveMenu] = useState("empresas");

  const navigate = useNavigate();

  const updateToken = useCallback((newToken) => {
    setTokenState(newToken);
    localStorage.setItem("token", newToken);
    console.log("App.jsx: Token actualizado en estado y localStorage.");
  }, []);

  const updateUser = useCallback((newUser) => {
    setUserState(newUser);
    localStorage.setItem("user", JSON.stringify(newUser));
    localStorage.setItem("tenantId", newUser?.tenant_id || '');
    console.log("App.jsx: Usuario actualizado en estado y localStorage. Tenant ID:", newUser?.tenant_id);
    if (newUser && newUser.tenant_id) {
      setIsAppReady(true);
    } else {
      setIsAppReady(false);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    console.log("App.jsx: Iniciando Logout.");
    setAppLoading(true);
    try {
      await api.post('/logout');
    } catch (error) {
      console.error("App.jsx: Error al cerrar sesión en el backend:", error);
    } finally {
      setTokenState("");
      setUserState(null);
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("tenantId");
      setGlobalAxiosHeaders(null, null);
      setIsAppReady(false);
      setAppLoading(false);
      setSnack({ open: true, message: "Sesión cerrada.", severity: "info" });
      navigate('/login');
    }
  }, [navigate, setSnack]);

  const fetchAllFacilities = useCallback(async () => {
    console.log('App.jsx: fetchAllFacilities iniciado.');
    try {
      const response = await api.get('/facilities');
      const fetchedFacilities = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.data)
        ? response.data.data
        : [];
      setAllFacilities(fetchedFacilities);
      console.log('App.jsx: Todas las instalaciones cargadas:', fetchedFacilities.length);
    } catch (error) {
      console.error('App.jsx: Error fetching all facilities:', error);
      setSnack({ open: true, message: "Error al cargar todas las instalaciones.", severity: "error" });
    }
  }, [setSnack]);

  useEffect(() => {
    let isMounted = true;

    const initializeApp = async () => {
      if (!isMounted) return;

      console.log('App.jsx: initializeApp se está ejecutando.');
      setAppLoading(true);

      try {
        console.log("App.jsx: Intentando obtener CSRF cookie...");
        await axios.get('http://127.0.0.1:8000/sanctum/csrf-cookie', { withCredentials: true });
        console.log("App.jsx: CSRF cookie obtenida exitosamente.");

        const currentToken = localStorage.getItem("token");
        const currentUserData = localStorage.getItem("user");
        let parsedUser = null;
        if (currentUserData) {
          try {
            parsedUser = JSON.parse(currentUserData);
          } catch (e) {
            console.error("App.jsx: Error al parsear usuario de localStorage:", e);
            localStorage.removeItem("user");
          }
        }

        if (currentToken && parsedUser && parsedUser.tenant_id) {
          setGlobalAxiosHeaders(currentToken, parsedUser.tenant_id);

          console.log("App.jsx: Validando sesión con /user...");
          const response = await api.get("/user");
          const fetchedUser = response.data;

          if (isMounted) {
            setTokenState(currentToken);
            setUserState(fetchedUser);
            localStorage.setItem("user", JSON.stringify(fetchedUser));
            localStorage.setItem("tenantId", fetchedUser.tenant_id);
            setIsAppReady(true);
            console.log("App.jsx: Sesión validada y App lista. Usuario:", fetchedUser.email);

            await fetchAllFacilities();
          }
        } else {
          console.log("App.jsx: No hay token o usuario válido en localStorage. Mostrando login.");
          if (isMounted) {
            setTokenState("");
            setUserState(null);
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            localStorage.removeItem("tenantId");
            setGlobalAxiosHeaders(null, null);
            setIsAppReady(false);
          }
        }
      } catch (error) {
        console.error("App.jsx: Error fatal al inicializar la aplicación (CSRF o red/API):", error);
        if (isMounted) {
          setSnack({ open: true, message: "Error de conexión o al iniciar la aplicación. Intente de nuevo.", severity: "error" });
          setTokenState("");
          setUserState(null);
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          localStorage.removeItem("tenantId");
          setGlobalAxiosHeaders(null, null);
          setIsAppReady(false);
        }
      } finally {
        if (isMounted) {
          setAppLoading(false);
          console.log('App.jsx: initializeApp finalizado. appLoading:', false);
        }
      }
    };

    initializeApp();

    const requestInterceptor = api.interceptors.request.use(
      (config) => {
        if (!config.url.includes('/login') && !config.url.includes('/register') && !config.url.includes('/sanctum/csrf-cookie')) {
          const currentToken = localStorage.getItem("token");
          const currentUserData = localStorage.getItem("user");
          let currentTenantId = null;
          if (currentUserData) {
            try {
              currentTenantId = JSON.parse(currentUserData).tenant_id;
            } catch (e) {
              console.error("App.jsx [Interceptor]: Error al parsear usuario de localStorage:", e);
              localStorage.removeItem("user");
            }
          }

          if (currentToken) {
            config.headers.Authorization = `Bearer ${currentToken}`;
          } else {
            delete config.headers.Authorization;
          }

          if (currentTenantId) {
            config.headers["X-Tenant-ID"] = currentTenantId;
          } else {
            delete config.headers["X-Tenant-ID"];
          }
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    const responseInterceptor = api.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response && error.response.status === 401) {
          const currentToken = localStorage.getItem("token");
          if (currentToken && isMounted) {
            console.warn("App.jsx [Interceptor]: 401 Unauthorized. Token expirado o inválido. Redirigiendo a login.");
            setSnack({ open: true, message: "Su sesión ha expirado. Por favor, inicie sesión de nuevo.", severity: "warning" });
            handleLogout();
          } else {
            console.log("App.jsx [Interceptor]: 401 Unauthorized para usuario no logueado (esperado).");
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      console.log("App.jsx: Limpiando interceptores de Axios.");
      isMounted = false;
      api.interceptors.request.eject(requestInterceptor);
      api.interceptors.response.eject(responseInterceptor);
    };
  }, [handleLogout, fetchAllFacilities, updateUser]);

  if (appLoading) {
    console.log('App.jsx: Renderizando pantalla de carga.');
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

  if (!token || !user || !user.tenant_id) {
    console.log("App.jsx: Mostrando LoginComponent (no autenticado). Token:", token ? "presente" : "ausente", "User:", user, "Tenant ID:", user?.tenant_id);
    return (
      <LoginComponent setToken={updateToken} setUser={updateUser} />
    );
  }

  let mainContent = null;
  const currentTenantId = user.tenant_id;
  const userFacilityId = user.facility_id || null;

  console.log("App.jsx: Usuario autenticado. Tenant ID actual:", currentTenantId, "App ready:", isAppReady, "User Facility ID:", userFacilityId);

  if (activeMenu === "empresas") {
    mainContent = <EmpresasCrud tenantId={currentTenantId} isAppReady={isAppReady} />;
  } else if (activeMenu === "cultivo") {
    mainContent = <CultivationPage tenantId={currentTenantId} isAppReady={isAppReady} userFacilityId={userFacilityId} />;
  } else if (activeMenu === "calendario") {
    mainContent = <CalendarioModuleWrapper tenantId={currentTenantId} isAppReady={isAppReady} />;
  } else if (activeMenu === "usuarios") {
    // ¡CORRECCIÓN! Renderizar UsuariosCrudInternal aquí, pasando las facilities
    mainContent = <UsuariosCrudInternal tenantId={currentTenantId} isAppReady={isAppReady} facilities={allFacilities} />;
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
      <Snackbar
        open={snack.open}
        autoHideDuration={6000}
        onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnack({ ...snack, open: false })} severity={snack.severity} sx={{ width: '100%' }}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default function AppWrapper() {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Router>
        <AppContent />
      </Router>
    </ThemeProvider>
  );
}
