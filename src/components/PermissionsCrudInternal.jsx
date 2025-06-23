// src/components/PermissionsCrudInternal.jsx
import React, { useState, useEffect } from "react";
import { api } from "../App";
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, List, ListItem, ListItemText, IconButton, Snackbar, Alert,
  CircularProgress,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";

const PermissionsCrudInternal = () => {
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: "", severity: "success" });

  const [openPermissionDialog, setOpenPermissionDialog] = useState(false);
  const [editPermissionId, setEditPermissionId] = useState(null);
  const [permissionName, setPermissionName] = useState("");

  const fetchPermissions = async () => {
    setLoading(true);
    try {
      const res = await api.get("/permissions");
      setPermissions(Array.isArray(res.data) ? res.data : res.data.data || []);
    } catch (err) {
      console.error("Error al cargar permisos:", err);
      setSnack({ open: true, message: "No se pudieron cargar los permisos", severity: "error" });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPermissions();
  }, []);

  const handleSavePermission = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editPermissionId) {
        await api.put(`/permissions/${editPermissionId}`, { name: permissionName });
        setSnack({ open: true, message: "Permiso actualizado", severity: "success" });
      } else {
        await api.post("/permissions", { name: permissionName });
        setSnack({ open: true, message: "Permiso creado", severity: "success" });
      }
      setOpenPermissionDialog(false);
      setPermissionName("");
      setEditPermissionId(null);
      fetchPermissions();
    } catch (err) {
      console.error("Error al guardar permiso:", err.response?.data || err.message);
      setSnack({ open: true, message: "Error al guardar permiso: " + (err.response?.data?.message || err.message), severity: "error" });
    }
    setLoading(false);
  };

  const handleDeletePermission = async (permissionToDelete) => {
    if (!window.confirm(`¿Eliminar permiso "${permissionToDelete.name}"?`)) return;
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

  const openCreatePermissionDialog = () => {
    setEditPermissionId(null);
    setPermissionName("");
    setOpenPermissionDialog(true);
  };

  const openEditPermissionDialog = (permissionToEdit) => {
    setEditPermissionId(permissionToEdit.id);
    setPermissionName(permissionToEdit.name);
    setOpenPermissionDialog(true);
  };

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h6">Permisos</Typography>
        <Button startIcon={<AddIcon />} variant="contained" color="success" onClick={openCreatePermissionDialog}>
          Nuevo Permiso
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
          <CircularProgress />
        </Box>
      ) : (
        <List sx={{ mt: 1 }}>
          {permissions.map((permission) => (
            <ListItem
              key={permission.id}
              sx={{ bgcolor: "#f8f9fa", borderRadius: 2, mb: 1 }}
              secondaryAction={
                <>
                  <IconButton color="primary" onClick={() => openEditPermissionDialog(permission)}>
                    <EditIcon />
                  </IconButton>
                  <IconButton color="error" onClick={() => handleDeletePermission(permission)}>
                    <DeleteIcon />
                  </IconButton>
                </>
              }
            >
              <ListItemText primary={<b>{permission.name}</b>} secondary={`Guard: ${permission.guard_name}`} />
            </ListItem>
          ))}
          {permissions.length === 0 && (
            <Typography sx={{ color: "#aaa", mt: 2 }}>No hay permisos creados.</Typography>
          )}
        </List>
      )}

      <Dialog open={openPermissionDialog} onClose={() => setOpenPermissionDialog(false)}>
        <DialogTitle>{editPermissionId ? "Editar Permiso" : "Nuevo Permiso"}</DialogTitle>
        <form onSubmit={handleSavePermission}>
          <DialogContent>
            <TextField
              label="Nombre del Permiso"
              value={permissionName}
              onChange={e => setPermissionName(e.target.value)}
              fullWidth
              autoFocus
              required
              sx={{ mt: 1 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenPermissionDialog(false)}>Cancelar</Button>
            <Button
              type="submit"
              variant="contained"
              startIcon={<SaveIcon />}
              color={editPermissionId ? "primary" : "success"}
              disabled={loading || !permissionName}
            >
              {editPermissionId ? "Guardar" : "Crear"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack({ ...snack, open: false })}
      >
        <Alert severity={snack.severity} onClose={() => setSnack({ ...snack, open: false })}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default PermissionsCrudInternal;