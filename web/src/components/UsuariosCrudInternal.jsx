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
    // General Application Permissions
    { label: 'General Administrator', value: 'admin' },
    { label: 'View Dashboard', value: 'view-dashboard' },

    // Company Permissions
    { label: 'View Companies', value: 'view-companies' },
    { label: 'Manage Companies', value: 'manage-companies' },
    { label: 'Create Company', value: 'create-company' },
    { label: 'Update Company', value: 'update-company' },
    { label: 'Delete Company', value: 'delete-company' },

    // Cultivation Permissions (General)
    { label: 'View Cultivation Areas (general)', value: 'view-cultivation-areas' },
    { label: 'Manage Cultivation Areas (general)', value: 'manage-cultivation-areas' },
    { label: 'View Batches (general)', value: 'view-batches' },
    { label: 'Manage Batches (general)', value: 'manage-batches' },
    { label: 'View Plants (general)', value: 'view-plants' },
    { label: 'Manage Plants (general)', value: 'manage-plants' },

    // Cultivation Permissions (Specific by Facility)
    { label: 'View Facility (specific)', value: 'view-facility-{id}' },
    { label: 'Manage Facility (specific)', value: 'manage-facility-{id}' },
    { label: 'Create Cultivation Area (specific)', value: 'create-cultivation-area-facility-{id}' },
    { label: 'Update Cultivation Area (specific)', value: 'update-cultivation-area-facility-{id}' },
    { label: 'Delete Cultivation Area (specific)', value: 'delete-cultivation-area-facility-{id}' },
    { label: 'View Batches (specific by facility)', value: 'view-batches-facility-{id}' },
    { label: 'Manage Batches (specific by facility)', value: 'manage-batches-facility-{id}' },
    { label: 'View Plants (specific by facility)', value: 'view-plants-facility-{id}' },
    { label: 'Manage Plants (specific by facility)', value: 'manage-plants-facility-{id}' },

    // Calendar Permissions
    { label: 'View Calendar Events', value: 'view-calendar-events' },
    { label: 'Manage Calendar Events', value: 'manage-calendar-events' },
    { label: 'Create Calendar Event', value: 'create-calendar-event' },
    { label: 'Update Calendar Event', value: 'update-calendar-event' },
    { label: 'Delete Calendar Event', value: 'delete-calendar-event' },

    // NEW PERMISSIONS FOR CALENDAR CARDS
    { label: 'Manage Card Checklist', value: 'manage-card-checklist' },
    { label: 'Assign Card Members', value: 'assign-card-members' },

    // User Permissions (User Module Management)
    { label: 'View Users', value: 'view-users' },
    { label: 'Manage Users', value: 'manage-users' },
    { label: 'Create User', value: 'create-user' },
    { label: 'Update User', value: 'update-user' },
    { label: 'Delete User', value: 'delete-user' },

    // Role Permissions
    { label: 'View Roles', value: 'view-roles' },
    { label: 'Manage Roles', value: 'manage-roles' },
    { label: 'Create Role', value: 'create-role' },
    { label: 'Update Role', value: 'update-role' },
    { label: 'Delete Role', value: 'delete-role' },

    // Permission Permissions (manage permissions themselves)
    { label: 'View Permissions', value: 'view-permissions' },
    { label: 'Manage Permissions', value: 'manage-permissions' },
    { label: 'Create Permission', value: 'create-permission' },
    { label: 'Update Permission', value: 'update-permission' },
    { label: 'Delete Permission', value: 'delete-permission' },

    // NEW PERMISSIONS FOR INVENTORY RECONCILIATION
    { label: 'View Inventory Reconciliation', value: 'view-inventory-reconciliation' },
    { label: 'Manage Inventory Reconciliation', value: 'manage-inventory-reconciliation' },
    { label: 'Create Inventory Reconciliation', value: 'create-inventory-reconciliation' },
    { label: 'Update Inventory Reconciliation', value: 'update-inventory-reconciliation' },
    { label: 'Delete Inventory Reconciliation', value: 'delete-inventory-reconciliation' },

    // If you also need specific permissions by facility for this:
    { label: 'View Reconciliation (specific by facility)', value: 'view-inventory-reconciliation-facility-{id}' },
    { label: 'Manage Reconciliation (specific by facility)', value: 'manage-inventory-reconciliation-facility-{id}' },
    { label: 'Justify Inventory Discrepancy', value: 'justify-inventory-discrepancy' },
    { label: 'Apply Tenant Admin Permissions', value: 'template-apply-tenant-admin' },

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
      showSnack('Users loaded successfully.', 'success');
    } catch (err) {
      console.error("Error loading users:", err);
      const errorMessage = err.response?.data?.message || err.message;
      showSnack(`Could not load users: ${errorMessage}`, "error");
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
      showSnack('Roles loaded successfully.', 'success');
    } catch (err) {
      console.error("Error loading roles:", err);
      const errorMessage = err.response?.data?.message || err.message;
      showSnack(`Could not load roles: ${errorMessage}`, "error");
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
      showSnack('Permissions loaded successfully.', 'success');
    } catch (err) {
      console.error("Error loading permissions:", err);
      const errorMessage = err.response?.data?.message || err.message;
      showSnack(`Could not load permissions: ${errorMessage}`, "error");
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
      showSnack('Error loading tenants for board assignment.', 'error');
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
      showSnack("Could not load roles for assignment.", "error");
    }
  }, [isAppReady, isGlobalAdmin, tenantId, showSnack]);


  // --- CRUD Operations (Usuarios) ---
  const handleSaveUser = async (e) => {
    e.preventDefault();
    setUserDialogLoading(true);
    try {
      // Validaciones adicionales para el tenantId
      if (isGlobalAdmin && !selectedTenantId) {
        showSnack('As Super Admin, you must select a tenant for the user.', 'warning');
        setUserDialogLoading(false);
        return;
      }
      if (!userName.trim() || !userEmail.trim() || (!editingUser && !userPassword.trim())) {
        showSnack('Name, email and password (for new users) are required.', 'warning');
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
        showSnack("User updated", "success");
      } else {
        await api.post("/users", userData);
        showSnack("User created", "success");
      }
      handleCloseUserDialog();
      await fetchUsers(); // Recargar usuarios
    } catch (err) {
      console.error("Error al guardar usuario:", err.response?.data || err.message);
      // MODIFICACIÓN: Pasar los detalles del error si existen
      showSnack("Error saving user: " + (err.response?.data?.message || err.message), "error", err.response?.data?.details || err.message);
    } finally { setUserDialogLoading(false); }
  };

  const handleDeleteUser = async (userToDelete) => {
    setConfirmDialogData({
      title: 'Confirm User Deletion',
      message: `Delete user "${userToDelete.name}"? This action is irreversible.`,
      onConfirm: async () => {
        setLoadingUsers(true);
        try {
          await api.delete(`/users/${userToDelete.id}`);
          showSnack("User deleted", "info");
          await fetchUsers();
        } catch (err) {
          console.error("No se pudo eliminar el usuario:", err);
          showSnack("Could not delete user: " + (err.response?.data?.message || err.message), "error");
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
        showSnack("Role updated", "success");
      } else {
        const res = await api.post("/roles", roleData);
        console.log("handleSaveRole: Respuesta de creación de rol:", res.data); // LOG: Ver la respuesta del POST
        showSnack("Role created", "success");
      }
      await fetchRoles(); // Se vuelve a cargar la lista de roles
      handleCloseRoleDialog();
    } catch (err) {
      console.error("Error al guardar rol:", err.response?.data || err.message);
      // MODIFICACIÓN: Pasar los detalles del error si existen
      showSnack("Error saving role: " + (err.response?.data?.message || err.message), "error", err.response?.data?.details || err.message);
    } finally { setLoadingRoleDialog(false); }
  };

  const handleDeleteRole = async (roleToDelete) => {
    setConfirmDialogData({
      title: 'Confirm Role Deletion',
      message: `Delete role "${roleToDelete.name}"? This action is irreversible and will affect assigned users.`,
      onConfirm: async () => {
        setLoadingRoles(true);
        try {
          await api.delete(`/roles/${roleToDelete.id}`);
          showSnack("Role deleted", "info");
          await fetchRoles();
          await fetchUsers();
        } catch (err) {
          console.error("No se pudo eliminar el rol:", err);
          showSnack("Could not delete role: " + (err.response?.data?.message || err.message), "error");
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
        showSnack("You must select a facility for this type of permission.", "warning");
        setPermissionDialogLoading(false);
        return;
      }
      if (!permissionName.trim()) {
        showSnack("Permission name is required.", "warning");
        setPermissionDialogLoading(false);
        return;
      }

      if (editingPermission) {
        await api.put(`/permissions/${editingPermission.id}`, permissionData);
        showSnack("Permission updated", "success");
      } else {
        await api.post("/permissions", permissionData);
        showSnack("Permission created", "success");
      }
      await fetchPermissions();
      handleClosePermissionDialog();
    } catch (err) {
      console.error("Error al guardar permiso:", err.response?.data || err.message);
      // MODIFICACIÓN: Pasar los detalles del error si existen
      showSnack("Error saving permission: " + (err.response?.data?.message || err.message), "error", err.response?.data?.details || err.message);
    } finally { setPermissionDialogLoading(false); }
  };

  const handleDeletePermission = async (permissionToDelete) => {
    setConfirmDialogData({
      title: 'Confirm Permission Deletion',
      message: `Delete permission "${permissionToDelete.name}"? This action is irreversible.`,
      onConfirm: async () => {
        setLoadingPermissions(true);
        try {
          await api.delete(`/permissions/${permissionToDelete.id}`);
          showSnack("Permission deleted", "info");
          await fetchPermissions();
          await fetchRoles();
        } catch (err) {
          console.error("No se pudo eliminar el permiso:", err);
          showSnack("Could not delete permission: " + (err.response?.data?.message || err.message), "error");
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
                placeholder="Search users..."
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
                + NEW USER
              </Button>
            </Box>

            <TableContainer component={Paper} sx={{ bgcolor: '#283e51', borderRadius: 2, boxShadow: '0 1px 0 rgba(9,30,66,.25)' }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#3a506b' }}>
                    <TableCell sx={{ fontWeight: 600, color: '#fff' }}>Nombre</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#fff' }}>Email</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#fff' }}>Assigned Roles</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#fff' }} align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loadingUsers ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ color: '#fff' }}>
                        <CircularProgress size={24} color="inherit" sx={{ my: 3 }} />
                        <Typography>Loading users...</Typography>
                      </TableCell>
                    </TableRow>
                  ) : filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ color: "#aaa", py: 5 }}>
                        No users found.
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
                              None
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
              <DialogTitle sx={{ bgcolor: '#3a506b', color: '#fff' }}>{editingUser ? "Edit User" : "New User"}</DialogTitle>
              <form onSubmit={handleSaveUser}>
                <DialogContent sx={{ pt: '20px !important' }}>
                  <TextField
                    label="User Name"
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
                    label="User Email"
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
                    label="Password"
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
                    helperText={editingUser ? "Leave empty to not change password." : "Required for new users."}
                    autoComplete="new-password"
                    required={!editingUser && userPassword.trim() === ""}
                    disabled={userDialogLoading}
                  />

                  {/* NUEVO: Selector de Inquilino (solo para Global Admin) */}
                  {isGlobalAdmin && (
                    <FormControl fullWidth sx={{ mb: 2 }}>
                      <InputLabel id="tenant-select-label" sx={{ color: '#fff' }}>Tenant</InputLabel>
                      <Select
                        labelId="tenant-select-label"
                        value={selectedTenantId}
                        label="Tenant"
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
                            <em>No tenants available</em>
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
                  <Typography variant="subtitle2" sx={{ color: '#fff' }} mb={1}>Assigned Roles</Typography>
                  <Box sx={{ maxHeight: 200, overflowY: "auto", border: "1px solid rgba(255,255,255,0.3)", p: 1, borderRadius: 1 }}>
                    {rolesForAssignment.length === 0 ? (
                      <Typography color="text.secondary" sx={{ color: '#aaa' }}>No roles available.</Typography>
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
                  <Button onClick={handleCloseUserDialog} disabled={userDialogLoading}>Cancel</Button>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={userDialogLoading || !userName || !userEmail || (!editingUser && userPassword.trim() === "") || (isGlobalAdmin && !selectedTenantId)}
                    sx={{
                      bgcolor: '#4CAF50',
                      '&:hover': { bgcolor: '#43A047' }
                    }}
                  >
                    {userDialogLoading ? <CircularProgress size={24} /> : (editingUser ? "Save Changes" : "Create User")}
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
                + NEW ROLE
              </Button>
            </Box>

            <TableContainer component={Paper} sx={{ bgcolor: '#283e51', borderRadius: 2, boxShadow: '0 1px 0 rgba(9,30,66,.25)' }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#3a506b' }}>
                    <TableCell sx={{ fontWeight: 600, color: '#fff' }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#fff' }}>Description</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#fff' }}>Assigned Permissions</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#fff' }} align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loadingRoles ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ color: '#fff' }}>
                        <CircularProgress size={24} color="inherit" sx={{ my: 3 }} />
                        <Typography>Loading roles...</Typography>
                      </TableCell>
                    </TableRow>
                  ) : roles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ color: "#aaa", py: 5 }}>
                        No roles found.
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
                              None
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
              <DialogTitle sx={{ bgcolor: '#3a506b', color: '#fff' }}>{editingRole ? "Edit Role" : "New Role"}</DialogTitle>
              <form onSubmit={handleSaveRole}>
                <DialogContent sx={{ pt: '20px !important' }}>
                  <TextField
                    label="Role Name"
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
                    label="Role Description"
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
                  <Typography variant="subtitle2" sx={{ color: '#fff' }} mb={1}>Assigned Permissions</Typography>
                  <Box sx={{ maxHeight: 200, overflowY: "auto", border: "1px solid rgba(255,255,255,0.3)", p: 1, borderRadius: 1 }}>
                    {permissions.length === 0 ? (
                      <Typography color="text.secondary" sx={{ color: '#aaa' }}>No permissions available.</Typography>
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
                  <Button onClick={handleCloseRoleDialog} disabled={roleDialogLoading}>Cancel</Button>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={roleDialogLoading || !roleName.trim()}
                    sx={{
                      bgcolor: '#4CAF50',
                      '&:hover': { bgcolor: '#43A047' }
                    }}
                  >
                    {roleDialogLoading ? <CircularProgress size={24} /> : (editingRole ? "Save Changes" : "Create Role")}
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
                + NEW PERMISSION
              </Button>
            </Box>

            <TableContainer component={Paper} sx={{ bgcolor: '#283e51', borderRadius: 2, boxShadow: '0 1px 0 rgba(9,30,66,.25)' }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#3a506b' }}>
                    <TableCell sx={{ fontWeight: 600, color: '#fff' }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#fff' }}>Description</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#fff' }} align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loadingPermissions ? (
                    <TableRow>
                      <TableCell colSpan={3} align="center" sx={{ color: '#fff' }}>
                        <CircularProgress size={24} color="inherit" sx={{ my: 3 }} />
                        <Typography>Loading permissions...</Typography>
                      </TableCell>
                    </TableRow>
                  ) : permissions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} align="center" sx={{ color: "#aaa", py: 5 }}>
                        No permissions found.
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
              <DialogTitle sx={{ bgcolor: '#3a506b', color: '#fff' }}>{editingPermission ? "Edit Permission" : "New Permission"}</DialogTitle>
              <form onSubmit={handleSavePermission}>
                <DialogContent sx={{ pt: '20px !important' }}>
                  {!editingPermission && (
                    <>
                      <FormControl fullWidth sx={{ mt: 1, mb: 2 }}>
                        <InputLabel id="permission-template-label">Permission Template</InputLabel>
                        <Select
                          labelId="permission-template-label"
                          value={permissionTemplate}
                          label="Permission Template"
                          onChange={(e) => {
                            setPermissionTemplate(e.target.value);
                            setSelectedFacilityForPermission('');
                          }}
                          disabled={permissionDialogLoading}
                        >
                          <MenuItem value=""><em>Select a template</em></MenuItem>
                          {permissionTemplates.map((template) => (
                            <MenuItem key={template.value} value={template.value}>
                              {template.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>

                      {permissionTemplate.includes('{id}') && (
                        <FormControl fullWidth sx={{ mb: 2 }}>
                          <InputLabel id="facility-for-permission-label">Select Facility</InputLabel>
                          <Select
                            labelId="facility-for-permission-label"
                            value={selectedFacilityForPermission}
                            label="Select Facility"
                            onChange={(e) => setSelectedFacilityForPermission(e.target.value)}
                            required={permissionTemplate.includes('{id}')}
                            disabled={permissionDialogLoading || (facilities && facilities.length === 0)}
                          >
                            {facilities && facilities.length === 0 ? (
                              <MenuItem value="" disabled>
                                <em>No facilities available</em>
                              </MenuItem>
                            ) : (facilities || []).map((f) => (
                                <MenuItem key={f.id} value={f.id}>{f.name} (ID: {f.id})</MenuItem>
                              ))
                            }
                          </Select>
                          {facilities && facilities.length === 0 && (
                            <Typography variant="caption" color="error" sx={{ mt: 1 }}>
                              No facilities to assign specific permissions.
                            </Typography>
                          )}
                        </FormControl>
                      )}
                    </>
                  )}

                  <TextField
                    label="Permission Name"
                    value={permissionName}
                    onChange={e => setPermissionName(e.target.value)}
                    fullWidth
                    required
                    sx={{ mt: !editingPermission && !permissionTemplate.includes('{id}') ? 1 : 0, mb: 2 }}
                    disabled={permissionDialogLoading || (!editingPermission && permissionTemplate.includes('{id}'))}
                    helperText={!editingPermission && permissionTemplate.includes('{id}') ? 'Name is automatically generated when selecting a facility.' : ''}
                    inputProps={{ maxLength: 255 }}
                    aria-label="Nombre del permiso"
                  />
                  <TextField
                    label="Permission Description"
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
                  <Button onClick={handleClosePermissionDialog} disabled={permissionDialogLoading}>Cancel</Button>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={permissionDialogLoading || !permissionName.trim() || (permissionTemplate.includes('{id}') && !selectedFacilityForPermission)}
                    sx={{
                      bgcolor: '#4CAF50',
                      '&:hover': { bgcolor: '#43A047' }
                    }}
                  >
                    {permissionDialogLoading ? <CircularProgress size={24} /> : (editingPermission ? "Save Changes" : "Create Permission")}
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
          Users, Roles & Permissions Management
        </Typography>
      </Box>

      {/* Pestañas de navegación */}
      <Paper elevation={2} sx={{ mb: 3, borderRadius: 2, bgcolor: '#283e51', boxShadow: '0 1px 0 rgba(9,30,66,.25)' }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          aria-label="Users, Roles and Permissions Navigation"
          indicatorColor="primary"
          textColor="inherit"
          centered
          sx={{
            '& .MuiTabs-flexContainer': { flexWrap: 'wrap' },
            '& .MuiTab-root': { color: 'rgba(255,255,255,0.7)', '&.Mui-selected': { color: '#fff', fontWeight: 600 } },
            '& .MuiTabs-indicator': { backgroundColor: '#4CAF50' },
          }}
        >
          <Tab label="Users" icon={<PeopleIcon />} iconPosition="start" />
          <Tab label="Roles" icon={<LockIcon />} iconPosition="start" />
          <Tab label="Permissions" icon={<VpnKeyIcon />} iconPosition="start" />
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
