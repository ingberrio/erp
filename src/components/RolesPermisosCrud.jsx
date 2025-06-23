import React, { useState, useEffect } from "react";
import {
  Box, Paper, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Snackbar, Alert, Divider, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Tabs, Tab, Tooltip, InputAdornment, Checkbox, Avatar, CircularProgress
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ShieldIcon from "@mui/icons-material/Shield"; // For Roles and Permissions
import GroupIcon from "@mui/icons-material/Group"; // For Users
import SearchIcon from "@mui/icons-material/Search";
import CheckBoxIcon from "@mui/icons-material/CheckBox"; // Used in Checkbox component, good to keep
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank"; // Used in Checkbox component, good to keep

const API = "http://127.0.0.1:8000/api";

const RolesPermisosCrud = ({ token, tenantId }) => {
  const [tab, setTab] = useState(0);

  // --- Common State for Loading and Snackbar ---
  const [loading, setLoading] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: "", severity: "success" });

  // --- Roles State ---
  const [roles, setRoles] = useState([]);
  const [roleSearch, setRoleSearch] = useState("");
  const [openRoleDialog, setOpenRoleDialog] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleName, setRoleName] = useState("");
  const [roleDesc, setRoleDesc] = useState("");
  const [selectedPermsForRole, setSelectedPermsForRole] = useState([]); // Perms for the specific role being edited

  // --- Permisos State ---
  const [perms, setPerms] = useState([]);
  const [permSearch, setPermSearch] = useState("");
  const [openPermDialog, setOpenPermDialog] = useState(false);
  const [editingPerm, setEditingPerm] = useState(null);
  const [permName, setPermName] = useState("");
  const [permDesc, setPermDesc] = useState("");

  // --- Usuarios State ---
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState("");
  const [openUserDialog, setOpenUserDialog] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userRoles, setUserRoles] = useState([]); // Roles for the specific user being edited
  const [userPassword, setUserPassword] = useState("");

  // --- Authenticated Fetch Helper ---
  const authFetch = async (url, opts = {}) => {
    try {
      const res = await fetch(url, {
        ...opts,
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Tenant-ID": tenantId,
          "Content-Type": "application/json",
          ...(opts.headers || {}),
        },
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Something went wrong!");
      }
      return res;
    } catch (error) {
      setSnack({ open: true, message: error.message || "Error de red o del servidor.", severity: "error" });
      throw error; // Re-throw to be caught by specific handlers if needed
    }
  };

  // --- Fetch Data Functions ---
  const fetchRoles = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API}/roles`);
      const data = await res.json();
      setRoles(Array.isArray(data) ? data : data.data || []);
    } catch (error) {
      console.error("Error fetching roles:", error);
      setRoles([]); // Ensure roles is an array even on error
    } finally {
      setLoading(false);
    }
  };

  const fetchPerms = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API}/permissions`);
      const data = await res.json();
      setPerms(Array.isArray(data) ? data : data.data || []);
    } catch (error) {
      console.error("Error fetching permissions:", error);
      setPerms([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API}/users`);
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : data.data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token && tenantId) {
      fetchRoles();
      fetchPerms();
      fetchUsers();
    }
  }, [token, tenantId]); // Depend on tenantId as well

  // --- Roles Handlers ---
  const handleOpenRoleDialog = (role = null) => {
    setEditingRole(role);
    setRoleName(role?.name || "");
    setRoleDesc(role?.description || "");
    setSelectedPermsForRole(role?.permissions?.map(p => p.id) || []);
    setOpenRoleDialog(true);
  };

  const handleSaveRole = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const body = { name: roleName, description: roleDesc, permissions: selectedPermsForRole }; // Include permissions
      let url = `${API}/roles`;
      let method = "POST";
      if (editingRole) {
        url = `${API}/roles/${editingRole.id}`;
        method = "PUT";
      }
      await authFetch(url, {
        method,
        body: JSON.stringify(body),
      });
      setSnack({ open: true, message: editingRole ? "Rol actualizado exitosamente." : "Rol creado exitosamente.", severity: "success" });
      setOpenRoleDialog(false);
      fetchRoles();
    } catch (error) {
      // Error message already set by authFetch
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRole = async (role) => {
    if (!window.confirm(`¿Está seguro de eliminar el rol "${role.name}"?`)) return;
    setLoading(true);
    try {
      await authFetch(`${API}/roles/${role.id}`, { method: "DELETE" });
      setSnack({ open: true, message: "Rol eliminado exitosamente.", severity: "info" });
      fetchRoles();
    } catch (error) {
      // Error message already set by authFetch
    } finally {
      setLoading(false);
    }
  };

  // --- Permisos Handlers ---
  const handleOpenPermDialog = (perm = null) => {
    setEditingPerm(perm);
    setPermName(perm?.name || "");
    setPermDesc(perm?.description || "");
    setOpenPermDialog(true);
  };

  const handleSavePerm = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const body = { name: permName, description: permDesc };
      let url = `${API}/permissions`;
      let method = "POST";
      if (editingPerm) {
        url = `${API}/permissions/${editingPerm.id}`;
        method = "PUT";
      }
      await authFetch(url, {
        method,
        body: JSON.stringify(body),
      });
      setSnack({ open: true, message: editingPerm ? "Permiso actualizado exitosamente." : "Permiso creado exitosamente.", severity: "success" });
      setOpenPermDialog(false);
      fetchPerms();
    } catch (error) {
      // Error message already set by authFetch
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePerm = async (perm) => {
    if (!window.confirm(`¿Está seguro de eliminar el permiso "${perm.name}"?`)) return;
    setLoading(true);
    try {
      await authFetch(`${API}/permissions/${perm.id}`, { method: "DELETE" });
      setSnack({ open: true, message: "Permiso eliminado exitosamente.", severity: "info" });
      fetchPerms();
    } catch (error) {
      // Error message already set by authFetch
    } finally {
      setLoading(false);
    }
  };

  // --- Usuarios Handlers ---
  const handleOpenUserDialog = (user = null) => {
    setEditingUser(user);
    setUserName(user?.name || "");
    setUserEmail(user?.email || "");
    setUserRoles(user?.roles?.map(r => r.id) || []);
    setUserPassword(""); // Clear password field for security
    setOpenUserDialog(true);
  };
  
  const generateTemporaryPassword = () => {
    return Math.random().toString(36).slice(-8) + Math.random().toString(36).charAt(2);
  };
  
  const handleSaveUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const body = {
        name: userName.trim(),
        email: userEmail.trim(),
        roles: userRoles,
      };
      if (!editingUser || userPassword.trim()) {
        if (!userPassword.trim() && !editingUser) {
          throw new Error("La contraseña es requerida para nuevos usuarios.");
        }
        body.password = userPassword.trim() || generateTemporaryPassword();
      }
      const finalBody = { // Explicitly construct the body
        name: body.name,
        email: body.email,
        roles: body.roles,
      };
      if (body.password) finalBody.password = body.password; // Only add password if it exists
      console.log("Final payload before send (1):", JSON.stringify(finalBody));
      let url = `${API}/users`;
      let method = "POST";
      if (editingUser) {
        url = `${API}/users/${editingUser.id}`;
        method = "PUT";
      }
      console.log("Final payload before fetch:", JSON.stringify(finalBody));
      const response = await authFetch(url, {
        method,
        body: JSON.stringify(finalBody),
      });
      const data = await response.json();
      setSnack({ open: true, message: editingUser ? "Usuario actualizado exitosamente." : "Usuario creado exitosamente.", severity: "success" });
      setOpenUserDialog(false);
      fetchUsers();
    } catch (error) {
      const errorData = await error.response?.json() || { message: error.message };
      setSnack({ open: true, message: errorData.message || "Error al guardar usuario.", severity: "error" });
      console.error("Error details:", errorData);
    } finally {
      setLoading(false);
    };
  };
  
  

  const handleDeleteUser = async (user) => {
    if (!window.confirm(`¿Está seguro de eliminar al usuario "${user.name}"?`)) return;
    setLoading(true);
    try {
      await authFetch(`${API}/users/${user.id}`, { method: "DELETE" });
      setSnack({ open: true, message: "Usuario eliminado exitosamente.", severity: "info" });
      fetchUsers();
    } catch (error) {
      // Error message already set by authFetch
    } finally {
      setLoading(false);
    }
  };

  const toggleUserRole = (roleId) => {
    setUserRoles((prev) =>
      prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId]
    );
  };

  const togglePermissionForRole = (permId) => {
    setSelectedPermsForRole((prev) =>
      prev.includes(permId) ? prev.filter(id => id !== permId) : [...prev, permId]
    );
  };

  // --- Filtered Data ---
  const filteredRoles = roles.filter((r) =>
    r.name.toLowerCase().includes(roleSearch.toLowerCase()) ||
    (r.description?.toLowerCase() || "").includes(roleSearch.toLowerCase())
  );
  const filteredPerms = perms.filter((p) =>
    p.name.toLowerCase().includes(permSearch.toLowerCase()) ||
    (p.description?.toLowerCase() || "").includes(permSearch.toLowerCase())
  );
  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", mt: { xs: 2, md: 6 }, width: "100%" }}>
      <Paper sx={{ p: { xs: 1, md: 4 }, boxShadow: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
          <GroupIcon sx={{ fontSize: 34, mr: 1, color: "#222" }} />
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Gestión de Usuarios, Roles y Permisos</Typography>
        </Box>

        <Tabs value={tab} onChange={(_, t) => setTab(t)} sx={{ mb: 2 }}>
          <Tab label={<><ShieldIcon sx={{ mr: 1 }} />ROLES</>} />
          <Tab label={<><ShieldIcon sx={{ mr: 1, opacity: 0.7 }} />PERMISOS</>} />
          <Tab label={<><GroupIcon sx={{ mr: 1, opacity: 0.7 }} />USUARIOS</>} />
        </Tabs>

        {/* --- TAB ROLES --- */}
        {tab === 0 && (
          <>
            <Box sx={{ display: "flex", mb: 2, gap: 2, alignItems: "center", flexWrap: "wrap" }}>
              <TextField
                size="small"
                placeholder="Buscar roles..."
                value={roleSearch}
                onChange={e => setRoleSearch(e.target.value)}
                sx={{ width: { xs: "100%", sm: 250 }, bgcolor: "#f9f9f9" }}
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
                sx={{ minWidth: 160, borderRadius: 2, width: { xs: "100%", sm: "auto" } }}
                onClick={() => handleOpenRoleDialog(null)}
              >
                + NUEVO ROL
              </Button>
            </Box>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: "#fafbfc" }}>
                    <TableCell sx={{ fontWeight: 600 }}>Nombre</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Descripción</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Permisos</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Usuarios Asignados</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        <CircularProgress size={24} sx={{ my: 3 }} />
                      </TableCell>
                    </TableRow>
                  ) : filteredRoles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ color: "#aaa", py: 5 }}>
                        No hay roles encontrados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRoles.map((role) => (
                      <TableRow key={role.id}>
                        <TableCell>
                          <Typography fontWeight={500}>{role.name}</Typography>
                        </TableCell>
                        <TableCell>
                          {role.description || <span style={{ color: "#bbb" }}>Sin descripción</span>}
                        </TableCell>
                        <TableCell sx={{ maxWidth: 220 }}>
                          {(role.permissions || []).slice(0, 2).map(p => (
                            <Box
                              component="span"
                              key={p.id}
                              sx={{
                                bgcolor: "#e6f2fe",
                                px: 1,
                                py: 0.2,
                                mr: 0.5,
                                borderRadius: 1,
                                fontSize: 13,
                                color: "#1976d2",
                                whiteSpace: "nowrap"
                              }}
                            >
                              {p.name}
                            </Box>
                          ))}
                          {(role.permissions || []).length > 2 && (
                            <Typography component="span" sx={{ color: "#888", fontSize: 13 }}>
                              +{role.permissions.length - 2} más
                            </Typography>
                          )}
                           {(role.permissions || []).length === 0 && (
                            <Typography component="span" sx={{ color: "#bbb", fontSize: 13 }}>
                              Ninguno
                            </Typography>
                           )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ color: "#666" }}>
                            {role.users_count || 0}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <IconButton
                            onClick={() => handleOpenRoleDialog(role)}
                            color="primary"
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            onClick={() => handleDeleteRole(role)}
                            color="error"
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
          </>
        )}

        {/* --- TAB PERMISOS --- */}
        {tab === 1 && (
          <>
            <Box sx={{ display: "flex", mb: 2, gap: 2, alignItems: "center", flexWrap: "wrap" }}>
              <TextField
                size="small"
                placeholder="Buscar permisos..."
                value={permSearch}
                onChange={e => setPermSearch(e.target.value)}
                sx={{ width: { xs: "100%", sm: 250 }, bgcolor: "#f9f9f9" }}
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
                sx={{ minWidth: 160, borderRadius: 2, width: { xs: "100%", sm: "auto" } }}
                onClick={() => handleOpenPermDialog(null)}
              >
                + NUEVO PERMISO
              </Button>
            </Box>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: "#fafbfc" }}>
                    <TableCell sx={{ fontWeight: 600 }}>Nombre</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Descripción</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={3} align="center">
                        <CircularProgress size={24} sx={{ my: 3 }} />
                      </TableCell>
                    </TableRow>
                  ) : filteredPerms.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} align="center" sx={{ color: "#aaa", py: 5 }}>
                        No hay permisos encontrados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPerms.map((perm) => (
                      <TableRow key={perm.id}>
                        <TableCell>
                          <Typography fontWeight={500}>{perm.name}</Typography>
                        </TableCell>
                        <TableCell>{perm.description || <span style={{ color: "#bbb" }}>Sin descripción</span>}</TableCell>
                        <TableCell align="right">
                          <IconButton
                            onClick={() => handleOpenPermDialog(perm)}
                            color="primary"
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            onClick={() => handleDeletePerm(perm)}
                            color="error"
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
          </>
        )}

        {/* --- TAB USUARIOS --- */}
        {tab === 2 && (
          <>
            <Box sx={{ display: "flex", mb: 2, gap: 2, alignItems: "center", flexWrap: "wrap" }}>
              <TextField
                size="small"
                placeholder="Buscar usuarios..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                sx={{ width: { xs: "100%", sm: 250 }, bgcolor: "#f9f9f9" }}
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
                sx={{ minWidth: 160, borderRadius: 2, width: { xs: "100%", sm: "auto" } }}
                onClick={() => handleOpenUserDialog(null)}
              >
                + NUEVO USUARIO
              </Button>
            </Box>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: "#fafbfc" }}>
                    <TableCell sx={{ fontWeight: 600 }}>Nombre</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Roles Asignados</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        <CircularProgress size={24} sx={{ my: 3 }} />
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
                      <TableRow key={user.id}>
                        <TableCell>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Avatar sx={{ width: 32, height: 32, fontSize: 14 }}>{user.name.charAt(0).toUpperCase()}</Avatar>
                            <Typography fontWeight={500}>{user.name}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          {(user.roles || []).map(r => (
                            <Box
                              component="span"
                              key={r.id}
                              sx={{
                                bgcolor: "#d7eaff",
                                px: 1,
                                py: 0.2,
                                mr: 0.5,
                                borderRadius: 1,
                                fontSize: 13,
                                color: "#1572c9",
                                whiteSpace: "nowrap"
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
                            color="primary"
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            onClick={() => handleDeleteUser(user)}
                            color="error"
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
          </>
        )}

        {/* --- DIALOGO ROL (Crear/Editar) --- */}
        <Dialog open={openRoleDialog} onClose={() => setOpenRoleDialog(false)} maxWidth="xs" fullWidth>
          <DialogTitle>{editingRole ? "Editar Rol" : "Nuevo Rol"}</DialogTitle>
          <form onSubmit={handleSaveRole}>
            <DialogContent>
              <TextField
                label="Nombre del Rol"
                value={roleName}
                onChange={e => setRoleName(e.target.value)}
                fullWidth
                required
                sx={{ mt: 1, mb: 2 }}
                disabled={loading}
              />
              <TextField
                label="Descripción del Rol"
                value={roleDesc}
                onChange={e => setRoleDesc(e.target.value)}
                fullWidth
                multiline
                rows={2}
                sx={{ mb: 1 }}
                disabled={loading}
              />
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" mb={1}>Permisos Asignados</Typography>
              <Box sx={{ maxHeight: 180, overflowY: "auto", border: "1px solid #ccc", p: 1, borderRadius: 1 }}>
                {perms.length === 0 ? (
                  <Typography color="text.secondary">No hay permisos configurados.</Typography>
                ) : (
                  perms.map((perm) => (
                    <Box key={perm.id} sx={{ display: "flex", alignItems: "center", mb: 0.5 }}>
                      <Checkbox
                        size="small"
                        checked={selectedPermsForRole.includes(perm.id)}
                        onChange={() => togglePermissionForRole(perm.id)}
                        disabled={loading}
                        icon={<CheckBoxOutlineBlankIcon fontSize="small" />}
                        checkedIcon={<CheckBoxIcon fontSize="small" />}
                      />
                      <Typography>{perm.name}</Typography>
                    </Box>
                  ))
                )}
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpenRoleDialog(false)} disabled={loading}>Cancelar</Button>
              <Button
                type="submit"
                variant="contained"
                disabled={loading || !roleName}
              >
                {loading ? <CircularProgress size={24} /> : (editingRole ? "Guardar Cambios" : "Crear Rol")}
              </Button>
            </DialogActions>
          </form>
        </Dialog>

        {/* --- DIALOGO PERMISO (Crear/Editar) --- */}
        <Dialog open={openPermDialog} onClose={() => setOpenPermDialog(false)} maxWidth="xs" fullWidth>
          <DialogTitle>{editingPerm ? "Editar Permiso" : "Nuevo Permiso"}</DialogTitle>
          <form onSubmit={handleSavePerm}>
            <DialogContent>
              <TextField
                label="Nombre del Permiso"
                value={permName}
                onChange={e => setPermName(e.target.value)}
                fullWidth
                required
                sx={{ mt: 1, mb: 2 }}
                disabled={loading}
              />
              <TextField
                label="Descripción del Permiso"
                value={permDesc}
                onChange={e => setPermDesc(e.target.value)}
                fullWidth
                multiline
                rows={2}
                sx={{ mb: 1 }}
                disabled={loading}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpenPermDialog(false)} disabled={loading}>Cancelar</Button>
              <Button
                type="submit"
                variant="contained"
                disabled={loading || !permName}
              >
                {loading ? <CircularProgress size={24} /> : (editingPerm ? "Guardar Cambios" : "Crear Permiso")}
              </Button>
            </DialogActions>
          </form>
        </Dialog>

        {/* --- DIALOGO USUARIO (Crear/Editar) --- */}
        <Dialog open={openUserDialog} onClose={() => setOpenUserDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>{editingUser ? "Editar Usuario" : "Nuevo Usuario"}</DialogTitle>
          <form onSubmit={handleSaveUser}>
            <DialogContent>
              <TextField
                label="Nombre del Usuario"
                value={userName}
                onChange={e => setUserName(e.target.value)}
                fullWidth
                required
                sx={{ mt: 1, mb: 2 }}
                disabled={loading}
              />
              <TextField
                label="Email del Usuario"
                value={userEmail}
                onChange={e => setUserEmail(e.target.value)}
                type="email"
                fullWidth
                required
                sx={{ mb: 2 }}
                disabled={loading}
              />
              <TextField
                label="Contraseña"
                value={userPassword}
                onChange={e => setUserPassword(e.target.value)}
                type="password"
                fullWidth
                sx={{ mb: 2 }}
                helperText={editingUser ? "Dejar vacío para no cambiar la contraseña." : "Requerido para nuevos usuarios."}
                autoComplete="new-password"
                disabled={loading}
              />
              <Divider sx={{ mb: 1 }} />
              <Typography variant="subtitle2" mb={1}>Roles Asignados</Typography>
              <Box sx={{ maxHeight: 200, overflowY: "auto", border: "1px solid #ccc", p: 1, borderRadius: 1 }}>
                {roles.length === 0 ? (
                  <Typography color="text.secondary">No hay roles disponibles.</Typography>
                ) : (
                  roles.map((role) => (
                    <Box key={role.id} sx={{ display: "flex", alignItems: "center", mb: 0.5 }}>
                      <Checkbox
                        size="small"
                        checked={userRoles.includes(role.id)}
                        onChange={() => toggleUserRole(role.id)}
                        disabled={loading}
                        icon={<CheckBoxOutlineBlankIcon fontSize="small" />}
                        checkedIcon={<CheckBoxIcon fontSize="small" />}
                      />
                      <Typography>{role.name}</Typography>
                    </Box>
                  ))
                )}
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpenUserDialog(false)} disabled={loading}>Cancelar</Button>
              <Button
                type="submit"
                variant="contained"
                disabled={loading || !userName || !userEmail || (!editingUser && !userPassword.trim())} // Password is required for new users
              >
                {loading ? <CircularProgress size={24} /> : (editingUser ? "Guardar Cambios" : "Crear Usuario")}
              </Button>
            </DialogActions>
          </form>
        </Dialog>

        <Snackbar
          open={snack.open}
          autoHideDuration={4000}
          onClose={() => setSnack({ ...snack, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity={snack.severity} onClose={() => setSnack({ ...snack, open: false })} sx={{ width: '100%' }}>
            {snack.message}
          </Alert>
        </Snackbar>
      </Paper>
    </Box>
  );
};

export default RolesPermisosCrud;