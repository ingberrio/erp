// src/components/crm/CrmAccountsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { api } from '../../App';
import {
  Box, Typography, Button, CircularProgress, Snackbar, Alert,
  TextField, Paper, IconButton, Grid, Chip, MenuItem, Select,
  FormControl, InputLabel, InputAdornment, Tooltip, Switch,
  Dialog, DialogTitle, DialogContent, DialogActions, Divider,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, TableSortLabel, FormControlLabel, Radio, RadioGroup,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import BusinessIcon from '@mui/icons-material/Business';
import FilterListIcon from '@mui/icons-material/FilterList';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

// Constants
const ACCOUNT_STATUSES = [
  { value: 'active', label: 'Active', color: '#4caf50' },
  { value: 'pending', label: 'Pending', color: '#ffa726' },
  { value: 'awaiting_approval', label: 'Awaiting Approval', color: '#29b6f6' },
  { value: 'approved', label: 'Approved', color: '#66bb6a' },
  { value: 'rejected', label: 'Rejected', color: '#ef5350' },
  { value: 'suspended', label: 'Suspended', color: '#78909c' },
];

const ACCOUNT_TYPES = [
  { value: 'license_holder', label: 'License Holder' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'distributor', label: 'Distributor' },
  { value: 'retailer', label: 'Retailer' },
  { value: 'other', label: 'Other' },
];

const CANADIAN_PROVINCES = [
  'Alberta', 'British Columbia', 'Manitoba', 'New Brunswick',
  'Newfoundland and Labrador', 'Northwest Territories', 'Nova Scotia',
  'Nunavut', 'Ontario', 'Prince Edward Island', 'Quebec', 'Saskatchewan', 'Yukon'
];

const COUNTRIES = [
  'Canada', 'United States', 'Mexico', 'United Kingdom', 'Germany', 'France', 
  'Spain', 'Italy', 'Netherlands', 'Belgium', 'Australia', 'Other'
];

const getTypeLabel = (type) => {
  const typeConfig = ACCOUNT_TYPES.find(t => t.value === type);
  return typeConfig ? typeConfig.label : type;
};

const getExpirationStatusColor = (status) => {
  switch (status) {
    case 'Expired': return '#ef5350';
    case 'Expiring soon': return '#ffa726';
    case 'Not expired': return '#66bb6a';
    default: return '#757575';
  }
};

// Initial form state
const initialFormData = {
  account_type: 'license_holder',
  account_status: 'active',
  name: '',
  phone: '',
  email: '',
  fax: '',
  expiration_date: '',
  license_number: '',
  address_line1: '',
  address_line2: '',
  city: '',
  province: '',
  postal_code: '',
  country: 'Canada',
  shipping_same_as_primary: true,
  shipping_address_line1: '',
  shipping_address_line2: '',
  shipping_city: '',
  shipping_province: '',
  shipping_postal_code: '',
  shipping_country: 'Canada',
  notes: '',
};

const CrmAccountsPage = ({ tenantId, isAppReady, isGlobalAdmin, setParentSnack }) => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [orderBy, setOrderBy] = useState('id');
  const [order, setOrder] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [dialogLoading, setDialogLoading] = useState(false);
  
  // Tenants for Global Admin
  const [tenants, setTenants] = useState([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [formData, setFormData] = useState(initialFormData);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState(null);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

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

  const fetchAccounts = useCallback(async () => {
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
      if (filterStatus !== 'all') params.append('status', filterStatus);
      if (filterType !== 'all') params.append('type', filterType);
      
      const response = await api.get(`/crm/accounts?${params.toString()}`);
      setAccounts(response.data.data || []);
      setTotalCount(response.data.total || 0);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      showSnack('Error loading accounts', 'error');
    } finally {
      setLoading(false);
    }
  }, [isAppReady, page, rowsPerPage, orderBy, order, searchTerm, filterStatus, filterType, showSnack]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

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

  const handleOpenDialog = (account = null) => {
    if (account) {
      setEditingAccount(account);
      setFormData({
        account_type: account.account_type || 'license_holder',
        account_status: account.account_status || 'active',
        name: account.name || '',
        phone: account.phone || '',
        email: account.email || '',
        fax: account.fax || '',
        expiration_date: account.expiration_date ? account.expiration_date.split('T')[0] : '',
        license_number: account.license_number || '',
        address_line1: account.address_line1 || '',
        address_line2: account.address_line2 || '',
        city: account.city || '',
        province: account.province || '',
        postal_code: account.postal_code || '',
        country: account.country || 'Canada',
        shipping_same_as_primary: account.shipping_same_as_primary ?? true,
        shipping_address_line1: account.shipping_address_line1 || '',
        shipping_address_line2: account.shipping_address_line2 || '',
        shipping_city: account.shipping_city || '',
        shipping_province: account.shipping_province || '',
        shipping_postal_code: account.shipping_postal_code || '',
        shipping_country: account.shipping_country || 'Canada',
        notes: account.notes || '',
      });
      // Set tenant for editing (Global Admin)
      if (isGlobalAdmin && account.tenant_id) {
        setSelectedTenantId(account.tenant_id);
      }
    } else {
      setEditingAccount(null);
      setFormData(initialFormData);
      setSelectedTenantId(''); // Reset tenant selection for new account
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingAccount(null);
    setDialogLoading(false);
    setSelectedTenantId(''); // Reset on close
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleShippingOptionChange = (e) => {
    const sameAsPrimary = e.target.value === 'same';
    setFormData(prev => ({
      ...prev,
      shipping_same_as_primary: sameAsPrimary,
      ...(sameAsPrimary && {
        shipping_address_line1: '',
        shipping_address_line2: '',
        shipping_city: '',
        shipping_province: '',
        shipping_postal_code: '',
        shipping_country: '',
      })
    }));
  };

  const handleSaveAccount = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showSnack('Name is required', 'warning');
      return;
    }
    if (!formData.address_line1.trim()) {
      showSnack('Address 1 is required', 'warning');
      return;
    }
    if (!formData.city.trim()) {
      showSnack('City is required', 'warning');
      return;
    }
    if (!formData.province.trim()) {
      showSnack('Province/State/Territory is required', 'warning');
      return;
    }
    if (!formData.postal_code.trim()) {
      showSnack('Postal Code is required', 'warning');
      return;
    }
    if (!formData.country.trim()) {
      showSnack('Country is required', 'warning');
      return;
    }
    // Validate tenant selection for Global Admin
    if (isGlobalAdmin && !selectedTenantId) {
      showSnack('Please select a Tenant', 'warning');
      return;
    }
    
    setDialogLoading(true);
    try {
      const payload = { ...formData };
      if (!payload.expiration_date) delete payload.expiration_date;
      
      // Include tenant_id for Global Admin
      if (isGlobalAdmin && selectedTenantId) {
        payload.tenant_id = selectedTenantId;
      }
      
      if (editingAccount) {
        await api.put(`/crm/accounts/${editingAccount.id}`, payload);
        showSnack('Account updated successfully', 'success');
      } else {
        await api.post('/crm/accounts', payload);
        showSnack('Account created successfully', 'success');
      }
      handleCloseDialog();
      fetchAccounts();
    } catch (error) {
      console.error('Error saving account:', error);
      const message = error.response?.data?.message || 'Error saving account';
      const details = error.response?.data?.details;
      if (details) {
        const errorMessages = Object.values(details).flat().join(', ');
        showSnack(`${message}: ${errorMessages}`, 'error');
      } else {
        showSnack(message, 'error');
      }
    } finally {
      setDialogLoading(false);
    }
  };

  const handleDeleteClick = (account) => {
    setAccountToDelete(account);
    setDeleteDialogOpen(true);
  };

  const handleToggleActive = async (account) => {
    try {
      const newStatus = account.account_status === 'suspended' ? 'active' : 'suspended';
      await api.put(`/crm/accounts/${account.id}`, { account_status: newStatus });
      showSnack(`Account ${newStatus === 'active' ? 'activated' : 'suspended'} successfully`, 'success');
      fetchAccounts();
    } catch (error) {
      console.error('Error toggling account status:', error);
      showSnack('Error updating account status', 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!accountToDelete) return;
    setDialogLoading(true);
    try {
      await api.delete(`/crm/accounts/${accountToDelete.id}`);
      showSnack('Account deleted successfully', 'info');
      setDeleteDialogOpen(false);
      setAccountToDelete(null);
      fetchAccounts();
    } catch (error) {
      console.error('Error deleting account:', error);
      showSnack(error.response?.data?.message || 'Error deleting account', 'error');
    } finally {
      setDialogLoading(false);
    }
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setAccountToDelete(null);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      setPage(0);
      fetchAccounts();
    }
  };

  if (loading && accounts.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading accounts...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 0 }}>
      {/* Header - Compact */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BusinessIcon sx={{ fontSize: 24, color: '#1976d2' }} />
          <Typography variant="h6" fontWeight="bold">Accounts</Typography>
          <Chip label={totalCount} size="small" color="primary" />
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh">
            <IconButton onClick={() => fetchAccounts()} disabled={loading} size="small">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => handleOpenDialog()} sx={{ textTransform: 'none' }}>
            Add Account
          </Button>
        </Box>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search by name, email or license..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment>,
              }}
            />
          </Grid>
          <Grid item xs={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select value={filterStatus} label="Status" onChange={(e) => { setFilterStatus(e.target.value); setPage(0); }}>
                <MenuItem value="all">All Statuses</MenuItem>
                {ACCOUNT_STATUSES.map(status => (
                  <MenuItem key={status.value} value={status.value}>{status.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Type</InputLabel>
              <Select value={filterType} label="Type" onChange={(e) => { setFilterType(e.target.value); setPage(0); }}>
                <MenuItem value="all">All Types</MenuItem>
                {ACCOUNT_TYPES.map(type => (
                  <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<FilterListIcon />}
                onClick={() => { setSearchTerm(''); setFilterStatus('all'); setFilterType('all'); setPage(0); }}
              >
                Clear Filters
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Accounts Table */}
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
                <TableCell>Type</TableCell>
                <TableCell>
                  <TableSortLabel active={orderBy === 'account_status'} direction={orderBy === 'account_status' ? order : 'asc'} onClick={() => handleSort('account_status')}>
                    Status
                  </TableSortLabel>
                </TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>License #</TableCell>
                <TableCell>
                  <TableSortLabel active={orderBy === 'expiration_date'} direction={orderBy === 'expiration_date' ? order : 'asc'} onClick={() => handleSort('expiration_date')}>
                    Expiration
                  </TableSortLabel>
                </TableCell>
                <TableCell>City</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 4 }}><CircularProgress size={24} /></TableCell>
                </TableRow>
              ) : accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                    <Typography color="textSecondary">No accounts found</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                accounts.map((account) => (
                  <TableRow key={account.id} hover>
                    <TableCell>{account.id}</TableCell>
                    <TableCell><Typography fontWeight={500}>{account.name}</Typography></TableCell>
                    <TableCell>{getTypeLabel(account.account_type)}</TableCell>
                    <TableCell>
                      <Tooltip title={account.account_status === 'suspended' ? 'Click to activate' : 'Click to suspend'}>
                        <Switch
                          checked={account.account_status !== 'suspended'}
                          onChange={() => handleToggleActive(account)}
                          size="small"
                          color="success"
                        />
                      </Tooltip>
                    </TableCell>
                    <TableCell>{account.email || '-'}</TableCell>
                    <TableCell>{account.phone || '-'}</TableCell>
                    <TableCell>{account.license_number || '-'}</TableCell>
                    <TableCell>
                      {account.expiration_date ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography variant="body2">{new Date(account.expiration_date).toLocaleDateString()}</Typography>
                          {account.expiration_status && (
                            <Chip
                              label={account.expiration_status}
                              size="small"
                              sx={{ bgcolor: getExpirationStatusColor(account.expiration_status), color: '#fff', fontSize: '0.65rem', height: 18 }}
                            />
                          )}
                        </Box>
                      ) : '-'}
                    </TableCell>
                    <TableCell>{account.city || '-'}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => handleOpenDialog(account)}><EditIcon fontSize="small" /></IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => handleDeleteClick(account)}><DeleteIcon fontSize="small" /></IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[10, 25, 50, 100]}
          component="div"
          count={totalCount}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth PaperProps={{ sx: { maxHeight: '90vh' } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid #e0e0e0', pb: 2 }}>
          <BusinessIcon color="primary" />
          {editingAccount ? 'Edit Account' : 'Add New Account'}
          <IconButton aria-label="close" onClick={handleCloseDialog} sx={{ position: 'absolute', right: 8, top: 8 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <form onSubmit={handleSaveAccount}>
          <DialogContent sx={{ pt: 3 }}>
            
            {/* Tenant Selector for Global Admin */}
            {isGlobalAdmin && (
              <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center' }}>
                <FormControl size="small" sx={{ minWidth: 250 }} required>
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
                <Tooltip title="As Global Admin, select the tenant this account belongs to">
                  <HelpOutlineIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                </Tooltip>
              </Box>
            )}

            {/* Account Type Row */}
            <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center' }}>
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Account Type *</InputLabel>
                <Select name="account_type" value={formData.account_type} label="Account Type *" onChange={handleFormChange} required>
                  {ACCOUNT_TYPES.map(type => (
                    <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Tooltip title="Select the type of account based on their business role">
                <HelpOutlineIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              </Tooltip>
            </Box>

            {/* Account Information Section */}
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1.5 }}>Account Information</Typography>
            <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
              <TextField size="small" name="name" label="Name *" value={formData.name} onChange={handleFormChange} required sx={{ flex: 1, minWidth: 200 }} />
              <TextField size="small" name="phone" label="Phone Number" value={formData.phone} onChange={handleFormChange} sx={{ flex: 1, minWidth: 150 }} />
            </Box>
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
              <TextField size="small" name="email" label="E-mail" type="email" value={formData.email} onChange={handleFormChange} sx={{ flex: 1, minWidth: 180 }} />
              <TextField size="small" name="fax" label="Fax (Optional)" value={formData.fax} onChange={handleFormChange} sx={{ flex: 1, minWidth: 150 }} />
              <TextField size="small" name="expiration_date" label="Expiration date (Optional)" type="date" value={formData.expiration_date} onChange={handleFormChange} InputLabelProps={{ shrink: true }} sx={{ flex: 1, minWidth: 180 }} />
              <TextField size="small" name="license_number" label="License Number (Optional)" value={formData.license_number} onChange={handleFormChange} sx={{ flex: 1, minWidth: 180 }} />
            </Box>

            {/* Address Section */}
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1.5 }}>Address</Typography>
            <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
              <TextField size="small" name="address_line1" label="Address 1 *" value={formData.address_line1} onChange={handleFormChange} required sx={{ flex: 2, minWidth: 200 }} />
              <TextField size="small" name="address_line2" label="Apt, Suite # (Optional)" value={formData.address_line2} onChange={handleFormChange} sx={{ flex: 1, minWidth: 150 }} />
              <TextField size="small" name="city" label="City *" value={formData.city} onChange={handleFormChange} required sx={{ flex: 1, minWidth: 150 }} />
              <FormControl size="small" sx={{ flex: 1, minWidth: 150 }} required>
                <InputLabel>Province/State/Territory *</InputLabel>
                <Select name="province" value={formData.province} label="Province/State/Territory *" onChange={handleFormChange} required>
                  {CANADIAN_PROVINCES.map(province => (
                    <MenuItem key={province} value={province}>{province}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
              <TextField size="small" name="postal_code" label="Postal Code *" value={formData.postal_code} onChange={handleFormChange} required sx={{ flex: 1, minWidth: 150 }} />
              <FormControl size="small" sx={{ flex: 1, minWidth: 150 }} required>
                <InputLabel>Country *</InputLabel>
                <Select name="country" value={formData.country} label="Country *" onChange={handleFormChange} required>
                  {COUNTRIES.map(country => (
                    <MenuItem key={country} value={country}>{country}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Box sx={{ flex: 2 }} /> {/* Spacer */}
            </Box>

            {/* Shipping Address Section */}
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1.5 }}>Shipping Address</Typography>
            <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <FormControl component="fieldset">
                <RadioGroup row value={formData.shipping_same_as_primary ? 'same' : 'different'} onChange={handleShippingOptionChange}>
                  <FormControlLabel value="same" control={<Radio size="small" />} label="Same as address" />
                  <FormControlLabel value="different" control={<Radio size="small" />} label="Add new shipping address" />
                </RadioGroup>
              </FormControl>
              <TextField 
                size="small" 
                multiline 
                rows={3} 
                name="notes" 
                label="Notes (Optional)" 
                value={formData.notes} 
                onChange={handleFormChange} 
                sx={{ flex: 1, minWidth: 250 }} 
              />
            </Box>

            {/* Shipping Address Fields (conditional) */}
            {!formData.shipping_same_as_primary && (
              <Box sx={{ p: 2, bgcolor: '#f5f5f5', borderRadius: 1, mt: 1 }}>
                <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                  <TextField size="small" name="shipping_address_line1" label="Address 1" value={formData.shipping_address_line1} onChange={handleFormChange} sx={{ flex: 2, minWidth: 200 }} />
                  <TextField size="small" name="shipping_address_line2" label="Apt, Suite # (Optional)" value={formData.shipping_address_line2} onChange={handleFormChange} sx={{ flex: 1, minWidth: 150 }} />
                  <TextField size="small" name="shipping_city" label="City" value={formData.shipping_city} onChange={handleFormChange} sx={{ flex: 1, minWidth: 150 }} />
                  <FormControl size="small" sx={{ flex: 1, minWidth: 150 }}>
                    <InputLabel>Province/State/Territory</InputLabel>
                    <Select name="shipping_province" value={formData.shipping_province} label="Province/State/Territory" onChange={handleFormChange}>
                      {CANADIAN_PROVINCES.map(province => (
                        <MenuItem key={province} value={province}>{province}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <TextField size="small" name="shipping_postal_code" label="Postal Code" value={formData.shipping_postal_code} onChange={handleFormChange} sx={{ flex: 1, minWidth: 150 }} />
                  <FormControl size="small" sx={{ flex: 1, minWidth: 150 }}>
                    <InputLabel>Country</InputLabel>
                    <Select name="shipping_country" value={formData.shipping_country} label="Country" onChange={handleFormChange}>
                      {COUNTRIES.map(country => (
                        <MenuItem key={country} value={country}>{country}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Box sx={{ flex: 2 }} /> {/* Spacer */}
                </Box>
              </Box>
            )}

          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #e0e0e0' }}>
            <Button onClick={handleCloseDialog} disabled={dialogLoading}>Close</Button>
            <Button type="submit" variant="contained" disabled={dialogLoading} startIcon={dialogLoading && <CircularProgress size={16} color="inherit" />}>
              {dialogLoading ? 'Saving...' : 'Submit'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleCancelDelete} maxWidth="sm">
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete the account <strong>{accountToDelete?.name}</strong>?</Typography>
          <Typography color="error" sx={{ mt: 1 }}>This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete} disabled={dialogLoading}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained" disabled={dialogLoading} startIcon={dialogLoading && <CircularProgress size={16} color="inherit" />}>
            {dialogLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      {!setParentSnack && (
        <Snackbar open={snack.open} autoHideDuration={6000} onClose={() => setSnack({ ...snack, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
          <Alert onClose={() => setSnack({ ...snack, open: false })} severity={snack.severity}>{snack.message}</Alert>
        </Snackbar>
      )}
    </Box>
  );
};

CrmAccountsPage.propTypes = {
  tenantId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  isAppReady: PropTypes.bool,
  isGlobalAdmin: PropTypes.bool,
  setParentSnack: PropTypes.func,
};

CrmAccountsPage.defaultProps = {
  tenantId: null,
  isAppReady: false,
  isGlobalAdmin: false,
  setParentSnack: null,
};

export default CrmAccountsPage;
