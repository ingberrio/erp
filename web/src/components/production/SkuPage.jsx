// src/components/production/SkuPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { api } from '../../App';
import {
  Box, Typography, Button, CircularProgress, Snackbar, Alert,
  TextField, Paper, IconButton, Chip, MenuItem, Select,
  FormControl, InputLabel, Tooltip, Switch, FormControlLabel, Checkbox,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, TableSortLabel, Grid, InputAdornment,
  Stepper, Step, StepLabel,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import InventoryIcon from '@mui/icons-material/Inventory';

// Stepper steps
const steps = ['SKU Details', 'Unit Details', 'Confirm'];

// Constants
const SALES_CLASSES = [
  { value: 'wholesale', label: 'Wholesale' },
  { value: 'patient', label: 'Patient' },
  { value: 'intra-industry', label: 'Intra-Industry' },
  { value: 'recreational', label: 'Recreational' },
];

const TYPES = [
  { value: 'unpackaged', label: 'Unpackaged' },
  { value: 'packaged', label: 'Packaged' },
];

const END_TYPES = [
  { value: 'dry', label: 'dry (Dried)' },
  { value: 'dry+biomass', label: 'dry+biomass (Extracts - Other)' },
  { value: 'g-wet', label: 'g-wet (Wet)' },
  { value: 'plants', label: 'plants (Plants)' },
  { value: 'seeds', label: 'seeds (Seeds)' },
];

const CANNABIS_CLASSES = [
  { value: 'cannabis plants seeds', label: 'cannabis plants seeds' },
  { value: 'cannabis plants', label: 'cannabis plants' },
  { value: 'fresh cannabis', label: 'fresh cannabis' },
  { value: 'dried cannabis', label: 'dried cannabis' },
  { value: 'cannabis oil', label: 'cannabis oil' },
];

const UNITS = [
  { value: 'g', label: 'g' },
  { value: 'kg', label: 'kg' },
];

const STATUS_OPTIONS = [
  { value: 'enabled', label: 'Enabled' },
  { value: 'disabled', label: 'Disabled' },
];

const getSalesClassColor = (salesClass) => {
  switch (salesClass) {
    case 'wholesale': return '#1976d2'; // Blue
    case 'patient': return '#388e3c'; // Green
    case 'intra-industry': return '#7b1fa2'; // Purple
    case 'recreational': return '#f57c00'; // Orange
    default: return '#757575';
  }
};

const getTypeColor = (type) => {
  switch (type) {
    case 'unpackaged': return '#616161'; // Gray
    case 'packaged': return '#0288d1'; // Light Blue
    default: return '#757575';
  }
};

// Initial form state
const initialFormData = {
  name: '',
  variety_id: '',
  sales_class: 'intra-industry',
  gtin_12: '',
  gtin_14: '',
  status: 'enabled',
  end_type: '',
  cannabis_class: '',
  unit: 'g',
  type: 'unpackaged', // Default as per user request
  unit_quantity: 1,
  unit_weight: 0,
  total_packaged_weight: '',
  estimated_price: 0,
  cost_per_package: 0,
  is_ghost_sku: false,
};

const SkuPage = ({ tenantId, isAppReady, isGlobalAdmin, setParentSnack }) => {
  const [skus, setSkus] = useState([]);
  const [varieties, setVarieties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [orderBy, setOrderBy] = useState('id');
  const [order, setOrder] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSku, setEditingSku] = useState(null);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [formData, setFormData] = useState(initialFormData);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [skuToDelete, setSkuToDelete] = useState(null);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });
  const [activeStep, setActiveStep] = useState(0);
  
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

  // Fetch varieties for dropdown
  const fetchVarieties = useCallback(async () => {
    if (!isAppReady) return;
    try {
      const response = await api.get('/production/skus/varieties');
      console.log('Varieties response:', response.data);
      const data = Array.isArray(response.data) ? response.data : response.data.data || [];
      setVarieties(data);
    } catch (error) {
      console.error('Error fetching varieties:', error);
    }
  }, [isAppReady]);

  useEffect(() => {
    fetchVarieties();
  }, [fetchVarieties]);

  const fetchSkus = useCallback(async () => {
    if (!isAppReady) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (filterType !== 'all') params.append('type', filterType);
      if (filterStatus !== 'all') params.append('status', filterStatus);
      
      const response = await api.get(`/production/skus?${params.toString()}`);
      const data = Array.isArray(response.data) ? response.data : response.data.data || [];
      setSkus(data);
      setTotalCount(data.length);
    } catch (error) {
      console.error('Error fetching SKUs:', error);
      showSnack('Error loading SKUs', 'error');
    } finally {
      setLoading(false);
    }
  }, [isAppReady, searchTerm, filterType, filterStatus, showSnack]);

  useEffect(() => {
    fetchSkus();
  }, [fetchSkus]);

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

  const handleOpenDialog = (sku = null) => {
    if (sku) {
      setEditingSku(sku);
      setFormData({
        name: sku.name || '',
        variety_id: sku.variety_id || '',
        sales_class: sku.sales_class || 'intra-industry',
        gtin_12: sku.gtin_12 || '',
        gtin_14: sku.gtin_14 || '',
        status: sku.status || 'enabled',
        end_type: sku.end_type || '',
        cannabis_class: sku.cannabis_class || '',
        unit: sku.unit || 'g',
        type: sku.type || 'unpackaged',
        unit_quantity: sku.unit_quantity || 1,
        unit_weight: sku.unit_weight || 0,
        total_packaged_weight: sku.total_packaged_weight || '',
        estimated_price: sku.estimated_price || 0,
        cost_per_package: sku.cost_per_package || 0,
        is_ghost_sku: sku.is_ghost_sku || false,
      });
      if (isGlobalAdmin && sku.tenant_id) {
        setSelectedTenantId(sku.tenant_id);
      }
    } else {
      setEditingSku(null);
      setFormData(initialFormData);
      setSelectedTenantId('');
    }
    setActiveStep(0);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingSku(null);
    setDialogLoading(false);
    setSelectedTenantId('');
    setActiveStep(0);
  };

  const handleNext = () => {
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSaveSku = async (e) => {
    e.preventDefault();
    setDialogLoading(true);

    try {
      const payload = { ...formData };
      
      // Convert numeric fields
      payload.unit_quantity = parseFloat(payload.unit_quantity) || 1;
      payload.unit_weight = parseFloat(payload.unit_weight) || 0;
      payload.estimated_price = parseFloat(payload.estimated_price) || 0;
      payload.cost_per_package = parseFloat(payload.cost_per_package) || 0;
      if (payload.total_packaged_weight) {
        payload.total_packaged_weight = parseFloat(payload.total_packaged_weight);
      } else {
        delete payload.total_packaged_weight;
      }
      
      // For Global Admin, add tenant_id
      if (isGlobalAdmin && selectedTenantId) {
        payload.tenant_id = selectedTenantId;
      }

      if (editingSku) {
        await api.put(`/production/skus/${editingSku.id}`, payload);
        showSnack('SKU updated successfully', 'success');
      } else {
        await api.post('/production/skus', payload);
        showSnack('SKU created successfully', 'success');
      }
      handleCloseDialog();
      fetchSkus();
    } catch (error) {
      console.error('Error saving SKU:', error);
      const errorMessage = error.response?.data?.message || 'Error saving SKU';
      showSnack(errorMessage, 'error');
    } finally {
      setDialogLoading(false);
    }
  };

  const handleOpenDeleteDialog = (sku) => {
    setSkuToDelete(sku);
    setDeleteDialogOpen(true);
  };

  const handleDeleteSku = async () => {
    if (!skuToDelete) return;
    try {
      await api.delete(`/production/skus/${skuToDelete.id}`);
      showSnack('SKU deleted successfully', 'success');
      fetchSkus();
    } catch (error) {
      console.error('Error deleting SKU:', error);
      showSnack('Error deleting SKU', 'error');
    } finally {
      setDeleteDialogOpen(false);
      setSkuToDelete(null);
    }
  };

  const handleToggleStatus = async (sku) => {
    try {
      const response = await api.patch(`/production/skus/${sku.id}/toggle-status`);
      setSkus(prev => prev.map(s => s.id === sku.id ? response.data : s));
      showSnack(`SKU ${response.data.status === 'enabled' ? 'enabled' : 'disabled'}`, 'success');
    } catch (error) {
      console.error('Error toggling SKU status:', error);
      showSnack('Error updating SKU status', 'error');
    }
  };

  // Sorting function
  const sortedSkus = [...skus].sort((a, b) => {
    const aValue = a[orderBy] || '';
    const bValue = b[orderBy] || '';
    if (order === 'asc') {
      return aValue > bValue ? 1 : -1;
    }
    return aValue < bValue ? 1 : -1;
  });

  // Pagination
  const paginatedSkus = sortedSkus.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <InventoryIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h5" fontWeight="bold">
            SKUs
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          New SKU
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
              InputProps={{
                startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />,
              }}
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Type</InputLabel>
              <Select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                label="Type"
              >
                <MenuItem value="all">All Types</MenuItem>
                {TYPES.map((t) => (
                  <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                label="Status"
              >
                <MenuItem value="all">All Status</MenuItem>
                {STATUS_OPTIONS.map((s) => (
                  <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={2}>
            <Tooltip title="Refresh">
              <IconButton onClick={fetchSkus} color="primary">
                <RefreshIcon />
              </IconButton>
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
                <TableSortLabel
                  active={orderBy === 'name'}
                  direction={orderBy === 'name' ? order : 'asc'}
                  onClick={() => handleSort('name')}
                >
                  SKU Name
                </TableSortLabel>
              </TableCell>
              <TableCell>Variety</TableCell>
              <TableCell>Sales Class</TableCell>
              <TableCell>Type</TableCell>
              <TableCell align="right">Unit Weight</TableCell>
              <TableCell align="right">Target Weight</TableCell>
              <TableCell align="right">Price</TableCell>
              <TableCell align="center">Status</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : paginatedSkus.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">No SKUs found</Typography>
                </TableCell>
              </TableRow>
            ) : (
              paginatedSkus.map((sku) => (
                <TableRow key={sku.id} hover>
                  <TableCell>
                    <Typography fontWeight="medium">{sku.name}</Typography>
                  </TableCell>
                  <TableCell>
                    {sku.variety?.name || '-'}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={SALES_CLASSES.find(sc => sc.value === sku.sales_class)?.label || sku.sales_class}
                      size="small"
                      sx={{ bgcolor: getSalesClassColor(sku.sales_class), color: 'white' }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={TYPES.find(t => t.value === sku.type)?.label || sku.type}
                      size="small"
                      sx={{ bgcolor: getTypeColor(sku.type), color: 'white' }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    {sku.unit_weight} {sku.unit}
                  </TableCell>
                  <TableCell align="right">
                    {sku.target_weight} {sku.unit}
                  </TableCell>
                  <TableCell align="right">
                    CA${parseFloat(sku.estimated_price || 0).toFixed(2)}
                  </TableCell>
                  <TableCell align="center">
                    <Switch
                      checked={sku.status === 'enabled'}
                      onChange={() => handleToggleStatus(sku)}
                      color="success"
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => handleOpenDialog(sku)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => handleOpenDeleteDialog(sku)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
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

      {/* Create/Edit Dialog with Stepper */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth PaperProps={{ sx: { maxHeight: '90vh' } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
          <InventoryIcon color="primary" />
          {editingSku ? 'Edit SKU' : 'New SKU'}
          <IconButton aria-label="close" onClick={handleCloseDialog} sx={{ position: 'absolute', right: 8, top: 8 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        
        <Stepper activeStep={activeStep} sx={{ px: 3, py: 2 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <form onSubmit={handleSaveSku}>
          <DialogContent sx={{ pt: 3, minHeight: 380 }}>
            
            {/* Step 0: SKU Details */}
            {activeStep === 0 && (
              <Box>
                {/* Tenant Selector for Global Admin */}
                {isGlobalAdmin && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" fontWeight="bold" color="primary" sx={{ mb: 1.5 }}>Select Tenant</Typography>
                    <FormControl size="small" sx={{ minWidth: 250 }} required>
                      <InputLabel>Tenant *</InputLabel>
                      <Select 
                        value={selectedTenantId} 
                        label="Tenant *" 
                        onChange={(e) => setSelectedTenantId(e.target.value)}
                        required
                      >
                        <MenuItem value=""><em>Select Tenant</em></MenuItem>
                        {tenants.map((tenant) => (
                          <MenuItem key={tenant.id} value={tenant.id}>{tenant.name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>
                )}

                <Typography variant="subtitle1" fontWeight="bold" color="primary" sx={{ mb: 1.5 }}>SKU Information</Typography>
                <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                  <FormControl size="small" sx={{ flex: 1, minWidth: 120 }} required>
                    <InputLabel>Type *</InputLabel>
                    <Select name="type" value={formData.type} label="Type *" onChange={handleFormChange} required>
                      {TYPES.map((t) => (
                        <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField size="small" name="name" label="SKU Name *" value={formData.name} onChange={handleFormChange} required sx={{ flex: 2, minWidth: 200 }} />
                  <FormControl size="small" sx={{ flex: 1, minWidth: 150 }}>
                    <InputLabel>Variety</InputLabel>
                    <Select name="variety_id" value={formData.variety_id} label="Variety" onChange={handleFormChange}>
                      <MenuItem value=""><em>Select Variety</em></MenuItem>
                      {varieties.map((variety) => (
                        <MenuItem key={variety.id} value={variety.id}>{variety.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
                <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                  <FormControl size="small" sx={{ flex: 1, minWidth: 150 }} required>
                    <InputLabel>Sales Class *</InputLabel>
                    <Select name="sales_class" value={formData.sales_class} label="Sales Class *" onChange={handleFormChange} required>
                      {SALES_CLASSES.map((sc) => (
                        <MenuItem key={sc.value} value={sc.value}>{sc.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ flex: 1, minWidth: 120 }} required>
                    <InputLabel>Status *</InputLabel>
                    <Select name="status" value={formData.status} label="Status *" onChange={handleFormChange} required>
                      {STATUS_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>

                <Typography variant="subtitle1" fontWeight="bold" color="primary" sx={{ mb: 1.5 }}>Barcode Information</Typography>
                <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                  <TextField size="small" name="gtin_12" label="UPCA Barcode (GTIN-12)" value={formData.gtin_12} onChange={handleFormChange} sx={{ flex: 1, minWidth: 200 }} inputProps={{ maxLength: 12 }} />
                  <TextField size="small" name="gtin_14" label="DoubleStacked (GTIN-14)" value={formData.gtin_14} onChange={handleFormChange} sx={{ flex: 1, minWidth: 200 }} inputProps={{ maxLength: 14 }} />
                </Box>

                <Typography variant="subtitle1" fontWeight="bold" color="primary" sx={{ mb: 1.5 }}>Options</Typography>
                <Box sx={{ p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                  <FormControlLabel
                    control={<Checkbox checked={formData.is_ghost_sku} onChange={handleFormChange} name="is_ghost_sku" />}
                    label="Ghost SKU - Enable if this SKU is for internal tracking only"
                  />
                </Box>
              </Box>
            )}

            {/* Step 1: Unit Details */}
            {activeStep === 1 && (
              <Box>
                <Typography variant="subtitle1" fontWeight="bold" color="primary" sx={{ mb: 1.5 }}>Classification</Typography>
                <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                  <FormControl size="small" sx={{ flex: 1, minWidth: 200 }}>
                    <InputLabel>End Type</InputLabel>
                    <Select name="end_type" value={formData.end_type} label="End Type" onChange={handleFormChange}>
                      <MenuItem value=""><em>Select End Type</em></MenuItem>
                      {END_TYPES.map((et) => (
                        <MenuItem key={et.value} value={et.value}>{et.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ flex: 1, minWidth: 200 }}>
                    <InputLabel>Cannabis Class</InputLabel>
                    <Select name="cannabis_class" value={formData.cannabis_class} label="Cannabis Class" onChange={handleFormChange}>
                      <MenuItem value=""><em>Select Cannabis Class</em></MenuItem>
                      {CANNABIS_CLASSES.map((cc) => (
                        <MenuItem key={cc.value} value={cc.value}>{cc.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>

                <Typography variant="subtitle1" fontWeight="bold" color="primary" sx={{ mb: 1.5 }}>Weight & Quantity</Typography>
                <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                  <FormControl size="small" sx={{ flex: 1, minWidth: 100 }} required>
                    <InputLabel>Unit *</InputLabel>
                    <Select name="unit" value={formData.unit} label="Unit *" onChange={handleFormChange} required>
                      {UNITS.map((u) => (
                        <MenuItem key={u.value} value={u.value}>{u.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField size="small" name="unit_quantity" label="Unit Quantity *" type="number" value={formData.unit_quantity} onChange={handleFormChange} required sx={{ flex: 1, minWidth: 120 }} inputProps={{ min: 1, step: 1 }} />
                  <TextField size="small" name="unit_weight" label="Unit Weight *" type="number" value={formData.unit_weight} onChange={handleFormChange} required error={formData.unit_weight <= 0} sx={{ flex: 1, minWidth: 140 }} inputProps={{ min: 0, step: 0.01 }} InputProps={{ endAdornment: <InputAdornment position="end">{formData.unit}</InputAdornment> }} />
                </Box>
                <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                  <TextField size="small" name="total_packaged_weight" label="Total Packaged Weight" type="number" value={formData.total_packaged_weight} onChange={handleFormChange} sx={{ flex: 1, minWidth: 220 }} inputProps={{ min: 0, step: 0.01 }} InputProps={{ endAdornment: <InputAdornment position="end">{formData.unit}</InputAdornment> }} />
                  <Box sx={{ flex: 2 }} />
                </Box>

                <Typography variant="subtitle1" fontWeight="bold" color="primary" sx={{ mb: 1.5 }}>Pricing</Typography>
                <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                  <TextField size="small" name="estimated_price" label="Estimated Price" type="number" value={formData.estimated_price} onChange={handleFormChange} sx={{ flex: 1, minWidth: 150 }} inputProps={{ min: 0, step: 0.01 }} InputProps={{ startAdornment: <InputAdornment position="start">CA$</InputAdornment> }} />
                  <TextField size="small" name="cost_per_package" label="Cost per Package" type="number" value={formData.cost_per_package} onChange={handleFormChange} sx={{ flex: 1, minWidth: 150 }} inputProps={{ min: 0, step: 0.01 }} InputProps={{ startAdornment: <InputAdornment position="start">CA$</InputAdornment> }} />
                  <Box sx={{ flex: 2 }} />
                </Box>
              </Box>
            )}

            {/* Step 2: Confirm */}
            {activeStep === 2 && (
              <Box>
                <Typography variant="subtitle1" fontWeight="bold" color="primary" sx={{ mb: 2 }}>SKU DETAILS</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Sales Class</Typography>
                    <Typography variant="body2">{SALES_CLASSES.find(s => s.value === formData.sales_class)?.label || formData.sales_class}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">SKU Name</Typography>
                    <Typography variant="body2">{formData.name || '-'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Status</Typography>
                    <Typography variant="body2">{STATUS_OPTIONS.find(s => s.value === formData.status)?.label || formData.status}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Variety</Typography>
                    <Typography variant="body2">{varieties.find(v => v.id === formData.variety_id)?.name || '-'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Cannabis Class</Typography>
                    <Typography variant="body2">{CANNABIS_CLASSES.find(c => c.value === formData.cannabis_class)?.label || formData.cannabis_class || '-'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Target Weight</Typography>
                    <Typography variant="body2">{formData.unit_weight ? `${parseFloat(formData.unit_weight).toFixed(3)}` : '-'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">End Type</Typography>
                    <Typography variant="body2">{END_TYPES.find(e => e.value === formData.end_type)?.label || formData.end_type || '-'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Type</Typography>
                    <Typography variant="body2">{TYPES.find(t => t.value === formData.type)?.label || formData.type}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Unit Metric</Typography>
                    <Typography variant="body2">{formData.unit}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Unit Quantity</Typography>
                    <Typography variant="body2">{formData.unit_quantity}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Unit Weight</Typography>
                    <Typography variant="body2">{formData.unit_weight}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Unit Weight (kg)</Typography>
                    <Typography variant="body2">{formData.unit === 'g' ? (parseFloat(formData.unit_weight || 0) / 1000).toFixed(3) : formData.unit_weight}</Typography>
                  </Grid>
                </Grid>
              </Box>
            )}

          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #e0e0e0', justifyContent: 'space-between' }}>
            <Box>
              {activeStep > 0 && (
                <Button onClick={handleBack} disabled={dialogLoading}>BACK</Button>
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {activeStep < 2 ? (
                <Button variant="contained" onClick={handleNext} disabled={activeStep === 0 && (!formData.name || (isGlobalAdmin && !selectedTenantId))}>NEXT</Button>
              ) : (
                <Button type="submit" variant="contained" color="primary" disabled={dialogLoading || !formData.name || (isGlobalAdmin && !selectedTenantId)} startIcon={dialogLoading && <CircularProgress size={16} color="inherit" />}>
                  {dialogLoading ? 'Saving...' : 'SUBMIT'}
                </Button>
              )}
              <Button onClick={handleCloseDialog} disabled={dialogLoading}>CLOSE</Button>
            </Box>
          </DialogActions>
        </form>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the SKU &quot;{skuToDelete?.name}&quot;? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteSku} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snack.severity} onClose={() => setSnack({ ...snack, open: false })}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

SkuPage.propTypes = {
  tenantId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  isAppReady: PropTypes.bool.isRequired,
  isGlobalAdmin: PropTypes.bool,
  setParentSnack: PropTypes.func,
};

SkuPage.defaultProps = {
  tenantId: null,
  isGlobalAdmin: false,
  setParentSnack: null,
};

export default SkuPage;
