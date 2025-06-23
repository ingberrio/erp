// src/components/UsuariosCrudInternal.jsx
import React, { useState, useEffect } from "react";
import { api } from "../App"; // Importar la instancia global de Axios
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
import GroupIcon from '@mui/icons-material/Group'; // Para el icono del título, aunque el título principal está en el padre


const UsuariosCrudInternal = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]); // Para la lista de roles disponibles en el diálogo
  const [loading, setLoading] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: "", severity: "success" });

  const [openUserDialog, setOpenUserDialog] = useState(false);
  const [editingUser, setEditingUser] = useState(null); // Guarda el objeto de usuario que se está editando
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userRoles, setUserRoles] = useState([]); // IDs de los roles seleccionados para el usuario
  const [userSearch, setUserSearch] = useState(""); // Estado para el campo de búsqueda de usuarios

  // --- Fetch Data Functions ---
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get("/users?with_roles=true"); // Asumiendo que el backend puede incluir roles
      setUsers(Array.isArray(res.data) ? res.data : res.data.data || []);
    } catch (err) {
      console.error("Error al cargar usuarios:", err);
      setSnack({ open: true, message: "No se pudieron cargar los usuarios", severity: "error" });
    }
    setLoading(false);
  };

  const fetchRolesForAssignment = async () => {
    try {
      const res = await api.get("/roles"); // Obtener todos los roles para asignación
      setRoles(Array.isArray(res.data) ? res.data : res.data.data || []);
    } catch (err) {
      console.error("Error al cargar roles para asignación:", err);
      setSnack({ open: true, message: "No se pudieron cargar los roles para asignación", severity: "error" });
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchRolesForAssignment(); // Cargar roles al inicio para el diálogo de usuario
  }, []);

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
    setUserPassword(""); // Never pre-fill password for security
    setUserRoles(user ? (user.roles?.map(role => role.id) || []) : []); // Set selected roles
    setOpenUserDialog(true);
  };

  const handleCloseUserDialog = () => {
    setOpenUserDialog(false);
    setEditingUser(null);
    setUserName("");
    setUserEmail("");
    setUserPassword("");
    setUserRoles([]);
  };

  // --- CRUD Operations ---
  const handleSaveUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userData = {
        name: userName,
        email: userEmail,
        // La contraseña solo se envía si es un nuevo usuario o si se ha introducido un valor en la edición
        ...(!editingUser || userPassword.trim() !== "" ? { password: userPassword } : {}),
        roles: userRoles, // Send an array of role IDs
      };

      if (editingUser) {
        await api.put(`/users/${editingUser.id}`, userData);
        setSnack({ open: true, message: "Usuario actualizado", severity: "success" });
      } else {
        await api.post("/users", userData);
        setSnack({ open: true, message: "Usuario creado", severity: "success" });
      }
      handleCloseUserDialog();
      fetchUsers(); // Refresh list
    } catch (err) {
      console.error("Error al guardar usuario:", err.response?.data || err.message);
      setSnack({ open: true, message: "Error al guardar usuario: " + (err.response?.data?.message || err.message), severity: "error" });
    }
    setLoading(false);
  };

  const handleDeleteUser = async (userToDelete) => {
    if (!window.confirm(`¿Eliminar usuario "${userToDelete.name}"? Esta acción es irreversible.`)) return;
    setLoading(true);
    try {
      await api.delete(`/users/${userToDelete.id}`);
      setSnack({ open: true, message: "Usuario eliminado", severity: "info" });
      fetchUsers();
    } catch (err) {
      console.error("No se pudo eliminar el usuario:", err);
      setSnack({ open: true, message: "No se pudo eliminar el usuario", severity: "error" });
    }
    setLoading(false);
  };

  // --- Role Assignment Logic for Users ---
  const toggleUserRole = (roleId) => {
    setUserRoles(prevSelected =>
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
          NUEVO USUARIO
        </Button>
      </Box>

      <TableContainer component={Paper}> {/* Usar Paper para el fondo de la tabla */}
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
              required={!editingUser && userPassword.trim() === ""} // Solo requerido si es nuevo y el campo está vacío
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
            <Button onClick={handleCloseUserDialog} disabled={loading}>Cancelar</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={loading || !userName || !userEmail || (!editingUser && userPassword.trim() === "")} // Password is required for new users
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
    </Box>
  );
};

export default UsuariosCrudInternal;
