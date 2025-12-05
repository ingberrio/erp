// src/components/production/CultivationAreasPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { api } from '../../App';
import {
  Box, Typography, Button, CircularProgress, Snackbar, Alert,
  TextField, Paper, IconButton, Chip, MenuItem, Select,
  FormControl, InputLabel, Tooltip, Switch, Grid,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, TableSortLabel,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import WarehouseIcon from '@mui/icons-material/Warehouse';

// Constants
const CAPACITY_UNIT_TYPES = ['plants', 'sqft', 'sqm', 'units'];

const initialFormData = {
  name: '',
  description: '',
  capacity_units: '',
  capacity_unit_type: 'plants',
  facility_id: '',
  current_stage_id: '',
};

const CultivationAreasPage = ({ isAppReady, isGlobalAdmin, setParentSnack, hasPermission }) => {
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [orderBy, setOrderBy] = useState('name');
  const [order, setOrder] = useState('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFacility, setFilterFacility] = useState('all');
  const [filterStage, setFilterStage] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingArea, setEditingArea] = useState(null);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [formData, setFormData] = useState(initialFormData);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [areaToDelete, setAreaToDelete] = useState(null);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });
  const [facilities, setFacilities] = useState([]);
  const [stages, setStages] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');

  const showSnack = useCallback((message, severity = 'success') => {
    if (setParentSnack) {
      setParentSnack(message, severity);
    } else {
      setSnack({ open: true, message, severity });
    }
  }, [setParentSnack]);

  // Fetch tenants for global admin
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

  // Fetch facilities
  useEffect(() => {
    const fetchFacilities = async () => {
      if (!isAppReady) return;
      try {
        const response = await api.get('/facilities');
        const data = Array.isArray(response.data) ? response.data : response.data.data || [];
        setFacilities(data);
      } catch (error) {
        console.error('Error fetching facilities:', error);
      }
    };
    fetchFacilities();
  }, [isAppReady]);

  // Fetch stages
  useEffect(() => {
    const fetchStages = async () => {
      if (!isAppReady) return;
      try {
        const response = await api.get('/stages');
        const data = Array.isArray(response.data) ? response.data : response.data.data || [];
        setStages(data);
      } catch (error) {
        console.error('Error fetching stages:', error);
      }
    };
    fetchStages();
  }, [isAppReady]);

  const fetchAreas = useCallback(async () => {
    if (!isAppReady) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (filterFacility !== 'all') params.append('facility_id', filterFacility);
      if (filterStage !== 'all') params.append('current_stage_id', filterStage);

      const response = await api.get('/cultivation-areas?' + params.toString());
      const data = Array.isArray(response.data) ? response.data : response.data.data || [];
      setAreas(data);
      setTotalCount(data.length);
    } catch (error) {
      console.error('Error fetching cultivation areas:', error);
      showSnack('Error loading cultivation areas', 'error');
    } finally {
      setLoading(false);
    }
  }, [isAppReady, searchTerm, filterFacility, filterStage, showSnack]);

  useEffect(() => {
    fetchAreas();
  }, [fetchAreas]);

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

  const handleOpenDialog = (area = null) => {
    if (area) {
      setEditingArea(area);
      setFormData({
        name: area.name || '',
        description: area.description || '',
        capacity_units: area.capacity_units || '',
        capacity_unit_type: area.capacity_unit_type || 'plants',
        facility_id: area.facility_id || '',
        current_stage_id: area.current_stage_id || '',
      });
      if (isGlobalAdmin && area.tenant_id) {
        setSelectedTenantId(area.tenant_id);
      }
    } else {
      setEditingArea(null);
      setFormData(initialFormData);
      setSelectedTenantId('');
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingArea(null);
    setDialogLoading(false);
    setSelectedTenantId('');
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveArea = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showSnack('Area name is required', 'warning');
      return;
    }
    if (!formData.facility_id) {
      showSnack('Facility is required', 'warning');
      return;
    }
    setDialogLoading(true);
    try {
      const payload = { ...formData };
      if (payload.capacity_units) {
        payload.capacity_units = parseInt(payload.capacity_units, 10);
      } else {
        delete payload.capacity_units;
      }
      if (!payload.current_stage_id) {
        delete payload.current_stage_id;
      }
      if (isGlobalAdmin && selectedTenantId) {
        payload.tenant_id = selectedTenantId;
      }
      if (editingArea) {
        await api.put('/cultivation-areas/' + editingArea.id, payload);
        showSnack('Cultivation area updated successfully', 'success');
      } else {
        await api.post('/cultivation-areas', payload);
        showSnack('Cultivation area created successfully', 'success');
      }
      handleCloseDialog();
      fetchAreas();
    } catch (error) {
      console.error('Error saving cultivation area:', error);
      const message = error.response?.data?.message || 'Error saving cultivation area';
      showSnack(message, 'error');
    } finally {
      setDialogLoading(false);
    }
  };

  const handleDeleteClick = (area) => {
    setAreaToDelete(area);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!areaToDelete) return;
    try {
      await api.delete('/cultivation-areas/' + areaToDelete.id);
      showSnack('Cultivation area deleted successfully', 'success');
      fetchAreas();
    } catch (error) {
      console.error('Error deleting cultivation area:', error);
      const message = error.response?.data?.message || 'Error deleting cultivation area';
      showSnack(message, 'error');
    } finally {
      setDeleteDialogOpen(false);
      setAreaToDelete(null);
    }
  };

  const getFacilityName = (facilityId) => {
    const facility = facilities.find(f => f.id === facilityId);
    return facility?.name || '-';
  };

  const getStageName = (stageId) => {
    const stage = stages.find(s => s.id === stageId);
    return stage?.name || '-';
  };

  const getStageColor = (stageId) => {
    const stage = stages.find(s => s.id === stageId);
    if (!stage) return '#757575';
    // Color based on typical stage order
    const colors = ['#4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ff9800', '#f44336'];
    const index = stages.findIndex(s => s.id === stageId);
    return colors[index % colors.length] || '#757575';
  };

  const sortedAreas = [...areas].sort((a, b) => {
    let aValue = a[orderBy];
    let bValue = b[orderBy];
    
    if (orderBy === 'facility_id') {
      aValue = getFacilityName(a.facility_id);
      bValue = getFacilityName(b.facility_id);
    } else if (orderBy === 'current_stage_id') {
      aValue = getStageName(a.current_stage_id);
      bValue = getStageName(b.current_stage_id);
    }
    
    aValue = aValue || '';
    bValue = bValue || '';
    
    if (order === 'asc') return aValue > bValue ? 1 : -1;
    return aValue < bValue ? 1 : -1;
  });

  const paginatedAreas = sortedAreas.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const canCreate = !hasPermission || hasPermission('create-cultivation-areas');
  const canEdit = !hasPermission || hasPermission('edit-cultivation-areas');
  const canDelete = !hasPermission || hasPermission('delete-cultivation-areas');

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LocationOnIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h5" fontWeight="bold">Cultivation Areas</Typography>
        </Box>
        {canCreate && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
            New Area
          </Button>
        )}
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
              <InputLabel>Facility</InputLabel>
              <Select value={filterFacility} onChange={(e) => setFilterFacility(e.target.value)} label="Facility">
                <MenuItem value="all">All Facilities</MenuItem>
                {facilities.map((f) => (<MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Stage</InputLabel>
              <Select value={filterStage} onChange={(e) => setFilterStage(e.target.value)} label="Stage">
                <MenuItem value="all">All Stages</MenuItem>
                {stages.map((s) => (<MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={2}>
            <Tooltip title="Refresh">
              <IconButton onClick={fetchAreas} color="primary"><RefreshIcon /></IconButton>
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
                  Area Name
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel active={orderBy === 'facility_id'} direction={orderBy === 'facility_id' ? order : 'asc'} onClick={() => handleSort('facility_id')}>
                  Facility
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel active={orderBy === 'current_stage_id'} direction={orderBy === 'current_stage_id' ? order : 'asc'} onClick={() => handleSort('current_stage_id')}>
                  Current Stage
                </TableSortLabel>
              </TableCell>
              <TableCell align="center">Capacity</TableCell>
              <TableCell>Description</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}><CircularProgress /></TableCell></TableRow>
            ) : paginatedAreas.length === 0 ? (
              <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}><Typography color="text.secondary">No cultivation areas found</Typography></TableCell></TableRow>
            ) : (
              paginatedAreas.map((area) => (
                <TableRow key={area.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LocationOnIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                      <Typography fontWeight="medium">{area.name}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <WarehouseIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      {getFacilityName(area.facility_id)}
                    </Box>
                  </TableCell>
                  <TableCell>
                    {area.current_stage_id ? (
                      <Chip 
                        label={getStageName(area.current_stage_id)} 
                        size="small" 
                        sx={{ bgcolor: getStageColor(area.current_stage_id), color: 'white' }} 
                      />
                    ) : (
                      <Typography color="text.secondary">-</Typography>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {area.capacity_units ? (
                      <Typography>{area.capacity_units} {area.capacity_unit_type || 'units'}</Typography>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {area.description || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    {canEdit && (
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => handleOpenDialog(area)}><EditIcon fontSize="small" /></IconButton>
                      </Tooltip>
                    )}
                    {canDelete && (
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => handleDeleteClick(area)}><DeleteIcon fontSize="small" /></IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination 
          component="div" 
          count={totalCount} 
          page={page} 
          onPageChange={handleChangePage} 
          rowsPerPage={rowsPerPage} 
          onRowsPerPageChange={handleChangeRowsPerPage} 
          rowsPerPageOptions={[10, 20, 50, 100]} 
        />
      </TableContainer>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth PaperProps={{ sx: { maxHeight: '90vh' } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
          <LocationOnIcon color="primary" />
          {editingArea ? 'Edit Cultivation Area' : 'New Cultivation Area'}
          <IconButton aria-label="close" onClick={handleCloseDialog} sx={{ position: 'absolute', right: 8, top: 8 }}><CloseIcon /></IconButton>
        </DialogTitle>

        <form onSubmit={handleSaveArea}>
          <DialogContent sx={{ pt: 3 }}>
            {/* Tenant Selector for Global Admin */}
            {isGlobalAdmin && !editingArea && (
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
              <TextField 
                size="small" 
                name="name" 
                label="Area Name *" 
                value={formData.name} 
                onChange={handleFormChange} 
                required 
                sx={{ flex: 2, minWidth: 200 }} 
              />
              <FormControl size="small" sx={{ flex: 1, minWidth: 200 }} required>
                <InputLabel>Facility *</InputLabel>
                <Select name="facility_id" value={formData.facility_id} label="Facility *" onChange={handleFormChange} required>
                  <MenuItem value=""><em>Select Facility</em></MenuItem>
                  {facilities.map((f) => (<MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>))}
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ mb: 3 }}>
              <TextField 
                fullWidth 
                size="small" 
                name="description" 
                label="Description" 
                value={formData.description} 
                onChange={handleFormChange} 
                multiline 
                rows={2} 
              />
            </Box>

            <Typography variant="subtitle1" fontWeight="bold" color="primary" sx={{ mb: 1.5 }}>Capacity & Stage</Typography>
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
              <TextField 
                size="small" 
                name="capacity_units" 
                label="Capacity" 
                type="number" 
                value={formData.capacity_units} 
                onChange={handleFormChange} 
                inputProps={{ min: 1 }} 
                sx={{ flex: 1, minWidth: 120 }} 
              />
              <FormControl size="small" sx={{ flex: 1, minWidth: 150 }}>
                <InputLabel>Unit Type</InputLabel>
                <Select name="capacity_unit_type" value={formData.capacity_unit_type} label="Unit Type" onChange={handleFormChange}>
                  {CAPACITY_UNIT_TYPES.map((type) => (<MenuItem key={type} value={type}>{type}</MenuItem>))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ flex: 1, minWidth: 180 }}>
                <InputLabel>Current Stage</InputLabel>
                <Select name="current_stage_id" value={formData.current_stage_id} label="Current Stage" onChange={handleFormChange}>
                  <MenuItem value=""><em>None</em></MenuItem>
                  {stages.map((s) => (<MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>))}
                </Select>
              </FormControl>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #e0e0e0' }}>
            <Button onClick={handleCloseDialog} disabled={dialogLoading}>Cancel</Button>
            <Button 
              type="submit" 
              variant="contained" 
              color="primary" 
              disabled={dialogLoading || !formData.name || !formData.facility_id || (isGlobalAdmin && !editingArea && !selectedTenantId)} 
              startIcon={dialogLoading && <CircularProgress size={16} color="inherit" />}
            >
              {dialogLoading ? 'Saving...' : 'Save'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete the cultivation area "{areaToDelete?.name}"? This action cannot be undone.</Typography>
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

CultivationAreasPage.propTypes = {
  isAppReady: PropTypes.bool.isRequired,
  isGlobalAdmin: PropTypes.bool,
  setParentSnack: PropTypes.func,
  hasPermission: PropTypes.func,
};

CultivationAreasPage.defaultProps = {
  isGlobalAdmin: false,
  setParentSnack: null,
  hasPermission: null,
};

export default CultivationAreasPage;
