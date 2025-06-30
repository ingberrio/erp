import React, { useState, useEffect, useCallback, useMemo } from "react";
import PropTypes from 'prop-types';
import { api } from "../App";
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Avatar, Checkbox, Divider, IconButton, Snackbar, Alert, CircularProgress, InputAdornment,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SearchIcon from '@mui/icons-material/Search';
import GroupIcon from '@mui/icons-material/Group';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';

// Theme constants (optional, for consistency)
const themeConstants = {
  primaryBg: '#004d80',
  secondaryBg: '#283e51',
  accentGreen: '#4CAF50',
  accentGreenHover: '#43A047',
  divider: 'rgba(255,255,255,0.2)',
  textPrimary: '#fff',
  textSecondary: '#aaa',
  inputBorder: 'rgba(255,255,255,0.5)',
  inputBorderHover: 'rgba(255,255,255,0.8)',
};

// --- Componente de Diálogo de Confirmación Genérico ---
const ConfirmationDialog = ({ open, title, message, onConfirm, onCancel }) => {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">{title}</DialogTitle>
      <DialogContent>
        <Typography id="alert-dialog-description">
          {message}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} color="primary">
          Cancelar
        </Button>
        <Button onClick={onConfirm} color="error" autoFocus>
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

const UsuariosCrudInternal = ({ tenantId, isAppReady }) => {
  const [users, setUsers] = useState([]);
  const [rolesForAssignment, setRolesForAssignment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [snack, setSnack] = useState({ open: false, message: "", severity: "success" });
  const [openUserDialog, setOpenUserDialog] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userSelectedRoleIds, setUserSelectedRoleIds] = useState([]);
  const [userSearch, setUserSearch] = useState("");
  const [userDialogLoading, setUserDialogLoading] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmDialogData, setConfirmDialogData] = useState({ title: '', message: '', onConfirm: () => {} });

  const showSnack = useCallback((message, severity = 'success') => {
    setSnack({ open: true, message, severity });
  }, []);

  const fetchUsers = useCallback(async () => {
    if (!tenantId || !isAppReady) {
      console.log("UsuariosCrudInternal: Skipping fetchUsers. Tenant ID:", tenantId, "App Ready:", isAppReady);
      setLoading(false);
      return;
    }
    setLoading(true);
    console.log("UsuariosCrudInternal: fetchUsers attempting to load...");
    try {
      const res = await api.get("/users?with_roles=true");
      setUsers(Array.isArray(res.data) ? res.data : res.data.data || []);
      console.log("UsuariosCrudInternal: Users loaded successfully:", res.data);
    } catch (err) {
      console.error("UsuariosCrudInternal: Error loading users:", err);
      showSnack("No se pudieron cargar los usuarios", "error");
    } finally {
      setLoading(false);
    }
  }, [tenantId, isAppReady, showSnack]);

  const fetchRolesForAssignment = useCallback(async () => {
    console.log("UsuariosCrudInternal: fetchRolesForAssignment attempting to load...");
    try {
      const res = await api.get("/roles");
      setRolesForAssignment(Array.isArray(res.data) ? res.data : res.data.data || []);
      console.log("UsuariosCrudInternal: Roles for assignment loaded successfully.");
    } catch (err) {
      console.error("UsuariosCrudInternal: Error al cargar roles para asignación:", err);
      showSnack("No se pudieron cargar los roles para asignación", "error");
    }
  }, [showSnack]);

  useEffect(() => {
    console.log("UsuariosCrudInternal: Main useEffect condition check. tenantId:", tenantId, "isAppReady:", isAppReady);
    if (tenantId && isAppReady) {
      console.log("UsuariosCrudInternal: Condición cumplida para la carga inicial de usuarios. Llamando a fetchUsers.");
      fetchUsers();
    } else {
      console.log("UsuariosCrudInternal: Condición NO cumplida para la carga inicial. Esperando que tenantId e isAppReady sean true.");
    }
  }, [tenantId, isAppReady, fetchUsers]);

  const filteredUsers = useMemo(() => {
    return users.filter(user =>
      user.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      user.email.toLowerCase().includes(userSearch.toLowerCase())
    );
  }, [users, userSearch]);

  const handleOpenUserDialog = (user = null) => {
    setEditingUser(user);
    setUserName(user ? user.name : "");
    setUserEmail(user ? user.email : "");
    setUserPassword("");
    if (tenantId && isAppReady) {
      fetchRolesForAssignment();
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

  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!userName.trim()) {
      showSnack("El nombre del usuario es obligatorio.", "warning");
      return;
    }
    if (!userEmail.trim()) {
      showSnack("El email del usuario es obligatorio.", "warning");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userEmail)) {
      showSnack("Por favor, ingrese un email válido.", "warning");
      return;
    }
    if (!editingUser && !userPassword.trim()) {
      showSnack("La contraseña es obligatoria para nuevos usuarios.", "warning");
      return;
    }
    if (userPassword && userPassword.length < 8) {
      showSnack("La contraseña debe tener al menos 8 caracteres.", "warning");
      return;
    }
    setUserDialogLoading(true);
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
        showSnack("Usuario actualizado", "success");
      } else {
        res = await api.post("/users", userData);
        showSnack("Usuario creado", "success");
      }
      await fetchUsers();
      handleCloseUserDialog();
    } catch (err) {
      console.error("Error al guardar usuario:", err);
      const errorMessage = err.response?.data?.message || err.message;
      if (err.response?.status === 400) {
        showSnack(`Datos inválidos: ${errorMessage}`, "error");
      } else if (err.response?.status === 403) {
        showSnack("No tienes permisos para realizar esta acción.", "error");
      } else {
        showSnack(`Error al guardar usuario: ${errorMessage}`, "error");
      }
    } finally {
      setUserDialogLoading(false);
    }
  };

  const handleDeleteUser = useCallback(async (userToDelete) => {
    setConfirmDialogData({
      title: 'Confirmar Eliminación de Usuario',
      message: `¿Estás seguro de eliminar al usuario "${userToDelete.name}"? Esta acción es irreversible.`,
      onConfirm: async () => {
        setLoading(true);
        try {
          await api.delete(`/users/${userToDelete.id}`);
          showSnack("Usuario eliminado", "info");
          await fetchUsers();
        } catch (err) {
          console.error("No se pudo eliminar el usuario:", err);
          const errorMessage = err.response?.data?.message || err.message;
          if (err.response?.status === 400) {
            showSnack(`Datos inválidos: ${errorMessage}`, "error");
          } else if (err.response?.status === 403) {
            showSnack("No tienes permisos para realizar esta acción.", "error");
          } else {
            showSnack(`Error al eliminar usuario: ${errorMessage}`, "error");
          }
        } finally {
          setLoading(false);
          setConfirmDialogOpen(false);
        }
      },
    });
    setConfirmDialogOpen(true);
  }, [fetchUsers, showSnack]);

  const toggleUserRole = (roleId) => {
    setUserSelectedRoleIds(prevSelected =>
      prevSelected.includes(roleId)
        ? prevSelected.filter(id => id !== roleId)
        : [...prevSelected, roleId]
    );
  };

  return (
    <Box sx={{
      p: { xs: 2, sm: 3 },
      minHeight: 'calc(100vh - 64px)',
      bgcolor: themeConstants.primaryBg,
      color: themeConstants.textPrimary,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <GroupIcon sx={{ fontSize: 32, color: themeConstants.textPrimary, mr: 1 }} />
        <Typography variant="h5" sx={{ fontWeight: 600, color: themeConstants.textPrimary }}>
          Gestión de Usuarios
        </Typography>
      </Box>

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
            '& .MuiInputBase-input': { color: themeConstants.textPrimary },
            '& .MuiOutlinedInput-notchedOutline': { borderColor: themeConstants.inputBorder },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: themeConstants.inputBorderHover },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: themeConstants.textPrimary },
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
            bgcolor: themeConstants.accentGreen,
            '&:hover': { bgcolor: themeConstants.accentGreenHover },
          }}
          onClick={() => handleOpenUserDialog(null)}
        >
          + NUEVO USUARIO
        </Button>
      </Box>

      <TableContainer component={Paper} sx={{ bgcolor: themeConstants.secondaryBg, borderRadius: 2, boxShadow: '0 1px 0 rgba(9,30,66,.25)' }}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: '#3a506b' }}>
              <TableCell sx={{ fontWeight: 600, color: themeConstants.textPrimary }}>Nombre</TableCell>
              <TableCell sx={{ fontWeight: 600, color: themeConstants.textPrimary }}>Email</TableCell>
              <TableCell sx={{ fontWeight: 600, color: themeConstants.textPrimary }}>Roles Asignados</TableCell>
              <TableCell sx={{ fontWeight: 600, color: themeConstants.textPrimary }} align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ color: themeConstants.textPrimary }}>
                  <CircularProgress size={24} color="inherit" sx={{ my: 3 }} />
                  <Typography>Cargando usuarios...</Typography>
                </TableCell>
              </TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ color: themeConstants.textSecondary, py: 5 }}>
                  No hay usuarios encontrados.
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id} sx={{ '&:nth-of-type(odd)': { bgcolor: 'rgba(255,255,255,0.05)' } }}>
                  <TableCell sx={{ color: themeConstants.textPrimary }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Avatar sx={{ width: 32, height: 32, fontSize: 14, bgcolor: themeConstants.accentGreen }}>
                        {user.name.charAt(0).toUpperCase()}
                      </Avatar>
                      <Typography fontWeight={500}>{user.name}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ color: themeConstants.textPrimary }}>{user.email}</TableCell>
                  <TableCell sx={{ color: themeConstants.textPrimary }}>
                    {(user.roles || []).map(r => (
                      <Box
                        component="span"
                        key={r.id}
                        sx={{
                          bgcolor: themeConstants.accentGreen,
                          px: 1,
                          py: 0.2,
                          mr: 0.5,
                          borderRadius: 1,
                          fontSize: 13,
                          color: themeConstants.textPrimary,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {r.name}
                      </Box>
                    ))}
                    {(user.roles || []).length === 0 && (
                      <Typography component="span" sx={{ color: themeConstants.textSecondary, fontSize: 13 }}>
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

      <Dialog open={openUserDialog} onClose={handleCloseUserDialog} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: themeConstants.secondaryBg, color: themeConstants.textPrimary, borderRadius: 2 } }}
      >
        <DialogTitle sx={{ bgcolor: '#3a506b', color: themeConstants.textPrimary }}>
          {editingUser ? "Editar Usuario" : "Nuevo Usuario"}
        </DialogTitle>
        <form onSubmit={handleSaveUser}>
          <DialogContent sx={{ pt: '20px !important' }}>
            <TextField
              label="Nombre del Usuario"
              value={userName}
              onChange={e => setUserName(e.target.value)}
              fullWidth
              required
              sx={{
                mt: 1, mb: 2,
                '& .MuiInputBase-input': { color: themeConstants.textPrimary },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: themeConstants.inputBorder },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: themeConstants.inputBorderHover },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: themeConstants.textPrimary },
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
              sx={{
                mb: 2,
                '& .MuiInputBase-input': { color: themeConstants.textPrimary },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: themeConstants.inputBorder },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: themeConstants.inputBorderHover },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: themeConstants.textPrimary },
              }}
              disabled={userDialogLoading}
            />
            <TextField
              label="Contraseña"
              value={userPassword}
              onChange={e => setUserPassword(e.target.value)}
              type="password"
              fullWidth
              sx={{
                mb: 2,
                '& .MuiInputBase-input': { color: themeConstants.textPrimary },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: themeConstants.inputBorder },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: themeConstants.inputBorderHover },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: themeConstants.textPrimary },
              }}
              helperText={editingUser ? "Dejar vacío para no cambiar la contraseña." : "Requerido para nuevos usuarios."}
              autoComplete="new-password"
              required={!editingUser && userPassword.trim() === ""}
              disabled={userDialogLoading}
            />
            <Divider sx={{ my: 2, bgcolor: themeConstants.divider }} />
            <Typography variant="subtitle2" sx={{ color: themeConstants.textPrimary }} mb={1}>Roles Asignados</Typography>
            <Box sx={{ maxHeight: 200, overflowY: "auto", border: `1px solid ${themeConstants.inputBorder}`, p: 1, borderRadius: 1 }}>
              {rolesForAssignment.length === 0 ? (
                <Typography color="text.secondary" sx={{ color: themeConstants.textSecondary }}>No hay roles disponibles.</Typography>
              ) : (
                rolesForAssignment.map((role) => (
                  <Box key={role.id} sx={{ display: "flex", alignItems: "center", mb: 0.5 }}>
                    <Checkbox
                      size="small"
                      checked={userSelectedRoleIds.includes(role.id)}
                      onChange={() => toggleUserRole(role.id)}
                      disabled={userDialogLoading}
                      icon={<CheckBoxOutlineBlankIcon fontSize="small" sx={{ color: 'rgba(255,255,255,0.7)' }} />}
                      checkedIcon={<CheckBoxIcon fontSize="small" sx={{ color: themeConstants.accentGreen }} />}
                      sx={{ color: 'rgba(255,255,255,0.7)' }}
                    />
                    <Typography sx={{ color: themeConstants.textPrimary }}>{role.name}</Typography>
                  </Box>
                ))
              )}
            </Box>
          </DialogContent>
          <DialogActions sx={{ bgcolor: '#3a506b' }}>
            <Button onClick={handleCloseUserDialog} disabled={userDialogLoading} sx={{ color: '#b0c4de' }}>Cancelar</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={userDialogLoading || !userName || !userEmail || (!editingUser && userPassword.trim() === "")}
              sx={{
                bgcolor: themeConstants.accentGreen,
                '&:hover': { bgcolor: themeConstants.accentGreenHover },
              }}
            >
              {userDialogLoading ? <CircularProgress size={24} color="inherit" /> : (editingUser ? "Guardar Cambios" : "Crear Usuario")}
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
          {snack.message}
        </Alert>
      </Snackbar>

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
  tenantId: PropTypes.string.isRequired,
  isAppReady: PropTypes.bool.isRequired,
};

export default UsuariosCrudInternal;