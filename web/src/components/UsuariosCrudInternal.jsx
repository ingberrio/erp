// src/components/UsuariosCrudInternal.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import PropTypes from 'prop-types';
import { api } from "../App";
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, List, ListItem, ListItemText, IconButton, Snackbar, Alert,
  CircularProgress, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Avatar, Checkbox, Divider, Tabs, Tab, FormControl, InputLabel, Select,
  MenuItem, TablePagination // Asegúrate de que TablePagination esté importado
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SearchIcon from '@mui/icons-material/Search';
import SaveIcon from "@mui/icons-material/Save";
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import GroupIcon from '@mui/icons-material/Group';
import PeopleIcon from '@mui/icons-material/People';
import LockIcon from '@mui/icons-material/Lock';
import VpnKeyIcon from '@mui/icons-material/VpnKey';


// --- Componente de Diálogo de Confirmación Genérico ---
const ConfirmationDialog = ({ open, title, message, onConfirm, onCancel }) => {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
      PaperProps={{ sx: { bgcolor: '#2d3748', color: '#e2e8f0', borderRadius: 2 } }} // Estilo oscuro
    >
      <DialogTitle id="alert-dialog-title" sx={{ bgcolor: '#3a506b', color: '#fff' }}>{title}</DialogTitle> {/* Estilo oscuro */}
      <DialogContent sx={{ pt: '20px !important' }}>
        <Typography id="alert-dialog-description" sx={{ color: '#e2e8f0' }}> {/* Color de texto para contraste */}
          {message}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ bgcolor: '#3a506b' }}> {/* Estilo oscuro */}
        <Button onClick={onCancel} sx={{ color: '#a0aec0' }}>Cancelar</Button>
        <Button onClick={onConfirm} autoFocus variant="contained" sx={{ bgcolor: '#d32f2f', '&:hover': { bgcolor: '#c62828' } }}>
          Confirmar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

ConfirmationDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  title: PropTypes.string.isRequired,
  message: PropTypes.string.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

// --- Componente principal de CRUD de Usuarios, Roles y Permisos ---
const UsuariosCrudInternal = ({ tenantId, isAppReady, facilities, setParentSnack, isGlobalAdmin }) => {
  const [activeTab, setActiveTab] = useState(0);

  console.log("UsuariosCrudInternal: Componente renderizado. Pestaña activa:", activeTab);
  console.log("UsuariosCrudInternal: Props recibidas: tenantId:", tenantId, "isAppReady:", isAppReady, "isGlobalAdmin:", isGlobalAdmin);


  // --- Estados para Usuarios ---
  const [users, setUsers] = useState([]);
  const [rolesForAssignment, setRolesForAssignment] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [openUserDialog, setOpenUserDialog] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userSelectedRoleIds, setUserSelectedRoleIds] = useState([]);
  const [userSearch, setUserSearch] = useState("");
  const [userDialogLoading, setUserDialogLoading] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState(''); // Estado para el tenant_id del usuario
  const [tenants, setTenants] = useState([]); // Estado para la lista de tenants (solo para Global Admin)


  // --- Estados para Roles ---
  const [roles, setRoles] = useState([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [openRoleDialog, setOpenRoleDialog] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [roleSelectedPermissionIds, setRoleSelectedPermissionIds] = useState([]);
  const [roleDialogLoading, setLoadingRoleDialog] = useState(false);

  // --- Estados para Permisos ---
  const [permissions, setPermissions] = useState([]);
  const [loadingPermissions, setLoadingPermissions] = useState(true);
  const [openPermissionDialog, setOpenPermissionDialog] = useState(false);
  const [editingPermission, setEditingPermission] = useState(null);
  const [permissionName, setPermissionName] = useState("");
  const [permissionDescription, setPermissionDescription] = useState("");
  const [permissionDialogLoading, setPermissionDialogLoading] = useState(false);

  // --- Nuevos estados para la creación de permisos con facility_id ---
  const [permissionTemplate, setPermissionTemplate] = useState('');
  const [selectedFacilityForPermission, setSelectedFacilityForPermission] = useState('');
  const permissionTemplates = useMemo(() => [
    // Permisos Generales de la Aplicación
    { label: 'Administrador General', value: 'admin' },
    { label: 'Ver Dashboard', value: 'view-dashboard' },

    // Permisos de Empresas
    { label: 'Ver Empresas', value: 'view-companies' },
    { label: 'Gestionar Empresas', value: 'manage-companies' },
    { label: 'Crear Empresa', value: 'create-company' },
    { label: 'Actualizar Empresa', value: 'update-company' },
    { label: 'Eliminar Empresa', value: 'delete-company' },

    // Permisos de Cultivo (Generales)
    { label: 'Ver Áreas de Cultivo (general)', value: 'view-cultivation-areas' },
    { label: 'Gestionar Áreas de Cultivo (general)', value: 'manage-cultivation-areas' },
    { label: 'Ver Lotes (general)', value: 'view-batches' },
    { label: 'Gestionar Lotes (general)', value: 'manage-batches' },
    { label: 'Ver Plantas (general)', value: 'view-plants' },
    { label: 'Gestionar Plantas (general)', value: 'manage-plants' },

    // Permisos de Cultivo (Específicos por Instalación)
    { label: 'Ver Instalación (específica)', value: 'view-facility-{id}' },
    { label: 'Gestionar Instalación (específica)', value: 'manage-facility-{id}' },
    { label: 'Crear Área de Cultivo (específica)', value: 'create-cultivation-area-facility-{id}' },
    { label: 'Actualizar Área de Cultivo (específica)', value: 'update-cultivation-area-facility-{id}' },
    { label: 'Eliminar Área de Cultivo (específica)', value: 'delete-cultivation-area-facility-{id}' },
    { label: 'Ver Lotes (específico por instalación)', value: 'view-batches-facility-{id}' },
    { label: 'Gestionar Lotes (específico por instalación)', value: 'manage-batches-facility-{id}' },
    { label: 'Ver Plantas (específico por instalación)', value: 'view-plants-facility-{id}' },
    { label: 'Gestionar Plantas (específico por instalación)', value: 'manage-plants-facility-{id}' },

    // Permisos de Calendario
    { label: 'Ver Eventos de Calendario', value: 'view-calendar-events' },
    { label: 'Gestionar Eventos de Calendario', value: 'manage-calendar-events' },
    { label: 'Crear Evento de Calendario', value: 'create-calendar-event' },
    { label: 'Actualizar Evento de Calendario', value: 'update-calendar-event' },
    { label: 'Eliminar Evento de Calendario', value: 'delete-calendar-event' },

    // NUEVOS PERMISOS PARA TARJETAS DE CALENDARIO
    { label: 'Gestionar Checklist de Tarjeta', value: 'manage-card-checklist' },
    { label: 'Asignar Miembros a Tarjeta', value: 'assign-card-members' },

    // Permisos de Usuarios (Gestión del módulo de Usuarios)
    { label: 'Ver Usuarios', value: 'view-users' },
    { label: 'Gestionar Usuarios', value: 'manage-users' },
    { label: 'Crear Usuario', value: 'create-user' },
    { label: 'Actualizar Usuario', value: 'update-user' },
    { label: 'Eliminar Usuario', value: 'delete-user' },

    // Permisos de Roles
    { label: 'Ver Roles', value: 'view-roles' },
    { label: 'Gestionar Roles', value: 'manage-roles' },
    { label: 'Crear Rol', value: 'create-role' },
    { label: 'Actualizar Rol', value: 'update-role' },
    { label: 'Eliminar Rol', value: 'delete-role' },

    // Permisos de Permisos (gestionar los propios permisos)
    { label: 'Ver Permisos', value: 'view-permissions' },
    { label: 'Gestionar Permisos', value: 'manage-permissions' },
    { label: 'Crear Permiso', value: 'create-permission' },
    { label: 'Actualizar Permiso', value: 'update-permission' },
    { label: 'Eliminar Permiso', value: 'delete-permission' },

    // NUEVOS PERMISOS PARA RECONCILIACIÓN DE INVENTARIO
    { label: 'Ver Reconciliación de Inventario', value: 'view-inventory-reconciliation' },
    { label: 'Gestionar Reconciliación de Inventario', value: 'manage-inventory-reconciliation' },
    { label: 'Crear Reconciliación de Inventario', value: 'create-inventory-reconciliation' },
    { label: 'Actualizar Reconciliación de Inventario', value: 'update-inventory-reconciliation' },
    { label: 'Eliminar Reconciliación de Inventario', value: 'delete-inventory-reconciliation' },

    // Si también necesitas permisos específicos por instalación para esto:
    { label: 'Ver Reconciliación (específica por instalación)', value: 'view-inventory-reconciliation-facility-{id}' },
    { label: 'Gestionar Reconciliación (específica por instalación)', value: 'manage-inventory-reconciliation-facility-{id}' },
    { label: 'Justificar Discrepancia de Inventario', value: 'justify-inventory-discrepancy' },
    { label: 'Aplicar Permisos de Administrador de Tenant', value: 'template-apply-tenant-admin' },

  ], []);

  // --- Estados y funciones para el diálogo de confirmación genérico ---
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmDialogData, setConfirmDialogData] = useState({ title: '', message: '', onConfirm: () => {} });

  // Utilidad para manejar notificaciones (ahora muestra detalles de error si existen)
  const showSnack = useCallback((message, severity = 'success', errorDetails = null) => {
    let fullMessage = message;
    if (severity === 'error' && errorDetails) {
      // Si errorDetails es un objeto con mensajes de validación
      if (typeof errorDetails === 'object' && !Array.isArray(errorDetails)) {
        const detailMessages = Object.values(errorDetails).flat();
        if (detailMessages.length > 0) {
          fullMessage += ": " + detailMessages.join(', ');
        }
      } else if (typeof errorDetails === 'string') {
        fullMessage += ": " + errorDetails;
      }
    }
    setParentSnack(fullMessage, severity);
  }, [setParentSnack]);


  // --- Fetchers de datos ---
  const fetchUsers = useCallback(async () => {
    console.log('fetchUsers: Iniciando. tenantId:', tenantId, 'isGlobalAdmin:', isGlobalAdmin, 'isAppReady:', isAppReady);
    if (!isAppReady || (!isGlobalAdmin && !tenantId)) {
      console.log('fetchUsers: Saltando fetchUsers debido a la condición. Tenant ID:', tenantId, 'Is Global Admin:', isGlobalAdmin, 'App Ready:', isAppReady);
      setLoadingUsers(false);
      return;
    }
    setLoadingUsers(true);
    try {
      const res = await api.get("/users?with_roles=true");
      setUsers(Array.isArray(res.data) ? res.data : res.data.data || []);
      showSnack('Usuarios cargados exitosamente.', 'success');
    } catch (err) {
      console.error("Error loading users:", err);
      const errorMessage = err.response?.data?.message || err.message;
      showSnack(`No se pudieron cargar los usuarios: ${errorMessage}`, "error");
    } finally { setLoadingUsers(false); }
  }, [tenantId, isAppReady, isGlobalAdmin, showSnack]);

  const fetchRoles = useCallback(async () => {
    console.log('fetchRoles: Iniciando. tenantId:', tenantId, 'isGlobalAdmin:', isGlobalAdmin, 'isAppReady:', isAppReady);
    if (!isAppReady || (!isGlobalAdmin && !tenantId)) {
      console.log('fetchRoles: Saltando fetchRoles debido a la condición. Tenant ID:', tenantId, 'Is Global Admin:', isGlobalAdmin, 'App Ready:', isAppReady);
      setLoadingRoles(false);
      return;
    }
    setLoadingRoles(true);
    try {
      const res = await api.get("/roles?with_permissions=true");
      console.log("fetchRoles: Datos de roles recibidos:", res.data); // LOG: Ver la respuesta completa
      setRoles(Array.isArray(res.data) ? res.data : res.data.data || []);
      showSnack('Roles cargados exitosamente.', 'success');
    } catch (err) {
      console.error("Error loading roles:", err);
      const errorMessage = err.response?.data?.message || err.message;
      showSnack(`No se pudieron cargar los roles: ${errorMessage}`, "error");
    } finally { setLoadingRoles(false); }
  }, [tenantId, isAppReady, isGlobalAdmin, showSnack]);

  const fetchPermissions = useCallback(async () => {
    console.log('fetchPermissions: Iniciando. tenantId:', tenantId, 'isGlobalAdmin:', isGlobalAdmin, 'isAppReady:', isAppReady);
    if (!isAppReady || (!isGlobalAdmin && !tenantId)) {
      console.log('fetchPermissions: Saltando fetchPermissions debido a la condición. Tenant ID:', tenantId, 'Is Global Admin:', isGlobalAdmin, 'App Ready:', isAppReady);
      setLoadingPermissions(false);
      return;
    }
    setLoadingPermissions(true);
    try {
      const res = await api.get("/permissions");
      setPermissions(Array.isArray(res.data) ? res.data : res.data.data || []);
      showSnack('Permisos cargados exitosamente.', 'success');
    } catch (err) {
      console.error("Error loading permissions:", err);
      const errorMessage = err.response?.data?.message || err.message;
      showSnack(`No se pudieron cargar los permisos: ${errorMessage}`, "error");
    } finally { setLoadingPermissions(false); }
  }, [tenantId, isAppReady, isGlobalAdmin, showSnack]);

  // NUEVA FUNCIÓN: Fetch de tenants para Super Admin
  const fetchTenants = useCallback(async () => {
    if (!isGlobalAdmin) {
      setTenants([]); // Solo Global Admin puede ver la lista de tenants
      return;
    }
    try {
      const response = await api.get('/tenants');
      const fetchedTenants = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.data)
        ? response.data.data
        : [];
      setTenants(fetchedTenants);
      // Si estamos creando un nuevo usuario y somos global admin, preseleccionar el primer tenant
      if (!editingUser && fetchedTenants.length > 0) {
        setSelectedTenantId(fetchedTenants[0].id);
      }
    } catch (error) {
      console.error('Error fetching tenants:', error);
      showSnack('Error al cargar inquilinos para la asignación de tableros.', 'error');
    }
  }, [isGlobalAdmin, showSnack, editingUser]);


  // --- useEffects para Carga Inicial ---
  useEffect(() => {
    console.log("UsuariosCrudInternal: useEffect principal activado. isAppReady:", isAppReady, "isGlobalAdmin:", isGlobalAdmin, "tenantId:", tenantId);
    if (isAppReady && (isGlobalAdmin || tenantId)) {
      console.log("UsuariosCrudInternal: useEffect: isAppReady y (isGlobalAdmin o tenantId) son true. Cargando datos para la pestaña:", activeTab);
      // Cargar todos los datos relevantes al inicio, no solo por pestaña
      fetchUsers();
      fetchRoles();
      fetchPermissions();
      if (isGlobalAdmin) {
        fetchTenants(); // Cargar tenants si es Global Admin
      }
    } else {
      console.log("UsuariosCrudInternal: useEffect: Esperando isAppReady o (isGlobalAdmin o tenantId). tenantId:", tenantId, "isAppReady:", isAppReady, "isGlobalAdmin:", isGlobalAdmin);
      setLoadingUsers(false);
      setLoadingRoles(false);
      setLoadingPermissions(false);
    }
  }, [isAppReady, isGlobalAdmin, tenantId, fetchUsers, fetchRoles, fetchPermissions, fetchTenants]); // Añadir fetchTenants aquí


  // --- Lógica de filtrado de usuarios ---
  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    user.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  // --- Handlers de Diálogos (Usuarios) ---
  const handleOpenUserDialog = (user = null) => {
    setEditingUser(user);
    setUserName(user ? user.name : "");
    setUserEmail(user ? user.email : "");
    setUserPassword("");
    fetchRolesForAssignment(); // Siempre cargar roles para asignación

    // Lógica para el tenant_id en el diálogo de usuario
    if (user && user.tenant_id) {
      setSelectedTenantId(user.tenant_id); // Si edita, usar el tenant_id del usuario
    } else if (isGlobalAdmin && tenants.length > 0) {
      setSelectedTenantId(tenants[0].id); // Si es Global Admin y crea, seleccionar el primer tenant
    } else if (tenantId) {
      setSelectedTenantId(tenantId); // Si es usuario de tenant, usar su propio tenantId
    } else {
      setSelectedTenantId(''); // Por defecto vacío
    }

    setUserSelectedRoleIds(user ? (user.roles?.map(role => role.id) || []) : []);
    setOpenUserDialog(true);
  };

  const handleCloseUserDialog = () => {
    setOpenUserDialog(false);
    setEditingUser(null);
    setUserName("");
    setUserEmail("");
    setUserPassword("");
    setUserSelectedRoleIds([]);
    setSelectedTenantId(''); // Limpiar al cerrar
  };

  // Función específica para cargar roles para el diálogo de asignación de usuarios
  const fetchRolesForAssignment = useCallback(async () => {
    if (!isAppReady || (!isGlobalAdmin && !tenantId)) { return; }
    try {
      const res = await api.get("/roles");
      setRolesForAssignment(Array.isArray(res.data) ? res.data : res.data.data || []);
    } catch (err) {
      console.error("Error loading roles for assignment:", err);
      showSnack("No se pudieron cargar los roles para asignación.", "error");
    }
  }, [isAppReady, isGlobalAdmin, tenantId, showSnack]);


  // --- CRUD Operations (Usuarios) ---
  const handleSaveUser = async (e) => {
    e.preventDefault();
    setUserDialogLoading(true);
    try {
      // Validaciones adicionales para el tenantId
      if (isGlobalAdmin && !selectedTenantId) {
        showSnack('Como Super Admin, debes seleccionar un inquilino para el usuario.', 'warning');
        setUserDialogLoading(false);
        return;
      }
      if (!userName.trim() || !userEmail.trim() || (!editingUser && !userPassword.trim())) {
        showSnack('Nombre, email y contraseña (para nuevos usuarios) son obligatorios.', 'warning');
        setUserDialogLoading(false);
        return;
      }

      const userData = {
        name: userName,
        email: userEmail,
        ...(!editingUser || userPassword.trim() !== "" ? { password: userPassword } : {}),
        roles: userSelectedRoleIds,
        // CORRECCIÓN CLAVE: Enviar el tenant_id correcto
        tenant_id: isGlobalAdmin ? selectedTenantId : tenantId, 
        facility_id: null, // Tu código no usa facility_id para usuarios, lo dejo como null por si acaso.
      };
      
      // Si userEmail es el mismo que el del usuario logueado y se está editando, no permitir cambiar el tenant_id
      // Esto es una medida de seguridad, pero puede ser ajustada según tu lógica de negocio
      // if (editingUser && editingUser.email === userEmail && editingUser.tenant_id !== userData.tenant_id) {
      //   showSnack('No puedes cambiar el inquilino de tu propio usuario.', 'error');
      //   setUserDialogLoading(false);
      //   return;
      // }

      let res;
      if (editingUser) {
        await api.put(`/users/${editingUser.id}`, userData);
        showSnack("Usuario actualizado", "success");
      } else {
        await api.post("/users", userData);
        showSnack("Usuario creado", "success");
      }
      handleCloseUserDialog();
      await fetchUsers(); // Recargar usuarios
    } catch (err) {
      console.error("Error al guardar usuario:", err.response?.data || err.message);
      // MODIFICACIÓN: Pasar los detalles del error si existen
      showSnack("Error al guardar usuario: " + (err.response?.data?.message || err.message), "error", err.response?.data?.details || err.message);
    } finally { setUserDialogLoading(false); }
  };

  const handleDeleteUser = async (userToDelete) => {
    setConfirmDialogData({
      title: 'Confirmar Eliminación de Usuario',
      message: `¿Eliminar usuario "${userToDelete.name}"? Esta acción es irreversible.`,
      onConfirm: async () => {
        setLoadingUsers(true);
        try {
          await api.delete(`/users/${userToDelete.id}`);
          showSnack("Usuario eliminado", "info");
          await fetchUsers();
        } catch (err) {
          console.error("No se pudo eliminar el usuario:", err);
          showSnack("No se pudo eliminar el usuario: " + (err.response?.data?.message || err.message), "error");
        } finally {
          setLoadingUsers(false);
          setConfirmDialogOpen(false);
        }
      },
    });
    setConfirmDialogOpen(true);
  };

  const toggleUserRole = (roleId) => {
    setUserSelectedRoleIds(prevSelected =>
      prevSelected.includes(roleId)
        ? prevSelected.filter(id => id !== roleId)
        : [...prevSelected, roleId]
    );
  };

  // --- Handlers de Diálogos (Roles) ---
  const handleOpenRoleDialog = (role = null) => {
    console.log("handleOpenRoleDialog: Rol recibido para edición:", role); // LOG: Ver el objeto rol completo
    setEditingRole(role);
    setRoleName(role ? role.name : "");
    setRoleDescription(role ? (role.description || "") : "");
    if (isAppReady && (isGlobalAdmin || tenantId)) { fetchPermissions(); }
    
    const initialSelectedPermissions = role ? (role.permissions?.map(perm => perm.id) || []) : [];
    console.log("handleOpenRoleDialog: Permisos iniciales seleccionados (IDs):", initialSelectedPermissions); // LOG: Ver los IDs de permisos
    setRoleSelectedPermissionIds(initialSelectedPermissions);
    setOpenRoleDialog(true);
  };

  const handleCloseRoleDialog = () => {
    setOpenRoleDialog(false);
    setEditingRole(null);
    setRoleName("");
    setRoleDescription("");
    setRoleSelectedPermissionIds([]);
  };

  // --- CRUD Operations (Roles) ---
  const handleSaveRole = async (e) => {
    e.preventDefault();
    setLoadingRoleDialog(true);
    try {
      const roleData = {
        name: roleName,
        description: roleDescription,
        permissions: roleSelectedPermissionIds, // <--- Esto es lo que se envía
        tenant_id: isGlobalAdmin ? null : tenantId, // Asegura que el tenant_id se envía correctamente
      };
      console.log("handleSaveRole: Datos del rol a enviar:", roleData); // LOG: Ver el payload completo
      if (editingRole) {
        const res = await api.put(`/roles/${editingRole.id}`, roleData);
        console.log("handleSaveRole: Respuesta de actualización de rol:", res.data); // LOG: Ver la respuesta del PUT
        showSnack("Rol actualizado", "success");
      } else {
        const res = await api.post("/roles", roleData);
        console.log("handleSaveRole: Respuesta de creación de rol:", res.data); // LOG: Ver la respuesta del POST
        showSnack("Rol creado", "success");
      }
      await fetchRoles(); // Se vuelve a cargar la lista de roles
      handleCloseRoleDialog();
    } catch (err) {
      console.error("Error al guardar rol:", err.response?.data || err.message);
      // MODIFICACIÓN: Pasar los detalles del error si existen
      showSnack("Error al guardar rol: " + (err.response?.data?.message || err.message), "error", err.response?.data?.details || err.message);
    } finally { setLoadingRoleDialog(false); }
  };

  const handleDeleteRole = async (roleToDelete) => {
    setConfirmDialogData({
      title: 'Confirmar Eliminación de Rol',
      message: `¿Eliminar rol "${roleToDelete.name}"? Esta acción es irreversible y afectará a los usuarios asignados.`,
      onConfirm: async () => {
        setLoadingRoles(true);
        try {
          await api.delete(`/roles/${roleToDelete.id}`);
          showSnack("Rol eliminado", "info");
          await fetchRoles();
          await fetchUsers();
        } catch (err) {
          console.error("No se pudo eliminar el rol:", err);
          showSnack("No se pudo eliminar el rol: " + (err.response?.data?.message || err.message), "error");
        } finally {
          setLoadingRoles(false);
          setConfirmDialogOpen(false);
        }
      },
    });
    setConfirmDialogOpen(true);
  };

  const toggleRolePermission = (permissionId) => {
    setRoleSelectedPermissionIds(prevSelected =>
      prevSelected.includes(permissionId)
        ? prevSelected.filter(id => id !== permissionId)
        : [...prevSelected, permissionId]
    );
  };

  // --- Handlers de Diálogos (Permisos) ---
  const handleOpenPermissionDialog = (permission = null) => {
    setEditingPermission(permission);
    setPermissionName(permission ? permission.name : "");
    setPermissionDescription(permission ? (permission.description || "") : "");
    setPermissionTemplate('');
    setSelectedFacilityForPermission('');
    setOpenPermissionDialog(true);
  };

  const handleClosePermissionDialog = () => {
    setOpenPermissionDialog(false);
    setEditingPermission(null);
    setPermissionName("");
    setPermissionDescription("");
    setPermissionTemplate('');
    setSelectedFacilityForPermission('');
  };

  // Lógica para generar el nombre del permiso basado en la plantilla y la instalación
  useEffect(() => {
    if (!editingPermission && permissionTemplate) {
      if (permissionTemplate.includes('{id}') && selectedFacilityForPermission) {
        setPermissionName(permissionTemplate.replace('{id}', selectedFacilityForPermission));
      } else if (!permissionTemplate.includes('{id}')) {
        setPermissionName(permissionTemplate);
      } else {
        setPermissionName('');
      }
    }
  }, [permissionTemplate, selectedFacilityForPermission, editingPermission]);

  // --- CRUD Operations (Permisos) ---
  const handleSavePermission = async (e) => {
    e.preventDefault();
    setPermissionDialogLoading(true);
    try {
      const permissionData = {
        name: permissionName,
        description: permissionDescription,
        tenant_id: isGlobalAdmin ? null : tenantId, // Asegura que el tenant_id se envía correctamente
      };

      if (!editingPermission && permissionTemplate.includes('{id}') && !selectedFacilityForPermission) {
        showSnack("Debe seleccionar una instalación para este tipo de permiso.", "warning");
        setPermissionDialogLoading(false);
        return;
      }
      if (!permissionName.trim()) {
        showSnack("El nombre del permiso es obligatorio.", "warning");
        setPermissionDialogLoading(false);
        return;
      }

      if (editingPermission) {
        await api.put(`/permissions/${editingPermission.id}`, permissionData);
        showSnack("Permiso actualizado", "success");
      } else {
        await api.post("/permissions", permissionData);
        showSnack("Permiso creado", "success");
      }
      await fetchPermissions();
      handleClosePermissionDialog();
    } catch (err) {
      console.error("Error al guardar permiso:", err.response?.data || err.message);
      // MODIFICACIÓN: Pasar los detalles del error si existen
      showSnack("Error al guardar permiso: " + (err.response?.data?.message || err.message), "error", err.response?.data?.details || err.message);
    } finally { setPermissionDialogLoading(false); }
  };

  const handleDeletePermission = async (permissionToDelete) => {
    setConfirmDialogData({
      title: 'Confirmar Eliminación de Permiso',
      message: `¿Eliminar permiso "${permissionToDelete.name}"? Esta acción es irreversible.`,
      onConfirm: async () => {
        setLoadingPermissions(true);
        try {
          await api.delete(`/permissions/${permissionToDelete.id}`);
          showSnack("Permiso eliminado", "info");
          await fetchPermissions();
          await fetchRoles();
        } catch (err) {
          console.error("No se pudo eliminar el permiso:", err);
          showSnack("No se pudo eliminar el permiso: " + (err.response?.data?.message || err.message), "error");
        } finally {
          setLoadingPermissions(false);
          setConfirmDialogOpen(false);
        }
      },
    });
    setConfirmDialogOpen(true);
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  // --- Renderizado de pestañas ---
  const renderTabPanel = (index) => {
    switch (index) {
      case 0: // Usuarios
        return (
          <Box>
            <Box sx={{ display: "flex", mb: 2, gap: 2, alignItems: "center", flexWrap: "wrap" }}>
              <TextField
                size="small"
                placeholder="Buscar usuarios..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                sx={{
                  width: { xs: "100%", sm: 250 },
                  bgcolor: 'rgba(255,255,255,0.1)',
                  borderRadius: 1,
                  '& .MuiInputBase-input': { color: '#fff' },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.8)' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
                  '& .MuiInputAdornment-root .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.7)' },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
              <Box sx={{ flexGrow: 1 }} />
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                sx={{
                  minWidth: 160,
                  borderRadius: 2,
                  width: { xs: "100%", sm: "auto" },
                  bgcolor: '#4CAF50',
                  '&:hover': { bgcolor: '#43A047' }
                }}
                onClick={() => handleOpenUserDialog(null)}
              >
                + NUEVO USUARIO
              </Button>
            </Box>

            <TableContainer component={Paper} sx={{ bgcolor: '#283e51', borderRadius: 2, boxShadow: '0 1px 0 rgba(9,30,66,.25)' }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#3a506b' }}>
                    <TableCell sx={{ fontWeight: 600, color: '#fff' }}>Nombre</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#fff' }}>Email</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#fff' }}>Roles Asignados</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#fff' }} align="right">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loadingUsers ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ color: '#fff' }}>
                        <CircularProgress size={24} color="inherit" sx={{ my: 3 }} />
                        <Typography>Cargando usuarios...</Typography>
                      </TableCell>
                    </TableRow>
                  ) : filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ color: "#aaa", py: 5 }}>
                        No hay usuarios encontrados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                      <TableRow key={user.id} sx={{ '&:nth-of-type(odd)': { bgcolor: 'rgba(255,255,255,0.05)' } }}>
                        <TableCell sx={{ color: '#fff' }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Avatar sx={{ width: 32, height: 32, fontSize: 14, bgcolor: '#4CAF50' }}>{user.name.charAt(0).toUpperCase()}</Avatar>
                            <Typography fontWeight={500}>{user.name}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ color: '#fff' }}>{user.email}</TableCell>
                        <TableCell sx={{ color: '#fff' }}>
                          {(user.roles || []).map(r => (
                            <Box
                              component="span"
                              key={r.id}
                              sx={{
                                bgcolor: '#4CAF50',
                                px: 1,
                                py: 0.2,
                                mr: 0.5,
                                mb: 0.5,
                                borderRadius: 1,
                                fontSize: 13,
                                color: '#fff',
                                whiteSpace: "nowrap",
                                display: 'inline-block'
                              }}
                            >
                              {r.name}
                            </Box>
                          ))}
                          {(user.roles || []).length === 0 && (
                            <Typography component="span" sx={{ color: "#bbb", fontSize: 13 }}>
                              Ninguno
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <IconButton
                            onClick={() => handleOpenUserDialog(user)}
                            sx={{ color: '#b0c4de' }}
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            onClick={() => handleDeleteUser(user)}
                            sx={{ color: '#b0c4de' }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {/* User Dialog (Create/Edit) */}
            <Dialog open={openUserDialog} onClose={handleCloseUserDialog} maxWidth="sm" fullWidth
              PaperProps={{ sx: { bgcolor: '#283e51', color: '#fff', borderRadius: 2 } }}
            >
              <DialogTitle sx={{ bgcolor: '#3a506b', color: '#fff' }}>{editingUser ? "Editar Usuario" : "Nuevo Usuario"}</DialogTitle>
              <form onSubmit={handleSaveUser}>
                <DialogContent sx={{ pt: '20px !important' }}>
                  <TextField
                    label="Nombre del Usuario"
                    value={userName}
                    onChange={e => setUserName(e.target.value)}
                    fullWidth
                    required
                    sx={{ mt: 1, mb: 2,
                      '& .MuiInputBase-input': { color: '#fff' },
                      '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.8)' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
                    }}
                    disabled={userDialogLoading}
                  />
                  <TextField
                    label="Email del Usuario"
                    value={userEmail}
                    onChange={e => setUserEmail(e.target.value)}
                    type="email"
                    fullWidth
                    required
                    sx={{ mb: 2,
                      '& .MuiInputBase-input': { color: '#fff' },
                      '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.8)' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
                    }}
                    disabled={userDialogLoading}
                  />
                  <TextField
                    label="Contraseña"
                    value={userPassword}
                    onChange={e => setUserPassword(e.target.value)}
                    type="password"
                    fullWidth
                    sx={{ mb: 2,
                      '& .MuiInputBase-input': { color: '#fff' },
                      '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.8)' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
                    }}
                    helperText={editingUser ? "Dejar vacío para no cambiar la contraseña." : "Requerido para nuevos usuarios."}
                    autoComplete="new-password"
                    required={!editingUser && userPassword.trim() === ""}
                    disabled={userDialogLoading}
                  />

                  {/* NUEVO: Selector de Inquilino (solo para Global Admin) */}
                  {isGlobalAdmin && (
                    <FormControl fullWidth sx={{ mb: 2 }}>
                      <InputLabel id="tenant-select-label" sx={{ color: '#fff' }}>Inquilino</InputLabel>
                      <Select
                        labelId="tenant-select-label"
                        value={selectedTenantId}
                        label="Inquilino"
                        onChange={(e) => setSelectedTenantId(e.target.value)}
                        required
                        disabled={userDialogLoading || tenants.length === 0}
                        sx={{
                          color: '#fff',
                          '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
                          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.8)' },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
                          '.MuiSvgIcon-root': { color: '#fff' },
                        }}
                        MenuProps={{
                          PaperProps: {
                            sx: { bgcolor: '#004060', color: '#fff' },
                          },
                        }}
                      >
                        {tenants.length === 0 ? (
                          <MenuItem value="" sx={{ color: '#aaa' }}>
                            <em>No hay inquilinos disponibles</em>
                          </MenuItem>
                        ) : (
                          tenants.map((tenant) => (
                            <MenuItem key={tenant.id} value={tenant.id}>
                              {tenant.name}
                            </MenuItem>
                          ))
                        )}
                      </Select>
                    </FormControl>
                  )}

                  <Divider sx={{ my: 2, bgcolor: 'rgba(255,255,255,0.2)' }} />
                  <Typography variant="subtitle2" sx={{ color: '#fff' }} mb={1}>Roles Asignados</Typography>
                  <Box sx={{ maxHeight: 200, overflowY: "auto", border: "1px solid rgba(255,255,255,0.3)", p: 1, borderRadius: 1 }}>
                    {rolesForAssignment.length === 0 ? (
                      <Typography color="text.secondary" sx={{ color: '#aaa' }}>No hay roles disponibles.</Typography>
                    ) : (
                      rolesForAssignment.map((role) => (
                        <Box key={role.id} sx={{ display: "flex", alignItems: "center", mb: 0.5 }}>
                          <Checkbox
                            size="small"
                            checked={userSelectedRoleIds.includes(role.id)}
                            onChange={() => toggleUserRole(role.id)}
                            disabled={userDialogLoading}
                            icon={<CheckBoxOutlineBlankIcon fontSize="small" sx={{ color: 'rgba(255,255,255,0.7)' }} />}
                            checkedIcon={<CheckBoxIcon fontSize="small" sx={{ color: '#4CAF50' }} />}
                            sx={{ color: 'rgba(255,255,255,0.7)' }}
                          />
                          <Typography sx={{ color: '#fff' }}>{role.name}</Typography>
                        </Box>
                      ))
                    )}
                  </Box>
                </DialogContent>
                <DialogActions sx={{ bgcolor: '#3a506b' }}>
                  <Button onClick={handleCloseUserDialog} disabled={userDialogLoading}>Cancelar</Button>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={userDialogLoading || !userName || !userEmail || (!editingUser && userPassword.trim() === "") || (isGlobalAdmin && !selectedTenantId)}
                    sx={{
                      bgcolor: '#4CAF50',
                      '&:hover': { bgcolor: '#43A047' }
                    }}
                  >
                    {userDialogLoading ? <CircularProgress size={24} /> : (editingUser ? "Guardar Cambios" : "Crear Usuario")}
                  </Button>
                </DialogActions>
              </form>
            </Dialog>
          </Box>
        );
      case 1: // Roles
        return (
          <Box>
            <Box sx={{ display: "flex", mb: 2, gap: 2, alignItems: "center", flexWrap: "wrap" }}>
              <Box sx={{ flexGrow: 1 }} />
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                sx={{
                  minWidth: 160,
                  borderRadius: 2,
                  width: { xs: "100%", sm: "auto" },
                  bgcolor: '#4CAF50',
                  '&:hover': { bgcolor: '#43A047' }
                }}
                onClick={() => handleOpenRoleDialog(null)}
              >
                + NUEVO ROL
              </Button>
            </Box>

            <TableContainer component={Paper} sx={{ bgcolor: '#283e51', borderRadius: 2, boxShadow: '0 1px 0 rgba(9,30,66,.25)' }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#3a506b' }}>
                    <TableCell sx={{ fontWeight: 600, color: '#fff' }}>Nombre</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#fff' }}>Descripción</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#fff' }}>Permisos Asignados</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#fff' }} align="right">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loadingRoles ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ color: '#fff' }}>
                        <CircularProgress size={24} color="inherit" sx={{ my: 3 }} />
                        <Typography>Cargando roles...</Typography>
                      </TableCell>
                    </TableRow>
                  ) : roles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ color: "#aaa", py: 5 }}>
                        No hay roles encontrados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    roles.map((role) => (
                      <TableRow key={role.id} sx={{ '&:nth-of-type(odd)': { bgcolor: 'rgba(255,255,255,0.05)' } }}>
                        <TableCell sx={{ color: '#fff' }}>
                          <Typography fontWeight={500}>{role.name}</Typography>
                        </TableCell>
                        <TableCell sx={{ color: '#fff' }}>{role.description || 'N/A'}</TableCell>
                        <TableCell sx={{ color: '#fff' }}>
                          {(role.permissions || []).map(p => (
                            <Box
                              component="span"
                              key={p.id}
                              sx={{
                                bgcolor: '#4CAF50',
                                px: 1,
                                py: 0.2,
                                mr: 0.5,
                                mb: 0.5,
                                borderRadius: 1,
                                fontSize: 13,
                                color: '#fff',
                                whiteSpace: "nowrap",
                                display: 'inline-block'
                              }}
                            >
                              {p.name}
                            </Box>
                          ))}
                          {(role.permissions || []).length === 0 && (
                            <Typography component="span" sx={{ color: "#bbb", fontSize: 13 }}>
                              Ninguno
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <IconButton
                            onClick={() => handleOpenRoleDialog(role)}
                            sx={{ color: '#b0c4de' }}
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            onClick={() => handleDeleteRole(role)}
                            sx={{ color: '#b0c4de' }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Role Dialog (Create/Edit) */}
            <Dialog open={openRoleDialog} onClose={handleCloseRoleDialog} maxWidth="sm" fullWidth
              PaperProps={{ sx: { bgcolor: '#283e51', color: '#fff', borderRadius: 2 } }}
            >
              <DialogTitle sx={{ bgcolor: '#3a506b', color: '#fff' }}>{editingRole ? "Editar Rol" : "Nuevo Rol"}</DialogTitle>
              <form onSubmit={handleSaveRole}>
                <DialogContent sx={{ pt: '20px !important' }}>
                  <TextField
                    label="Nombre del Rol"
                    value={roleName}
                    onChange={e => setRoleName(e.target.value)}
                    fullWidth
                    required
                    sx={{ mt: 1, mb: 2,
                      '& .MuiInputBase-input': { color: '#fff' },
                      '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.8)' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
                    }}
                    disabled={roleDialogLoading}
                  />
                  <TextField
                    label="Descripción del Rol"
                    value={roleDescription}
                    onChange={e => setRoleDescription(e.target.value)}
                    fullWidth
                    multiline
                    rows={3}
                    sx={{ mb: 2,
                      '& .MuiInputBase-input': { color: '#fff' },
                      '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.8)' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
                    }}
                    disabled={roleDialogLoading}
                  />
                  <Divider sx={{ my: 2, bgcolor: 'rgba(255,255,255,0.2)' }} />
                  <Typography variant="subtitle2" sx={{ color: '#fff' }} mb={1}>Permisos Asignados</Typography>
                  <Box sx={{ maxHeight: 200, overflowY: "auto", border: "1px solid rgba(255,255,255,0.3)", p: 1, borderRadius: 1 }}>
                    {permissions.length === 0 ? (
                      <Typography color="text.secondary" sx={{ color: '#aaa' }}>No hay permisos disponibles.</Typography>
                    ) : (
                      permissions.map((permission) => (
                        <Box key={permission.id} sx={{ display: "flex", alignItems: "center", mb: 0.5 }}>
                          <Checkbox
                            size="small"
                            checked={roleSelectedPermissionIds.includes(permission.id)}
                            onChange={() => toggleRolePermission(permission.id)}
                            disabled={roleDialogLoading}
                            icon={<CheckBoxOutlineBlankIcon fontSize="small" sx={{ color: 'rgba(255,255,255,0.7)' }} />}
                            checkedIcon={<CheckBoxIcon fontSize="small" sx={{ color: '#4CAF50' }} />}
                            sx={{ color: 'rgba(255,255,255,0.7)' }}
                          />
                          <Typography sx={{ color: '#fff' }}>{permission.name}</Typography>
                        </Box>
                      ))
                    )}
                  </Box>
                </DialogContent>
                <DialogActions sx={{ bgcolor: '#3a506b' }}>
                  <Button onClick={handleCloseRoleDialog} disabled={roleDialogLoading}>Cancelar</Button>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={roleDialogLoading || !roleName.trim()}
                    sx={{
                      bgcolor: '#4CAF50',
                      '&:hover': { bgcolor: '#43A047' }
                    }}
                  >
                    {roleDialogLoading ? <CircularProgress size={24} /> : (editingRole ? "Guardar Cambios" : "Crear Rol")}
                  </Button>
                </DialogActions>
              </form>
            </Dialog>
          </Box>
        );
      case 2: // Permisos
        return (
          <Box>
            <Box sx={{ display: "flex", mb: 2, gap: 2, alignItems: "center", flexWrap: "wrap" }}>
              <Box sx={{ flexGrow: 1 }} />
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                sx={{
                  minWidth: 160,
                  borderRadius: 2,
                  width: { xs: "100%", sm: "auto" },
                  bgcolor: '#4CAF50',
                  '&:hover': { bgcolor: '#43A047' }
                }}
                onClick={() => handleOpenPermissionDialog(null)}
              >
                + NUEVO PERMISO
              </Button>
            </Box>

            <TableContainer component={Paper} sx={{ bgcolor: '#283e51', borderRadius: 2, boxShadow: '0 1px 0 rgba(9,30,66,.25)' }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#3a506b' }}>
                    <TableCell sx={{ fontWeight: 600, color: '#fff' }}>Nombre</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#fff' }}>Descripción</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#fff' }} align="right">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loadingPermissions ? (
                    <TableRow>
                      <TableCell colSpan={3} align="center" sx={{ color: '#fff' }}>
                        <CircularProgress size={24} color="inherit" sx={{ my: 3 }} />
                        <Typography>Cargando permisos...</Typography>
                      </TableCell>
                    </TableRow>
                  ) : permissions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} align="center" sx={{ color: "#aaa", py: 5 }}>
                        No hay permisos encontrados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    permissions.map((permission) => (
                      <TableRow key={permission.id} sx={{ '&:nth-of-type(odd)': { bgcolor: 'rgba(255,255,255,0.05)' } }}>
                        <TableCell sx={{ color: '#fff' }}>
                          <Typography fontWeight={500}>{permission.name}</Typography>
                        </TableCell>
                        <TableCell sx={{ color: '#fff' }}>{permission.description || 'N/A'}</TableCell>
                        <TableCell align="right">
                          <IconButton
                            onClick={() => handleOpenPermissionDialog(permission)}
                            sx={{ color: '#b0c4de' }}
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            onClick={() => handleDeletePermission(permission)}
                            sx={{ color: '#b0c4de' }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Permission Dialog (Create/Edit) */}
            <Dialog open={openPermissionDialog} onClose={handleClosePermissionDialog} maxWidth="sm" fullWidth
              PaperProps={{ sx: { bgcolor: '#283e51', color: '#fff', borderRadius: 2 } }}
            >
              <DialogTitle sx={{ bgcolor: '#3a506b', color: '#fff' }}>{editingPermission ? "Editar Permiso" : "Nuevo Permiso"}</DialogTitle>
              <form onSubmit={handleSavePermission}>
                <DialogContent sx={{ pt: '20px !important' }}>
                  {!editingPermission && (
                    <>
                      <FormControl fullWidth sx={{ mt: 1, mb: 2 }}>
                        <InputLabel id="permission-template-label">Plantilla de Permiso</InputLabel>
                        <Select
                          labelId="permission-template-label"
                          value={permissionTemplate}
                          label="Plantilla de Permiso"
                          onChange={(e) => {
                            setPermissionTemplate(e.target.value);
                            setSelectedFacilityForPermission('');
                          }}
                          disabled={permissionDialogLoading}
                        >
                          <MenuItem value=""><em>Seleccione una plantilla</em></MenuItem>
                          {permissionTemplates.map((template) => (
                            <MenuItem key={template.value} value={template.value}>
                              {template.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>

                      {permissionTemplate.includes('{id}') && (
                        <FormControl fullWidth sx={{ mb: 2 }}>
                          <InputLabel id="facility-for-permission-label">Seleccionar Instalación</InputLabel>
                          <Select
                            labelId="facility-for-permission-label"
                            value={selectedFacilityForPermission}
                            label="Seleccionar Instalación"
                            onChange={(e) => setSelectedFacilityForPermission(e.target.value)}
                            required={permissionTemplate.includes('{id}')}
                            disabled={permissionDialogLoading || (facilities && facilities.length === 0)}
                          >
                            {facilities && facilities.length === 0 ? (
                              <MenuItem value="" disabled>
                                <em>No hay instalaciones disponibles</em>
                              </MenuItem>
                            ) : (facilities || []).map((f) => (
                                <MenuItem key={f.id} value={f.id}>{f.name} (ID: {f.id})</MenuItem>
                              ))
                            }
                          </Select>
                          {facilities && facilities.length === 0 && (
                            <Typography variant="caption" color="error" sx={{ mt: 1 }}>
                              No hay instalaciones para asignar permisos específicos.
                            </Typography>
                          )}
                        </FormControl>
                      )}
                    </>
                  )}

                  <TextField
                    label="Nombre del Permiso"
                    value={permissionName}
                    onChange={e => setPermissionName(e.target.value)}
                    fullWidth
                    required
                    sx={{ mt: !editingPermission && !permissionTemplate.includes('{id}') ? 1 : 0, mb: 2 }}
                    disabled={permissionDialogLoading || (!editingPermission && permissionTemplate.includes('{id}'))}
                    helperText={!editingPermission && permissionTemplate.includes('{id}') ? 'El nombre se genera automáticamente al seleccionar una instalación.' : ''}
                    inputProps={{ maxLength: 255 }}
                    aria-label="Nombre del permiso"
                  />
                  <TextField
                    label="Descripción del Permiso"
                    value={permissionDescription}
                    onChange={e => setPermissionDescription(e.target.value)}
                    fullWidth
                    multiline
                    rows={3}
                    sx={{ mb: 2 }}
                    disabled={permissionDialogLoading}
                    aria-label="Descripción del permiso"
                  />
                </DialogContent>
                <DialogActions sx={{ bgcolor: '#3a506b' }}>
                  <Button onClick={handleClosePermissionDialog} disabled={permissionDialogLoading}>Cancelar</Button>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={permissionDialogLoading || !permissionName.trim() || (permissionTemplate.includes('{id}') && !selectedFacilityForPermission)}
                    sx={{
                      bgcolor: '#4CAF50',
                      '&:hover': { bgcolor: '#43A047' }
                    }}
                  >
                    {permissionDialogLoading ? <CircularProgress size={24} /> : (editingPermission ? "Guardar Cambios" : "Crear Permiso")}
                  </Button>
                </DialogActions>
              </form>
            </Dialog>
          </Box>
        );
      default:
        return null;
    }
  };

  return (
    <Box sx={{
      p: { xs: 2, sm: 3 },
      minHeight: 'calc(100vh - 64px)',
      bgcolor: '#004d80',
      color: '#fff',
    }}>
      {/* Título del Módulo */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <GroupIcon sx={{ fontSize: 32, color: '#fff', mr: 1 }} />
        <Typography variant="h5" sx={{ fontWeight: 600, color: '#fff' }}>
          Gestión de Usuarios, Roles y Permisos
        </Typography>
      </Box>

      {/* Pestañas de navegación */}
      <Paper elevation={2} sx={{ mb: 3, borderRadius: 2, bgcolor: '#283e51', boxShadow: '0 1px 0 rgba(9,30,66,.25)' }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          aria-label="Navegación de Usuarios, Roles y Permisos"
          indicatorColor="primary"
          textColor="inherit"
          centered
          sx={{
            '& .MuiTabs-flexContainer': { flexWrap: 'wrap' },
            '& .MuiTab-root': { color: 'rgba(255,255,255,0.7)', '&.Mui-selected': { color: '#fff', fontWeight: 600 } },
            '& .MuiTabs-indicator': { backgroundColor: '#4CAF50' },
          }}
        >
          <Tab label="Usuarios" icon={<PeopleIcon />} iconPosition="start" />
          <Tab label="Roles" icon={<LockIcon />} iconPosition="start" />
          <Tab label="Permisos" icon={<VpnKeyIcon />} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* Contenido de la pestaña activa */}
      <Box sx={{ p: 3, bgcolor: '#18191b', borderRadius: 2, boxShadow: '0 1px 0 rgba(9,30,66,.25)' }}>
        {renderTabPanel(activeTab)}
      </Box>

      <ConfirmationDialog
        open={confirmDialogOpen}
        title={confirmDialogData.title}
        message={confirmDialogData.message}
        onConfirm={confirmDialogData.onConfirm}
        onCancel={() => setConfirmDialogOpen(false)}
      />
    </Box>
  );
};

UsuariosCrudInternal.propTypes = {
  tenantId: PropTypes.number, // Cambiado a number para IDs de inquilino
  isAppReady: PropTypes.bool.isRequired,
  facilities: PropTypes.array, // PropTypes actualizado para permitir array vacío o null/undefined
  setParentSnack: PropTypes.func.isRequired,
  isGlobalAdmin: PropTypes.bool.isRequired,
};

export default UsuariosCrudInternal;
