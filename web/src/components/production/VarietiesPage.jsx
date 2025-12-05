// src/components/production/VarietiesPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { api } from '../../App';
import {
  Box, Typography, Button, CircularProgress, Snackbar, Alert,
  TextField, Paper, IconButton, Chip, MenuItem, Select,
  FormControl, InputLabel, Tooltip, Switch, Checkbox, ListItemText, Grid,
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
    case 'Indica': return '#7b1fa2';
    case 'Sativa': return '#388e3c';
    case 'Hybrid': return '#1976d2';
    default: return '#757575';
  }
};

const getYieldColor = (yieldPotential) => {
  switch (yieldPotential) {
    case 'High': return '#388e3c';
    case 'Medium': return '#f57c00';
    case 'Low': return '#d32f2f';
    default: return '#757575';
  }
};

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

const VarietiesPage = ({ isAppReady, isGlobalAdmin, setParentSnack }) => {
  const [varieties, setVarieties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [orderBy, setOrderBy] = useState('id');
  const [order, setOrder] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStrain, setFilterStrain] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVariety, setEditingVariety] = useState(null);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [formData, setFormData] = useState(initialFormData);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [varietyToDelete, setVarietyToDelete] = useState(null);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });
  const [tenants, setTenants] = useState([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');

  const showSnack = useCallback((message, severity = 'success') => {
    if (setParentSnack) {
      setParentSnack(message, severity);
    } else {
      setSnack({ open: true, message, severity });
    }
  }, [setParentSnack]);

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
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (filterStrain !== 'all') params.append('strain', filterStrain);
      if (filterStatus !== 'all') params.append('is_active', filterStatus === 'active' ? '1' : '0');
      
      const response = await api.get('/production/varieties?' + params.toString());
      const data = Array.isArray(response.data) ? response.data : response.data.data || [];
      setVarieties(data);
      setTotalCount(data.length);
    } catch (error) {
      console.error('Error fetching varieties:', error);
      showSnack('Error loading varieties', 'error');
    } finally {
      setLoading(false);
    }
  }, [isAppReady, searchTerm, filterStrain, filterStatus, showSnack]);

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
      if (payload.flowering_time_days) {
        payload.flowering_time_days = parseInt(payload.flowering_time_days, 10);
      } else {
        delete payload.flowering_time_days;
      }
      if (isGlobalAdmin && selectedTenantId) {
        payload.tenant_id = selectedTenantId;
      }
      if (editingVariety) {
        await api.put('/production/varieties/' + editingVariety.id, payload);
        showSnack('Variety updated successfully', 'success');
      } else {
        await api.post('/production/varieties', payload);
        showSnack('Variety created successfully', 'success');
      }
      handleCloseDialog();
      fetchVarieties();
    } catch (error) {
      console.error('Error saving variety:', error);
      const message = error.response?.data?.message || 'Error saving variety';
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
      await api.delete('/production/varieties/' + varietyToDelete.id);
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
      await api.patch('/production/varieties/' + variety.id + '/toggle-active');
      showSnack(variety.is_active ? 'Variety deactivated' : 'Variety activated', 'success');
      fetchVarieties();
    } catch (error) {
      console.error('Error toggling variety status:', error);
      showSnack('Error updating variety status', 'error');
    }
  };

  const sortedVarieties = [...varieties].sort((a, b) => {
    const aValue = a[orderBy] || '';
    const bValue = b[orderBy] || '';
    if (order === 'asc') return aValue > bValue ? 1 : -1;
    return aValue < bValue ? 1 : -1;
  });

  const paginatedVarieties = sortedVarieties.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LocalFloristIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h5" fontWeight="bold">Varieties</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
          New Variety
        </Button>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{ startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} /> }}
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Strain</InputLabel>
              <Select value={filterStrain} onChange={(e) => setFilterStrain(e.target.value)} label="Strain">
                <MenuItem value="all">All Strains</MenuItem>
                {STRAINS.map((strain) => (<MenuItem key={strain} value={strain}>{strain}</MenuItem>))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} label="Status">
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={2}>
            <Tooltip title="Refresh">
              <IconButton onClick={fetchVarieties} color="primary"><RefreshIcon /></IconButton>
            </Tooltip>
          </Grid>
        </Grid>
      </Paper>

      {/* Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel active={orderBy === 'name'} direction={orderBy === 'name' ? order : 'asc'} onClick={() => handleSort('name')}>
                  Variety Name
                </TableSortLabel>
              </TableCell>
              <TableCell>Strain</TableCell>
              <TableCell>THC Range</TableCell>
              <TableCell>CBD Range</TableCell>
              <TableCell align="center">Flowering Days</TableCell>
              <TableCell>Yield Potential</TableCell>
              <TableCell align="center">Status</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}><CircularProgress /></TableCell></TableRow>
            ) : paginatedVarieties.length === 0 ? (
              <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}><Typography color="text.secondary">No varieties found</Typography></TableCell></TableRow>
            ) : (
              paginatedVarieties.map((variety) => (
                <TableRow key={variety.id} hover>
                  <TableCell><Typography fontWeight="medium">{variety.name}</Typography></TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {variety.strain && variety.strain.length > 0 ? (
                        variety.strain.map((s) => (<Chip key={s} label={s} size="small" sx={{ bgcolor: getStrainColor(s), color: 'white' }} />))
                      ) : (<Typography color="text.secondary">-</Typography>)}
                    </Box>
                  </TableCell>
                  <TableCell>{variety.thc_range || '-'}</TableCell>
                  <TableCell>{variety.cbd_range || '-'}</TableCell>
                  <TableCell align="center">{variety.flowering_time_days || '-'}</TableCell>
                  <TableCell>
                    {variety.yield_potential ? (
                      <Chip label={variety.yield_potential} size="small" sx={{ bgcolor: getYieldColor(variety.yield_potential), color: 'white' }} />
                    ) : '-'}
                  </TableCell>
                  <TableCell align="center">
                    <Switch checked={variety.is_active} onChange={() => handleToggleActive(variety)} color="success" size="small" />
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="Edit"><IconButton size="small" onClick={() => handleOpenDialog(variety)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => handleDeleteClick(variety)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination component="div" count={totalCount} page={page} onPageChange={handleChangePage} rowsPerPage={rowsPerPage} onRowsPerPageChange={handleChangeRowsPerPage} rowsPerPageOptions={[10, 20, 50, 100]} />
      </TableContainer>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth PaperProps={{ sx: { maxHeight: '90vh' } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
          <LocalFloristIcon color="primary" />
          {editingVariety ? 'Edit Variety' : 'New Variety'}
          <IconButton aria-label="close" onClick={handleCloseDialog} sx={{ position: 'absolute', right: 8, top: 8 }}><CloseIcon /></IconButton>
        </DialogTitle>

        <form onSubmit={handleSaveVariety}>
          <DialogContent sx={{ pt: 3 }}>
            {/* Tenant Selector for Global Admin */}
            {isGlobalAdmin && !editingVariety && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" fontWeight="bold" color="primary" sx={{ mb: 1.5 }}>Select Tenant</Typography>
                <FormControl size="small" sx={{ minWidth: 250 }} required>
                  <InputLabel>Tenant *</InputLabel>
                  <Select value={selectedTenantId} label="Tenant *" onChange={(e) => setSelectedTenantId(e.target.value)} required>
                    <MenuItem value=""><em>Select Tenant</em></MenuItem>
                    {tenants.map((tenant) => (<MenuItem key={tenant.id} value={tenant.id}>{tenant.name}</MenuItem>))}
                  </Select>
                </FormControl>
              </Box>
            )}

            <Typography variant="subtitle1" fontWeight="bold" color="primary" sx={{ mb: 1.5 }}>Basic Information</Typography>
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
              <TextField size="small" name="name" label="Variety Name *" value={formData.name} onChange={handleFormChange} required sx={{ flex: 2, minWidth: 200 }} />
              <FormControl size="small" sx={{ flex: 1, minWidth: 200 }}>
                <InputLabel>Strain</InputLabel>
                <Select multiple value={formData.strain} onChange={handleStrainChange} input={<OutlinedInput label="Strain" />}
                  renderValue={(selected) => (<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>{selected.map((value) => (<Chip key={value} label={value} size="small" sx={{ bgcolor: getStrainColor(value), color: '#fff' }} />))}</Box>)}>
                  {STRAINS.map((strain) => (<MenuItem key={strain} value={strain}><Checkbox checked={formData.strain.indexOf(strain) > -1} /><ListItemText primary={strain} /></MenuItem>))}
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ mb: 3 }}>
              <TextField fullWidth size="small" name="description" label="Description" value={formData.description} onChange={handleFormChange} multiline rows={2} />
            </Box>

            <Typography variant="subtitle1" fontWeight="bold" color="primary" sx={{ mb: 1.5 }}>Cannabinoid Profile</Typography>
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
              <TextField size="small" name="thc_range" label="THC Range" placeholder="e.g., 15-20%" value={formData.thc_range} onChange={handleFormChange} sx={{ flex: 1, minWidth: 150 }} />
              <TextField size="small" name="cbd_range" label="CBD Range" placeholder="e.g., 0.1-1%" value={formData.cbd_range} onChange={handleFormChange} sx={{ flex: 1, minWidth: 150 }} />
            </Box>

            <Typography variant="subtitle1" fontWeight="bold" color="primary" sx={{ mb: 1.5 }}>Growth Characteristics</Typography>
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
              <TextField size="small" name="flowering_time_days" label="Flowering Time (days)" type="number" value={formData.flowering_time_days} onChange={handleFormChange} inputProps={{ min: 1, max: 365 }} sx={{ flex: 1, minWidth: 180 }} />
              <FormControl size="small" sx={{ flex: 1, minWidth: 180 }}>
                <InputLabel>Yield Potential</InputLabel>
                <Select name="yield_potential" value={formData.yield_potential} label="Yield Potential" onChange={handleFormChange}>
                  <MenuItem value=""><em>Select...</em></MenuItem>
                  {YIELD_POTENTIALS.map(yp => (<MenuItem key={yp} value={yp}>{yp}</MenuItem>))}
                </Select>
              </FormControl>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #e0e0e0' }}>
            <Button onClick={handleCloseDialog} disabled={dialogLoading}>Cancel</Button>
            <Button type="submit" variant="contained" color="primary" disabled={dialogLoading || !formData.name || (isGlobalAdmin && !editingVariety && !selectedTenantId)} startIcon={dialogLoading && <CircularProgress size={16} color="inherit" />}>
              {dialogLoading ? 'Saving...' : 'Save'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete the variety "{varietyToDelete?.name}"? This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({ ...snack, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} onClose={() => setSnack({ ...snack, open: false })}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
};

VarietiesPage.propTypes = {
  isAppReady: PropTypes.bool.isRequired,
  isGlobalAdmin: PropTypes.bool,
  setParentSnack: PropTypes.func,
};

VarietiesPage.defaultProps = {
  isGlobalAdmin: false,
  setParentSnack: null,
};

export default VarietiesPage;
