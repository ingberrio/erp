// src/components/PermissionsCrudInternal.jsx
import React, { useState, useEffect, useCallback } from "react";
import { api } from "../App";
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, IconButton, Snackbar, Alert,
  CircularProgress, InputAdornment, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import SearchIcon from '@mui/icons-material/Search';


const PermissionsCrudInternal = ({ tenantId, isAppReady }) => {
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: "", severity: "success" });

  const [openPermissionDialog, setOpenPermissionDialog] = useState(false);
  const [editingPerm, setEditingPerm] = useState(null);
  const [permissionName, setPermissionName] = useState("");
  const [permissionDesc, setPermissionDesc] = useState("");
  const [permSearch, setPermSearch] = useState("");

  // Nuevos estados para el diálogo de confirmación de eliminación
  const [openConfirmDialog, setOpenConfirmDialog] = useState(false);
  const [permToDelete, setPermToDelete] = useState(null); // Guarda el permiso a eliminar

  // --- Fetch Data Functions ---
  const fetchPermissions = useCallback(async () => {
    setLoading(true);
    console.log("PermissionsCrudInternal: fetchPermissions attempting to load...");
    try {
      const res = await api.get("/permissions");
      setPermissions(Array.isArray(res.data) ? res.data : res.data.data || []);
      console.log("PermissionsCrudInternal: Permissions loaded successfully:", res.data);
      setSnack(prevSnack => { // Usa el callback para evitar la función re-creada
        if (prevSnack.open && prevSnack.severity === "error") {
          return { ...prevSnack, open: false };
        }
        return prevSnack;
      });
    } catch (err) {
      console.error("PermissionsCrudInternal: Error loading permissions:", err);
      setSnack({ open: true, message: "No se pudieron cargar los permisos", severity: "error" });
    }
    setLoading(false);
  }, []); // Dependencias vacías para useCallback para estabilidad

  // Se ejecuta CUANDO tenantId Y isAppReady son true.
  useEffect(() => {
    console.log("PermissionsCrudInternal: useEffect condition check. tenantId:", tenantId, "isAppReady:", isAppReady);
    if (tenantId && isAppReady) {
      console.log("PermissionsCrudInternal: Condition met! Calling fetchPermissions.");
      fetchPermissions();
    } else {
      console.log("PermissionsCrudInternal: Condition NOT met. Waiting for tenantId and isAppReady to be true.");
    }
  }, [tenantId, isAppReady, fetchPermissions]);

  // --- Filtering Logic ---
  const filteredPerms = permissions.filter(perm =>
    perm.name.toLowerCase().includes(permSearch.toLowerCase()) ||
    (perm.description && perm.description.toLowerCase().includes(permSearch.toLowerCase()))
  );

  // --- Dialog Handlers (Create/Edit Permission) ---
  const handleOpenPermDialog = (perm = null) => {
    setEditingPerm(perm);
    setPermissionName(perm ? perm.name : "");
    setPermissionDesc(perm ? (perm.description || "") : "");
    setOpenPermissionDialog(true);
  };

  const handleClosePermDialog = () => {
    setOpenPermissionDialog(false);
    setEditingPerm(null);
    setPermissionName("");
    setPermissionDesc("");
  };

  // --- CRUD Operations (Save) ---
  const handleSavePermission = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const permData = {
        name: permissionName,
        description: permissionDesc,
      };

      let res;
      if (editingPerm) {
        res = await api.put(`/permissions/${editingPerm.id}`, permData);
        setSnack({ open: true, message: "Permission updated", severity: "success" });
        // Optimización: Actualiza el permiso en el estado directamente
        setPermissions(prevPerms => prevPerms.map(p => p.id === res.data.id ? res.data : p)); // Asume que la API devuelve el permiso actualizado
      } else {
        res = await api.post("/permissions", permData);
        setSnack({ open: true, message: "Permission created", severity: "success" });
        // Optimización: Añade el nuevo permiso al estado directamente
        setPermissions(prevPerms => [...prevPerms, res.data]); // Asume que la API devuelve el nuevo permiso
      }
      handleClosePermDialog();
    } catch (err) {
      console.error("Error saving permission:", err.response?.data || err.message);
      const errorMessage = err.response?.data?.message || err.message;
      setSnack({ open: true, message: "Error saving permission: " + errorMessage, severity: "error" });
    }
    setLoading(false);
  };

  // --- Delete Confirmation Handler ---
  // Esta función se llama al hacer clic en el botón de eliminar
  const confirmDeletePermission = (perm) => {
    setPermToDelete(perm);
    setOpenConfirmDialog(true);
  };

  // Esta función se llama si el usuario confirma la eliminación
  const handleDeleteConfirmed = async () => {
    setOpenConfirmDialog(false); // Cierra el diálogo de confirmación
    if (!permToDelete) return; // Si por alguna razón no hay permiso a eliminar, sale

    setLoading(true);
    try {
      await api.delete(`/permissions/${permToDelete.id}`);
      setSnack({ open: true, message: "Permission deleted", severity: "info" });
      // Optimización: Elimina el permiso del estado directamente
      setPermissions(prevPerms => prevPerms.filter(p => p.id !== permToDelete.id));
      setPermToDelete(null); // Limpia el permiso a eliminar
    } catch (err) {
      console.error("Could not delete permission:", err);
      const errorMessage = err.response?.data?.message || err.message;
      setSnack({ open: true, message: "Could not delete permission: " + errorMessage, severity: "error" });
    }
    setLoading(false);
  };

  const handleCancelDelete = () => {
    setOpenConfirmDialog(false);
    setPermToDelete(null);
  };

  return (
    <Box>
      <Box sx={{ display: "flex", mb: 2, gap: 2, alignItems: "center", flexWrap: "wrap" }}>
        <TextField
          size="small"
                    placeholder="Search permissions..."
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
                    + NEW PERMISSION
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: "#fafbfc" }}>
              <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
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
                                    No permissions found.
                </TableCell>
              </TableRow>
            ) : (
              filteredPerms.map((perm) => (
                <TableRow key={perm.id}>
                  <TableCell>
                    <Typography fontWeight={500}>{perm.name}</Typography>
                  </TableCell>
                  <TableCell>{perm.description || <span style={{ color: "#bbb" }}>No description</span>}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      onClick={() => handleOpenPermDialog(perm)}
                      color="primary"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      onClick={() => confirmDeletePermission(perm)} // <-- Llama a la nueva función de confirmación
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

      {/* Permission Dialog (Create/Edit) */}
      <Dialog open={openPermissionDialog} onClose={handleClosePermDialog} maxWidth="xs" fullWidth>
        <DialogTitle>{editingPerm ? "Edit Permission" : "New Permission"}</DialogTitle>
        <form onSubmit={handleSavePermission}>
          <DialogContent>
            <TextField
                            label="Permission Name"
              value={permissionName}
              onChange={e => setPermissionName(e.target.value)}
              fullWidth
              required
              sx={{ mt: 1, mb: 2 }}
              disabled={loading}
            />
            <TextField
                            label="Permission Description"
              value={permissionDesc}
              onChange={e => setPermissionDesc(e.target.value)}
              fullWidth
              multiline
              rows={2}
              sx={{ mb: 1 }}
              disabled={loading}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClosePermDialog} disabled={loading}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={loading || !permissionName}
            >
              {loading ? <CircularProgress size={24} /> : (editingPerm ? "Save Changes" : "Create Permission")}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Custom Confirmation Dialog for Delete */}
      <Dialog
        open={openConfirmDialog}
        onClose={handleCancelDelete}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle id="alert-dialog-title">{"Confirm Deletion"}</DialogTitle>
        <DialogContent>
          <Typography id="alert-dialog-description">
            Are you sure you want to delete the permission "
            {permToDelete ? permToDelete.name : ''}"? This action is irreversible.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete} disabled={loading}>Cancel</Button>
          <Button onClick={handleDeleteConfirmed} color="error" variant="contained" disabled={loading} autoFocus>
            Delete
          </Button>
        </DialogActions>
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

export default PermissionsCrudInternal;
