// src/components/EmpresasCrud.jsx

import React, { useState, useEffect } from "react";
// Importa la instancia global de Axios desde App.jsx
import { api } from "../App";
import {
  Box, Paper, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, List, ListItem, ListItemText, IconButton, Snackbar, Alert, Divider,
  CircularProgress // Añadimos CircularProgress para el estado de carga
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import BusinessIcon from "@mui/icons-material/Business";
import SaveIcon from "@mui/icons-material/Save";

// La URL base ya está configurada en la instancia global 'api' de Axios.
// Por lo tanto, no necesitamos redefinirla aquí.
// const API = "http://127.0.0.1:8000/api/tenants"; // <-- Ya no es necesario

// EmpresasCrud ahora no necesita recibir 'token' ni 'tenantId' como props,
// porque la instancia global 'api' ya maneja esos headers.
const EmpresasCrud = (tenantId) => {
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: "", severity: "success" });

  // Para crear/editar
  const [openDialog, setOpenDialog] = useState(false);
  const [editEmpresaId, setEditEmpresaId] = useState(null);
  const [empresaNombre, setEmpresaNombre] = useState("");

  // Elimina la creación de axiosAuth aquí, usaremos la instancia global 'api'.
  // const axiosAuth = axios.create({ ... }); // <-- ELIMINADO

  // Listar empresas
  const fetchEmpresas = async () => {
    setLoading(true);
    try {
      // Usa la instancia global 'api' y especifica el endpoint relativo.
      const res = await api.get("/tenants"); // Endpoint para listar tenants/empresas
      console.log("Respuesta empresas:", res.data);
      setEmpresas(Array.isArray(res.data) ? res.data : res.data.data || []);
    } catch (err) {
      console.error("Error al cargar empresas:", err); // Añadir log de error para depuración
      setSnack({ open: true, message: "No se pudieron cargar las empresas", severity: "error" });
    }
    setLoading(false);
  };

  // Se ejecuta una vez al montar el componente, ya que 'api' debería estar configurado.
  // También se puede añadir 'api' a las dependencias si la instancia pudiera cambiar (poco probable).
  useEffect(() => {
    if (tenantId) { // Solo si tenantId existe
      fetchEmpresas();
    }
  }, [tenantId]); 

  // Crear/editar empresa
  const handleSaveEmpresa = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editEmpresaId) {
        // Usa la instancia global 'api' para la petición PUT
        await api.put(`/tenants/${editEmpresaId}`, { name: empresaNombre });
        setSnack({ open: true, message: "Empresa actualizada", severity: "success" });
      } else {
        // Usa la instancia global 'api' para la petición POST
        await api.post("/tenants", { name: empresaNombre });
        setSnack({ open: true, message: "Empresa creada", severity: "success" });
      }
      setOpenDialog(false);
      setEmpresaNombre("");
      setEditEmpresaId(null);
      fetchEmpresas(); // Refrescar la lista de empresas después de guardar
    } catch (err) {
      console.error("Error al guardar empresa:", err); // Añadir log de error para depuración
      setSnack({ open: true, message: "Error al guardar empresa", severity: "error" });
    }
    setLoading(false);
  };

  // Eliminar empresa
  const handleDeleteEmpresa = async (empresa) => {
    // Reemplaza window.confirm con un modal de confirmación de Material-UI si quieres
    if (!window.confirm(`¿Eliminar empresa "${empresa.name}"?`)) return;
    setLoading(true);
    try {
      // Usa la instancia global 'api' para la petición DELETE
      await api.delete(`/tenants/${empresa.id}`);
      setSnack({ open: true, message: "Empresa eliminada", severity: "info" });
      fetchEmpresas(); // Refrescar la lista de empresas después de eliminar
    } catch (err) {
      console.error("No se pudo eliminar la empresa:", err); // Añadir log de error para depuración
      setSnack({ open: true, message: "No se pudo eliminar la empresa", severity: "error" });
    }
    setLoading(false);
  };

  // Abrir modal crear
  const abrirDialogCrear = () => {
    setEditEmpresaId(null);
    setEmpresaNombre("");
    setOpenDialog(true);
  };

  // Abrir modal editar
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

        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
          <Typography variant="h6">Empresas</Typography>
          <Button startIcon={<AddIcon />} variant="contained" color="success" onClick={abrirDialogCrear}>
            Nueva Empresa
          </Button>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
            <CircularProgress />
          </Box>
        ) : (
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
            {empresas.length === 0 && (
              <Typography sx={{ color: "#aaa", mt: 2 }}>No hay empresas creadas.</Typography>
            )}
          </List>
        )}


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
