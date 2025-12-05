// src/components/RolesCrudInternal.jsx
import React, { useState, useEffect } from "react";
import { api } from "../App"; // Importar la instancia global de Axios
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, List, ListItem, ListItemText, IconButton, Snackbar, Alert,
  CircularProgress, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Checkbox, Divider,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import SearchIcon from '@mui/icons-material/Search';
import ShieldIcon from '@mui/icons-material/Shield'; // Icono para el título
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';


const RolesCrudInternal = () => {
  const [roles, setRoles] = useState([]);
  const [perms, setPerms] = useState([]); // Para la lista de permisos disponibles en el diálogo
  const [loading, setLoading] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: "", severity: "success" });

  const [openRoleDialog, setOpenRoleDialog] = useState(false);
  const [editingRole, setEditingRole] = useState(null); // Guarda el objeto de rol que se está editando
  const [roleName, setRoleName] = useState("");
  const [roleDesc, setRoleDesc] = useState(""); // Nuevo campo para la descripción del rol
  const [selectedPermsForRole, setSelectedPermsForRole] = useState([]); // IDs de permisos seleccionados para el rol
  const [roleSearch, setRoleSearch] = useState(""); // Estado para el campo de búsqueda de roles

  // --- Fetch Data Functions ---
  const fetchRoles = async () => {
    setLoading(true);
    try {
      // Assuming your backend can include permissions and user_count in roles endpoint
      const res = await api.get("/roles?with_permissions=true&with_users_count=true");
      setRoles(Array.isArray(res.data) ? res.data : res.data.data || []);
    } catch (err) {
      console.error("Error loading roles:", err);
      setSnack({ open: true, message: "Could not load roles", severity: "error" });
    }
    setLoading(false);
  };

  const fetchPermissionsForAssignment = async () => {
    try {
      const res = await api.get("/permissions"); // Obtener todos los permisos para asignación
      setPerms(Array.isArray(res.data) ? res.data : res.data.data || []);
    } catch (err) {
      console.error("Error loading permissions for assignment:", err);
      setSnack({ open: true, message: "Could not load permissions for assignment", severity: "error" });
    }
  };

  useEffect(() => {
    fetchRoles();
    fetchPermissionsForAssignment(); // Cargar permisos al inicio para el diálogo de rol
  }, []);

  // --- Filtering Logic ---
  const filteredRoles = roles.filter(role =>
    role.name.toLowerCase().includes(roleSearch.toLowerCase()) ||
    (role.description && role.description.toLowerCase().includes(roleSearch.toLowerCase()))
  );

  // --- Dialog Handlers ---
  const handleOpenRoleDialog = (role = null) => {
    setEditingRole(role);
    setRoleName(role ? role.name : "");
    setRoleDesc(role ? (role.description || "") : ""); // Set description
    setSelectedPermsForRole(role ? (role.permissions?.map(perm => perm.id) || []) : []); // Set selected permissions
    setOpenRoleDialog(true);
  };

  const handleCloseRoleDialog = () => {
    setOpenRoleDialog(false);
    setEditingRole(null);
    setRoleName("");
    setRoleDesc("");
    setSelectedPermsForRole([]);
  };

  // --- CRUD Operations ---
  const handleSaveRole = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const roleData = {
        name: roleName,
        description: roleDesc,
        permissions: selectedPermsForRole, // Send an array of permission IDs
      };

      if (editingRole) {
        await api.put(`/roles/${editingRole.id}`, roleData);
        setSnack({ open: true, message: "Role updated", severity: "success" });
      } else {
        await api.post("/roles", roleData);
        setSnack({ open: true, message: "Role created", severity: "success" });
      }
      handleCloseRoleDialog();
      fetchRoles(); // Refresh list
    } catch (err) {
      console.error("Error saving role:", err.response?.data || err.message);
      setSnack({ open: true, message: "Error saving role: " + (err.response?.data?.message || err.message), severity: "error" });
    }
    setLoading(false);
  };

  const handleDeleteRole = async (roleToDelete) => {
    if (!window.confirm(`Delete role "${roleToDelete.name}"? This action is irreversible.`)) return;
    setLoading(true);
    try {
      await api.delete(`/roles/${roleToDelete.id}`);
      setSnack({ open: true, message: "Role deleted", severity: "info" });
      fetchRoles();
    } catch (err) {
      console.error("Could not delete role:", err);
      setSnack({ open: true, message: "Could not delete role", severity: "error" });
    }
    setLoading(false);
  };

  // --- Permission Assignment Logic for Roles ---
  const togglePermissionForRole = (permId) => {
    setSelectedPermsForRole(prevSelected =>
      prevSelected.includes(permId)
        ? prevSelected.filter(id => id !== permId)
        : [...prevSelected, permId]
    );
  };

  return (
    <Box>
      <Box sx={{ display: "flex", mb: 2, gap: 2, alignItems: "center", flexWrap: "wrap" }}>
        <TextField
          size="small"
          placeholder="Search roles..."
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
                    + NEW ROLE
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: "#fafbfc" }}>
              <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Permissions</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Assigned Users</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
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
                                    No roles found.
                </TableCell>
              </TableRow>
            ) : (
              filteredRoles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell>
                    <Typography fontWeight={500}>{role.name}</Typography>
                  </TableCell>
                  <TableCell>
                    {role.description || <span style={{ color: "#bbb" }}>No description</span>}
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
                                                +{role.permissions.length - 2} more
                      </Typography>
                    )}
                    {(role.permissions || []).length === 0 && (
                      <Typography component="span" sx={{ color: "#bbb", fontSize: 13 }}>
                                                None
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

      {/* Role Dialog (Create/Edit) */}
      <Dialog open={openRoleDialog} onClose={handleCloseRoleDialog} maxWidth="xs" fullWidth>
        <DialogTitle>{editingRole ? "Edit Role" : "New Role"}</DialogTitle>
        <form onSubmit={handleSaveRole}>
          <DialogContent>
            <TextField
                            label="Role Name"
              value={roleName}
              onChange={e => setRoleName(e.target.value)}
              fullWidth
              required
              sx={{ mt: 1, mb: 2 }}
              disabled={loading}
            />
            <TextField
                            label="Role Description"
              value={roleDesc}
              onChange={e => setRoleDesc(e.target.value)}
              fullWidth
              multiline
              rows={2}
              sx={{ mb: 1 }}
              disabled={loading}
            />
            <Divider sx={{ my: 2 }} />
                        <Typography variant="subtitle2" mb={1}>Assigned Permissions</Typography>
            <Box sx={{ maxHeight: 180, overflowY: "auto", border: "1px solid #ccc", p: 1, borderRadius: 1 }}>
              {perms.length === 0 ? (
                                <Typography color="text.secondary">No permissions configured.</Typography>
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
                        <Button onClick={handleCloseRoleDialog} disabled={loading}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={loading || !roleName}
            >
                            {loading ? <CircularProgress size={24} /> : (editingRole ? "Save Changes" : "Create Role")}
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

export default RolesCrudInternal;
