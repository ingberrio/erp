// src/components/TenantFacilityManagement.jsx
import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { api } from '../App'; // Asegúrate de que esta importación sea correcta
import {
  Box, Typography, Button, CircularProgress, Snackbar, Alert,
  TextField, Paper, Divider, IconButton, Grid,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import BusinessIcon from '@mui/icons-material/Business'; // Icono para instalaciones

// Constantes para mensajes y títulos de diálogo
const SNACK_MESSAGES = {
  FACILITIES_ERROR: 'Error loading facilities.',
  FACILITY_NAME_REQUIRED: 'Facility name is required.',
  FACILITY_NAME_LENGTH_EXCEEDED: 'Facility name cannot exceed 100 characters.',
  FACILITY_NAME_INVALID_CHARS: 'Name cannot contain special characters such as <, >, or {}.',
  FACILITY_CREATED: 'Facility created successfully.',
  FACILITY_UPDATED: 'Facility updated successfully.',
  FACILITY_DELETED: 'Facility deleted successfully.',
  VALIDATION_ERROR: 'Validation error:',
  PERMISSION_DENIED: 'You do not have permission to perform this action.',
  GENERAL_ERROR_SAVING_FACILITY: 'Error saving facility:',
  CANNOT_DELETE_FACILITY_WITH_AREAS: 'Cannot delete facility: It has associated cultivation areas.',
  LICENCE_NUMBER_LENGTH_EXCEEDED: 'Licence number cannot exceed 255 characters.',
  ADMIN_EMAIL_REQUIRED: 'Admin email is required when creating a new facility.',
  ADMIN_EMAIL_INVALID: 'Please enter a valid email address.',
};

const DIALOG_TITLES = {
  CREATE_FACILITY: 'Create New Facility',
  EDIT_FACILITY: 'Edit Facility',
  CONFIRM_DELETE_FACILITY: 'Confirm Facility Deletion',
};

const BUTTON_LABELS = {
  ADD_FACILITY: 'Add Facility',
  SAVE_CHANGES: 'Save Changes',
  CREATE_FACILITY: 'Create Facility',
  CANCEL: 'Cancel',
  CONFIRM: 'Confirm',
};

const TenantFacilityManagement = ({ tenantId, setParentSnack, onClose, isGlobalAdmin }) => {
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openFacilityDialog, setOpenFacilityDialog] = useState(false);
  const [newFacilityName, setNewFacilityName] = useState('');
  const [newFacilityLicenceNumber, setNewFacilityLicenceNumber] = useState('');
  const [newFacilityAdminEmail, setNewFacilityAdminEmail] = useState(''); // NEW: Admin email state
  const [editingFacility, setEditingFacility] = useState(null);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [confirmDeleteDialogOpen, setConfirmDeleteDialogOpen] = useState(false);
  const [facilityToDelete, setFacilityToDelete] = useState(null);

  // Función para obtener instalaciones del tenant especificado
  const fetchFacilities = useCallback(async () => {
    if (!tenantId) {
      setParentSnack('Error: No Tenant ID was provided to manage facilities.', 'error');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Es crucial enviar el X-Tenant-ID aquí, ya que esta llamada es específica para un inquilino
      // incluso si el usuario es un Superadmin.
      const response = await api.get('/facilities', {
        headers: {
          'X-Tenant-ID': String(tenantId),
        },
      });
      const fetchedFacilities = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.data)
        ? response.data.data
        : [];
      setFacilities(fetchedFacilities);
    } catch (error) {
      console.error('TenantFacilityManagement: Error fetching facilities:', error.response?.data || error.message);
      setParentSnack(SNACK_MESSAGES.FACILITIES_ERROR, 'error');
    } finally {
      setLoading(false);
    }
  }, [tenantId, setParentSnack]);

  useEffect(() => {
    fetchFacilities();
  }, [fetchFacilities]);

  const handleOpenFacilityDialog = useCallback((facility = null) => {
    setEditingFacility(facility);
    setNewFacilityName(facility ? facility.name : '');
    setNewFacilityLicenceNumber(facility ? (facility.licence_number || '') : '');
    setNewFacilityAdminEmail(''); // NEW: Clear admin email (only used for creation)
    setOpenFacilityDialog(true);
    setDialogLoading(false);
  }, []);

  const handleCloseFacilityDialog = useCallback(() => {
    setOpenFacilityDialog(false);
    setEditingFacility(null);
    setNewFacilityName('');
    setNewFacilityLicenceNumber('');
    setNewFacilityAdminEmail(''); // NEW: Clear admin email on close
    setDialogLoading(false);
  }, []);

  const handleSaveFacility = async (e) => {
    e.preventDefault();
    if (!newFacilityName.trim()) {
      setParentSnack(SNACK_MESSAGES.FACILITY_NAME_REQUIRED, 'warning');
      return;
    }
    if (newFacilityName.length > 100) {
      setParentSnack(SNACK_MESSAGES.FACILITY_NAME_LENGTH_EXCEEDED, 'warning');
      return;
    }
    if (/[<>{}]/.test(newFacilityName)) {
      setParentSnack(SNACK_MESSAGES.FACILITY_NAME_INVALID_CHARS, 'warning');
      return;
    }
    // NEW: Validate licence number length
    if (newFacilityLicenceNumber.length > 255) {
      setParentSnack(SNACK_MESSAGES.LICENCE_NUMBER_LENGTH_EXCEEDED, 'warning');
      return;
    }
    // NEW: Validate admin email only when creating (not editing)
    if (!editingFacility) {
      if (!newFacilityAdminEmail.trim()) {
        setParentSnack(SNACK_MESSAGES.ADMIN_EMAIL_REQUIRED, 'warning');
        return;
      }
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newFacilityAdminEmail.trim())) {
        setParentSnack(SNACK_MESSAGES.ADMIN_EMAIL_INVALID, 'warning');
        return;
      }
    }
    if (!tenantId) {
      setParentSnack('Error: Could not determine the Tenant ID to save the facility.', 'error');
      return;
    }

    setDialogLoading(true);
    try {
      const facilityData = {
        name: newFacilityName,
        address: '', // Add address field or remove if not used
        tenant_id: tenantId, // El tenant_id debe ir en el payload para Laravel
        licence_number: newFacilityLicenceNumber.trim() || null,
      };

      // NEW: Add admin_email only when creating a new facility
      if (!editingFacility) {
        facilityData.admin_email = newFacilityAdminEmail.trim();
      }

      if (editingFacility) {
        await api.put(`/facilities/${editingFacility.id}`, facilityData, {
          headers: {
            'X-Tenant-ID': String(tenantId),
          },
        });
        setParentSnack(SNACK_MESSAGES.FACILITY_UPDATED, 'success');
      } else {
        await api.post('/facilities', facilityData, {
          headers: {
            'X-Tenant-ID': String(tenantId),
          },
        });
        setParentSnack(SNACK_MESSAGES.FACILITY_CREATED, 'success');
      }
      await fetchFacilities(); // Recargar la lista de instalaciones
      handleCloseFacilityDialog();
    } catch (err) {
      console.error('Error al guardar instalación:', err.response?.data || err.message);
      const errorMessage = err.response?.data?.message || err.message;
      if (err.response?.status === 422) {
        const errors = err.response?.data?.details;
        const firstError = errors ? Object.values(errors)[0][0] : errorMessage;
        setParentSnack(`${SNACK_MESSAGES.VALIDATION_ERROR} ${firstError}`, 'error');
      } else if (err.response?.status === 403) {
        setParentSnack(SNACK_MESSAGES.PERMISSION_DENIED, 'error');
      } else {
        setParentSnack(`${SNACK_MESSAGES.GENERAL_ERROR_SAVING_FACILITY} ${errorMessage}`, 'error');
      }
    } finally {
      setDialogLoading(false);
    }
  };

  const handleConfirmDelete = useCallback((facility) => {
    setFacilityToDelete(facility);
    setConfirmDeleteDialogOpen(true);
  }, []);

  const handleDeleteFacility = async () => {
    setDialogLoading(true);
    setConfirmDeleteDialogOpen(false); // Close confirmation dialog
    if (!facilityToDelete || !tenantId) {
      setParentSnack('Error: Could not determine the facility or Tenant ID to delete.', 'error');
      setDialogLoading(false);
      return;
    }

    try {
      await api.delete(`/facilities/${facilityToDelete.id}`, {
        headers: {
          'X-Tenant-ID': String(tenantId),
        },
      });
      setParentSnack(SNACK_MESSAGES.FACILITY_DELETED, 'info');
      await fetchFacilities(); // Recargar la lista de instalaciones
    } catch (err) {
      console.error('Error al eliminar instalación:', err.response?.data || err.message);
      const errorMessage = err.response?.data?.message || err.message;
      if (err.response?.status === 403) {
        setParentSnack(SNACK_MESSAGES.PERMISSION_DENIED, 'error');
      } else if (err.response?.status === 409) { // Conflict (e.g., has associated cultivation areas)
        setParentSnack(SNACK_MESSAGES.CANNOT_DELETE_FACILITY_WITH_AREAS, 'error');
      } else {
        setParentSnack(`Error deleting facility: ${errorMessage}`, 'error');
      }
    } finally {
      setDialogLoading(false);
      setFacilityToDelete(null);
    }
  };

  return (
    <Dialog open={true} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { bgcolor: '#2d3748', color: '#e2e8f0', borderRadius: 2 } }}
    >
      <DialogTitle sx={{ bgcolor: '#3a506b', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <BusinessIcon sx={{ mr: 1 }} />
          <Typography variant="h6" component="span">
            Facility Management for Tenant ID: {tenantId}
          </Typography>
        </Box>
        <IconButton onClick={onClose} sx={{ color: '#e2e8f0' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: '20px !important' }}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenFacilityDialog(null)}
            disabled={loading || dialogLoading}
            sx={{
              borderRadius: 2,
              bgcolor: '#4CAF50',
              '&:hover': { bgcolor: '#43A047' },
            }}
          >
            {BUTTON_LABELS.ADD_FACILITY}
          </Button>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '150px', color: '#fff' }}>
            <CircularProgress color="inherit" />
            <Typography variant="body1" sx={{ ml: 2, color: '#fff' }}>Loading facilities...</Typography>
          </Box>
        ) : (
          <Grid container spacing={2}>
            {facilities.length === 0 ? (
              <Grid item xs={12}>
                <Typography variant="h6" sx={{ color: '#aaa', textAlign: 'center', mt: 2 }}>
                  No facilities registered for this tenant.
                </Typography>
              </Grid>
            ) : (
              facilities.map((facility) => (
                <Grid item xs={12} sm={6} md={6} key={facility.id}>
                  <Paper elevation={1} sx={{ p: 2, bgcolor: '#283e51', borderRadius: 2, color: '#fff' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600, color: '#fff' }}>
                        {facility.name}
                      </Typography>
                      <Box>
                        <IconButton size="small" onClick={() => handleOpenFacilityDialog(facility)} aria-label={`Edit ${facility.name}`}>
                          <EditIcon sx={{ fontSize: 18, color: '#b0c4de' }} />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleConfirmDelete(facility)} aria-label={`Delete ${facility.name}`}>
                          <DeleteIcon sx={{ fontSize: 18, color: '#fc8181' }} />
                        </IconButton>
                      </Box>
                    </Box>
                    <Divider sx={{ mb: 1.5, bgcolor: 'rgba(255,255,255,0.2)' }} />
                    <Typography variant="body2" color="text.secondary" sx={{ color: '#a0aec0' }}>
                      ID: {facility.id}
                    </Typography>
                    {facility.licence_number && ( // NEW: Display licence number if available
                      <Typography variant="body2" color="text.secondary" sx={{ color: '#a0aec0' }}>
                        Licence ID: {facility.licence_number}
                      </Typography>
                    )}
                    <Typography variant="body2" color="text.secondary" sx={{ color: '#a0aec0' }}>
                      Created: {new Date(facility.created_at).toLocaleDateString()}
                    </Typography>
                  </Paper>
                </Grid>
              ))
            )}
          </Grid>
        )}
      </DialogContent>

      <Dialog open={openFacilityDialog} onClose={handleCloseFacilityDialog} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: '#2d3748', color: '#e2e8f0', borderRadius: 2 } }}
      >
        <DialogTitle sx={{ bgcolor: '#3a506b', color: '#fff' }}>
          {editingFacility ? DIALOG_TITLES.EDIT_FACILITY : DIALOG_TITLES.CREATE_FACILITY}
        </DialogTitle>
        <form onSubmit={handleSaveFacility}>
          <DialogContent sx={{ pt: '20px !important' }}>
            <TextField
              label="Facility Name"
              value={newFacilityName}
              onChange={e => setNewFacilityName(e.target.value)}
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
              inputProps={{ maxLength: 100 }}
            />
            {/* NEW: Licence ID TextField */}
            <TextField
              label="Licence ID (Optional)"
              value={newFacilityLicenceNumber}
              onChange={e => setNewFacilityLicenceNumber(e.target.value)}
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
            {/* NEW: Admin Email TextField - only shown when creating a new facility */}
            {!editingFacility && (
              <TextField
                label="Admin Email"
                type="email"
                value={newFacilityAdminEmail}
                onChange={e => setNewFacilityAdminEmail(e.target.value)}
                fullWidth
                required
                helperText="A user will be created with this email and a default password (Facility@123)"
                sx={{ mb: 2,
                  '& .MuiInputBase-input': { color: '#fff' },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.8)' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
                  '& .MuiFormHelperText-root': { color: 'rgba(255,255,255,0.6)' },
                }}
                disabled={dialogLoading}
                inputProps={{ maxLength: 255 }}
              />
            )}
          </DialogContent>
          <DialogActions sx={{ bgcolor: '#3a506b' }}>
            <Button onClick={handleCloseFacilityDialog} disabled={dialogLoading} sx={{ color: '#a0aec0' }}>
              {BUTTON_LABELS.CANCEL}
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={dialogLoading || !newFacilityName.trim()}
              sx={{
                bgcolor: '#4CAF50',
                '&:hover': { bgcolor: '#43A047' }
              }}
            >
              {dialogLoading ? <CircularProgress size={24} /> : (editingFacility ? BUTTON_LABELS.SAVE_CHANGES : BUTTON_LABELS.CREATE_FACILITY)}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Confirmation Dialog for Deletion */}
      <Dialog
        open={confirmDeleteDialogOpen}
        onClose={() => setConfirmDeleteDialogOpen(false)}
        aria-labelledby="confirm-delete-title"
        aria-describedby="confirm-delete-description"
        PaperProps={{ sx: { bgcolor: '#2d3748', color: '#e2e8f0', borderRadius: 2 } }}
      >
        <DialogTitle id="confirm-delete-title" sx={{ color: '#e2e8f0' }}>{DIALOG_TITLES.CONFIRM_DELETE_FACILITY}</DialogTitle>
        <DialogContent>
          <Typography id="confirm-delete-description" sx={{ color: '#a0aec0' }}>
            Are you sure you want to delete the facility "{facilityToDelete?.name}"?
            This will also delete all associated cultivation areas.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteDialogOpen(false)} sx={{ color: '#a0aec0' }}>
            {BUTTON_LABELS.CANCEL}
          </Button>
          <Button onClick={handleDeleteFacility} color="error" autoFocus sx={{ color: '#fc8181' }}>
            {BUTTON_LABELS.CONFIRM}
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

TenantFacilityManagement.propTypes = {
  tenantId: PropTypes.number.isRequired, // El ID del inquilino al que pertenecen las instalaciones
  setParentSnack: PropTypes.func.isRequired, // Función para mostrar snackbars en el componente padre
  onClose: PropTypes.func.isRequired, // Función para cerrar este diálogo
  isGlobalAdmin: PropTypes.bool.isRequired, // Para saber si el usuario actual es Superadmin
};

export default TenantFacilityManagement;
