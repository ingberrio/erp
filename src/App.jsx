// src/App.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

// Componentes y Utilidades de Material-UI
import {
  AppBar, Toolbar, IconButton, Typography, Box, Drawer, List, ListItem,
  ListItemIcon, ListItemText, CssBaseline, Snackbar, Alert, Menu, MenuItem,
  CircularProgress, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Collapse, Divider
} from '@mui/material';

// Iconos de Material-UI
import MenuIcon from '@mui/icons-material/Menu';
import AccountCircle from '@mui/icons-material/AccountCircle';
import HomeIcon from '@mui/icons-material/Home';
import BusinessIcon from '@mui/icons-material/Business';
import PeopleIcon from '@mui/icons-material/People';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LockIcon from '@mui/icons-material/Lock';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import LocalFloristIcon from '@mui/icons-material/LocalFlorist';


// Componentes de tu aplicación
import EmpresasCrud from './components/EmpresasCrud';
import UsuariosCrudInternal from './components/UsuariosCrudInternal';
import CultivationPage from './components/CultivationPage';
import CalendarPage from './components/CalendarPage';
import LandingPage from './components/LandingPage';

// Configuración de Axios
export const api = axios.create({
  baseURL: 'http://localhost:8000/api', // Asegúrate de que esta URL sea correcta para tu backend Laravel
  withCredentials: true, // Importante para enviar cookies de sesión (Sanctum)
});

// Interceptor para añadir el token de autenticación y el Tenant ID
api.interceptors.request.use(config => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    delete config.headers.Authorization;
  }

  // MODIFICACIÓN CLAVE AQUÍ: Leer currentTenantId y aplicarlo si existe
  const currentTenantId = localStorage.getItem('currentTenantId');
  if (currentTenantId && currentTenantId !== 'null') {
    config.headers['X-Tenant-ID'] = currentTenantId;
    console.log('Axios Interceptor: X-Tenant-ID establecido:', currentTenantId);
  } else {
    delete config.headers['X-Tenant-ID'];
    console.log('Axios Interceptor: X-Tenant-ID removido o no establecido.');
  }

  return config;
}, error => {
  return Promise.reject(error);
});


function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null); // Estado para el anclaje del menú de usuario

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');

  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoadingLogin] = useState(false);
  const [loginError, setLoginError] = useState(''); 

  const [adminMenuOpen, setAdminMenuOpen] = useState(false);

  const [userPermissions, setUserPermissions] = useState([]);
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
  const [userFacilityId, setUserFacilityId] = useState(null);
  const [appReady, setAppReady] = useState(false);

  const [facilities, setFacilities] = useState([]);


  const showSnack = useCallback((message, severity = 'success') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  }, [setSnackbarMessage, setSnackbarSeverity, setSnackbarOpen]);

  const handleSnackbarClose = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbarOpen(false);
  };

  const hasPermission = useCallback((permissionName) => {
    if (isGlobalAdmin) {
      console.log(`hasPermission: User is Global Admin. Permission '${permissionName}' granted.`);
      return true;
    }
    const hasPerm = userPermissions.includes(permissionName);
    console.log(`hasPermission: Checking for '${permissionName}'. User has:`, userPermissions, `Result: ${hasPerm}`);
    return hasPerm;
  }, [userPermissions, isGlobalAdmin]);

  const fetchUserData = useCallback(async () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      console.log('App.jsx: No auth token found. User is not logged in.');
      setUser(null);
      setIsGlobalAdmin(false);
      setUserPermissions([]);
      setUserFacilityId(null);
      setLoading(false);
      setAppReady(true);
      return;
    }

    try {
      const response = await api.get('/user');
      const userData = response.data;
      setUser(userData);
      setIsGlobalAdmin(userData.is_global_admin);
      setUserPermissions(userData.permissions || []);
      setUserFacilityId(userData.facility_id || null);

      // Si no es global admin y tiene tenant_id, lo guarda en localStorage
      // Si es global admin, o no tiene tenant_id, se asegura de que no haya un currentTenantId en localStorage
      if (!userData.is_global_admin && userData.tenant_id) {
        localStorage.setItem('currentTenantId', String(userData.tenant_id));
        console.log('App.jsx: Usuario de tenant logueado. Tenant ID establecido en localStorage:', userData.tenant_id);
      } else {
        // Importante: Si es global admin, no queremos que el interceptor envíe un X-Tenant-ID por defecto
        // hasta que elija uno. Si no tiene tenant_id, tampoco.
        localStorage.removeItem('currentTenantId');
        console.log('App.jsx: Usuario global admin o sin tenant_id. currentTenantId removido de localStorage.');
      }

      console.log('App.jsx: fetchUserData completado. User object:', userData);
      console.log('App.jsx: User tenant_id (from state):', userData.tenant_id);
      console.log('App.jsx: isGlobalAdmin (from state):', userData.is_global_admin);
      console.log('App.jsx: User permissions (from state):', userData.permissions);
      return userData; 
    } catch (error) {
      console.error('App.jsx: fetchUserData: Error fetching user data:', error);
      localStorage.removeItem('authToken');
      localStorage.removeItem('currentTenantId'); // Asegurarse de limpiar en caso de error
      setUser(null);
      setIsGlobalAdmin(false);
      setUserPermissions([]);
      setUserFacilityId(null);
      showSnack('Sesión expirada o no autorizada. Por favor, inicie sesión de nuevo.', 'error');
      return null;
    } finally {
      setLoading(false);
      setAppReady(true);
    }
  }, [showSnack]);

  const fetchFacilitiesForPermissions = useCallback(async () => {
    if (!isGlobalAdmin) {
      setFacilities([]);
      return;
    }
    try {
      const response = await api.get('/facilities');
      const fetchedFacilities = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.data)
        ? response.data.data
        : [];
      setFacilities(fetchedFacilities);
    } catch (error) {
      console.error('App.jsx: Error cargando instalaciones para permisos:', error);
      showSnack('Error cargando instalaciones para permisos.', 'error');
    }
  }, [isGlobalAdmin, showSnack]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  useEffect(() => {
    fetchFacilitiesForPermissions();
  }, [isGlobalAdmin, fetchFacilitiesForPermissions]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoadingLogin(true);
    setLoginError('');
    try {
      const response = await api.post('/login', {
        email: loginEmail,
        password: loginPassword,
      });
      
      localStorage.setItem('authToken', response.data.token);
      
      // Lógica para establecer currentTenantId en login
      if (response.data.user && !response.data.user.is_global_admin && response.data.user.tenant_id) {
        localStorage.setItem('currentTenantId', String(response.data.user.tenant_id));
      } else {
        localStorage.removeItem('currentTenantId'); // Limpiar si es global admin o no tiene tenant_id
      }

      setLoginDialogOpen(false);
      
      const fetchedUser = await fetchUserData(); 

      if (fetchedUser) {
        const userHasPermission = (permissionName) => {
            if (fetchedUser.is_global_admin) return true;
            return (fetchedUser.permissions || []).includes(permissionName);
        };

        if (userHasPermission('view-cultivation-areas')) {
          navigate('/cultivo');
        } else if (userHasPermission('view-users')) {
          navigate('/users');
        } else if (userHasPermission('view-companies')) {
          navigate('/empresas');
        } else if (userHasPermission('view-calendar-events')) {
          navigate('/calendario');
        } else {
          navigate('/');
          showSnack('Inicio de sesión exitoso, pero no tienes permisos para ver ningún módulo. Contacta al administrador.', 'warning');
        }
        showSnack('Inicio de sesión exitoso.', 'success');
      } else {
        showSnack('Inicio de sesión exitoso, pero no se pudieron cargar los datos del usuario. Intente de nuevo.', 'warning');
        navigate('/');
      }

    } catch (error) {
      console.error('Login error:', error);
      setLoginError(error.response?.data?.message || 'Error al iniciar sesión. Verifique sus credenciales.');
      showSnack('Error al iniciar sesión.', 'error');
    } finally {
      setLoadingLogin(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.post('/logout');
      localStorage.removeItem('authToken');
      localStorage.removeItem('currentTenantId'); // Asegurarse de limpiar al cerrar sesión
      setUser(null);
      setIsGlobalAdmin(false);
      setUserPermissions([]);
      setUserFacilityId(null);
      navigate('/');
      showSnack('Sesión cerrada exitosamente.', 'info');
    } catch (error) {
      console.error('Logout error:', error);
      showSnack('Error al cerrar sesión.', 'error');
    } finally {
      handleClose(); // Cerrar el menú después de cerrar sesión
    }
  };

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null); // Esto cerrará el menú
  };

  const handleAdminMenuToggle = () => {
    setAdminMenuOpen(!adminMenuOpen);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: '#1a202c', color: '#fff' }}>
        <CircularProgress color="inherit" />
        <Typography variant="h6" sx={{ ml: 2 }}>Cargando aplicación...</Typography>
      </Box>
    );
  }

  // Determinar el color de fondo de la AppBar y el color del texto
  const appBarBgColor = user ? '#2d3748' : '#2d3748'; // Mismo color para logueado y no logueado
  const appBarTextColor = user ? '#e2e8f0' : '#e2e8f0'; // Texto blanco para contraste

  if (!user) {
    return (
      <>
        <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, bgcolor: appBarBgColor }}>
          <Toolbar>
            <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1, fontWeight: 600, color: appBarTextColor }}>
              Cannaprime ERP
            </Typography>
            <Button color="inherit" onClick={() => setLoginDialogOpen(true)} sx={{ color: appBarTextColor }}>
              Login
            </Button>
          </Toolbar>
        </AppBar>
        <LandingPage setLoginDialogOpen={setLoginDialogOpen} />

        <Dialog open={loginDialogOpen} onClose={() => setLoginDialogOpen(false)} maxWidth="xs" fullWidth disableEscapeKeyDown PaperProps={{ sx: { bgcolor: '#2d3748', color: '#e2e8f0', borderRadius: 2 } }}>
          <DialogTitle sx={{ bgcolor: '#3a506b', color: '#fff', textAlign: 'center' }}>Iniciar Sesión</DialogTitle>
          <form onSubmit={handleLogin}>
            <DialogContent sx={{ pt: '20px !important' }}>
              <TextField
                autoFocus
                margin="dense"
                label="Email"
                type="email"
                fullWidth
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                sx={{
                  mb: 2,
                  '& .MuiInputBase-input': { color: '#fff' },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.8)' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
                }}
                disabled={loginLoading}
              />
              <TextField
                margin="dense"
                label="Contraseña"
                type="password"
                fullWidth
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                sx={{
                  mb: 2,
                  '& .MuiInputBase-input': { color: '#fff' },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.8)' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
                }}
                helperText={user ? "Dejar vacío para no cambiar la contraseña." : "Requerido para nuevos usuarios."}
                autoComplete="new-password"
                required={!user && loginPassword.trim() === ""}
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
      </>
    );
  }

  return (
    <Box sx={{ display: 'flex', bgcolor: '#1a202c', minHeight: '100vh' }}>
      <CssBaseline />
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, bgcolor: appBarBgColor }}>
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            onClick={() => setDrawerOpen(!drawerOpen)}
            edge="start"
            sx={{ mr: 2, color: appBarTextColor }} // Asegurar el color del icono
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1, fontWeight: 600, color: appBarTextColor }}>
            Cannabis ERP
          </Typography>
          {user && (
            <Box>
              <Button
                onClick={handleMenu}
                color="inherit"
                startIcon={<AccountCircle />}
                sx={{ textTransform: 'none', fontSize: '1rem', color: appBarTextColor }} // Asegurar el color del botón
              >
                {user.name}
              </Button>
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
                open={Boolean(anchorEl)}
                onClose={handleClose}
                PaperProps={{
                  sx: {
                    bgcolor: '#2d3748',
                    color: '#e2e8f0',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
                    borderRadius: 2,
                  },
                }}
              >
                <MenuItem onClick={handleClose} sx={{ '&:hover': { bgcolor: '#3a506b' } }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#fff' }}>{user.name}</Typography>
                </MenuItem>
                <MenuItem onClick={handleClose} sx={{ '&:hover': { bgcolor: '#3a506b' } }}>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>{user.email}</Typography>
                </MenuItem>
                {user.tenant_id && (
                  <MenuItem onClick={handleClose} sx={{ '&:hover': { bgcolor: '#3a506b' } }}>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>Tenant ID: {user.tenant_id}</Typography>
                  </MenuItem>
                )}
                <Divider sx={{ my: 0.5, bgcolor: 'rgba(255,255,255,0.2)' }} />
                <MenuItem onClick={handleLogout} sx={{ '&:hover': { bgcolor: '#3a506b' } }}>
                  <ListItemIcon sx={{ color: '#e2e8f0' }}><ExitToAppIcon fontSize="small" /></ListItemIcon>
                  <ListItemText primary="Cerrar Sesión" sx={{ '& .MuiListItemText-primary': { color: '#e2e8f0' } }} />
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
        ModalProps={{ keepMounted: true }}
        sx={{
          width: 240,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { width: 240, boxSizing: 'border-box', bgcolor: '#2d3748', color: '#e2e8f0' },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto' }}>
          <List>
            {hasPermission('view-cultivation-areas') && (
              <ListItem button onClick={() => { navigate('/cultivo'); setDrawerOpen(false); }} selected={location.pathname === '/cultivo'}>
                <ListItemIcon sx={{ color: '#e2e8f0' }}><LocalFloristIcon /></ListItemIcon>
                <ListItemText primary="Cultivo" />
              </ListItem>
            )}
            {hasPermission('view-calendar-events') && (
              <ListItem button onClick={() => { navigate('/calendario'); setDrawerOpen(false); }} selected={location.pathname === '/calendario'}>
                <ListItemIcon sx={{ color: '#e2e8f0' }}><CalendarTodayIcon /></ListItemIcon>
                <ListItemText primary="Calendario" />
              </ListItem>
            )}

            {(hasPermission('view-users') || hasPermission('view-roles') || hasPermission('view-permissions') || hasPermission('view-companies')) && (
              <>
                <ListItem button onClick={handleAdminMenuToggle}>
                  <ListItemIcon sx={{ color: '#e2e8f0' }}><LockIcon /></ListItemIcon>
                  <ListItemText primary="Administración" />
                  {adminMenuOpen ? <ExpandLess sx={{ color: '#e2e8f0' }} /> : <ExpandMoreIcon sx={{ color: '#e2e8f0' }} />}
                </ListItem>
                <Collapse in={adminMenuOpen} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding>
                    {hasPermission('view-companies') && (
                      <ListItem button sx={{ pl: 4 }} onClick={() => { navigate('/empresas'); setDrawerOpen(false); }} selected={location.pathname === '/empresas'}>
                        <ListItemIcon sx={{ color: '#e2e8f0' }}><BusinessIcon /></ListItemIcon>
                        <ListItemText primary="Empresas" />
                      </ListItem>
                    )}
                    {hasPermission('view-users') && (
                      <ListItem button sx={{ pl: 4 }} onClick={() => { navigate('/users'); setDrawerOpen(false); }} selected={location.pathname === '/users'}>
                        <ListItemIcon sx={{ color: '#e2e8f0' }}><PeopleIcon /></ListItemIcon>
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

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          mt: 8,
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <Routes>
          {hasPermission('view-companies') && (
            <Route path="/empresas" element={<EmpresasCrud setParentSnack={showSnack} isAppReady={appReady} tenantId={user?.tenant_id} isGlobalAdmin={isGlobalAdmin} />} />
          )}
          {hasPermission('view-users') && (
            <Route
              path="/users"
              element={
                <UsuariosCrudInternal
                  tenantId={user?.tenant_id}
                  isAppReady={appReady}
                  facilities={facilities}
                  setParentSnack={showSnack}
                  isGlobalAdmin={isGlobalAdmin}
                />
              }
            />
          )}
          {hasPermission('view-cultivation-areas') && (
            <Route
              path="/cultivo"
              element={
                <CultivationPage
                  tenantId={user?.tenant_id}
                  isAppReady={appReady}
                  userFacilityId={userFacilityId}
                  setParentSnack={showSnack}
                  isGlobalAdmin={isGlobalAdmin}
                />
              }
            />
          )}
          {hasPermission('view-calendar-events') && (
            <Route
              path="/calendario"
              element={
                <CalendarPage
                  setParentSnack={showSnack}
                  isAppReady={appReady}
                  tenantId={user?.tenant_id}
                  isGlobalAdmin={isGlobalAdmin}
                />
              }
            />
          )}
          <Route path="*" element={
            user && hasPermission('view-cultivation-areas') ? (
              <CultivationPage
                tenantId={user?.tenant_id}
                isAppReady={appReady}
                userFacilityId={userFacilityId}
                setParentSnack={showSnack}
                isGlobalAdmin={isGlobalAdmin}
              />
            ) : user && hasPermission('view-users') ? (
              <UsuariosCrudInternal
                tenantId={user?.tenant_id}
                isAppReady={appReady}
                facilities={facilities}
                setParentSnack={showSnack}
                isGlobalAdmin={isGlobalAdmin}
              />
            ) : user && hasPermission('view-calendar-events') ? (
              <CalendarPage
                setParentSnack={showSnack}
                isAppReady={appReady}
                tenantId={user?.tenant_id}
                isGlobalAdmin={isGlobalAdmin}
              />
            ) : (
              <LandingPage setLoginDialogOpen={setLoginDialogOpen} />
            )
          } />
        </Routes>
      </Box>
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
}

export default App;
