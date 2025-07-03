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
      PaperProps={{ sx: { bgcolor: '#2d3748', color: '#e2e8f0', borderRadius: 2 } }}
    >
      <DialogTitle id="alert-dialog-title" sx={{ color: '#e2e8f0' }}>{title}</DialogTitle>
      <DialogContent>
        <Typography id="alert-dialog-description" sx={{ color: '#a0aec0' }}>
          {message}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} sx={{ color: '#a0aec0' }}>
          Cancelar
        </Button>
        <Button onClick={onConfirm} color="error" autoFocus sx={{ color: '#fc8181' }}>
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
// Recibe isGlobalAdmin como prop para una lógica más robusta
const EmpresasCrud = ({ tenantId, isAppReady, setParentSnack }) => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  const [openCompanyDialog, setOpenCompanyDialog] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState(''); // Añadido para la dirección
  const [editingCompany, setEditingCompany] = useState(null);
  const [companyDialogLoading, setCompanyDialogLoading] = useState(false);

  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmDialogData, setConfirmDialogData] = useState({ title: '', message: '', onConfirm: () => {} });

  // Determinar si el usuario es Super Admin.
  // Es mejor pasarla como prop desde App.jsx, pero si no, se puede leer de localStorage.
  const isGlobalAdmin = localStorage.getItem('isGlobalAdmin') === 'true';

  // Utilidad para manejar notificaciones (memorizada con useCallback)
  const showSnack = useCallback((message, severity = 'success') => {
    setSnack({ open: true, message, severity });
    // También llamar al snackbar padre si se proporciona
    if (setParentSnack) {
      setParentSnack(message, severity);
    }
  }, [setParentSnack]);

  // Fetch companies (memorizada con useCallback)
  const fetchCompanies = useCallback(async () => {
    // ¡LÓGICA CLAVE DE CARGA!
    // Cargar si la app está lista Y (es Super Admin O tiene un tenantId válido)
    if (!isAppReady || (!isGlobalAdmin && !tenantId)) {
      console.log('EmpresasCrud: Saltando fetchCompanies. Tenant ID:', tenantId, 'Is Global Admin:', isGlobalAdmin, 'App Ready:', isAppReady);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Endpoint para listar tenants/empresas
      // El backend debe manejar si es Super Admin (sin X-Tenant-ID) o admin de tenant (con X-Tenant-ID)
      const response = await api.get('/tenants'); // Asume que esta ruta lista todas las empresas para Super Admin
      const fetchedCompanies = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.data) // Manejo de respuesta paginada o directa
        ? response.data.data
        : [];
      setCompanies(fetchedCompanies);
      console.log('EmpresasCrud: Empresas cargadas:', fetchedCompanies.length);
      showSnack('Empresas cargadas exitosamente.', 'success'); // Notificación de éxito
    } catch (error) {
      console.error('EmpresasCrud: Error al cargar empresas:', error);
      const errorMessage = error.response?.data?.message || error.message;
      showSnack(`Error al cargar empresas: ${errorMessage}`, 'error');
      setCompanies([]); // Limpiar la lista en caso de error
    } finally {
      setLoading(false);
      console.log('EmpresasCrud: setLoading(false) llamado en fetchCompanies.');
    }
  }, [tenantId, isAppReady, isGlobalAdmin, showSnack]); // Añadir isGlobalAdmin a las dependencias

  // Efecto para la carga inicial de empresas
  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  // Handlers de UI y Diálogos
  const handleOpenCompanyDialog = (company = null) => {
    setEditingCompany(company);
    setCompanyName(company ? company.name : '');
    setCompanyAddress(company ? company.address : ''); // Cargar dirección si existe
    setOpenCompanyDialog(true);
    setCompanyDialogLoading(false);
  };

  const handleCloseCompanyDialog = () => {
    setOpenCompanyDialog(false);
    setEditingCompany(null);
    setCompanyName('');
    setCompanyAddress(''); // Limpiar dirección
    setCompanyDialogLoading(false);
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
    setCompanyDialogLoading(true);
    try {
      const companyData = { name: companyName.trim(), address: companyAddress.trim() }; // Incluir dirección
      if (editingCompany) {
        await api.put(`/tenants/${editingCompany.id}`, companyData); // Usar /tenants para PUT
        showSnack('Empresa actualizada.', 'success');
      } else {
        await api.post('/tenants', companyData); // Usar /tenants para POST
        showSnack('Empresa creada.', 'success');
      }
      await fetchCompanies();
      handleCloseCompanyDialog();
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
      setCompanyDialogLoading(false);
    }
  };

  const handleDeleteCompanyConfirm = useCallback(async (companyToDelete) => {
    setLoading(true);
    try {
      await api.delete(`/tenants/${companyToDelete.id}`); // Usar /tenants para DELETE
      showSnack('Empresa eliminada.', 'info');
      await fetchCompanies();
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
      setLoading(false);
      setConfirmDialogOpen(false);
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
      minHeight: 'calc(100vh - 64px)',
      bgcolor: '#004d80',
      color: '#fff',
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <BusinessIcon sx={{ fontSize: 32, color: '#fff', mr: 1 }} />
        <Typography variant="h5" sx={{ fontWeight: 600, color: '#fff' }}>
          Gestión de Empresas
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenCompanyDialog(null)}
          disabled={loading}
          sx={{
            borderRadius: 2,
            bgcolor: '#4CAF50',
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
            {/* Añadir campo de dirección */}
            <TextField
              label="Dirección"
              value={companyAddress}
              onChange={e => setCompanyAddress(e.target.value)}
              fullWidth
              sx={{ mb: 2 }}
              disabled={companyDialogLoading}
              aria-label="Dirección de la empresa"
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
  tenantId: PropTypes.string.isRequired, // <-- ¡Este debe ser PropTypes.string o null!
  isAppReady: PropTypes.bool.isRequired,
};

// --- Componente: CompanyCard (Tarjeta individual de Empresa) ---
const CompanyCard = React.memo(({ company, handleEdit, handleDelete }) => {
  return (
    <Paper
      sx={{
        bgcolor: '#283e51',
        borderRadius: 2,
        p: 2,
        boxShadow: '0 1px 0 rgba(9,30,66,.25)',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
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
            <EditIcon sx={{ fontSize: 18, color: '#b0c4de' }} />
          </IconButton>
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); handleDelete(company); }}
            aria-label={`Eliminar empresa ${company.name}`}
          >
            <DeleteIcon sx={{ fontSize: 18, color: '#b0c4de' }} />
          </IconButton>
        </Box>
      </Box>
      <Divider sx={{ mb: 1.5, bgcolor: 'rgba(255,255,255,0.2)' }} />
      <Typography variant="body2" sx={{ color: '#b0c4de' }}>ID: {company.id}</Typography>
      {company.address && ( // Mostrar dirección solo si existe
        <Typography variant="body2" sx={{ color: '#b0c4de' }}>Dirección: {company.address}</Typography>
      )}
    </Paper>
  );
});

CompanyCard.propTypes = {
  company: PropTypes.object.isRequired,
  handleEdit: PropTypes.func.isRequired,
  handleDelete: PropTypes.func.isRequired,
};

export default EmpresasCrud;
