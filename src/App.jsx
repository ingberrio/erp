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
import { createTheme, ThemeProvider } from '@mui/material/styles'; // Importar ThemeProvider y createTheme
import BusinessIcon from "@mui/icons-material/Business";
import LogoutIcon from "@mui/icons-material/Logout";
import PeopleIcon from "@mui/icons-material/People";
import EventNoteIcon from "@mui/icons-material/EventNote"; // Icono para Calendario
import GrassIcon from '@mui/icons-material/Grass'; // Nuevo icono para Cultivo
import SecurityIcon from '@mui/icons-material/Security'; // Icono para Roles/Permisos

// Importaciones de componentes (asegúrate de que los nombres de archivo coincidan)
import LoginComponent from "./components/LoginComponent";
import EmpresasCrud from "./components/EmpresasCrud";
import RolesPermisosCrud from "./components/RolesPermisosCrud";
import CalendarioModuleWrapper from './components/CalendarioModuleWrapper';
import CultivationPage from './components/CultivationPage';

// Importar BrowserRouter y useNavigate desde react-router-dom
import { BrowserRouter as Router, useNavigate } from 'react-router-dom';

// --- Configuración Global de Axios ---
export const api = axios.create({
  baseURL: "http://127.0.0.1:8000/api",
  headers: {
    "Accept": "application/json",
  },
  withCredentials: true, // ¡CRÍTICO! Permite el envío y recepción de cookies
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
  { key: "cultivo", label: "Cultivo", icon: <GrassIcon /> },
  { key: "calendario", label: "Calendario", icon: <EventNoteIcon /> },
  { key: "usuarios", label: "Usuarios", icon: <PeopleIcon /> },
  { key: "roles-permisos", label: "Roles y Permisos", icon: <SecurityIcon /> }, // Nuevo item de menú
];

const drawerWidth = 220;

// Tema de Material-UI (definido aquí para que ThemeProvider pueda usarlo)
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

// --- Nuevo componente AppContent que contiene la lógica principal ---
function AppContent() {
  const [token, setTokenState] = useState("");
  const [user, setUserState] = useState(null);
  const [appLoading, setAppLoading] = useState(true);
  const [isAppReady, setIsAppReady] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: "", severity: "success" });

  const [activeMenu, setActiveMenu] = useState("empresas"); // Mantener "empresas" como activo por defecto

  const navigate = useNavigate(); // useNavigate ahora está dentro de AppContent, que es hijo de Router

  const updateToken = useCallback((newToken) => {
    setTokenState(newToken);
    localStorage.setItem("token", newToken);
    console.log("App.jsx: Token actualizado en estado y localStorage.");
  }, []);

  const updateUser = useCallback((newUser) => {
    setUserState(newUser);
    localStorage.setItem("user", JSON.stringify(newUser));
    console.log("App.jsx: Usuario actualizado en estado y localStorage. Tenant ID:", newUser?.tenant_id);
    // Si el usuario se actualiza (ej. login), la app está lista
    if (newUser && newUser.tenant_id) {
        setIsAppReady(true);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    console.log("App.jsx: Iniciando Logout.");
    setAppLoading(true); // Activar loading para el logout
    try {
      await api.post('/logout'); // Usar la instancia 'api' para que adjunte el token
    } catch (error) {
      console.error("App.jsx: Error al cerrar sesión en el backend:", error);
      // No es crítico si el logout del backend falla después de limpiar el frontend
    } finally {
      setTokenState("");
      setUserState(null);
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("tenantId"); // Asegúrate de limpiar también tenantId
      setGlobalAxiosHeaders(null, null);
      setIsAppReady(false);
      setAppLoading(false);
      setSnack({ open: true, message: "Sesión cerrada.", severity: "info" });
      navigate('/login'); // Redirigir a la página de login
    }
  }, [navigate]);

  // Efecto para la carga inicial de la aplicación y validación de sesión
  useEffect(() => {
    const initializeApp = async () => {
      setAppLoading(true);
      try {
        // 1. Obtener la cookie CSRF (CRÍTICO para Sanctum SPA)
        console.log("App.jsx: Intentando obtener CSRF cookie...");
        await axios.get('http://127.0.0.1:8000/sanctum/csrf-cookie', { withCredentials: true });
        console.log("App.jsx: CSRF cookie obtenida exitosamente.");

        // 2. Cargar token y usuario de localStorage
        const storedToken = localStorage.getItem("token");
        const storedUser = localStorage.getItem("user");
        let initialUser = null;
        let initialTenantId = null;

        if (storedToken && storedUser) {
          try {
            const parsedUser = JSON.parse(storedUser);
            initialUser = parsedUser;
            initialTenantId = parsedUser.tenant_id;
            // Configurar headers de Axios antes de cualquier otra llamada API
            setGlobalAxiosHeaders(storedToken, initialTenantId);

            // 3. Validar el token y obtener usuario del backend
            console.log("App.jsx: Validando sesión con /user...");
            const response = await api.get("/user"); // Usar 'api' para que el interceptor adjunte el token
            const fetchedUser = response.data;
            setTokenState(storedToken);
            setUserState(fetchedUser);
            localStorage.setItem("user", JSON.stringify(fetchedUser)); // Actualizar user en localStorage si es necesario
            setIsAppReady(true);
            console.log("App.jsx: Sesión validada y App lista. Usuario:", fetchedUser.email);
          } catch (error) {
            console.error("App.jsx: La sesión ha expirado o es inválida (error en /user):", error);
            // Si hay un error al validar el usuario, limpiar la sesión
            handleLogout(); // Llama a handleLogout para limpiar todo y redirigir
            setSnack({ open: true, message: "Su sesión ha expirado. Por favor, inicie sesión de nuevo.", severity: "warning" });
          }
        } else {
          console.log("App.jsx: No hay token o usuario en localStorage. Usuario no autenticado.");
          setUserState(null);
          setTokenState("");
          setGlobalAxiosHeaders(null, null); // Limpiar headers si no hay token
          setIsAppReady(false);
        }
      } catch (error) {
        console.error("App.jsx: Error fatal al inicializar la aplicación (CSRF o red):", error);
        setSnack({ open: true, message: "Error de conexión o al iniciar la aplicación. Intente de nuevo.", severity: "error" });
        setUserState(null);
        setTokenState("");
        setGlobalAxiosHeaders(null, null);
        setIsAppReady(false);
      } finally {
        setAppLoading(false); // Desactivar el spinner de carga inicial
      }
    };

    initializeApp();

    // Interceptor de solicitudes de Axios (asegura que los headers estén siempre actualizados)
    const requestInterceptor = api.interceptors.request.use(
      (config) => {
        // Excluir login, register y csrf-cookie del interceptor de token/tenantId
        if (!config.url.includes('/login') && !config.url.includes('/register') && !config.url.includes('/sanctum/csrf-cookie')) {
          const currentToken = localStorage.getItem("token");
          const currentUser = localStorage.getItem("user");
          let currentTenantId = null;
          if (currentUser) {
            try {
              currentTenantId = JSON.parse(currentUser).tenant_id;
            } catch (e) {
              console.error("App.jsx [Interceptor]: Error al parsear usuario de localStorage:", e);
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

    // Interceptor de respuestas de Axios (manejo de 401 global)
    const responseInterceptor = api.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response && error.response.status === 401) {
          // Si es 401 y el usuario estaba logueado, significa que el token expiró o es inválido
          if (user) { // Solo si el usuario estaba previamente autenticado en el estado
            console.warn("App.jsx [Interceptor]: 401 Unauthorized. Token expirado o inválido. Redirigiendo a login.");
            setSnack({ open: true, message: "Su sesión ha expirado. Por favor, inicie sesión de nuevo.", severity: "warning" });
            handleLogout(); // Llama a la función de logout para limpiar el estado y redirigir
          } else {
            // Si no estaba logueado, es un 401 esperado (ej. intentando acceder a ruta protegida sin login)
            console.log("App.jsx [Interceptor]: 401 Unauthorized para usuario no logueado.");
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      console.log("App.jsx: Limpiando interceptores de Axios.");
      api.interceptors.request.eject(requestInterceptor);
      api.interceptors.response.eject(responseInterceptor);
    };
  }, [handleLogout]); // Dependencia handleLogout para evitar bucles si se actualiza

  // Renderizado condicional basado en el estado de autenticación y carga
  if (appLoading) {
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

  // Si no hay token o usuario, mostrar el componente de login
  if (!token || !user || !user.tenant_id) {
    console.log("App.jsx: Mostrando LoginComponent (no autenticado).");
    return (
      <LoginComponent setToken={updateToken} setUser={updateUser} />
    );
  }

  // Si está autenticado, mostrar el contenido principal
  let mainContent = null;
  const currentTenantId = user.tenant_id;
  console.log("App.jsx: Usuario autenticado. Tenant ID actual:", currentTenantId, "App ready:", isAppReady);

  if (activeMenu === "empresas") {
    mainContent = <EmpresasCrud tenantId={currentTenantId} isAppReady={isAppReady} />;
  } else if (activeMenu === "cultivo") {
    mainContent = <CultivationPage tenantId={currentTenantId} isAppReady={isAppReady} />;
  } else if (activeMenu === "calendario") {
    mainContent = <CalendarioModuleWrapper tenantId={currentTenantId} isAppReady={isAppReady} />;
  } else if (activeMenu === "usuarios") {
    mainContent = <RolesPermisosCrud tenantId={currentTenantId} isAppReady={isAppReady} />;
  } else if (activeMenu === "roles-permisos") {
      mainContent = <RolesPermisosCrud tenantId={currentTenantId} isAppReady={isAppReady} />;
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

// --- Componente principal de la aplicación que se exporta por defecto ---
// Este componente envuelve AppContent en BrowserRouter y ThemeProvider
// para que useNavigate y otros hooks de React Router funcionen correctamente.
// Asegúrate de que este componente 'AppWrapper' sea el que se exporta por defecto.
export default function AppWrapper() {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Router> {/* BrowserRouter envuelve todo el contenido que usa hooks de React Router */}
        <AppContent />
      </Router>
    </ThemeProvider>
  );
}
