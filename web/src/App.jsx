// src/App.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

// Componentes y Utilidades de Material-UI
import {
  AppBar, Toolbar, IconButton, Typography, Box, Drawer, List, ListItem,
  ListItemIcon, ListItemText, CssBaseline, Snackbar, Alert, Menu, MenuItem,
  CircularProgress, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Collapse, Divider, Avatar, ThemeProvider, createTheme
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
import LocalFloristIcon from '@mui/icons-material/LocalFlorist'; // Icono para Cultivo
import CloudDownloadIcon from '@mui/icons-material/CloudDownload'; // Icono para Informes Regulatorios

// NUEVOS Iconos para el submenú de cultivo
import GrassIcon from '@mui/icons-material/Grass'; // Para Áreas de Cultivo
import InventoryIcon from '@mui/icons-material/Inventory'; // Para Lotes
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'; // NUEVO: Para Reconciliación de Inventario
import ContactsIcon from '@mui/icons-material/Contacts'; // CRM Module icon

// Componentes de tu aplicación
import EmpresasCrud from './components/EmpresasCrud';
import UsuariosCrudInternal from './components/UsuariosCrudInternal';
import CultivationPage from './components/CultivationPage';
import CalendarPage from './components/CalendarPage';
import LandingPage from './components/LandingPage';
import BatchManagementPage from './components/BatchManagementPage';
import RegulatoryReportsPage from './components/RegulatoryReportsPage';
import InventoryReconciliationPage from './components/InventoryReconciliationPage'; // NUEVO: Importar el componente de reconciliación
import { CrmModuleWrapper } from './components/crm'; // CRM Module
import ProductionModuleWrapper from './components/production/ProductionModuleWrapper'; // Production Module

// Configuración de Axios
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
  withCredentials: true,
});

// Interceptor para añadir SOLO el token de autenticación
api.interceptors.request.use(config => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    delete config.headers.Authorization;
  }
  // La lógica de X-Tenant-ID se maneja ahora en un useEffect en el componente App
  return config;
}, error => {
  return Promise.reject(error);
});


// Crear tema MUI con modo claro
const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
    text: {
      primary: '#212121',
      secondary: '#757575',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#f5f5f5',
          color: '#212121',
        },
      },
    },
  },
});

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');

  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoadingLogin] = useState(false);
  const [loginError, setLoginError] = useState(''); 

  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [cultivationMenuOpen, setCultivationMenuOpen] = useState(false); // NUEVO: Estado para el submenú de Cultivo
  const [crmMenuOpen, setCrmMenuOpen] = useState(false); // Estado para el submenú de CRM

  const [userPermissions, setUserPermissions] = useState([]);
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
  const [userFacilityId, setUserFacilityId] = useState(null);
  const [appReady, setAppReady] = useState(false); // Mantener este estado para controlar la carga de componentes

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
      setAppReady(true); // App is ready even if no user is logged in
      return;
    }

    try {
      const response = await api.get('/user');
      const userData = response.data;
      setUser(userData);
      setIsGlobalAdmin(userData.is_global_admin);
      setUserPermissions(userData.permissions || []);
      setUserFacilityId(userData.facility_id || null);

      console.log('App.jsx: fetchUserData completado. User object:', userData);
      console.log('App.jsx: User tenant_id (from state):', userData.tenant_id);
      console.log('App.jsx: isGlobalAdmin (from state):', userData.is_global_admin);
      console.log('App.jsx: User permissions (from state):', userData.permissions);
      return userData; 
    } catch (error) {
      console.error('App.jsx: fetchUserData: Error fetching user data:', error);
      localStorage.removeItem('authToken');
      // No necesitamos limpiar currentTenantId de localStorage aquí, ya que no lo usaremos en el interceptor
      setUser(null);
      setIsGlobalAdmin(false);
      setUserPermissions([]);
      setUserFacilityId(null);
      showSnack('Session expired or unauthorized. Please log in again.', 'error');
      return null;
    } finally {
      setLoading(false);
      setAppReady(true); // Mark app as ready once user/tenant info is processed
    }
  }, [showSnack]);

  // MODIFICACIÓN CLAVE AQUÍ: Asegurar que fetchFacilitiesForPermissions solo se ejecute cuando appReady y isGlobalAdmin sean verdaderos
  const fetchFacilitiesForPermissions = useCallback(async () => {
    // Solo procede si la aplicación está lista Y el usuario es un administrador global
    if (!appReady || !isGlobalAdmin) {
      setFacilities([]); // Asegura que facilities esté vacío si no es global admin o no está listo
      console.log('App.jsx: Skipping facility fetch for permissions (not ready or not global admin).');
      return;
    }
    try {
      // En este punto, appReady es verdadero, isGlobalAdmin es verdadero,
      // y el objeto de usuario ha sido procesado, por lo que X-Tenant-ID debería ser correcto (o ausente para global admin).
      const response = await api.get('/facilities');
      const fetchedFacilities = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.data)
        ? response.data.data
        : [];
      setFacilities(fetchedFacilities);
      console.log('App.jsx: Facilities fetched for Global Admin:', fetchedFacilities);
    } catch (error) {
      console.error('App.jsx: Error loading facilities for permissions:', error);
      showSnack('Error loading facilities for permissions.', 'error');
    }
  }, [isGlobalAdmin, appReady, showSnack]); // appReady añadido como dependencia

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  // MODIFICACIÓN CLAVE AQUÍ: Este useEffect ahora depende solo de la función memoizada,
  // que ya contiene las comprobaciones de appReady e isGlobalAdmin
  useEffect(() => {
    fetchFacilitiesForPermissions();
  }, [fetchFacilitiesForPermissions]);

  // NUEVO useEffect para manejar el X-Tenant-ID de forma reactiva
  useEffect(() => {
    if (user) {
      if (user.is_global_admin) {
        // Si es global admin, no se envía X-Tenant-ID
        delete api.defaults.headers.common['X-Tenant-ID'];
        console.log('Axios Defaults: X-Tenant-ID eliminado para Global Admin.');
      } else if (user.tenant_id) {
        // Si es usuario de inquilino y tiene tenant_id, se establece
        api.defaults.headers.common['X-Tenant-ID'] = String(user.tenant_id);
        console.log('Axios Defaults: X-Tenant-ID establecido a:', user.tenant_id);
      } else {
        // Caso inesperado: usuario no global admin y sin tenant_id
        delete api.defaults.headers.common['X-Tenant-ID'];
        console.log('Axios Defaults: X-Tenant-ID eliminado (usuario sin tenant_id y no global admin).');
      }
    } else {
      // Si no hay usuario logueado, asegúrate de que el encabezado no esté presente
      delete api.defaults.headers.common['X-Tenant-ID'];
      console.log('Axios Defaults: X-Tenant-ID eliminado (no hay usuario logueado).');
    }
  }, [user]); // Este efecto se ejecuta cada vez que el objeto 'user' cambia

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
      
      setLoginDialogOpen(false);
      
      const fetchedUser = await fetchUserData(); // Esto actualizará el estado 'user' y, por ende, el X-Tenant-ID via useEffect

      if (fetchedUser) {
        const userHasPermission = (permissionName) => {
            if (fetchedUser.is_global_admin) return true;
            return (fetchedUser.permissions || []).includes(permissionName);
        };

        // Lógica de navegación después del login
        if (userHasPermission('view-cultivation-areas')) {
          navigate('/cultivation/areas'); // Cambiado a la nueva ruta
        } else if (userHasPermission('view-batches')) { // NUEVO: Prioridad para lotes si tiene permiso
          navigate('/cultivation/batches');
        } else if (userHasPermission('view-inventory-reconciliation')) { // NUEVO: Prioridad para reconciliación
          navigate('/inventory-reconciliation');
        } else if (userHasPermission('view-users')) {
          navigate('/users');
        } else if (userHasPermission('view-companies')) {
          navigate('/empresas');
        } else if (userHasPermission('manage-calendar-events')) {
          navigate('/calendario');
        } else if (userHasPermission('generate-regulatory-reports')) { // NUEVO: Prioridad para informes regulatorios
          navigate('/regulatory-reports');
        }
        else {
          navigate('/');
          showSnack('Login successful, but you do not have permissions to view any module. Contact the administrator.', 'warning');
        }
        showSnack('Login successful.', 'success');
      } else {
        showSnack('Login successful, but user data could not be loaded. Please try again.', 'warning');
        navigate('/');
      }

    } catch (error) {
      console.error('Login error:', error.response?.data || error.message);
      setLoginError(error.response?.data?.message || 'Login error. Please check your credentials.');
      showSnack('Login error.', 'error');
    } finally {
      setLoadingLogin(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.post('/logout');
      localStorage.removeItem('authToken');
      setUser(null); // Esto disparará el useEffect para limpiar X-Tenant-ID de Axios
      setIsGlobalAdmin(false);
      setUserPermissions([]);
      setUserFacilityId(null);
      navigate('/');
      showSnack('Session closed successfully.', 'info');
    } catch (error) {
      console.error('Logout error:', error);
      showSnack('Error closing session.', 'error');
    } finally {
      handleClose();
    }
  };

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleAdminMenuToggle = () => {
    setAdminMenuOpen(!adminMenuOpen);
  };

  const handleCultivationMenuToggle = () => { // NUEVO: Handler para el submenú de Cultivo
    setCultivationMenuOpen(!cultivationMenuOpen);
  };

  const handleCrmMenuToggle = () => { // Handler para el submenú de CRM
    setCrmMenuOpen(!crmMenuOpen);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: '#1a202c', color: '#fff' }}>
        <CircularProgress color="inherit" />
        <Typography variant="h6" sx={{ ml: 2 }}>Loading application...</Typography>
      </Box>
    );
  }

  const appBarBgColor = user ? '#2d3748' : '#2d3748';
  const appBarTextColor = user ? '#e2e8f0' : '#e2e8f0';

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
          <DialogTitle sx={{ bgcolor: '#3a506b', color: '#fff', textAlign: 'center' }}>Sign In</DialogTitle>
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
                label="Password"
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
                helperText={user ? "Leave empty to not change the password." : "Required for new users."}
                autoComplete="new-password"
                required={!user && loginPassword.trim() === ""}
                disabled={loginLoading}
              />
              {loginError && (
                <Alert severity="error" sx={{ mb: 2 }}>{loginError}</Alert>
              )}
            </DialogContent>
            <DialogActions sx={{ bgcolor: '#3a506b' }}>
              <Button onClick={() => setLoginDialogOpen(false)} disabled={loginLoading} sx={{ color: '#a0aec0' }}>Cancel</Button>
              <Button
                type="submit"
                variant="contained"
                disabled={loginLoading}
                sx={{
                  bgcolor: '#4CAF50',
                  '&:hover': { bgcolor: '#43A047' }
                }}
              >
                {loginLoading ? <CircularProgress size={24} /> : "Sign In"}
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
    <ThemeProvider theme={lightTheme}>
    <Box sx={{ display: 'flex', bgcolor: 'background.default', minHeight: '100vh' }}>
      <CssBaseline />
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, bgcolor: appBarBgColor }}>
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            onClick={() => setDrawerOpen(!drawerOpen)}
            edge="start"
            sx={{ mr: 2, color: appBarTextColor }}
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
                startIcon={<Avatar sx={{ bgcolor: '#4CAF50', width: 32, height: 32, fontSize: 14 }}>
                  {user.name ? user.name.charAt(0).toUpperCase() : ''}
                </Avatar>}
                sx={{ textTransform: 'none', fontSize: '1rem', color: appBarTextColor }}
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
                {/* Muestra el Tenant ID solo si existe y no es global admin */}
                {user.tenant_id && !user.is_global_admin && (
                  <MenuItem onClick={handleClose} sx={{ '&:hover': { bgcolor: '#3a506b' } }}>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>Tenant ID: {user.tenant_id}</Typography>
                  </MenuItem>
                )}
                <Divider sx={{ my: 0.5, bgcolor: 'rgba(255,255,255,0.2)' }} />
                <MenuItem onClick={handleLogout} sx={{ '&:hover': { bgcolor: '#3a506b' } }}>
                  {/* CORRECCIÓN: Envolver los elementos hijos en un fragmento o Box */}
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <ListItemIcon sx={{ color: '#e2e8f0' }}><ExitToAppIcon fontSize="small" /></ListItemIcon>
                    <ListItemText primary="Sign Out" />
                  </Box>
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
            {/* Dashboard siempre visible */}
            <ListItem button onClick={() => { navigate('/'); setDrawerOpen(false); }} selected={location.pathname === '/'}>
              <ListItemIcon sx={{ color: '#e2e8f0' }}><HomeIcon /></ListItemIcon>
              <ListItemText primary="Dashboard" />
            </ListItem>

            {/* Menú de Cultivo con submenú */}
            {(hasPermission('view-facilities') || hasPermission('view-stages') || hasPermission('view-cultivation-areas') || hasPermission('view-batches') || hasPermission('view-inventory-reconciliation')) && (
              <>
                <ListItem button onClick={handleCultivationMenuToggle}>
                  <ListItemIcon sx={{ color: '#e2e8f0' }}><LocalFloristIcon /></ListItemIcon>
                  <ListItemText primary="Cultivation" />
                  {cultivationMenuOpen ? <ExpandLess sx={{ color: '#e2e8f0' }} /> : <ExpandMoreIcon sx={{ color: '#e2e8f0' }} />}
                </ListItem>
                <Collapse in={cultivationMenuOpen} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding>
                    {hasPermission('view-cultivation-areas') && (
                      <ListItem button sx={{ pl: 4 }} onClick={() => { navigate('/cultivation/areas'); setDrawerOpen(false); }} selected={location.pathname === '/cultivation/areas'}>
                        <ListItemIcon sx={{ color: '#e2e8f0' }}><GrassIcon /></ListItemIcon>
                        <ListItemText primary="Cultivation Areas" />
                      </ListItem>
                    )}
                    {hasPermission('view-batches') && (
                      <ListItem button sx={{ pl: 4 }} onClick={() => { navigate('/cultivation/batches'); setDrawerOpen(false); }} selected={location.pathname === '/cultivation/batches'}>
                        <ListItemIcon sx={{ color: '#e2e8f0' }}><InventoryIcon /></ListItemIcon>
                        <ListItemText primary="Batches" />
                      </ListItem>
                    )}
                    {/* NUEVO: Elemento de menú para Reconciliación de Inventario */}
                    {hasPermission('view-inventory-reconciliation') && (
                      <ListItem button sx={{ pl: 4 }} onClick={() => { navigate('/inventory-reconciliation'); setDrawerOpen(false); }} selected={location.pathname === '/inventory-reconciliation'}>
                        <ListItemIcon sx={{ color: '#e2e8f0' }}><CheckCircleOutlineIcon /></ListItemIcon>
                        <ListItemText primary="Inventory Reconciliation" />
                      </ListItem>
                    )}
                  </List>
                </Collapse>
              </>
            )}

            {hasPermission('manage-calendar-events') && (
              <ListItem button onClick={() => { navigate('/calendario'); setDrawerOpen(false); }} selected={location.pathname === '/calendario'}>
                <ListItemIcon sx={{ color: '#e2e8f0' }}><CalendarTodayIcon /></ListItemIcon>
                <ListItemText primary="Calendar" />
              </ListItem>
            )}

            {/* CRM Section */}
            {hasPermission('view-crm-accounts') && (
              <ListItem button onClick={() => { navigate('/crm'); setDrawerOpen(false); }} selected={location.pathname.startsWith('/crm')}>
                <ListItemIcon sx={{ color: '#e2e8f0' }}><ContactsIcon /></ListItemIcon>
                <ListItemText primary="CRM" />
              </ListItem>
            )}

            {/* Sección de Administración */}
            {(hasPermission('view-users') || hasPermission('view-roles') || hasPermission('view-permissions') || hasPermission('view-companies') || hasPermission('generate-regulatory-reports')) && (
              <>
                <ListItem button onClick={handleAdminMenuToggle}>
                  <ListItemIcon sx={{ color: '#e2e8f0' }}><LockIcon /></ListItemIcon>
                  <ListItemText primary="Administration" />
                  {adminMenuOpen ? <ExpandLess sx={{ color: '#e2e8f0' }} /> : <ExpandMoreIcon sx={{ color: '#e2e8f0' }} />}
                </ListItem>
                <Collapse in={adminMenuOpen} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding>
                    
                    {/* Production - Direct link to Production module with tabs */}
                    <ListItem button sx={{ pl: 4 }} onClick={() => { navigate('/production'); setDrawerOpen(false); }} selected={location.pathname.startsWith('/production')}>
                      <ListItemIcon sx={{ color: '#e2e8f0' }}><LocalFloristIcon /></ListItemIcon>
                      <ListItemText primary="Production" />
                    </ListItem>

                    {hasPermission('view-companies') && (
                      <ListItem button sx={{ pl: 4 }} onClick={() => { navigate('/empresas'); setDrawerOpen(false); }} selected={location.pathname === '/empresas'}>
                        <ListItemIcon sx={{ color: '#e2e8f0' }}><BusinessIcon /></ListItemIcon>
                        <ListItemText primary="Companies" />
                      </ListItem>
                    )}
                    {hasPermission('view-users') && (
                      <ListItem button sx={{ pl: 4 }} onClick={() => { navigate('/users'); setDrawerOpen(false); }} selected={location.pathname === '/users'}>
                        <ListItemIcon sx={{ color: '#e2e8f0' }}><PeopleIcon /></ListItemIcon>
                        <ListItemText primary="Users & Roles" />
                      </ListItem>
                    )}
                    {hasPermission('generate-regulatory-reports') && (
                      <ListItem button sx={{ pl: 4 }} onClick={() => { navigate('/regulatory-reports'); setDrawerOpen(false); }} selected={location.pathname === '/regulatory-reports'}>
                        <ListItemIcon sx={{ color: '#e2e8f0' }}><CloudDownloadIcon /></ListItemIcon>
                        <ListItemText primary="Regulatory Reports" />
                      </ListItem>
                    )}
                  </List>
                </Collapse>
              </>
            )}
            <Divider sx={{ my: 0.5, bgcolor: 'rgba(255,255,255,0.2)' }} />
            <ListItem button onClick={handleLogout}>
              {/* CORRECCIÓN: Envolver los elementos hijos en un fragmento o Box */}
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ListItemIcon sx={{ color: '#e2e8f0' }}><ExitToAppIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="Sign Out" />
              </Box>
            </ListItem>
          </List>
        </Box>
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          mt: 8, // Ajuste para el AppBar fijo
          width: '100%',
          boxSizing: 'border-box',
          bgcolor: 'background.default',
        }}
      >
        <Routes>
          {/* Rutas condicionales basadas en permisos */}
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
                  facilities={facilities} // `facilities` ahora se carga más seguro para global admins
                  setParentSnack={showSnack}
                  isGlobalAdmin={isGlobalAdmin}
                />
              }
            />
          )}
          {hasPermission('view-cultivation-areas') && (
            <Route
              path="/cultivation/areas"
              element={
                <CultivationPage
                  tenantId={user?.tenant_id}
                  isAppReady={appReady}
                  userFacilityId={userFacilityId}
                  currentUserId={user?.id}
                  setParentSnack={showSnack}
                  isGlobalAdmin={isGlobalAdmin}
                  hasPermission={hasPermission}
                />
              }
            />
          )}
          {hasPermission('view-batches') && (
            <Route
              path="/cultivation/batches"
              element={
                <BatchManagementPage
                  tenantId={user?.tenant_id}
                  isAppReady={appReady}
                  userFacilityId={userFacilityId}
                  setParentSnack={showSnack}
                  isGlobalAdmin={isGlobalAdmin}
                  hasPermission={hasPermission}
                />
              }
            />
          )}
          {hasPermission('view-inventory-reconciliation') && ( // NUEVO: Ruta para Reconciliación de Inventario
            <Route
              path="/inventory-reconciliation"
              element={
                <InventoryReconciliationPage
                  tenantId={user?.tenant_id}
                  isAppReady={appReady}
                  userFacilityId={userFacilityId}
                  isGlobalAdmin={isGlobalAdmin}
                  setParentSnack={showSnack}
                  hasPermission={hasPermission}
                />
              }
            />
          )}
          {hasPermission('manage-calendar-events') && (
            <Route
              path="/calendario"
              element={
                <CalendarPage
                  setParentSnack={showSnack}
                  isAppReady={appReady}
                  tenantId={user?.tenant_id}
                  isGlobalAdmin={isGlobalAdmin}
                  user={user}
                  hasPermission={hasPermission}
                />
              }
            />
          )}
          {hasPermission('generate-regulatory-reports') && (
            <Route
              path="/regulatory-reports"
              element={
                <RegulatoryReportsPage
                  tenantId={user?.tenant_id}
                  isAppReady={appReady}
                  userFacilityId={userFacilityId}
                  isGlobalAdmin={isGlobalAdmin}
                  setParentSnack={showSnack}
                  hasPermission={hasPermission}
                />
              }
            />
          )}
          {/* CRM Module Route */}
          {hasPermission('view-crm-accounts') && (
            <Route
              path="/crm/*"
              element={
                <CrmModuleWrapper
                  tenantId={user?.tenant_id}
                  isAppReady={appReady}
                  isGlobalAdmin={isGlobalAdmin}
                  setParentSnack={showSnack}
                  hasPermission={hasPermission}
                  user={user}
                />
              }
            />
          )}
          {/* Production Module - Single route with tabs */}
          <Route
            path="/production"
            element={
              <ProductionModuleWrapper
                tenantId={user?.tenant_id}
                isAppReady={appReady}
                isGlobalAdmin={isGlobalAdmin}
                setParentSnack={showSnack}
              />
            }
          />
          {/* Ruta por defecto o de fallback */}
          <Route path="*" element={
            user && hasPermission('view-cultivation-areas') ? (
              <CultivationPage
                tenantId={user?.tenant_id}
                isAppReady={appReady}
                userFacilityId={userFacilityId}
                currentUserId={user?.id}
                setParentSnack={showSnack}
                isGlobalAdmin={isGlobalAdmin}
                hasPermission={hasPermission}
              />
            ) : user && hasPermission('view-batches') ? (
              <BatchManagementPage
                tenantId={user?.tenant_id}
                isAppReady={appReady}
                userFacilityId={userFacilityId}
                setParentSnack={showSnack}
                isGlobalAdmin={isGlobalAdmin}
                hasPermission={hasPermission}
              />
            ) : user && hasPermission('view-inventory-reconciliation') ? ( // NUEVO: Fallback a reconciliación
              <InventoryReconciliationPage
                tenantId={user?.tenant_id}
                isAppReady={appReady}
                userFacilityId={userFacilityId}
                isGlobalAdmin={isGlobalAdmin}
                setParentSnack={showSnack}
                hasPermission={hasPermission}
              />
            ) : user && hasPermission('view-users') ? (
              <UsuariosCrudInternal
                tenantId={user?.tenant_id}
                isAppReady={appReady}
                facilities={facilities}
                setParentSnack={showSnack}
                isGlobalAdmin={isGlobalAdmin}
              />
            ) : user && hasPermission('manage-calendar-events') ? (
              <CalendarPage
                setParentSnack={showSnack}
                isAppReady={appReady}
                tenantId={user?.tenant_id}
                isGlobalAdmin={isGlobalAdmin}
                user={user}
                hasPermission={hasPermission}
              />
            ) : user && hasPermission('generate-regulatory-reports') ? (
              <RegulatoryReportsPage
                tenantId={user?.tenant_id}
                isAppReady={appReady}
                userFacilityId={userFacilityId}
                isGlobalAdmin={isGlobalAdmin}
                setParentSnack={showSnack}
                hasPermission={hasPermission}
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
    </ThemeProvider>
  );
}

export default App;