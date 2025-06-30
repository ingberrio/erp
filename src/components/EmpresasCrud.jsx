// src/components/EmpresasCrud.jsx

import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { api } from '../App'; // Importa la instancia global de Axios

import {
  Box, Typography, Button, CircularProgress, Snackbar, Alert,
  TextField, Paper, Divider, IconButton, Grid,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import BusinessIcon from '@mui/icons-material/Business';
import SaveIcon from '@mui/icons-material/Save';

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

// --- Componente principal del Módulo de Empresas ---
const EmpresasCrud = ({ tenantId, isAppReady }) => {
  const [companies, setCompanies] = useState([]); // Renombrado de 'empresas' a 'companies' para consistencia
  const [loading, setLoading] = useState(true); // Estado de carga principal
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  // Para crear/editar empresa
  const [openCompanyDialog, setOpenCompanyDialog] = useState(false); // Renombrado de 'openDialog'
  const [companyName, setCompanyName] = useState(''); // Renombrado de 'empresaNombre'
  const [editingCompany, setEditingCompany] = useState(null); // Renombrado de 'editEmpresaId' (ahora guarda el objeto completo)
  const [companyDialogLoading, setCompanyDialogLoading] = useState(false); // Estado de carga para el diálogo

  // Para el diálogo de confirmación
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmDialogData, setConfirmDialogData] = useState({ title: '', message: '', onConfirm: () => {} });

  // Utilidad para manejar notificaciones (memorizada con useCallback)
  const showSnack = useCallback((message, severity = 'success') => {
    setSnack({ open: true, message, severity });
  }, []);

  // Fetch companies (memorizada con useCallback)
  const fetchCompanies = useCallback(async () => {
    if (!tenantId || !isAppReady) {
      console.log('EmpresasCrud: Saltando fetchCompanies. Tenant ID:', tenantId, 'App Ready:', isAppReady);
      setLoading(false); // Desactiva el loading si no está listo
      return;
    }
    setLoading(true); // Activa el loading antes de la llamada API
    try {
      const response = await api.get('/tenants'); // Endpoint para listar tenants/empresas
      const fetchedCompanies = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.data) // Manejo de respuesta paginada o directa
        ? response.data.data
        : [];
      setCompanies(fetchedCompanies);
      console.log('EmpresasCrud: Empresas cargadas:', fetchedCompanies.length);
    } catch (error) {
      console.error('EmpresasCrud: Error al cargar empresas:', error);
      showSnack('Error al cargar empresas.', 'error');
    } finally {
      setLoading(false); // Desactiva el loading SIEMPRE
      console.log('EmpresasCrud: setLoading(false) llamado en fetchCompanies.');
    }
  }, [tenantId, isAppReady, showSnack]); // Dependencias para useCallback

  // Efecto para la carga inicial de empresas
  useEffect(() => {
    fetchCompanies(); // Llama a fetchCompanies cuando el componente se monta o sus dependencias cambian
  }, [fetchCompanies]); // fetchCompanies es la única dependencia porque ya está memorizada

  // Handlers de UI y Diálogos
  const handleOpenCompanyDialog = (company = null) => {
    setEditingCompany(company);
    setCompanyName(company ? company.name : '');
    setOpenCompanyDialog(true);
    setCompanyDialogLoading(false); // Asegura que el diálogo no esté cargando al abrir
  };

  const handleCloseCompanyDialog = () => {
    setOpenCompanyDialog(false);
    setEditingCompany(null);
    setCompanyName('');
    setCompanyDialogLoading(false); // Asegura que el diálogo no esté cargando al cerrar
  };

  const handleSaveCompany = async (e) => {
    e.preventDefault();
    if (!companyName.trim()) {
      showSnack('El nombre de la empresa es obligatorio.', 'warning');
      return;
    }
    if (companyName.length > 100) {
      showSnack('El nombre de la empresa no puede exceder los 100 caracteres.', 'warning');
      return;
    }
    if (/[<>{}]/.test(companyName)) {
      showSnack('El nombre no puede contener caracteres especiales como <, >, o {}.', 'warning');
      return;
    }
    setCompanyDialogLoading(true); // Activa el loading del diálogo
    try {
      const companyData = { name: companyName };
      if (editingCompany) {
        await api.put(`/tenants/${editingCompany.id}`, companyData);
        showSnack('Empresa actualizada.', 'success');
      } else {
        await api.post('/tenants', companyData);
        showSnack('Empresa creada.', 'success');
      }
      await fetchCompanies(); // Refresca la lista de empresas
      handleCloseCompanyDialog(); // Cierra el diálogo
    } catch (err) {
      console.error('EmpresasCrud: Error al guardar empresa:', err);
      const errorMessage = err.response?.data?.message || err.message;
      if (err.response?.status === 400) {
        showSnack(`Datos inválidos: ${errorMessage}`, 'error');
      } else if (err.response?.status === 403) {
        showSnack('No tienes permisos para realizar esta acción.', 'error');
      } else {
        showSnack(`Error al guardar empresa: ${errorMessage}`, 'error');
      }
    } finally {
      setCompanyDialogLoading(false); // Desactiva el loading del diálogo SIEMPRE
    }
  };

  // Eliminar empresa (memorizada con useCallback para el diálogo de confirmación)
  const handleDeleteCompanyConfirm = useCallback(async (companyToDelete) => {
    setLoading(true); // Activa el loading principal
    try {
      await api.delete(`/tenants/${companyToDelete.id}`);
      showSnack('Empresa eliminada.', 'info');
      await fetchCompanies(); // Refresca la lista de empresas
    } catch (err) {
      console.error('EmpresasCrud: Error al eliminar empresa:', err);
      const errorMessage = err.response?.data?.message || err.message;
      if (err.response?.status === 400) {
        showSnack(`Datos inválidos: ${errorMessage}`, 'error');
      } else if (err.response?.status === 403) {
        showSnack('No tienes permisos para realizar esta acción.', 'error');
      } else {
        showSnack(`Error al eliminar empresa: ${errorMessage}`, 'error');
      }
    } finally {
      setLoading(false); // Desactiva el loading principal SIEMPRE
      setConfirmDialogOpen(false); // Cierra el diálogo de confirmación
    }
  }, [fetchCompanies, showSnack]);

  const handleDeleteCompanyClick = (companyToDelete) => {
    setConfirmDialogData({
      title: 'Confirmar Eliminación de Empresa',
      message: `¿Estás seguro de eliminar la empresa "${companyToDelete.name}"?`,
      onConfirm: () => handleDeleteCompanyConfirm(companyToDelete),
    });
    setConfirmDialogOpen(true);
  };

  return (
    <Box sx={{
      p: { xs: 2, sm: 3 },
      minHeight: 'calc(100vh - 64px)', // Ajusta a la altura de la AppBar
      bgcolor: '#004d80', // Color de fondo azul oscuro como Cultivo
      color: '#fff', // Color de texto blanco para contraste
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <BusinessIcon sx={{ fontSize: 32, color: '#fff', mr: 1 }} /> {/* Icono blanco */}
        <Typography variant="h5" sx={{ fontWeight: 600, color: '#fff' }}> {/* Título blanco */}
          Gestión de Empresas
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenCompanyDialog(null)}
          disabled={loading} // Deshabilita el botón si la página está cargando
          sx={{
            borderRadius: 2,
            bgcolor: '#4CAF50', // Verde como el botón de Cultivo
            '&:hover': { bgcolor: '#43A047' }
          }}
        >
          Nueva Empresa
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', color: '#fff' }}>
          <CircularProgress color="inherit" />
          <Typography variant="body1" sx={{ ml: 2, color: '#fff' }}>Cargando empresas...</Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {companies.length === 0 ? (
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ color: '#aaa', textAlign: 'center', width: '100%', mt: 5 }}>
                No hay empresas. ¡Añade una para empezar!
              </Typography>
            </Grid>
          ) : (
            companies.map((company) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={company.id}>
                <CompanyCard
                  company={company}
                  handleEdit={handleOpenCompanyDialog}
                  handleDelete={handleDeleteCompanyClick}
                />
              </Grid>
            ))
          )}
        </Grid>
      )}

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

      <Dialog open={openCompanyDialog} onClose={handleCloseCompanyDialog} maxWidth="xs" fullWidth>
        <DialogTitle>{editingCompany ? 'Editar Empresa' : 'Crear Nueva Empresa'}</DialogTitle>
        <form onSubmit={handleSaveCompany}>
          <DialogContent>
            <TextField
              label="Nombre de la Empresa"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              fullWidth
              required
              sx={{ mt: 1, mb: 2 }}
              disabled={companyDialogLoading}
              helperText={!companyName.trim() && openCompanyDialog ? 'El nombre de la empresa es obligatorio.' : ''}
              error={!companyName.trim() && openCompanyDialog}
              inputProps={{ maxLength: 100 }}
              aria-label="Nombre de la empresa"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseCompanyDialog} disabled={companyDialogLoading}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={companyDialogLoading || !companyName.trim()}>
              {companyDialogLoading ? <CircularProgress size={24} /> : (editingCompany ? 'Guardar Cambios' : 'Crear Empresa')}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

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

EmpresasCrud.propTypes = {
  tenantId: PropTypes.string.isRequired,
  isAppReady: PropTypes.bool.isRequired,
};

// --- Componente: CompanyCard (Tarjeta individual de Empresa) ---
const CompanyCard = React.memo(({ company, handleEdit, handleDelete }) => {
  return (
    <Paper
      sx={{
        bgcolor: '#283e51', // Fondo de la tarjeta más oscuro que el fondo general
        borderRadius: 2,
        p: 2,
        boxShadow: '0 1px 0 rgba(9,30,66,.25)',
        color: '#fff', // Texto de la tarjeta blanco
        display: 'flex',
        flexDirection: 'column',
        height: '100%', // Asegura que las tarjetas en el Grid tengan la misma altura
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, color: '#fff', flexGrow: 1 }}>
          {company.name}
        </Typography>
        <Box>
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); handleEdit(company); }}
            aria-label={`Editar empresa ${company.name}`}
          >
            <EditIcon sx={{ fontSize: 18, color: '#b0c4de' }} /> {/* Icono más claro */}
          </IconButton>
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); handleDelete(company); }}
            aria-label={`Eliminar empresa ${company.name}`}
          >
            <DeleteIcon sx={{ fontSize: 18, color: '#b0c4de' }} /> {/* Icono más claro */}
          </IconButton>
        </Box>
      </Box>
      <Divider sx={{ mb: 1.5, bgcolor: 'rgba(255,255,255,0.2)' }} /> {/* Divisor más claro */}
      <Typography variant="body2" sx={{ color: '#b0c4de' }}>ID: {company.id}</Typography> {/* Texto ID más claro */}
      {/* Puedes añadir más detalles de la empresa aquí si tu modelo los tiene */}
      {/* Por ejemplo: <Typography variant="body2" sx={{ color: '#b0c4de' }}>Dirección: {company.address}</Typography> */}
    </Paper>
  );
});

CompanyCard.propTypes = {
  company: PropTypes.object.isRequired,
  handleEdit: PropTypes.func.isRequired,
  handleDelete: PropTypes.func.isRequired,
};

export default EmpresasCrud;
