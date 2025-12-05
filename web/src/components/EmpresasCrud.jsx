// src/components/EmpresasCrud.jsx
import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { api } from '../App';
import {
  Box, Typography, Button, CircularProgress, Snackbar, Alert,
  TextField, Paper, Divider, IconButton, Grid,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import BusinessIcon from '@mui/icons-material/Business'; // Importar icono de negocio/instalación

// Importar el nuevo componente de gestión de instalaciones
import TenantFacilityManagement from './TenantFacilityManagement';

const EmpresasCrud = ({ tenantId, isAppReady, setParentSnack, isGlobalAdmin }) => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [companyContactEmail, setCompanyContactEmail] = useState('');
  const [editingCompany, setEditingCompany] = useState(null);
  const [dialogLoading, setDialogLoading] = useState(false);

  // --- Nuevos estados para el diálogo de gestión de instalaciones ---
  const [openFacilitiesDialog, setOpenFacilitiesDialog] = useState(false);
  const [selectedCompanyTenantId, setSelectedCompanyTenantId] = useState(null);

  const fetchCompanies = useCallback(async () => {
    // --- CAMBIO CLAVE AQUÍ: Asegurarse de que la app esté lista y el rol sea correcto ---
    if (!isAppReady || (!isGlobalAdmin && !tenantId)) {
      console.log("EmpresasCrud: Saltando fetchCompanies. Tenant ID:", tenantId, "Is Global Admin:", isGlobalAdmin, "App Ready:", isAppReady);
      setLoading(false); // Asegúrate de que el loading se desactive si se salta
      return;
    }

    console.log("EmpresasCrud: Iniciando fetchCompanies. Tenant ID:", tenantId, "Is Global Admin:", isGlobalAdmin);
    setLoading(true);
    try {
      // Si es global admin, la API de tenants debería devolver todos los tenants
      // Si es un usuario de tenant, la API de companies (tenants) debería filtrar por su tenantId
      const response = await api.get('/tenants'); // Asume que /api/tenants devuelve las "empresas"
      const fetchedCompanies = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.data)
        ? response.data.data
        : [];
      setCompanies(fetchedCompanies);
      console.log("EmpresasCrud: Empresas cargadas:", fetchedCompanies.length);
    } catch (error) {
      console.error('EmpresasCrud: Error fetching companies:', error);
      setParentSnack('Error loading companies.', 'error');
    } finally {
      setLoading(false);
    }
  }, [tenantId, isAppReady, isGlobalAdmin, setParentSnack]); // Añadidas isGlobalAdmin y isAppReady a las dependencias

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]); // Dependencia del useCallback

  const handleOpenDialog = (company = null) => {
    setEditingCompany(company);
    setCompanyName(company ? company.name : '');
    setCompanyContactEmail(company ? (company.contact_email || '') : '');
    setOpenDialog(true);
    setDialogLoading(false);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingCompany(null);
    setCompanyName('');
    setCompanyContactEmail('');
    setDialogLoading(false);
  };

  const handleSaveCompany = async (e) => {
    e.preventDefault();
    if (!companyName.trim()) {
      setParentSnack('Company name is required.', 'warning');
      return;
    }
    if (companyName.length > 255) {
      setParentSnack('Company name cannot exceed 255 characters.', 'warning');
      return;
    }
    if (companyContactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyContactEmail)) {
      setParentSnack('Contact email is not valid.', 'warning');
      return;
    }

    setDialogLoading(true);
    try {
      const companyData = {
        name: companyName,
        contact_email: companyContactEmail || null,
      };

      if (editingCompany) {
        await api.put(`/tenants/${editingCompany.id}`, companyData);
        setParentSnack('Company updated.', 'success');
      } else {
        await api.post('/tenants', companyData);
        setParentSnack('Company created.', 'success');
      }
      await fetchCompanies();
      handleCloseDialog();
    } catch (err) {
      console.error('Error al guardar empresa:', err);
      const errorMessage = err.response?.data?.message || err.message;
      if (err.response?.status === 422) {
        const errors = err.response?.data?.details;
        if (errors) {
          const firstError = Object.values(errors)[0][0];
          setParentSnack(`Validation error: ${firstError}`, 'error');
        } else {
          setParentSnack(`Invalid data: ${errorMessage}`, 'error');
        }
      } else if (err.response?.status === 403) {
        setParentSnack('No tienes permisos para realizar esta acción.', 'error');
      } else {
        setParentSnack(`Error saving company: ${errorMessage}`, 'error');
      }
    } finally {
      setDialogLoading(false);
    }
  };

  const handleDeleteCompany = async (companyToDelete) => {
    setDialogLoading(true);
    try {
      await api.delete(`/tenants/${companyToDelete.id}`);
      setParentSnack('Company deleted.', 'info');
      await fetchCompanies();
    } catch (err) {
      console.error('Error al eliminar empresa:', err);
      const errorMessage = err.response?.data?.message || err.message;
      if (err.response?.status === 403) {
        setParentSnack('You do not have permission to perform this action.', 'error');
      } else {
        setParentSnack(`Error deleting company: ${errorMessage}`, 'error');
      }
    } finally {
      setDialogLoading(false);
    }
  };

  // --- Nuevos handlers para el diálogo de gestión de instalaciones ---
  const handleOpenFacilitiesDialog = (company) => {
    setSelectedCompanyTenantId(company.id);
    setOpenFacilitiesDialog(true);
  };

  const handleCloseFacilitiesDialog = () => {
    setOpenFacilitiesDialog(false);
    setSelectedCompanyTenantId(null);
  };

  return (
    <Box sx={{
      p: { xs: 2, sm: 3 },
      minHeight: 'calc(100vh - 64px)',
      bgcolor: '#004d80',
      color: '#fff',
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 600, color: '#fff' }}>
          Company Management
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog(null)}
          disabled={loading}
          sx={{
            borderRadius: 2,
            bgcolor: '#4CAF50',
            '&:hover': { bgcolor: '#43A047' },
          }}
        >
          New Company
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', color: '#fff' }}>
          <CircularProgress color="inherit" />
          <Typography variant="body1" sx={{ ml: 2, color: '#fff' }}>Loading companies...</Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {companies.length === 0 ? (
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ color: '#aaa', textAlign: 'center', mt: 5 }}>
                No companies registered. Add one to get started!
              </Typography>
            </Grid>
          ) : (
            companies.map((company) => (
              <Grid item xs={12} sm={6} md={4} key={company.id}>
                <Paper elevation={1} sx={{ p: 2, bgcolor: '#283e51', borderRadius: 2, color: '#fff' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: '#fff' }}>
                      {company.name}
                    </Typography>
                    <Box>
                      <IconButton size="small" onClick={() => handleOpenDialog(company)} aria-label={`Edit ${company.name}`}>
                        <EditIcon sx={{ fontSize: 18, color: '#b0c4de' }} />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDeleteCompany(company)} aria-label={`Delete ${company.name}`}>
                        <DeleteIcon sx={{ fontSize: 18, color: '#fc8181' }} />
                      </IconButton>
                    </Box>
                  </Box>
                  <Divider sx={{ mb: 1.5, bgcolor: 'rgba(255,255,255,0.2)' }} />
                  <Typography variant="body2" color="text.secondary" sx={{ color: '#a0aec0' }}>
                    ID: {company.id}
                  </Typography>
                  {company.contact_email && (
                    <Typography variant="body2" color="text.secondary" sx={{ color: '#a0aec0' }}>
                      Email: {company.contact_email}
                    </Typography>
                  )}
                  <Typography variant="body2" color="text.secondary" sx={{ color: '#a0aec0' }}>
                    Created: {new Date(company.created_at).toLocaleDateString()}
                  </Typography>
                  {/* --- Nuevo botón para gestionar instalaciones --- */}
                  <Button
                    variant="outlined"
                    startIcon={<BusinessIcon />}
                    onClick={() => handleOpenFacilitiesDialog(company)}
                    sx={{
                      mt: 2,
                      borderRadius: 1,
                      borderColor: '#b0c4de',
                      color: '#b0c4de',
                      '&:hover': {
                        bgcolor: 'rgba(255,255,255,0.1)',
                        borderColor: '#fff',
                      },
                      width: '100%', // Ocupa todo el ancho de la tarjeta
                    }}
                  >
                    Manage Facilities
                  </Button>
                </Paper>
              </Grid>
            ))
          )}
        </Grid>
      )}

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: '#2d3748', color: '#e2e8f0', borderRadius: 2 } }}
      >
        <DialogTitle sx={{ bgcolor: '#3a506b', color: '#fff' }}>{editingCompany ? 'Edit Company' : 'Create New Company'}</DialogTitle>
        <form onSubmit={handleSaveCompany}>
          <DialogContent sx={{ pt: '20px !important' }}>
            <TextField
              label="Company Name"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              fullWidth
              required
              sx={{ mt: 1, mb: 2,
                '& .MuiInputBase-input': { color: '#fff' },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.8)' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
              }}
              disabled={dialogLoading}
              inputProps={{ maxLength: 255 }}
            />
            <TextField
              label="Contact Email (Optional)"
              type="email"
              value={companyContactEmail}
              onChange={e => setCompanyContactEmail(e.target.value)}
              fullWidth
              sx={{ mb: 2,
                '& .MuiInputBase-input': { color: '#fff' },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.8)' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
              }}
              disabled={dialogLoading}
              inputProps={{ maxLength: 255 }}
            />
          </DialogContent>
          <DialogActions sx={{ bgcolor: '#3a506b' }}>
            <Button onClick={handleCloseDialog} disabled={dialogLoading} sx={{ color: '#a0aec0' }}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={dialogLoading || !companyName.trim()}
              sx={{
                bgcolor: '#4CAF50',
                '&:hover': { bgcolor: '#43A047' }
              }}
            >
              {dialogLoading ? <CircularProgress size={24} /> : (editingCompany ? 'Save Changes' : 'Create Company')}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* --- Diálogo para Gestionar Instalaciones --- */}
      {openFacilitiesDialog && selectedCompanyTenantId && (
        <TenantFacilityManagement
          tenantId={selectedCompanyTenantId}
          setParentSnack={setParentSnack}
          onClose={handleCloseFacilitiesDialog}
          isGlobalAdmin={isGlobalAdmin} // Pasar isGlobalAdmin al componente de gestión de instalaciones
        />
      )}
    </Box>
  );
};

EmpresasCrud.propTypes = {
  tenantId: PropTypes.number, // Cambiado a number ya que los IDs suelen ser numéricos
  isAppReady: PropTypes.bool.isRequired,
  setParentSnack: PropTypes.func.isRequired,
  isGlobalAdmin: PropTypes.bool.isRequired,
};

export default EmpresasCrud;
