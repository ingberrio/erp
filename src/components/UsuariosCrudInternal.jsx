// src/components/UsuariosCrudInternal.jsx
import React, { useState, useEffect, useCallback } from "react";
import { api } from "../App";
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, List, ListItem, ListItemText, IconButton, Snackbar, Alert,
  CircularProgress, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Avatar, Checkbox, Divider,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SearchIcon from '@mui/icons-material/Search';
import SaveIcon from "@mui/icons-material/Save";
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import GroupIcon from '@mui/icons-material/Group';


const UsuariosCrudInternal = ({ tenantId, isAppReady }) => {
  const [users, setUsers] = useState([]);
  const [rolesForAssignment, setRolesForAssignment] = useState([]);
  const [loading, setLoading] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: "", severity: "success" });

  const [openUserDialog, setOpenUserDialog] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userSelectedRoleIds, setUserSelectedRoleIds] = useState([]);
  const [userSearch, setUserSearch] = useState("");

  // --- Fetch Users Function (para la tabla principal) ---
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    console.log("UsuariosCrudInternal: fetchUsers attempting to load...");
    try {
      const res = await api.get("/users?with_roles=true");
      setUsers(Array.isArray(res.data) ? res.data : res.data.data || []);
      console.log("UsuariosCrudInternal: Users loaded successfully:", res.data);
      // Para cerrar el snackbar si era de error, usa el callback de setSnack
      setSnack(prevSnack => {
        if (prevSnack.open && prevSnack.severity === "error") {
          return { ...prevSnack, open: false };
        }
        return prevSnack;
      });
    } catch (err) {
      console.error("UsuariosCrudInternal: Error loading users:", err);
      setSnack({ open: true, message: "No se pudieron cargar los usuarios", severity: "error" });
    }
    setLoading(false);
  }, []); // <--- ¡Importante! Arreglo de dependencias vacío para que la función sea estable

  // --- Fetch Roles Function (para el diálogo de asignación) ---
  const fetchRolesForAssignment = useCallback(async () => {
    console.log("UsuariosCrudInternal: fetchRolesForAssignment attempting to load...");
    try {
      const res = await api.get("/roles");
      setRolesForAssignment(Array.isArray(res.data) ? res.data : res.data.data || []);
      console.log("UsuariosCrudInternal: Roles for assignment loaded successfully.");
      // Para cerrar el snackbar si era de error, usa el callback de setSnack
      setSnack(prevSnack => {
        if (prevSnack.open && prevSnack.severity === "error") {
          return { ...prevSnack, open: false };
        }
        return prevSnack;
      });
    } catch (err) {
      console.error("UsuariosCrudInternal: Error loading roles for assignment:", err);
      setSnack({ open: true, message: "No se pudieron cargar los roles para asignación", severity: "error" });
    }
  }, []); // <--- ¡Importante! Arreglo de dependencias vacío para que la función sea estable

  // --- useEffect para cargar usuarios al montar y cuando tenantId/isAppReady cambien ---
  useEffect(() => {
    console.log("UsuariosCrudInternal: Main useEffect condition check. tenantId:", tenantId, "isAppReady:", isAppReady);
    if (tenantId && isAppReady) {
      console.log("UsuariosCrudInternal: Condition met for initial user load. Calling fetchUsers.");
      fetchUsers();
    } else {
      console.log("UsuariosCrudInternal: Condition NOT met for initial load. Waiting for tenantId and isAppReady to be true.");
    }
  }, [tenantId, isAppReady, fetchUsers]); // Dependencias: tenantId, isAppReady, y fetchUsers (que ahora es estable)

  // --- Filtering Logic ---
  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    user.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  // --- Dialog Handlers ---
  const handleOpenUserDialog = (user = null) => {
    setEditingUser(user);
    setUserName(user ? user.name : "");
    setUserEmail(user ? user.email : "");
    setUserPassword("");
    if (tenantId && isAppReady) {
      fetchRolesForAssignment(); // Carga los roles solo al abrir el diálogo
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
  };

  // --- CRUD Operations ---
  const handleSaveUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userData = {
        name: userName,
        email: userEmail,
        ...(!editingUser || userPassword.trim() !== "" ? { password: userPassword } : {}),
        roles: userSelectedRoleIds,
      };

      let res;
      if (editingUser) {
        res = await api.put(`/users/${editingUser.id}`, userData);
        setSnack({ open: true, message: "Usuario actualizado", severity: "success" });
        setUsers(prevUsers => prevUsers.map(u => u.id === res.data.user.id ? res.data.user : u));
      } else {
        res = await api.post("/users", userData);
        setSnack({ open: true, message: "Usuario creado", severity: "success" });
        setUsers(prevUsers => [...prevUsers, res.data.user]);
      }
      handleCloseUserDialog();
    } catch (err) {
      console.error("Error al guardar usuario:", err.response?.data || err.message);
      const errorMessage = err.response?.data?.message || err.message;
      setSnack({ open: true, message: "Error al guardar usuario: " + errorMessage, severity: "error" });
    }
    setLoading(false);
  };

  const handleDeleteUser = async (userToDelete) => {
    if (!window.confirm(`¿Eliminar usuario "${userToDelete.name}"? Esta acción es irreversible.`)) return;
    setLoading(true);
    try {
      await api.delete(`/users/${userToDelete.id}`);
      setSnack({ open: true, message: "Usuario eliminado", severity: "info" });
      setUsers(prevUsers => prevUsers.filter(u => u.id !== userToDelete.id));
    } catch (err) {
      console.error("No se pudo eliminar el usuario:", err);
      const errorMessage = err.response?.data?.message || err.message;
      setSnack({ open: true, message: "No se pudo eliminar el usuario: " + errorMessage, severity: "error" });
    }
    setLoading(false);
  };

  const toggleUserRole = (roleId) => {
    setUserSelectedRoleIds(prevSelected =>
      prevSelected.includes(roleId)
        ? prevSelected.filter(id => id !== roleId)
        : [...prevSelected, roleId]
    );
  };

  return (
    <Box>
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

      <TableContainer component={Paper}>
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

      {/* User Dialog (Create/Edit) */}
      <Dialog open={openUserDialog} onClose={handleCloseUserDialog} maxWidth="sm" fullWidth>
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
              required={!editingUser && userPassword.trim() === ""}
              disabled={loading}
            />
            <Divider sx={{ mb: 1 }} />
            <Typography variant="subtitle2" mb={1}>Roles Asignados</Typography>
            <Box sx={{ maxHeight: 200, overflowY: "auto", border: "1px solid #ccc", p: 1, borderRadius: 1 }}>
              {rolesForAssignment.length === 0 ? (
                <Typography color="text.secondary">No hay roles disponibles.</Typography>
              ) : (
                rolesForAssignment.map((role) => (
                  <Box key={role.id} sx={{ display: "flex", alignItems: "center", mb: 0.5 }}>
                    <Checkbox
                      size="small"
                      checked={userSelectedRoleIds.includes(role.id)}
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
            <Button onClick={handleCloseUserDialog} disabled={loading}>Cancelar</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={loading || !userName || !userEmail || (!editingUser && userPassword.trim() === "")}
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
        <Alert severity={snack.severity} onClose={() => setSnack({ ...snack, open: false })}>
          {/* Eliminado sx={{ width: '100%' }} para evitar posibles saltos visuales */}
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default UsuariosCrudInternal;
