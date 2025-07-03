// src/App.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import PropTypes from 'prop-types';

import {
  AppBar, Toolbar, Typography, Button, Box, IconButton, Drawer, List, ListItem,
  ListItemText, CssBaseline, CircularProgress, Snackbar, Alert,
  Menu, MenuItem, Divider, ListItemIcon, Collapse
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import LockIcon from '@mui/icons-material/Lock';
import WorkIcon from '@mui/icons-material/Work';
import AccountCircle from '@mui/icons-material/AccountCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import HomeIcon from '@mui/icons-material/Home';
import AgricultureIcon from '@mui/icons-material/Agriculture';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';

// Importaciones de componentes especificados por el usuario
import LoginComponent from "./components/LoginComponent";
import EmpresasCrud from "./components/EmpresasCrud";
import CalendarioModuleWrapper from './components/CalendarioModuleWrapper';
import CultivationPage from './components/CultivationPage';
import UsuariosCrudInternal from './components/UsuariosCrudInternal';

// Configuración de Axios (instancia global para la API)
export const api = axios.create({
  baseURL: 'http://127.0.0.1:8000/api', // Asegúrate de que esta URL sea correcta para tu backend Laravel
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Componente principal de la aplicación
const App = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Estados de autenticación y carga
  const [loggedIn, setLoggedIn] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [appReady, setAppReady] = useState(false); // Para indicar que la app está lista después de cargar datos iniciales
  const [loginError, setLoginError] = useState(null);
  const [tenantId, setTenantId] = useState(null);
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
  const [userPermissions, setUserPermissions] = useState([]); // Permisos del usuario logeado
  const [facilities, setFacilities] = useState([]); // Lista de instalaciones para el selector de usuario/permisos

  // Estados para Snackbar (mensajes de alerta/éxito)
  const [snackOpen, setSnackOpen] = useState(false);
  const [snackMessage, setSnackMessage] = useState("");
  const [snackSeverity, setSnackSeverity] = useState("info");

  // Estado para el menú de usuario en la AppBar
  const [anchorEl, setAnchorEl] = useState(null);
  const openUserMenu = Boolean(anchorEl);

  // Estado para el drawer (menú lateral)
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Estados para submenús del drawer
  const [openCultivationMenu, setOpenCultivationMenu] = useState(false);
  const [openAdminMenu, setOpenAdminMenu] = useState(false);

  // Función para mostrar snackbar
  const showGlobalSnack = useCallback((message, severity = "info") => {
    setSnackMessage(message);
    setSnackSeverity(severity);
    setSnackOpen(true);
  }, []);

  // Función para cerrar snackbar
  const handleSnackClose = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackOpen(false);
  };

  // Función para verificar permisos del usuario logeado
  const hasPermission = useCallback((permissionName) => {
    return isGlobalAdmin || (Array.isArray(userPermissions) && userPermissions.includes(permissionName));
  }, [isGlobalAdmin, userPermissions]);

  // Manejo del menú de usuario
  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseUserMenu = () => {
    setAnchorEl(null);
  };

  // Función de login
  const handleLogin = async (email, password) => {
    setLoading(true);
    setLoginError(null);
    console.log("handleLogin: Attempting login...");
    try {
      const response = await api.post('/login', { email, password });
      console.log("handleLogin: Login response received:", response.data);

      const { token, user } = response.data;
      const tenant_id = user?.tenant_id;
      const is_global_admin = user?.is_global_admin;

      if (!token || (tenant_id === undefined && is_global_admin === undefined)) {
        console.error("handleLogin: Login failed: Login response missing token or tenant ID/is_global_admin.");
        setLoginError("Login failed: Invalid response from server.");
        showGlobalSnack("Fallo en el login: Respuesta inválida del servidor.", "error");
        setLoading(false);
        return;
      }

      localStorage.setItem('access_token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      if (is_global_admin) {
        setTenantId(null);
        setIsGlobalAdmin(true);
        delete api.defaults.headers.common['X-Tenant-ID'];
        localStorage.removeItem('tenantId');
        localStorage.setItem('isGlobalAdmin', 'true');
        console.log("handleLogin: Logged in as Global Admin. X-Tenant-ID header removed.");
      } else if (tenant_id) {
        setTenantId(tenant_id);
        setIsGlobalAdmin(false);
        api.defaults.headers.common['X-Tenant-ID'] = tenant_id;
        localStorage.setItem('tenantId', tenant_id);
        localStorage.removeItem('isGlobalAdmin');
        console.log("handleLogin: Logged in with Tenant ID:", tenant_id);
      } else {
        console.error("handleLogin: Login failed: User is neither global admin nor has a tenant ID.");
        setLoginError("Credenciales inválidas: Tu cuenta no está asociada a una empresa.");
        showGlobalSnack("Credenciales inválidas: Tu cuenta no está asociada a una empresa.", "error");
        setLoading(false);
        return;
      }

      setAuthUser(user);
      setUserPermissions(user.permissions && Array.isArray(user.permissions) ? user.permissions : []);
      setLoggedIn(true);
      setAppReady(true);

      showGlobalSnack("Inicio de sesión exitoso.", "success");
      navigate('/');

    } catch (error) {
      console.error("handleLogin: Login failed:", error);
      setAuthUser(null);
      setUserPermissions([]);
      setLoggedIn(false);
      localStorage.clear();
      api.defaults.headers.common['Authorization'] = '';
      delete api.defaults.headers.common['X-Tenant-ID'];

      if (error.response && error.response.data && error.response.data.errors) {
        const errorMessages = Object.values(error.response.data.errors).flat().join(' ');
        setLoginError(errorMessages || "Credenciales inválidas.");
        showGlobalSnack("Fallo en el login: " + (errorMessages || "Credenciales inválidas."), "error");
      } else if (error.response && error.response.data && error.response.data.message) {
        setLoginError(error.response.data.message);
        showGlobalSnack("Fallo en el login: " + error.response.data.message, "error");
      } else {
        setLoginError("Ocurrió un error inesperado durante el login.");
        showGlobalSnack("Fallo en el login: Ocurrió un error inesperado.", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  // Función para cargar los detalles del usuario autenticado (al recargar la página)
  const fetchAuthUser = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      const storedUser = localStorage.getItem('user');
      const storedTenantId = localStorage.getItem('tenantId');
      const storedIsGlobalAdmin = localStorage.getItem('isGlobalAdmin');

      if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        let userFromStorage = null;
        if (storedUser) {
          try {
            userFromStorage = JSON.parse(storedUser);
          } catch (e) {
            console.error("Error parsing user from localStorage:", e);
            localStorage.removeItem('user');
          }
        }

        if (storedIsGlobalAdmin === 'true') {
          setIsGlobalAdmin(true);
          setTenantId(null);
          delete api.defaults.headers.common['X-Tenant-ID'];
        } else if (storedTenantId) {
          setTenantId(storedTenantId);
          setIsGlobalAdmin(false);
          api.defaults.headers.common['X-Tenant-ID'] = storedTenantId;
        } else {
          console.warn("App: Authenticated token found but no tenantId or isGlobalAdmin in localStorage. Forcing logout.");
          handleLogout();
          setLoading(false);
          return;
        }

        const response = await api.get('/user');
        const user = response.data;

        setAuthUser(user);
        setUserPermissions(user.permissions && Array.isArray(user.permissions) ? user.permissions : []);
        setLoggedIn(true);
        setAppReady(true);
        console.log("App: User re-authenticated from stored token.", { user_id: user.id, tenant_id: user.tenant_id, is_global_admin: user.is_global_admin });

        if (location.pathname === '/login') {
          navigate('/');
        }
      } else {
        setLoggedIn(false);
        setAuthUser(null);
        setUserPermissions([]);
        setAppReady(true);
        console.log("App: No access token found. Not logged in.");
        if (location.pathname !== '/login') {
          navigate('/login');
        }
      }
    } catch (error) {
      console.error("App: Error fetching authenticated user:", error);
      handleLogout();
      setLoginError("Tu sesión ha expirado. Por favor, inicia sesión de nuevo.");
      showGlobalSnack("Tu sesión ha expirado. Por favor, inicia sesión de nuevo.", "error");
      setAppReady(true);
      if (location.pathname !== '/login') {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  }, [navigate, location.pathname, showGlobalSnack]);

  // Función de logout
  const handleLogout = useCallback(async () => {
    setLoading(true);
    try {
      await api.post('/logout');
      showGlobalSnack("Sesión cerrada exitosamente.", "info");
    } catch (error) {
      console.error("Logout failed:", error);
      showGlobalSnack("Error al cerrar sesión.", "error");
    } finally {
      localStorage.clear();
      api.defaults.headers.common['Authorization'] = '';
      delete api.defaults.headers.common['X-Tenant-ID'];
      setAuthUser(null);
      setUserPermissions([]);
      setLoggedIn(false);
      setTenantId(null);
      setIsGlobalAdmin(false);
      setLoading(false);
      navigate('/login');
    }
  }, [navigate, showGlobalSnack]);

  // Fetch de instalaciones (necesario para el CRUD de usuarios/permisos y CultivationPage)
  const fetchFacilities = useCallback(async () => {
    if (!tenantId && !isGlobalAdmin) {
      setFacilities([]);
      return;
    }
    try {
      const res = await api.get('/facilities');
      // Asegurarse de que setFacilities siempre reciba un array
      setFacilities(Array.isArray(res.data) ? res.data : (Array.isArray(res.data.data) ? res.data.data : []));
    } catch (error) {
      console.error("Error fetching facilities:", error);
      showGlobalSnack("No se pudieron cargar las instalaciones.", "error");
      setFacilities([]); // En caso de error, establecer como array vacío
    }
  }, [tenantId, isGlobalAdmin, showGlobalSnack]);

  // Efecto para cargar el usuario autenticado y las instalaciones al inicio de la aplicación
  useEffect(() => {
    fetchAuthUser();
  }, [fetchAuthUser]);

  // Efecto para cargar instalaciones cuando el tenantId o isGlobalAdmin cambian (después del login inicial)
  useEffect(() => {
    if (appReady && loggedIn) {
      fetchFacilities();
    }
  }, [appReady, loggedIn, fetchFacilities]);


  // Renderizado condicional
  if (loading && !appReady) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: '#1a202c', color: '#fff' }}>
        <CircularProgress color="inherit" />
        <Typography sx={{ ml: 2 }}>Cargando aplicación...</Typography>
      </Box>
    );
  }

  // Si no está logeado y la app está lista, mostrar componente de login
  if (!loggedIn && appReady) {
    return (
      <LoginComponent
        onLogin={handleLogin}
        loading={loading}
        error={loginError}
        setParentSnack={showGlobalSnack}
      />
    );
  }

  // Si está logeado y la app está lista, mostrar la interfaz principal
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#1a202c' }}>
      <CssBaseline />
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, bgcolor: '#283e51' }}>
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            onClick={() => setDrawerOpen(!drawerOpen)}
            edge="start"
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            Cannabis ERP
          </Typography>
          {loggedIn && (
            <Box>
              <IconButton
                size="large"
                edge="end"
                aria-label="account of current user"
                aria-controls="menu-appbar"
                aria-haspopup="true"
                onClick={handleMenu}
                color="inherit"
              >
                <AccountCircle />
              </IconButton>
              <Menu
                id="menu-appbar"
                anchorEl={anchorEl}
                anchorOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                keepMounted
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                open={openUserMenu}
                onClose={handleCloseUserMenu}
                PaperProps={{
                  sx: { bgcolor: '#283e51', color: '#fff' }
                }}
              >
                <MenuItem onClick={handleCloseUserMenu} sx={{ '&:hover': { bgcolor: '#3a506b' } }}>
                  <ListItemIcon><AccountCircle sx={{ color: '#fff' }} /></ListItemIcon>
                  <ListItemText primary={authUser?.name || 'Usuario'} secondary={authUser?.email} secondaryTypographyProps={{ color: 'rgba(255,255,255,0.7)' }} />
                </MenuItem>
                <Divider sx={{ bgcolor: 'rgba(255,255,255,0.2)' }} />
                <MenuItem onClick={handleLogout} sx={{ '&:hover': { bgcolor: '#3a506b' } }}>
                  <ListItemIcon><LogoutIcon sx={{ color: '#fff' }} /></ListItemIcon>
                  <ListItemText primary="Cerrar Sesión" />
                </MenuItem>
              </Menu>
            </Box>
          )}
        </Toolbar>
      </AppBar>
      <Drawer
        variant="temporary"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        ModalProps={{ keepMounted: true }} // Better open performance on mobile.
        sx={{
          width: 240,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { width: 240, boxSizing: 'border-box', bgcolor: '#18191b', color: '#fff' },
        }}
      >
        <Toolbar /> {/* Para compensar la AppBar */}
        <Box sx={{ overflow: 'auto' }}>
          <List>
            {/* Dashboard / Home (ruta raíz) */}
            <ListItem button onClick={() => { navigate('/'); setDrawerOpen(false); }} sx={{ '&:hover': { bgcolor: '#283e51' } }}>
              <ListItemIcon><HomeIcon sx={{ color: '#fff' }} /></ListItemIcon>
              <ListItemText primary="Inicio" />
            </ListItem>

            {/* Cultivo (CultivationPage) */}
            {hasPermission('view-cultivation-areas') && (
              <ListItem button onClick={() => { navigate('/cultivation'); setDrawerOpen(false); }} sx={{ '&:hover': { bgcolor: '#283e51' } }}>
                <ListItemIcon><AgricultureIcon sx={{ color: '#fff' }} /></ListItemIcon>
                <ListItemText primary="Cultivo" />
              </ListItem>
            )}

            {/* Calendario (CalendarioModuleWrapper) */}
            {hasPermission('view-calendar-events') && (
              <ListItem button onClick={() => { navigate('/calendar'); setDrawerOpen(false); }} sx={{ '&:hover': { bgcolor: '#283e51' } }}>
                <ListItemIcon><CalendarMonthIcon sx={{ color: '#fff' }} /></ListItemIcon>
                <ListItemText primary="Calendario" />
              </ListItem>
            )}

            {/* Menú de Administración */}
            {(isGlobalAdmin || hasPermission('view-users') || hasPermission('view-roles') || hasPermission('view-permissions') || hasPermission('view-companies')) && (
              <>
                <ListItem button onClick={() => setOpenAdminMenu(!openAdminMenu)} sx={{ '&:hover': { bgcolor: '#283e51' } }}>
                  <ListItemIcon><LockIcon sx={{ color: '#fff' }} /></ListItemIcon>
                  <ListItemText primary="Administración" />
                  {openAdminMenu ? <ExpandLess sx={{ color: '#fff' }} /> : <ExpandMore sx={{ color: '#fff' }} />}
                </ListItem>
                <Collapse in={openAdminMenu} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding>
                    {isGlobalAdmin && (
                      <ListItem button sx={{ pl: 4, '&:hover': { bgcolor: '#283e51' } }} onClick={() => { navigate('/companies'); setDrawerOpen(false); }}>
                        <ListItemText primary="Empresas" />
                      </ListItem>
                    )}
                    {(hasPermission('view-users') || hasPermission('view-roles') || hasPermission('view-permissions')) && (
                      <ListItem button sx={{ pl: 4, '&:hover': { bgcolor: '#283e51' } }} onClick={() => { navigate('/users'); setDrawerOpen(false); }}>
                        <ListItemText primary="Usuarios y Roles" />
                      </ListItem>
                    )}
                  </List>
                </Collapse>
              </>
            )}
          </List>
        </Box>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: 3, mt: 8, bgcolor: '#1a202c', color: '#fff' }}>
        <Routes>
          {/* Ruta raíz para el dashboard o página de inicio */}
          <Route path="/" element={<HomeComponent authUser={authUser} tenantId={tenantId} isGlobalAdmin={isGlobalAdmin} hasPermission={hasPermission} setParentSnack={showGlobalSnack} />} />
          
          {/* Rutas protegidas por permisos */}
          {hasPermission('view-users') && (
            <Route path="/users" element={
              <UsuariosCrudInternal
                tenantId={tenantId}
                isAppReady={appReady}
                facilities={facilities || []} // Asegurarse de pasar un array, incluso si facilities es null/undefined
                setParentSnack={showGlobalSnack}
                isGlobalAdmin={isGlobalAdmin} // Pasar isGlobalAdmin
              />
            } />
          )}
          {isGlobalAdmin && (
            <Route path="/companies" element={<EmpresasCrud tenantId={tenantId} isAppReady={appReady} isGlobalAdmin={isGlobalAdmin} setParentSnack={showGlobalSnack} />} />
          )}
          {hasPermission('view-cultivation-areas') && (
            <Route path="/cultivation" element={<CultivationPage tenantId={tenantId} isAppReady={appReady} facilities={facilities} setParentSnack={showGlobalSnack} />} />
          )}
          {hasPermission('view-calendar-events') && (
            <Route path="/calendar" element={<CalendarioModuleWrapper tenantId={tenantId} isAppReady={appReady} setParentSnack={showGlobalSnack} />} />
          )}

          {/* Ruta de fallback si no hay ruta o no está logeado (redirige al login si no logeado) */}
          <Route path="*" element={loggedIn ? <HomeComponent authUser={authUser} tenantId={tenantId} isGlobalAdmin={isGlobalAdmin} hasPermission={hasPermission} setParentSnack={showGlobalSnack} /> : <LoginComponent onLogin={handleLogin} loading={loading} error={loginError} setParentSnack={showGlobalSnack} />} />
        </Routes>
      </Box>

      <Snackbar
        open={snackOpen}
        autoHideDuration={6000}
        onClose={handleSnackClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleSnackClose} severity={snackSeverity} sx={{ width: '100%' }}>
          {snackMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

// Componente simple para la página de inicio/dashboard si no tienes un DashboardComponent específico
const HomeComponent = ({ authUser, tenantId, isGlobalAdmin, hasPermission, setParentSnack }) => {
  return (
    <Box sx={{ p: 3, bgcolor: '#18191b', borderRadius: 2, boxShadow: '0 1px 0 rgba(9,30,66,.25)', color: '#fff' }}>
      <Typography variant="h4" gutterBottom sx={{ color: '#fff' }}>
        Bienvenido, {authUser?.name || 'Usuario'}!
      </Typography>
      <Typography variant="body1" sx={{ mb: 2, color: '#aaa' }}>
        Esta es tu página de inicio.
      </Typography>
      {isGlobalAdmin && (
        <Typography variant="body2" sx={{ color: '#4CAF50' }}>
          Eres un Administrador Global.
        </Typography>
      )}
      {tenantId && (
        <Typography variant="body2" sx={{ color: '#4CAF50' }}>
          ID de Tenant: {tenantId}
        </Typography>
      )}
      <Typography variant="body2" sx={{ mt: 2, color: '#aaa' }}>
        Navega usando el menú lateral.
      </Typography>
    </Box>
  );
};

HomeComponent.propTypes = {
  authUser: PropTypes.object,
  tenantId: PropTypes.string,
  isGlobalAdmin: PropTypes.bool,
  hasPermission: PropTypes.func.isRequired,
  setParentSnack: PropTypes.func.isRequired,
};

// Componente Wrapper para Router
const AppWrapper = () => {
  return (
    <App />
  );
};

export default AppWrapper;
