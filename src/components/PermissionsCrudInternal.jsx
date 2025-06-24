// src/components/PermissionsCrudInternal.jsx
import React, { useState, useEffect, useCallback } from "react"; // <-- Importa useCallback
import { api } from "../App";
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, List, ListItem, ListItemText, IconButton, Snackbar, Alert,
  CircularProgress, InputAdornment, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import SearchIcon from '@mui/icons-material/Search';


const PermissionsCrudInternal = ({ tenantId, isAppReady }) => { // <-- Recibe las props
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: "", severity: "success" });

  const [openPermissionDialog, setOpenPermissionDialog] = useState(false);
  const [editingPerm, setEditingPerm] = useState(null);
  const [permissionName, setPermissionName] = useState("");
  const [permissionDesc, setPermissionDesc] = useState("");
  const [permSearch, setPermSearch] = useState("");

  // --- Fetch Data Functions ---
  const fetchPermissions = useCallback(async () => {
    setLoading(true);
    console.log("PermissionsCrudInternal: fetchPermissions attempting to load...");
    try {
      const res = await api.get("/permissions");
      setPermissions(Array.isArray(res.data) ? res.data : res.data.data || []);
      console.log("PermissionsCrudInternal: Permissions loaded successfully:", res.data);
      if (snack.open && snack.severity === "error") {
        setSnack(prevSnack => ({ ...prevSnack, open: false }));
      }
    } catch (err) {
      console.error("PermissionsCrudInternal: Error loading permissions:", err);
      setSnack({ open: true, message: "No se pudieron cargar los permisos", severity: "error" });
    }
    setLoading(false);
  }, [snack.open, snack.severity]);

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

  // --- Dialog Handlers ---
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

  // --- CRUD Operations ---
  const handleSavePermission = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const permData = {
        name: permissionName,
        description: permissionDesc,
      };

      if (editingPerm) {
        await api.put(`/permissions/${editingPerm.id}`, permData);
        setSnack({ open: true, message: "Permiso actualizado", severity: "success" });
      } else {
        await api.post("/permissions", permData);
        setSnack({ open: true, message: "Permiso creado", severity: "success" });
      }
      handleClosePermDialog();
      fetchPermissions();
    } catch (err) {
      console.error("Error al guardar permiso:", err.response?.data || err.message);
      setSnack({ open: true, message: "Error al guardar permiso: " + (err.response?.data?.message || err.message), severity: "error" });
    }
    setLoading(false);
  };

  const handleDeletePermission = async (permissionToDelete) => {
    if (!window.confirm(`¿Eliminar permiso "${permissionToDelete.name}"? Esta acción es irreversible.`)) return;
    setLoading(true);
    try {
      await api.delete(`/permissions/${permissionToDelete.id}`);
      setSnack({ open: true, message: "Permiso eliminado", severity: "info" });
      fetchPermissions();
    } catch (err) {
      console.error("No se pudo eliminar el permiso:", err);
      setSnack({ open: true, message: "No se pudo eliminar el permiso", severity: "error" });
    }
    setLoading(false);
  };

  return (
    <Box>
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

      <TableContainer component={Paper}>
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

      {/* Permission Dialog (Create/Edit) */}
      <Dialog open={openPermissionDialog} onClose={handleClosePermDialog} maxWidth="xs" fullWidth>
        <DialogTitle>{editingPerm ? "Editar Permiso" : "Nuevo Permiso"}</DialogTitle>
        <form onSubmit={handleSavePermission}>
          <DialogContent>
            <TextField
              label="Nombre del Permiso"
              value={permissionName}
              onChange={e => setPermissionName(e.target.value)}
              fullWidth
              required
              sx={{ mt: 1, mb: 2 }}
              disabled={loading}
            />
            <TextField
              label="Descripción del Permiso"
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
            <Button onClick={handleClosePermDialog} disabled={loading}>Cancelar</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={loading || !permissionName}
            >
              {loading ? <CircularProgress size={24} /> : (editingPerm ? "Guardar Cambios" : "Crear Permiso")}
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

export default PermissionsCrudInternal;
