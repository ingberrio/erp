// src/App.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

// Componentes y Utilidades de Material-UI
import {
  AppBar, Toolbar, IconButton, Typography, Box, Drawer, List, ListItem,
  ListItemIcon, ListItemText, CssBaseline, Snackbar, Alert, Menu, MenuItem,
  CircularProgress, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Collapse // Importar Collapse para el menú desplegable
} from '@mui/material';

// Iconos de Material-UI
import MenuIcon from '@mui/icons-material/Menu';
import AccountCircle from '@mui/icons-material/AccountCircle';
import HomeIcon from '@mui/icons-material/Home';
import BusinessIcon from '@mui/icons-material/Business';
import PeopleIcon from '@mui/icons-material/People';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import ExpandLess from '@mui/icons-material/ExpandLess'; // Icono para expandir
import ExpandMore from '@mui/icons-material/ExpandMore'; // Icono para contraer
import LockIcon from '@mui/icons-material/Lock'; // Para el menú de Administración
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'; // Para Calendario
import LocalFloristIcon from '@mui/icons-material/LocalFlorist'; // Para Cultivo (o un ícono de tractor si lo tienes)


// Componentes de tu aplicación
import EmpresasCrud from './components/EmpresasCrud';
import UsuariosCrudInternal from './components/UsuariosCrudInternal';
import CalendarioModuleWrapper from './components/CalendarioModuleWrapper'; // <-- ¡IMPORTADO!
import CultivationPage from './components/CultivationPage'; // <-- ¡IMPORTADO!


// Configuración de Axios
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
  withCredentials: true, // <-- ¡MUY IMPORTANTE PARA SANCTUM!
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
}); 

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken'); // O de donde sea que guardes tu token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Asegúrate de que X-Tenant-ID se envíe si está disponible
    const currentTenantId = localStorage.getItem('currentTenantId'); // O de donde sea que guardes el tenant ID
    if (currentTenantId) {
      config.headers['X-Tenant-ID'] = currentTenantId;
    } else {
      // Si no hay tenantId, asegúrate de que el header no se envíe o sea null,
      // dependiendo de cómo tu backend maneje los Super Admins.
      // Para Super Admins, a menudo no se necesita X-Tenant-ID para rutas globales como /tenants.
      // Puedes decidir eliminarlo si el usuario es Super Admin y la ruta es global.
      // Por ahora, lo dejamos para ver si es la causa del 401.
      config.headers['X-Tenant-ID'] = null; // O elimina la línea: delete config.headers['X-Tenant-ID'];
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

const drawerWidth = 240;

const App = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [loggedIn, setLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const [anchorEl, setAnchorEl] = useState(null); // Para el menú de usuario
  const openUserMenu = Boolean(anchorEl);
  const userMenuAnchorRef = React.useRef(null); // Ref para el anclaje del menú de usuario

  const [facilities, setFacilities] = useState([]);

  // Estado para el diálogo de login
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Estado para los permisos del usuario
  const [userPermissions, setUserPermissions] = useState(new Set()); // Usamos un Set para búsqueda rápida
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
  const [tenantId, setTenantId] = useState(null);
  const [isAppReady, setIsAppReady] = useState(false); // Nuevo estado para indicar que la app está lista

  // Estado para el menú de Administración colapsable
  const [openAdminMenu, setOpenAdminMenu] = useState(false);

  // --- Función para mostrar SnackBar ---
  const showSnack = useCallback((message, severity = 'success') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  }, []);

  const handleSnackbarClose = (event, reason) => {
    if (reason === 'clickaway') return;
    setSnackbarOpen(false);
  };

  // --- Función para verificar permisos ---
  const hasPermission = useCallback((permissionName) => {
    // Si es global admin, SIEMPRE tiene todos los permisos
    if (isGlobalAdmin) {
      console.log(`hasPermission: Global Admin. Permiso "${permissionName}" concedido.`);
      return true;
    }
    // Para usuarios de tenant, verifica si el permiso está en el Set
    const has = userPermissions.has(permissionName);
    console.log(`hasPermission: Tenant User. Permiso "${permissionName}" ${has ? 'concedido' : 'denegado'}.`);
    return has;
  }, [isGlobalAdmin, userPermissions]);


  // --- Lógica de Autenticación y Carga de Usuario ---
  const fetchUserData = useCallback(async () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      setLoggedIn(false);
      setUser(null);
      setUserPermissions(new Set());
      setIsGlobalAdmin(false);
      setTenantId(null);
      setLoading(false);
      setIsAppReady(true);
      console.log("fetchUserData: No auth token found. Not logged in.");
      return;
    }

    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    const storedTenantId = localStorage.getItem('tenantId');
    if (storedTenantId) {
      api.defaults.headers.common['X-Tenant-ID'] = storedTenantId;
      console.log("fetchUserData: Setting X-Tenant-ID from localStorage:", storedTenantId);
    } else {
      delete api.defaults.headers.common['X-Tenant-ID'];
      console.log("fetchUserData: No X-Tenant-ID in localStorage. Removing header.");
    }

    try {
      console.log("fetchUserData: Attempting to fetch user data...");
      const response = await api.get('/user');
      const userData = response.data;
      setUser(userData);
      setLoggedIn(true);
      setIsGlobalAdmin(userData.is_global_admin);
      setTenantId(userData.tenant_id);

      const permissionsSet = new Set();
      if (userData.roles && Array.isArray(userData.roles)) {
        userData.roles.forEach(role => {
          if (role.permissions && Array.isArray(role.permissions)) {
            role.permissions.forEach(permission => {
              permissionsSet.add(permission.name);
            });
          }
        });
      }
      if (userData.permissions && Array.isArray(userData.permissions)) {
        userData.permissions.forEach(p => permissionsSet.add(p.name || p));
      }
      setUserPermissions(permissionsSet);
      console.log("fetchUserData: User data fetched. Permissions loaded:", Array.from(permissionsSet));

      showSnack('Usuario re-autenticado desde token almacenado.', 'info');
    } catch (error) {
      console.error("fetchUserData: Failed to fetch user data:", error);
      localStorage.removeItem('authToken');
      localStorage.removeItem('tenantId');
      delete api.defaults.headers.common['Authorization'];
      delete api.defaults.headers.common['X-Tenant-ID'];
      setLoggedIn(false);
      setUser(null);
      setUserPermissions(new Set());
      setIsGlobalAdmin(false);
      setTenantId(null);
      showSnack('Sesión expirada o inválida. Por favor, inicie sesión de nuevo.', 'error');
      navigate('/login');
    } finally {
      setLoading(false);
      setIsAppReady(true);
    }
  }, [navigate, showSnack]);


  // --- Efecto para cargar usuario al inicio de la aplicación ---
  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  // --- Nuevo useEffect para depurar userPermissions ---
  useEffect(() => {
    console.log("DEBUG: userPermissions updated:", Array.from(userPermissions));
    console.log("DEBUG: isGlobalAdmin:", isGlobalAdmin);
    console.log("DEBUG: Does userPermissions have 'view-users'?", userPermissions.has('view-users'));
    console.log("DEBUG: Does userPermissions have 'view-companies'?", userPermissions.has('view-companies'));
    console.log("DEBUG: Does userPermissions have 'view-cultivation-areas'?", userPermissions.has('view-cultivation-areas'));
    console.log("DEBUG: Does userPermissions have 'view-calendar-events'?", userPermissions.has('view-calendar-events'));
  }, [userPermissions, isGlobalAdmin]);


  // --- Lógica de Login ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      console.log("handleLogin: Attempting login...");
      const response = await api.post('/login', {
        email: loginEmail,
        password: loginPassword,
      });
      const { token, user: userData } = response.data;
      localStorage.setItem('authToken', token);
      localStorage.setItem('tenantId', userData.tenant_id);
      console.log("handleLogin: Logged in with Tenant ID:", userData.tenant_id);
      await fetchUserData();
      setLoginDialogOpen(false);
      navigate('/');
      showSnack('Inicio de sesión exitoso.', 'success');
    } catch (error) {
      console.error("handleLogin: Login failed:", error);
      const errorMessage = error.response?.data?.message || 'Error desconocido al iniciar sesión.';
      setLoginError(errorMessage);
      showSnack(`Error al iniciar sesión: ${errorMessage}`, 'error');
    } finally {
      setLoginLoading(false);
    }
  };

  // --- Lógica de Logout ---
  const handleLogout = async () => {
    try {
      await api.post('/logout');
      localStorage.removeItem('authToken');
      localStorage.removeItem('tenantId');
      delete api.defaults.headers.common['Authorization'];
      delete api.defaults.headers.common['X-Tenant-ID'];
      setLoggedIn(false);
      setUser(null);
      setUserPermissions(new Set());
      setIsGlobalAdmin(false);
      setTenantId(null);
      showSnack('Sesión cerrada exitosamente.', 'info');
      navigate('/login');
    } catch (error) {
      console.error("Logout failed:", error);
      showSnack('Error al cerrar sesión.', 'error');
    }
  };

  // --- Manejo del menú de usuario ---
  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseUserMenu = () => {
    setAnchorEl(null);
  };

  // --- Manejo del menú de Administración (colapsable) ---
  const handleClickAdminMenu = () => {
    setOpenAdminMenu(!openAdminMenu);
  };


  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: '#1a202c' }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, bgcolor: '#283e51' }}>
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={() => { /* Lógica para abrir/cerrar drawer si lo implementas */ }}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            Cannabis ERP
          </Typography>
          {loggedIn ? (
            <Box>
              <IconButton
                size="large"
                edge="end"
                aria-label="account of current user"
                aria-controls="menu-appbar"
                aria-haspopup="true"
                onClick={handleMenu}
                color="inherit"
                ref={userMenuAnchorRef}
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
                <MenuItem onClick={handleCloseUserMenu} sx={{ color: '#fff' }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    {user?.name || 'Usuario'}
                  </Typography>
                </MenuItem>
                <MenuItem onClick={handleCloseUserMenu} sx={{ color: '#fff' }}>
                  <Typography variant="body2" sx={{ fontSize: '0.8rem', color: '#a0aec0' }}>
                    {user?.email}
                  </Typography>
                </MenuItem>
                <MenuItem onClick={handleCloseUserMenu} sx={{ color: '#fff' }}>
                  <Typography variant="body2" sx={{ fontSize: '0.8rem', color: '#a0aec0' }}>
                    {user?.is_global_admin ? 'Super Admin' : `Tenant ID: ${user?.tenant_id}`}
                  </Typography>
                </MenuItem>
                <MenuItem onClick={handleLogout} sx={{ color: '#fff' }}>
                  <ListItemIcon sx={{ color: '#fff' }}><ExitToAppIcon /></ListItemIcon>
                  <Typography>Cerrar Sesión</Typography>
                </MenuItem>
              </Menu>
            </Box>
          ) : (
            <Button color="inherit" onClick={() => setLoginDialogOpen(true)}>Iniciar Sesión</Button>
          )}
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            boxSizing: 'border-box',
            bgcolor: '#1a202c',
            color: '#fff',
            pt: '64px',
          },
        }}
      >
        <List>
          {/* Inicio */}
          <ListItem
            button
            onClick={() => navigate('/')}
            selected={location.pathname === '/'}
            sx={{
              '&.Mui-selected': {
                bgcolor: '#4CAF50',
                '&:hover': { bgcolor: '#43A047' },
              },
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
              borderRadius: 2,
              mx: 1,
              my: 0.5,
            }}
          >
            <ListItemIcon sx={{ color: 'inherit' }}>
              <HomeIcon />
            </ListItemIcon>
            <ListItemText primary="Inicio" />
          </ListItem>

          {/* Cultivo */}
          {loggedIn && (isGlobalAdmin || hasPermission('view-cultivation-areas')) && ( // Asume un permiso para Cultivo
            <ListItem
              button
              onClick={() => navigate('/cultivo')}
              selected={location.pathname === '/cultivo'}
              sx={{
                '&.Mui-selected': { bgcolor: '#4CAF50', '&:hover': { bgcolor: '#43A047' } },
                '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                borderRadius: 2, mx: 1, my: 0.5,
              }}
            >
              <ListItemIcon sx={{ color: 'inherit' }}>
                <LocalFloristIcon />
              </ListItemIcon>
              <ListItemText primary="Cultivo" />
            </ListItem>
          )}

          {/* Calendario */}
          {loggedIn && (isGlobalAdmin || hasPermission('view-calendar-events')) && ( // Asume un permiso para Calendario
            <ListItem
              button
              onClick={() => navigate('/calendar')}
              selected={location.pathname === '/calendar'}
              sx={{
                '&.Mui-selected': { bgcolor: '#4CAF50', '&:hover': { bgcolor: '#43A047' } },
                '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                borderRadius: 2, mx: 1, my: 0.5,
              }}
            >
              <ListItemIcon sx={{ color: 'inherit' }}>
                <CalendarTodayIcon />
              </ListItemIcon>
              <ListItemText primary="Calendario" />
            </ListItem>
          )}

          {/* Administración (Menú Colapsable) */}
          {(loggedIn && isGlobalAdmin) || (loggedIn && (hasPermission('view-companies') || hasPermission('view-users'))) ? (
            <>
              <ListItem
                button
                onClick={handleClickAdminMenu}
                sx={{
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                  borderRadius: 2, mx: 1, my: 0.5,
                }}
              >
                <ListItemIcon sx={{ color: 'inherit' }}>
                  <LockIcon />
                </ListItemIcon>
                <ListItemText primary="Administración" />
                {openAdminMenu ? <ExpandLess /> : <ExpandMore />}
              </ListItem>
              <Collapse in={openAdminMenu} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                  {/* Empresas (Submenú) */}
                  {loggedIn && (isGlobalAdmin || hasPermission('view-companies')) && (
                    <ListItem
                      button
                      onClick={() => navigate('/tenants')}
                      selected={location.pathname === '/tenants'}
                      sx={{
                        pl: 4, // Indentación para submenú
                        '&.Mui-selected': { bgcolor: '#4CAF50', '&:hover': { bgcolor: '#43A047' } },
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                        borderRadius: 2, mx: 1, my: 0.5,
                      }}
                    >
                      <ListItemIcon sx={{ color: 'inherit' }}>
                        <BusinessIcon />
                      </ListItemIcon>
                      <ListItemText primary="Empresas" />
                    </ListItem>
                  )}

                  {/* Usuarios y Roles (Submenú) */}
                  {loggedIn && (isGlobalAdmin || hasPermission('view-users')) && (
                    <ListItem
                      button
                      onClick={() => navigate('/users')}
                      selected={location.pathname === '/users'}
                      sx={{
                        pl: 4, // Indentación para submenú
                        '&.Mui-selected': { bgcolor: '#4CAF50', '&:hover': { bgcolor: '#43A047' } },
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                        borderRadius: 2, mx: 1, my: 0.5,
                      }}
                    >
                      <ListItemIcon sx={{ color: 'inherit' }}>
                        <PeopleIcon />
                      </ListItemIcon>
                      <ListItemText primary="Usuarios y Roles" />
                    </ListItem>
                  )}
                </List>
              </Collapse>
            </>
          ) : null}
        </List>
      </Drawer>
      <Box
        component="main"
        sx={{ flexGrow: 1, p: 3, mt: '64px', width: `calc(100% - ${drawerWidth}px)` }}
      >
        <Routes>
          <Route path="/" element={
            <Box sx={{ p: 3, bgcolor: '#18191b', borderRadius: 2, boxShadow: '0 1px 0 rgba(9,30,66,.25)', minHeight: 'calc(100vh - 128px)', color: '#fff' }}>
              <Typography variant="h4" gutterBottom sx={{ color: '#fff' }}>Bienvenido, {user?.name || 'Invitado'}!</Typography>
              <Typography variant="body1" sx={{ color: '#a0aec0' }}>
                Esta es la página de inicio de tu Cannabis ERP.
              </Typography>
              {!loggedIn && (
                <Typography variant="body1" sx={{ mt: 2, color: '#a0aec0' }}>
                  Por favor, <Button onClick={() => setLoginDialogOpen(true)} sx={{ color: '#4CAF50' }}>inicia sesión</Button> para acceder a todas las funcionalidades.
                </Typography>
              )}
            </Box>
          } />
          {loggedIn && isGlobalAdmin && (
            <Route path="/tenants" element={
              <EmpresasCrud
                tenantId={tenantId}
                isAppReady={isAppReady}
                setParentSnack={showSnack}
                isGlobalAdmin={isGlobalAdmin}
              />
            } />
          )}
          {loggedIn && hasPermission('view-users') && (
            <Route path="/users" element={
              <UsuariosCrudInternal
                tenantId={tenantId}
                isAppReady={isAppReady}
                facilities={facilities}
                setParentSnack={showSnack}
                isGlobalAdmin={isGlobalAdmin}
              />
            } />
          )}
          {/* Rutas para Cultivo y Calendario */}
          {loggedIn && (isGlobalAdmin || hasPermission('view-cultivation-areas')) && (
            <Route path="/cultivo" element={
              <CultivationPage // <-- ¡USANDO EL COMPONENTE!
                tenantId={tenantId}
                isAppReady={isAppReady}
                setParentSnack={showSnack}
                isGlobalAdmin={isGlobalAdmin}
              />
            } />
          )}
          {loggedIn && (isGlobalAdmin || hasPermission('view-calendar-events')) && (
            <Route path="/calendar" element={
              <CalendarioModuleWrapper // <-- ¡USANDO EL COMPONENTE!
                tenantId={tenantId}
                isAppReady={isAppReady}
                setParentSnack={showSnack}
                isGlobalAdmin={isGlobalAdmin}
              />
            } />
          )}
        </Routes>
      </Box>

      {/* Login Dialog */}
      <Dialog open={loginDialogOpen || (!loggedIn && !loading && location.pathname !== '/login')} onClose={() => setLoginDialogOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: '#2d3748', color: '#e2e8f0', borderRadius: 2 } }}
      >
        <DialogTitle sx={{ bgcolor: '#3a506b', color: '#fff' }}>Iniciar Sesión</DialogTitle>
        <form onSubmit={handleLogin}>
          <DialogContent sx={{ pt: '20px !important' }}>
            <TextField
              label="Email"
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              fullWidth
              required
              sx={{ mt: 1, mb: 2,
                '& .MuiInputBase-input': { color: '#fff' },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.8)' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
              }}
              disabled={loginLoading}
            />
            <TextField
              label="Contraseña"
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              fullWidth
              required
              sx={{ mb: 2,
                '& .MuiInputBase-input': { color: '#fff' },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.8)' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
              }}
              disabled={loginLoading}
            />
            {loginError && (
              <Alert severity="error" sx={{ mb: 2 }}>{loginError}</Alert>
            )}
          </DialogContent>
          <DialogActions sx={{ bgcolor: '#3a506b' }}>
            <Button onClick={() => setLoginDialogOpen(false)} disabled={loginLoading} sx={{ color: '#a0aec0' }}>Cancelar</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={loginLoading}
              sx={{
                bgcolor: '#4CAF50',
                '&:hover': { bgcolor: '#43A047' }
              }}
            >
              {loginLoading ? <CircularProgress size={24} /> : "Iniciar Sesión"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default App;
