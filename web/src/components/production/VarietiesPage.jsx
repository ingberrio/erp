// src/components/production/VarietiesPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { api } from '../../App';
import {
  Box, Typography, Button, CircularProgress, Snackbar, Alert,
  TextField, Paper, IconButton, Chip, MenuItem, Select,
  FormControl, InputLabel, Tooltip, Switch, Checkbox, ListItemText,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, TableSortLabel, OutlinedInput,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import LocalFloristIcon from '@mui/icons-material/LocalFlorist';

// Constants
const STRAINS = ['Indica', 'Sativa', 'Hybrid'];
const YIELD_POTENTIALS = ['Low', 'Medium', 'High'];

const getStrainColor = (strain) => {
  switch (strain) {
    case 'Indica': return '#7b1fa2'; // Purple
    case 'Sativa': return '#388e3c'; // Green
    case 'Hybrid': return '#1976d2'; // Blue
    default: return '#757575';
  }
};

// Initial form state
const initialFormData = {
  name: '',
  strain: [],
  description: '',
  thc_range: '',
  cbd_range: '',
  flowering_time_days: '',
  yield_potential: '',
  is_active: true,
};

const VarietiesPage = ({ tenantId, isAppReady, isGlobalAdmin, setParentSnack }) => {
  const [varieties, setVarieties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [orderBy, setOrderBy] = useState('id');
  const [order, setOrder] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStrain, setFilterStrain] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVariety, setEditingVariety] = useState(null);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [formData, setFormData] = useState(initialFormData);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [varietyToDelete, setVarietyToDelete] = useState(null);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });
  
  // Tenants for Global Admin
  const [tenants, setTenants] = useState([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');

  const showSnack = useCallback((message, severity = 'success') => {
    if (setParentSnack) {
      setParentSnack(message, severity);
    } else {
      setSnack({ open: true, message, severity });
    }
  }, [setParentSnack]);

  // Fetch tenants for Global Admin
  useEffect(() => {
    const fetchTenants = async () => {
      if (!isGlobalAdmin || !isAppReady) return;
      try {
        const response = await api.get('/tenants');
        setTenants(response.data.data || response.data || []);
      } catch (error) {
        console.error('Error fetching tenants:', error);
      }
    };
    fetchTenants();
  }, [isGlobalAdmin, isAppReady]);

  const fetchVarieties = useCallback(async () => {
    if (!isAppReady) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page + 1,
        per_page: rowsPerPage,
        sort_by: orderBy,
        sort_order: order,
      });
      if (searchTerm) params.append('search', searchTerm);
      if (filterStrain !== 'all') params.append('strain', filterStrain);
      
      const response = await api.get(`/production/varieties?${params.toString()}`);
      setVarieties(response.data.data || []);
      setTotalCount(response.data.total || 0);
    } catch (error) {
      console.error('Error fetching varieties:', error);
      showSnack('Error loading varieties', 'error');
    } finally {
      setLoading(false);
    }
  }, [isAppReady, page, rowsPerPage, orderBy, order, searchTerm, filterStrain, showSnack]);

  useEffect(() => {
    fetchVarieties();
  }, [fetchVarieties]);

  const handleChangePage = (event, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleOpenDialog = (variety = null) => {
    if (variety) {
      setEditingVariety(variety);
      setFormData({
        name: variety.name || '',
        strain: variety.strain || [],
        description: variety.description || '',
        thc_range: variety.thc_range || '',
        cbd_range: variety.cbd_range || '',
        flowering_time_days: variety.flowering_time_days || '',
        yield_potential: variety.yield_potential || '',
        is_active: variety.is_active !== false,
      });
      if (isGlobalAdmin && variety.tenant_id) {
        setSelectedTenantId(variety.tenant_id);
      }
    } else {
      setEditingVariety(null);
      setFormData(initialFormData);
      setSelectedTenantId('');
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingVariety(null);
    setDialogLoading(false);
    setSelectedTenantId('');
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleStrainChange = (event) => {
    const { value } = event.target;
    setFormData(prev => ({
      ...prev,
      strain: typeof value === 'string' ? value.split(',') : value,
    }));
  };

  const handleSaveVariety = async (e) => {
    e.preventDefault();
    setDialogLoading(true);

    try {
      const payload = { ...formData };
      
      // Convert flowering_time_days to integer if provided
      if (payload.flowering_time_days) {
        payload.flowering_time_days = parseInt(payload.flowering_time_days, 10);
      } else {
        delete payload.flowering_time_days;
      }
      
      // For Global Admin, add tenant_id
      if (isGlobalAdmin && selectedTenantId) {
        payload.tenant_id = selectedTenantId;
      }

      if (editingVariety) {
        await api.put(`/production/varieties/${editingVariety.id}`, payload);
        showSnack('Variety updated successfully', 'success');
      } else {
        await api.post('/production/varieties', payload);
        showSnack('Variety created successfully', 'success');
      }

      handleCloseDialog();
      fetchVarieties();
    } catch (error) {
      console.error('Error saving variety:', error);
      const message = error.response?.data?.message || error.response?.data?.errors 
        ? Object.values(error.response.data.errors).flat().join(', ')
        : 'Error saving variety';
      showSnack(message, 'error');
    } finally {
      setDialogLoading(false);
    }
  };

  const handleDeleteClick = (variety) => {
    setVarietyToDelete(variety);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!varietyToDelete) return;
    
    try {
      await api.delete(`/production/varieties/${varietyToDelete.id}`);
      showSnack('Variety deleted successfully', 'success');
      fetchVarieties();
    } catch (error) {
      console.error('Error deleting variety:', error);
      showSnack(error.response?.data?.message || 'Error deleting variety', 'error');
    } finally {
      setDeleteDialogOpen(false);
      setVarietyToDelete(null);
    }
  };

  const handleToggleActive = async (variety) => {
    try {
      await api.patch(`/production/varieties/${variety.id}/toggle-active`);
      showSnack(variety.is_active ? 'Variety deactivated' : 'Variety activated', 'success');
      fetchVarieties();
    } catch (error) {
      console.error('Error toggling variety status:', error);
      showSnack('Error updating variety status', 'error');
    }
  };

  return (
    <Box>
      {/* Breadcrumb */}
      <Typography variant="body2" color="primary" sx={{ mb: 1, cursor: 'pointer' }}>
        Administration /
      </Typography>

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">Varieties</Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add Variety
        </Button>
      </Box>

      {/* Search and Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Search"
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
          InputProps={{
            startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
          }}
          sx={{ minWidth: 200 }}
        />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Strain</InputLabel>
          <Select
            value={filterStrain}
            label="Strain"
            onChange={(e) => { setFilterStrain(e.target.value); setPage(0); }}
          >
            <MenuItem value="all">All Strains</MenuItem>
            {STRAINS.map(strain => (
              <MenuItem key={strain} value={strain}>{strain}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={fetchVarieties}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Varieties Table */}
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer sx={{ maxHeight: 600 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell>
                  <TableSortLabel active={orderBy === 'id'} direction={orderBy === 'id' ? order : 'asc'} onClick={() => handleSort('id')}>
                    ID
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel active={orderBy === 'name'} direction={orderBy === 'name' ? order : 'asc'} onClick={() => handleSort('name')}>
                    Name
                  </TableSortLabel>
                </TableCell>
                <TableCell>Strain</TableCell>
                <TableCell>Active</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}><CircularProgress size={24} /></TableCell>
                </TableRow>
              ) : varieties.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No varieties found</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                varieties.map(variety => (
                  <TableRow key={variety.id} hover>
                    <TableCell>{variety.id}</TableCell>
                    <TableCell><Typography fontWeight={500}>{variety.name}</Typography></TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {variety.strain && variety.strain.length > 0 ? (
                          variety.strain.map(s => (
                            <Chip
                              key={s}
                              label={s}
                              size="small"
                              sx={{ bgcolor: getStrainColor(s), color: '#fff', fontWeight: 500 }}
                            />
                          ))
                        ) : (
                          <Typography color="text.secondary">-</Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Tooltip title={variety.is_active ? 'Click to deactivate' : 'Click to activate'}>
                        <Switch
                          checked={variety.is_active}
                          onChange={() => handleToggleActive(variety)}
                          size="small"
                          color="success"
                        />
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                        <Tooltip title="Edit">
                          <IconButton size="small" color="primary" onClick={() => handleOpenDialog(variety)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => handleDeleteClick(variety)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 20, 50, 100]}
        />
      </Paper>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid #e0e0e0', pb: 2 }}>
          <LocalFloristIcon color="success" />
          {editingVariety ? 'Edit Variety' : 'Create Variety'}
          <IconButton aria-label="close" onClick={handleCloseDialog} sx={{ position: 'absolute', right: 8, top: 8 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <form onSubmit={handleSaveVariety}>
          <DialogContent sx={{ pt: 3 }}>
            
            {/* Tenant Selector for Global Admin */}
            {isGlobalAdmin && !editingVariety && (
              <Box sx={{ mb: 3 }}>
                <FormControl fullWidth size="small" required>
                  <InputLabel>Tenant *</InputLabel>
                  <Select 
                    value={selectedTenantId} 
                    label="Tenant *" 
                    onChange={(e) => setSelectedTenantId(e.target.value)}
                    required
                  >
                    {tenants.map(tenant => (
                      <MenuItem key={tenant.id} value={tenant.id}>{tenant.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            )}

            {/* Name */}
            <TextField
              fullWidth
              size="small"
              name="name"
              label="Name"
              value={formData.name}
              onChange={handleFormChange}
              required
              sx={{ mb: 2 }}
            />

            {/* Strain Multi-select */}
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>Strain</InputLabel>
              <Select
                multiple
                value={formData.strain}
                onChange={handleStrainChange}
                input={<OutlinedInput label="Strain" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip key={value} label={value} size="small" sx={{ bgcolor: getStrainColor(value), color: '#fff' }} />
                    ))}
                  </Box>
                )}
              >
                {STRAINS.map((strain) => (
                  <MenuItem key={strain} value={strain}>
                    <Checkbox checked={formData.strain.indexOf(strain) > -1} />
                    <ListItemText primary={strain} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Description */}
            <TextField
              fullWidth
              size="small"
              name="description"
              label="Description"
              value={formData.description}
              onChange={handleFormChange}
              multiline
              rows={2}
              sx={{ mb: 2 }}
            />

            {/* THC and CBD Range */}
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <TextField
                fullWidth
                size="small"
                name="thc_range"
                label="THC Range"
                placeholder="e.g., 15-20%"
                value={formData.thc_range}
                onChange={handleFormChange}
              />
              <TextField
                fullWidth
                size="small"
                name="cbd_range"
                label="CBD Range"
                placeholder="e.g., 0.1-1%"
                value={formData.cbd_range}
                onChange={handleFormChange}
              />
            </Box>

            {/* Flowering Time and Yield */}
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <TextField
                fullWidth
                size="small"
                name="flowering_time_days"
                label="Flowering Time (days)"
                type="number"
                value={formData.flowering_time_days}
                onChange={handleFormChange}
                inputProps={{ min: 1, max: 365 }}
              />
              <FormControl fullWidth size="small">
                <InputLabel>Yield Potential</InputLabel>
                <Select
                  name="yield_potential"
                  value={formData.yield_potential}
                  label="Yield Potential"
                  onChange={handleFormChange}
                >
                  <MenuItem value="">Select...</MenuItem>
                  {YIELD_POTENTIALS.map(yp => (
                    <MenuItem key={yp} value={yp}>{yp}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #e0e0e0' }}>
            <Button onClick={handleCloseDialog} color="inherit">Cancel</Button>
            <Button 
              type="submit" 
              variant="contained" 
              disabled={dialogLoading || !formData.name || (isGlobalAdmin && !editingVariety && !selectedTenantId)}
            >
              {dialogLoading ? <CircularProgress size={20} /> : 'Save'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="xs">
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the variety &quot;{varietyToDelete?.name}&quot;?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      {!setParentSnack && (
        <Snackbar 
          open={snack.open} 
          autoHideDuration={4000} 
          onClose={() => setSnack(prev => ({ ...prev, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert severity={snack.severity} onClose={() => setSnack(prev => ({ ...prev, open: false }))}>
            {snack.message}
          </Alert>
        </Snackbar>
      )}
    </Box>
  );
};

VarietiesPage.propTypes = {
  tenantId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  isAppReady: PropTypes.bool,
  isGlobalAdmin: PropTypes.bool,
  setParentSnack: PropTypes.func,
};

export default VarietiesPage;
