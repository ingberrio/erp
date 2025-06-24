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

import LoginComponent from "./components/LoginComponent";
import EmpresasCrud from "./components/EmpresasCrud";
import RolesPermisosCrud from "./components/RolesPermisosCrud";

// --- Configuración Global de Axios ---
export const api = axios.create({
  baseURL: "http://127.0.0.1:8000/api",
  headers: {
    "Accept": "application/json",
  },
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
};

const menuItems = [
  { key: "empresas", label: "Empresas", icon: <BusinessIcon /> },
  { key: "usuarios", label: "Usuarios", icon: <PeopleIcon /> },
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
  };

  const updateUser = (newUser) => {
    setUserState(newUser);
    localStorage.setItem("user", JSON.stringify(newUser));
  };

  const handleLogout = () => {
    console.log("App: Performing logout...");
    setTokenState("");
    setUserState(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setGlobalAxiosHeaders(null, null);
    setIsAppReady(false);
  };

  // --- useEffect para configurar el Interceptor de Axios y la carga inicial ---
  useEffect(() => {
    console.log("App: Primary useEffect running (initial load/refresh)");
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
          console.log("App: Found stored user data:", parsedUser);
        } catch (e) {
          console.error("App: Error parsing user from localStorage:", e);
          localStorage.removeItem("user");
        }
      }
    }
    console.log("App: Initializing Axios headers with token:", !!initialToken, "tenantId:", initialTenantId);
    setGlobalAxiosHeaders(initialToken, initialTenantId);


    // --- Axios Request Interceptor ---
    const requestInterceptor = api.interceptors.request.use(
      (config) => {
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
        // console.log("App Interceptor: Request headers set:", { auth: !!config.headers.Authorization, tenant: config.headers["X-Tenant-ID"] });
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // --- Lógica de validación de sesión inicial ---
    if (initialToken && initialTenantId) {
      console.log("App: Validating session with /user endpoint...");
      api.get("/user")
        .then(response => {
          const fetchedUser = response.data;
          setTokenState(initialToken);
          setUserState(fetchedUser);
          localStorage.setItem("user", JSON.stringify(fetchedUser));
          setAppLoading(false);
          setIsAppReady(true); // <-- Establecido a true aquí
          console.log("App: Session validated. isAppReady set to TRUE.");
        })
        .catch(error => {
          console.error("App: Session expired or invalid, logging out:", error);
          handleLogout();
          setAppLoading(false);
        });
    } else {
      console.log("App: No stored token or tenantId, showing login.");
      setAppLoading(false);
      setIsAppReady(false); // <-- Asegurarse de que esté en false si no hay sesión
    }

    // Función de limpieza para remover el interceptor cuando el componente se desmonte
    return () => {
      console.log("App: Cleaning up request interceptor.");
      api.interceptors.request.eject(requestInterceptor);
    };
  }, []); // Se ejecuta solo una vez al montar

  // --- useEffect para reaccionar a cambios en token/user y actualizar isAppReady ---
  useEffect(() => {
    console.log("App: Secondary useEffect running (token/user/appLoading changed).");
    console.log("Current state - token:", !!token, "user:", user ? user.email : "null", "tenant_id:", user?.tenant_id, "appLoading:", appLoading, "isAppReady:", isAppReady);

    if (!appLoading) {
        if (token && user?.tenant_id && !isAppReady) {
            setIsAppReady(true);
            console.log("App: isAppReady set to TRUE after login/state update.");
        } else if ((!token || !user?.tenant_id) && isAppReady) {
            setIsAppReady(false);
            console.log("App: isAppReady set to FALSE due to missing token/user.");
        }
    }
  }, [token, user, appLoading, isAppReady]);


  // Renderizar estado de carga
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

  // Renderizar LoginComponent si no hay token o usuario/tenant ID válido
  if (!token || !user || !user.tenant_id) {
    console.log("App: Showing LoginComponent (token, user, or tenant_id is missing).");
    return (
      <LoginComponent setToken={updateToken} setUser={updateUser} />
    );
  }

  // Contenido principal de la aplicación (después de autenticación exitosa)
  let mainContent = null;
  const currentTenantId = user.tenant_id;
  console.log("App: Rendering main content. currentTenantId:", currentTenantId, "isAppReady:", isAppReady);

  if (activeMenu === "empresas") {
    mainContent = <EmpresasCrud tenantId={currentTenantId} isAppReady={isAppReady} />;
  } else if (activeMenu === "usuarios") {
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
    </Box>
  );
}
