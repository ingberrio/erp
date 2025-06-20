// src/components/EmpresasCrud.jsx

import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Box, Paper, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, List, ListItem, ListItemText, IconButton, Snackbar, Alert, Divider
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import BusinessIcon from "@mui/icons-material/Business";
import SaveIcon from "@mui/icons-material/Save";

const API = "http://127.0.0.1:8000/api/tenants";

const EmpresasCrud = ({ token, tenantId }) => {
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: "", severity: "success" });

  // Para crear/editar
  const [openDialog, setOpenDialog] = useState(false);
  const [editEmpresaId, setEditEmpresaId] = useState(null);
  const [empresaNombre, setEmpresaNombre] = useState("");

  const axiosAuth = axios.create({
    baseURL: API,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "X-Tenant-ID": tenantId
    }
  });

  // Listar empresas
  const fetchEmpresas = async () => {
    setLoading(true);
    try {
      const res = await axiosAuth.get("");
      // Muestra la respuesta en consola para depuración
      console.log("Respuesta empresas:", res.data);
      setEmpresas(Array.isArray(res.data) ? res.data : res.data.data || []);
    } catch (err) {
      setSnack({ open: true, message: "No se pudieron cargar las empresas", severity: "error" });
    }
    setLoading(false);
  };

  useEffect(() => { if (token) fetchEmpresas(); }, [token]);

  // Crear/editar empresa
  const handleSaveEmpresa = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editEmpresaId) {
        await axiosAuth.put(`/${editEmpresaId}`, { name: empresaNombre });
        setSnack({ open: true, message: "Empresa actualizada", severity: "success" });
      } else {
        await axiosAuth.post("", { name: empresaNombre });
        setSnack({ open: true, message: "Empresa creada", severity: "success" });
      }
      setOpenDialog(false);
      setEmpresaNombre("");
      setEditEmpresaId(null);
      fetchEmpresas();
    } catch {
      setSnack({ open: true, message: "Error al guardar empresa", severity: "error" });
    }
    setLoading(false);
  };

  // Eliminar empresa
  const handleDeleteEmpresa = async (empresa) => {
    if (!window.confirm(`¿Eliminar empresa "${empresa.name}"?`)) return;
    setLoading(true);
    try {
      await axiosAuth.delete(`/${empresa.id}`);
      setSnack({ open: true, message: "Empresa eliminada", severity: "info" });
      fetchEmpresas();
    } catch {
      setSnack({ open: true, message: "No se pudo eliminar la empresa", severity: "error" });
    }
    setLoading(false);
  };

  // Abrir modal editar/crear
  const abrirDialogCrear = () => {
    setEditEmpresaId(null);
    setEmpresaNombre("");
    setOpenDialog(true);
  };

  const abrirDialogEditar = (empresa) => {
    setEditEmpresaId(empresa.id);
    setEmpresaNombre(empresa.name);
    setOpenDialog(true);
  };

  return (
    <Box sx={{ width: "100%", flex: 1, display: "flex", flexDirection: "column" }}>
      <Paper
        sx={{
          p: { xs: 2, sm: 4 },
          maxWidth: 700,
          mx: "auto",
          width: "100%",
          mt: { xs: 2, sm: 6 },
          minHeight: 400
        }}
      >
        <Typography variant="h5" gutterBottom>
          <BusinessIcon sx={{ mr: 1, mb: -0.5 }} />
          Gestión de Empresas
        </Typography>
        <Divider sx={{ my: 2 }} />

        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="h6">Empresas</Typography>
          <Button startIcon={<AddIcon />} variant="contained" color="success" onClick={abrirDialogCrear}>
            Nueva Empresa
          </Button>
        </Box>

        <List sx={{ mt: 1 }}>
          {empresas.map((empresa) => (
            <ListItem
              key={empresa.id}
              sx={{ bgcolor: "#f8f9fa", borderRadius: 2, mb: 1 }}
              secondaryAction={
                <>
                  <IconButton color="primary" onClick={() => abrirDialogEditar(empresa)}>
                    <EditIcon />
                  </IconButton>
                  <IconButton color="error" onClick={() => handleDeleteEmpresa(empresa)}>
                    <DeleteIcon />
                  </IconButton>
                </>
              }
            >
              <ListItemText
                primary={<b>{empresa.name}</b>}
                secondary={<span style={{ color: "#888" }}>ID: {empresa.id}</span>}
              />
            </ListItem>
          ))}
          {empresas.length === 0 && !loading && (
            <Typography sx={{ color: "#aaa", mt: 2 }}>No hay empresas creadas.</Typography>
          )}
        </List>

        {/* Modal crear/editar */}
        <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
          <DialogTitle>{editEmpresaId ? "Editar Empresa" : "Nueva Empresa"}</DialogTitle>
          <form onSubmit={handleSaveEmpresa}>
            <DialogContent>
              <TextField
                label="Nombre de empresa"
                value={empresaNombre}
                onChange={e => setEmpresaNombre(e.target.value)}
                fullWidth
                autoFocus
                required
                sx={{ mt: 1 }}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpenDialog(false)}>Cancelar</Button>
              <Button
                type="submit"
                variant="contained"
                startIcon={<SaveIcon />}
                color={editEmpresaId ? "primary" : "success"}
                disabled={loading || !empresaNombre}
              >
                {editEmpresaId ? "Guardar" : "Crear"}
              </Button>
            </DialogActions>
          </form>
        </Dialog>

        {/* Snackbars */}
        <Snackbar
          open={snack.open}
          autoHideDuration={3000}
          onClose={() => setSnack({ ...snack, open: false })}
        >
          <Alert severity={snack.severity} onClose={() => setSnack({ ...snack, open: false })}>
            {snack.message}
          </Alert>
        </Snackbar>
      </Paper>
    </Box>
  );
};

export default EmpresasCrud;
