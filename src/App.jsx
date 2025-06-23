import React, { useState, useEffect } from "react";
import axios from "axios"; // Importar Axios
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
  CircularProgress, // Importar CircularProgress para el estado de carga
} from "@mui/material";
import BusinessIcon from "@mui/icons-material/Business";
import LogoutIcon from "@mui/icons-material/Logout";
import PeopleIcon from "@mui/icons-material/People";

import LoginComponent from "./components/LoginComponent";
import EmpresasCrud from "./components/EmpresasCrud";
import RolesPermisosCrud from "./components/RolesPermisosCrud";

// --- Configuración Global de Axios ---
// Esta instancia de Axios será utilizada por todos los componentes.
// Configurar baseURL y headers comunes aquí.
export const api = axios.create({ // Exportar 'api' para que otros componentes puedan usarla
  baseURL: "http://127.0.0.1:8000/api", // Reemplaza con la URL base de tu API Laravel
  headers: {
    "Accept": "application/json",
    // Los headers Authorization y X-Tenant-ID se añadirán dinámicamente
  },
});

// Función para configurar globalmente los headers de Axios.
// Esto es CRUCIAL para que todas las peticiones lleven el token y el tenant ID.
const setGlobalAxiosHeaders = (token, tenantId) => {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    // Si no hay token, eliminar el header para evitar enviar un token inválido
    delete api.defaults.headers.common["Authorization"];
  }

  if (tenantId) {
    api.defaults.headers.common["X-Tenant-ID"] = tenantId;
  } else {
    // Si no hay tenantId, eliminar el header
    delete api.defaults.headers.common["X-Tenant-ID"];
  }
};

// --- Items del menú para navegación ---
const menuItems = [
  { key: "empresas", label: "Empresas", icon: <BusinessIcon /> },
  { key: "usuarios", label: "Usuarios", icon: <PeopleIcon /> },
];

const drawerWidth = 220;

export default function App() {
  // Estado para el token de autenticación
  const [token, setTokenState] = useState("");
  // Estado para el objeto de usuario autenticado
  const [user, setUserState] = useState(null);
  // Estado para el elemento de menú activo (por defecto 'empresas')
  const [activeMenu, setActiveMenu] = useState("empresas");
  // Nuevo estado para controlar la carga inicial de la aplicación
  const [appLoading, setAppLoading] = useState(true);

  // --- Funciones para actualizar el estado y localStorage ---
  // Estas funciones se pasarán a LoginComponent y se encargarán de sincronizar Axios
  const updateToken = (newToken) => {
    setTokenState(newToken);
    localStorage.setItem("token", newToken);
    // Llama a setGlobalAxiosHeaders para que el token se aplique inmediatamente
    // tenantId puede ser null en este punto si user aún no se ha seteado,
    // pero se actualizará en updateUser o la llamada a /user
    setGlobalAxiosHeaders(newToken, user?.tenant_id);
  };

  const updateUser = (newUser) => {
    setUserState(newUser);
    localStorage.setItem("user", JSON.stringify(newUser));
    // Llama a setGlobalAxiosHeaders para que el tenantId se aplique inmediatamente
    // Asegúrate de usar el token actual (del estado) y el tenant_id del nuevo usuario
    setGlobalAxiosHeaders(token, newUser?.tenant_id);
  };

  // --- Manejador de Logout ---
  const handleLogout = () => {
    setTokenState("");
    setUserState(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user"); // También limpiar el objeto de usuario
    setGlobalAxiosHeaders(null, null); // Limpiar los headers globales de Axios
    // Aquí puedes añadir una redirección a la página de login si usas react-router-dom
    // Por ejemplo: navigate('/login');
  };

  // --- useEffect para cargar y validar sesión al montar la aplicación ---
  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    let initialToken = null;
    let initialUser = null;
    let initialTenantId = null;

    if (storedToken) {
      initialToken = storedToken;
      // Intenta parsear el objeto de usuario si existe
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          initialUser = parsedUser;
          initialTenantId = parsedUser.tenant_id;
        } catch (e) {
          console.error("Error al parsear el usuario de localStorage:", e);
          // Si el usuario en localStorage está corrupto, lo borramos
          localStorage.removeItem("user");
        }
      }
    }

    // Configura los headers de Axios globalmente con lo que tengamos (incluso si es null al principio)
    // Esto es crucial para que la llamada a '/user' se haga con el token si existe.
    setGlobalAxiosHeaders(initialToken, initialTenantId);

    if (initialToken && initialTenantId) {
      // Si hay token y tenantId en localStorage, intenta validar la sesión con el backend
      api.get("/user") // Asume que tienes un endpoint /api/user que devuelve el usuario autenticado
        .then(response => {
          // Si la validación es exitosa, actualiza el estado y localStorage con datos frescos
          const fetchedUser = response.data;
          setTokenState(initialToken); // Mantén el token original
          setUserState(fetchedUser);
          localStorage.setItem("user", JSON.stringify(fetchedUser)); // Guarda la info de usuario fresca

          // Asegúrate de que los headers globales de Axios estén correctos con el tenant_id fresco
          // (Puede que ya lo estén si initialTenantId era correcto, pero lo confirmamos)
          setGlobalAxiosHeaders(initialToken, fetchedUser.tenant_id);
          setAppLoading(false); // La aplicación ha terminado de cargar
        })
        .catch(error => {
          console.error("La sesión ha expirado o es inválida:", error);
          // Si el token es inválido o expiró, fuerza el logout
          handleLogout();
          setAppLoading(false);
        });
    } else {
      // Si no hay token o tenantId en localStorage, la aplicación ha terminado de cargar
      // y mostrará la pantalla de login.
      setAppLoading(false);
    }
  }, []); // El array vacío asegura que este efecto se ejecute solo una vez al montar

  // --- Renderizar estado de carga ---
  if (appLoading) {
    return (
      <Box sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        bgcolor: "#1a1a1a",
        color: "#fff"
      }}>
        <CircularProgress color="inherit" sx={{ mr: 2 }} />
        <Typography variant="h5">Cargando aplicación...</Typography>
      </Box>
    );
  }

  // --- Renderizar LoginComponent si no hay token o usuario/tenant ID válido ---
  // Se ejecuta después de que `appLoading` es false.
  // Aseguramos que token, user y user.tenant_id estén presentes y sean válidos.
  if (!token || !user || !user.tenant_id) {
    return (
      // Pasar las funciones para actualizar el estado y localStorage
      <LoginComponent setToken={updateToken} setUser={updateUser} />
    );
  }

  // --- Contenido principal de la aplicación (después de autenticación exitosa) ---
  let mainContent = null;
  // Ya no necesitas 'currentTenantId' aquí, los componentes hijos usarán la 'api' global
  // const currentTenantId = user?.tenant_id; // <-- ELIMINADO/NO NECESARIO EN ESTA LÓGICA

  if (activeMenu === "empresas") {
    // Ya no es necesario pasar token y tenantId como props a EmpresasCrud
    mainContent = <EmpresasCrud />;
  } else if (activeMenu === "usuarios") {
    // Ya no es necesario pasar token y tenantId como props a RolesPermisosCrud
    mainContent = <RolesPermisosCrud />;
  }

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
          {user && ( // Mostrar info del usuario si está disponible
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
                  sx={{
                    "&.Mui-selected": {
                      bgcolor: "#4a4a4a", // Color de fondo cuando está seleccionado
                      "&:hover": {
                        bgcolor: "#5a5a5a",
                      },
                    },
                    "&:hover": {
                      bgcolor: "#3a3a3a",
                    },
                  }}
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

      {/* Contenido Principal */}
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
        <Toolbar /> {/* Espaciador para el AppBar */}
        {mainContent}
      </Box>
    </Box>
  );
}
