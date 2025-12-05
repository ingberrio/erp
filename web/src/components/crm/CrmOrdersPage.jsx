// src/components/crm/CrmOrdersPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { api } from '../../App';
import {
  Box, Typography, Button, CircularProgress, Snackbar, Alert,
  TextField, Paper, IconButton, Grid, Chip, MenuItem, Select,
  FormControl, InputLabel, Tooltip, Collapse, Switch,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, TableSortLabel,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import FilterListIcon from '@mui/icons-material/FilterList';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';

// Constants
const ORDER_STATUSES = [
  { value: 'draft', label: 'Draft', color: '#9e9e9e' },
  { value: 'pending', label: 'Pending', color: '#ffa726' },
  { value: 'approved', label: 'Approved', color: '#66bb6a' },
  { value: 'rejected', label: 'Rejected', color: '#ef5350' },
  { value: 'cancelled', label: 'Cancelled', color: '#78909c' },
  { value: 'completed', label: 'Completed', color: '#42a5f5' },
];

const SHIPPING_STATUSES = [
  { value: 'pending', label: 'Pending', color: '#9e9e9e' },
  { value: 'processing', label: 'Processing', color: '#ffa726' },
  { value: 'packaged', label: 'Packaged', color: '#29b6f6' },
  { value: 'shipped', label: 'Shipped', color: '#66bb6a' },
  { value: 'delivered', label: 'Delivered', color: '#43a047' },
  { value: 'returned', label: 'Returned', color: '#ef5350' },
];

const ORDER_TYPES = [
  { value: 'intra-industry', label: 'Intra-industry' },
  { value: 'retail', label: 'Retail' },
  { value: 'medical', label: 'Medical' },
  { value: 'export', label: 'Export' },
  { value: 'other', label: 'Other' },
];

const getStatusChip = (status, statusList) => {
  const statusConfig = statusList.find(s => s.value === status) || { label: status, color: '#757575' };
  return (
    <Chip
      label={statusConfig.label}
      size="small"
      sx={{
        bgcolor: statusConfig.color,
        color: '#fff',
        fontWeight: 500,
      }}
    />
  );
};

const formatCurrency = (value, currency = 'CAD') => {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
  }).format(value || 0);
};

const formatDate = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-CA', {
    year: '2-digit',
    month: 'numeric',
    day: 'numeric',
  });
};

const formatDateTime = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleString('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

// Initial form state
const initialFormData = {
  account_id: '',
  order_type: 'intra-industry',
  order_status: 'pending',
  shipping_status: 'pending',
  order_placed_by: '',
  received_date: new Date().toISOString().slice(0, 16),
  due_date: new Date().toISOString().slice(0, 16),
  purchase_order: '',
  shipping_address_line1: '',
  shipping_address_line2: '',
  shipping_city: '',
  shipping_province: '',
  shipping_postal_code: '',
  shipping_country: 'Canada',
  subtotal: 0,
  tax_amount: 0,
  shipping_cost: 0,
  discount_amount: 0,
  customer_license: '',
  is_oversold: false,
  notes: '',
};

const CrmOrdersPage = ({ tenantId, isAppReady, isGlobalAdmin, setParentSnack }) => {
  const [orders, setOrders] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [orderBy, setOrderBy] = useState('id');
  const [order, setOrder] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterShippingStatus, setFilterShippingStatus] = useState('all');
  const [filterOrderType, setFilterOrderType] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [formData, setFormData] = useState(initialFormData);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState(null);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });
  
  // Grouping
  const [groupBy, setGroupBy] = useState('none');
  const [expandedGroups, setExpandedGroups] = useState({});
  
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

  // Fetch accounts for dropdown - depends on selected tenant for Global Admin
  const fetchAccounts = useCallback(async (forTenantId = null) => {
    if (!isAppReady) return;
    
    // For Global Admin, need tenant selected first
    if (isGlobalAdmin && !forTenantId) {
      setAccounts([]);
      return;
    }
    
    try {
      let url = '/crm/accounts?per_page=200&account_status=active';
      if (isGlobalAdmin && forTenantId) {
        url += `&tenant_id=${forTenantId}`;
      }
      const response = await api.get(url);
      setAccounts(response.data.data || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  }, [isAppReady, isGlobalAdmin]);

  // For non-Global Admin, fetch accounts on mount
  useEffect(() => {
    if (!isGlobalAdmin) {
      fetchAccounts();
    }
  }, [isGlobalAdmin, fetchAccounts]);

  const fetchOrders = useCallback(async () => {
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
      if (filterShippingStatus !== 'all') params.append('shipping_status', filterShippingStatus);
      if (filterOrderType !== 'all') params.append('order_type', filterOrderType);
      
      const response = await api.get(`/crm/orders?${params.toString()}`);
      setOrders(response.data.data || []);
      setTotalCount(response.data.total || 0);
    } catch (error) {
      console.error('Error fetching orders:', error);
      showSnack('Error loading orders', 'error');
    } finally {
      setLoading(false);
    }
  }, [isAppReady, page, rowsPerPage, orderBy, order, searchTerm, filterStatus, filterShippingStatus, filterOrderType, showSnack]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

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

  const handleOpenDialog = (orderItem = null) => {
    if (orderItem) {
      setEditingOrder(orderItem);
      setFormData({
        account_id: orderItem.account_id || '',
        order_type: orderItem.order_type || 'intra-industry',
        order_status: orderItem.order_status || 'pending',
        shipping_status: orderItem.shipping_status || 'pending',
        order_placed_by: orderItem.order_placed_by || '',
        received_date: orderItem.received_date ? orderItem.received_date.slice(0, 16) : '',
        due_date: orderItem.due_date ? orderItem.due_date.slice(0, 16) : '',
        purchase_order: orderItem.purchase_order || '',
        shipping_address_line1: orderItem.shipping_address_line1 || '',
        shipping_address_line2: orderItem.shipping_address_line2 || '',
        shipping_city: orderItem.shipping_city || '',
        shipping_province: orderItem.shipping_province || '',
        shipping_postal_code: orderItem.shipping_postal_code || '',
        shipping_country: orderItem.shipping_country || 'Canada',
        subtotal: orderItem.subtotal || 0,
        tax_amount: orderItem.tax_amount || 0,
        shipping_cost: orderItem.shipping_cost || 0,
        discount_amount: orderItem.discount_amount || 0,
        customer_license: orderItem.customer_license || '',
        is_oversold: orderItem.is_oversold || false,
        notes: orderItem.notes || '',
      });
      if (isGlobalAdmin && orderItem.tenant_id) {
        setSelectedTenantId(orderItem.tenant_id);
      }
    } else {
      setEditingOrder(null);
      setFormData(initialFormData);
      setSelectedTenantId('');
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingOrder(null);
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

  const handleAccountSelect = (accountId) => {
    const account = accounts.find(a => a.id === accountId);
    setFormData(prev => ({
      ...prev,
      account_id: accountId,
      // Auto-fill shipping address from account if not editing
      ...(account && !editingOrder ? {
        shipping_address_line1: account.shipping_same_as_primary ? account.address_line1 : account.shipping_address_line1,
        shipping_address_line2: account.shipping_same_as_primary ? account.address_line2 : account.shipping_address_line2,
        shipping_city: account.shipping_same_as_primary ? account.city : account.shipping_city,
        shipping_province: account.shipping_same_as_primary ? account.province : account.shipping_province,
        shipping_postal_code: account.shipping_same_as_primary ? account.postal_code : account.shipping_postal_code,
        shipping_country: account.shipping_same_as_primary ? account.country : account.shipping_country,
        customer_license: account.license_number || '',
      } : {})
    }));
  };

  const handleSaveOrder = async (e) => {
    e.preventDefault();
    if (!formData.account_id) {
      showSnack('Please select an Account', 'warning');
      return;
    }
    if (!formData.order_type) {
      showSnack('Order Type is required', 'warning');
      return;
    }
    if (isGlobalAdmin && !selectedTenantId) {
      showSnack('Please select a Tenant', 'warning');
      return;
    }
    
    setDialogLoading(true);
    try {
      const payload = { ...formData };
      
      if (isGlobalAdmin && selectedTenantId) {
        payload.tenant_id = selectedTenantId;
      }
      
      if (editingOrder) {
        await api.put(`/crm/orders/${editingOrder.id}`, payload);
        showSnack('Order updated successfully', 'success');
      } else {
        await api.post('/crm/orders', payload);
        showSnack('Order created successfully', 'success');
      }
      handleCloseDialog();
      fetchOrders();
    } catch (error) {
      console.error('Error saving order:', error);
      const message = error.response?.data?.message || 'Error saving order';
      showSnack(message, 'error');
    } finally {
      setDialogLoading(false);
    }
  };

  const handleDeleteClick = (orderItem) => {
    setOrderToDelete(orderItem);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!orderToDelete) return;
    try {
      await api.delete(`/crm/orders/${orderToDelete.id}`);
      showSnack('Order deleted successfully', 'success');
      fetchOrders();
    } catch (error) {
      console.error('Error deleting order:', error);
      showSnack('Error deleting order', 'error');
    } finally {
      setDeleteDialogOpen(false);
      setOrderToDelete(null);
    }
  };

  const handleApproveOrder = async (orderItem) => {
    try {
      // Toggle between approved and pending
      const newStatus = orderItem.order_status === 'approved' ? 'pending' : 'approved';
      await api.put(`/crm/orders/${orderItem.id}`, { order_status: newStatus });
      showSnack(`Order ${newStatus === 'approved' ? 'approved' : 'set to pending'} successfully`, 'success');
      fetchOrders();
    } catch (error) {
      console.error('Error updating order status:', error);
      showSnack(error.response?.data?.message || 'Error updating order status', 'error');
    }
  };

  const toggleGroup = (groupKey) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  };

  // Group orders by address
  const groupedOrders = React.useMemo(() => {
    if (groupBy === 'none') return null;
    
    const groups = {};
    orders.forEach(o => {
      const key = groupBy === 'address' 
        ? `${o.shipping_address_line1 || 'No Address'}` 
        : o.account?.name || 'Unknown Account';
      
      if (!groups[key]) {
        groups[key] = {
          orders: [],
          totalSubtotal: 0,
          totalAmount: 0,
        };
      }
      groups[key].orders.push(o);
      groups[key].totalSubtotal += parseFloat(o.subtotal) || 0;
      groups[key].totalAmount += parseFloat(o.total) || 0;
    });
    
    return groups;
  }, [orders, groupBy]);

  const renderTableRows = () => {
    if (groupBy !== 'none' && groupedOrders) {
      return Object.entries(groupedOrders).map(([groupKey, groupData]) => (
        <React.Fragment key={groupKey}>
          {/* Group Header Row */}
          <TableRow 
            sx={{ bgcolor: '#f5f5f5', cursor: 'pointer' }}
            onClick={() => toggleGroup(groupKey)}
          >
            <TableCell colSpan={2}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {expandedGroups[groupKey] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                <Typography fontWeight="medium">
                  {groupKey} ({groupData.orders.length})
                </Typography>
              </Box>
            </TableCell>
            <TableCell>-</TableCell>
            <TableCell>-</TableCell>
            <TableCell>-</TableCell>
            <TableCell>-</TableCell>
            <TableCell>-</TableCell>
            <TableCell>-</TableCell>
            <TableCell align="right">{formatCurrency(groupData.totalSubtotal)}</TableCell>
            <TableCell align="right">{formatCurrency(groupData.totalAmount)}</TableCell>
            <TableCell>-</TableCell>
            <TableCell>-</TableCell>
          </TableRow>
          {/* Group Orders */}
          <TableRow>
            <TableCell colSpan={12} sx={{ p: 0, border: 0 }}>
              <Collapse in={expandedGroups[groupKey]} timeout="auto" unmountOnExit>
                <Table size="small">
                  <TableBody>
                    {groupData.orders.map(o => renderOrderRow(o, true))}
                  </TableBody>
                </Table>
              </Collapse>
            </TableCell>
          </TableRow>
        </React.Fragment>
      ));
    }
    
    return orders.map(o => renderOrderRow(o, false));
  };

  const renderOrderRow = (o, isGrouped) => (
    <TableRow key={o.id} hover sx={isGrouped ? { bgcolor: '#fafafa' } : {}}>
      <TableCell>
        <Typography 
          component="a" 
          href="#" 
          onClick={(e) => { e.preventDefault(); handleOpenDialog(o); }}
          sx={{ color: 'primary.main', textDecoration: 'underline', cursor: 'pointer' }}
        >
          {o.id}
        </Typography>
      </TableCell>
      <TableCell>{o.account?.name || '-'}</TableCell>
      <TableCell>
        <Tooltip title={o.order_status === 'approved' ? 'Click to set pending' : 'Click to approve'}>
          <Switch
            checked={o.order_status === 'approved'}
            onChange={() => handleApproveOrder(o)}
            size="small"
            color="success"
          />
        </Tooltip>
      </TableCell>
      <TableCell>
        {ORDER_TYPES.find(t => t.value === o.order_type)?.label || o.order_type}
      </TableCell>
      <TableCell>{getStatusChip(o.shipping_status, SHIPPING_STATUSES)}</TableCell>
      <TableCell>{o.order_placed_by || '-'}</TableCell>
      <TableCell>{formatDate(o.received_date)}</TableCell>
      <TableCell>{formatDate(o.due_date)}</TableCell>
      <TableCell align="right">{formatCurrency(o.subtotal)}</TableCell>
      <TableCell align="right">{formatCurrency(o.total)}</TableCell>
      <TableCell>{o.purchase_order || '-'}</TableCell>
      <TableCell align="right">
        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
          <Tooltip title="Edit">
            <IconButton size="small" color="primary" onClick={() => handleOpenDialog(o)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" color="error" onClick={() => handleDeleteClick(o)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </TableCell>
    </TableRow>
  );

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">Orders</Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add New Order
        </Button>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search by PO, License..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
              InputProps={{
                startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />,
              }}
            />
          </Grid>
          <Grid item xs={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Order Status</InputLabel>
              <Select value={filterStatus} label="Order Status" onChange={(e) => { setFilterStatus(e.target.value); setPage(0); }}>
                <MenuItem value="all">All Statuses</MenuItem>
                {ORDER_STATUSES.map(status => (
                  <MenuItem key={status.value} value={status.value}>{status.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Shipping</InputLabel>
              <Select value={filterShippingStatus} label="Shipping" onChange={(e) => { setFilterShippingStatus(e.target.value); setPage(0); }}>
                <MenuItem value="all">All Shipping</MenuItem>
                {SHIPPING_STATUSES.map(status => (
                  <MenuItem key={status.value} value={status.value}>{status.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Group By</InputLabel>
              <Select value={groupBy} label="Group By" onChange={(e) => setGroupBy(e.target.value)}>
                <MenuItem value="none">No Grouping</MenuItem>
                <MenuItem value="address">Address</MenuItem>
                <MenuItem value="account">Account</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} md={3}>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<FilterListIcon />}
                onClick={() => { setSearchTerm(''); setFilterStatus('all'); setFilterShippingStatus('all'); setFilterOrderType('all'); setGroupBy('none'); setPage(0); }}
              >
                Clear
              </Button>
              <Tooltip title="Refresh">
                <IconButton size="small" onClick={fetchOrders}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Orders Table */}
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
                <TableCell>Account Name</TableCell>
                <TableCell>
                  <TableSortLabel active={orderBy === 'order_status'} direction={orderBy === 'order_status' ? order : 'asc'} onClick={() => handleSort('order_status')}>
                    Order Status
                  </TableSortLabel>
                </TableCell>
                <TableCell>Order Type</TableCell>
                <TableCell>
                  <TableSortLabel active={orderBy === 'shipping_status'} direction={orderBy === 'shipping_status' ? order : 'asc'} onClick={() => handleSort('shipping_status')}>
                    Shipping Status
                  </TableSortLabel>
                </TableCell>
                <TableCell>Order Placed By</TableCell>
                <TableCell>
                  <TableSortLabel active={orderBy === 'received_date'} direction={orderBy === 'received_date' ? order : 'asc'} onClick={() => handleSort('received_date')}>
                    Received Date
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel active={orderBy === 'due_date'} direction={orderBy === 'due_date' ? order : 'asc'} onClick={() => handleSort('due_date')}>
                    Due Date
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">Sum(Sub-total)</TableCell>
                <TableCell align="right">Sum(Total)</TableCell>
                <TableCell>Purchase Order</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={12} align="center" sx={{ py: 4 }}><CircularProgress size={24} /></TableCell>
                </TableRow>
              ) : orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No orders found</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                renderTableRows()
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
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </Paper>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth PaperProps={{ sx: { maxHeight: '90vh' } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid #e0e0e0', pb: 2 }}>
          <ShoppingCartIcon color="primary" />
          {editingOrder ? 'Edit Order' : 'Create Order'}
          <IconButton aria-label="close" onClick={handleCloseDialog} sx={{ position: 'absolute', right: 8, top: 8 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <form onSubmit={handleSaveOrder}>
          <DialogContent sx={{ pt: 3 }}>
            
            {/* Tenant Selector for Global Admin */}
            {isGlobalAdmin && (
              <Box sx={{ mb: 3 }}>
                <FormControl fullWidth size="small" required>
                  <InputLabel>Tenant *</InputLabel>
                  <Select 
                    value={selectedTenantId} 
                    label="Tenant *" 
                    onChange={(e) => {
                      const newTenantId = e.target.value;
                      setSelectedTenantId(newTenantId);
                      setFormData(prev => ({ ...prev, account_id: '' }));
                      fetchAccounts(newTenantId);
                    }}
                    required
                  >
                    {tenants.map(tenant => (
                      <MenuItem key={tenant.id} value={tenant.id}>{tenant.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            )}
            
            {/* Account Dropdown */}
            <FormControl fullWidth size="small" sx={{ mb: 2 }} required disabled={isGlobalAdmin && !selectedTenantId}>
              <InputLabel>Select Account *</InputLabel>
              <Select 
                name="account_id"
                value={formData.account_id} 
                label="Select Account *" 
                onChange={(e) => handleAccountSelect(e.target.value)}
                required
              >
                {accounts.length === 0 ? (
                  <MenuItem disabled value="">
                    {isGlobalAdmin && !selectedTenantId ? 'Select a Tenant first' : 'No accounts available'}
                  </MenuItem>
                ) : (
                  accounts.map(account => (
                    <MenuItem key={account.id} value={account.id}>{account.name}</MenuItem>
                  ))
                )}
              </Select>
            </FormControl>

            {/* Shipping Address */}
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>Shipping Address</InputLabel>
              <Select 
                value="custom"
                label="Shipping Address"
                disabled
              >
                <MenuItem value="custom">
                  {formData.shipping_address_line1 
                    ? `${formData.shipping_address_line1}, ${formData.shipping_city}` 
                    : 'Select account to populate address'}
                </MenuItem>
              </Select>
            </FormControl>

            {/* Order Placed By */}
            <TextField 
              fullWidth 
              size="small" 
              name="order_placed_by" 
              label="Order Placed By" 
              value={formData.order_placed_by} 
              onChange={handleFormChange} 
              sx={{ mb: 2 }} 
            />

            {/* Order Creation Date */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" fontWeight="medium">Select the order creation date</Typography>
              <Typography variant="caption" color="text.secondary">Future dates can&apos;t be selected</Typography>
              <TextField 
                fullWidth 
                size="small" 
                name="received_date" 
                type="datetime-local" 
                value={formData.received_date} 
                onChange={handleFormChange}
                inputProps={{ max: new Date().toISOString().slice(0, 16) }}
                sx={{ mt: 1 }} 
              />
            </Box>

            {/* Order Type */}
            <FormControl fullWidth size="small" sx={{ mb: 2 }} required>
              <InputLabel>Order Type *</InputLabel>
              <Select 
                name="order_type"
                value={formData.order_type} 
                label="Order Type *" 
                onChange={handleFormChange}
                required
              >
                {ORDER_TYPES.map(type => (
                  <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Due Date */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" fontWeight="medium">Select the order due date</Typography>
              <Typography variant="caption" color="text.secondary">The earliest selectable date is the date the order was created</Typography>
              <TextField 
                fullWidth 
                size="small" 
                name="due_date" 
                type="datetime-local" 
                value={formData.due_date} 
                onChange={handleFormChange}
                inputProps={{ min: formData.received_date }}
                sx={{ mt: 1 }} 
              />
            </Box>

            {/* Purchase Order */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                If you have a PO available for this order, enter it here
              </Typography>
              <TextField 
                fullWidth 
                size="small" 
                name="purchase_order" 
                label="Purchase Order" 
                value={formData.purchase_order} 
                onChange={handleFormChange}
              />
            </Box>

          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #e0e0e0' }}>
            <Button onClick={handleCloseDialog} disabled={dialogLoading}>
              CLOSE
            </Button>
            <Button type="submit" color="primary" disabled={dialogLoading}>
              {dialogLoading ? <CircularProgress size={20} /> : (editingOrder ? 'UPDATE' : 'CREATE')}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="xs">
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete order #{orderToDelete?.id}?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      {!setParentSnack && (
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
      )}
    </Box>
  );
};

CrmOrdersPage.propTypes = {
  tenantId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  isAppReady: PropTypes.bool.isRequired,
  isGlobalAdmin: PropTypes.bool,
  setParentSnack: PropTypes.func,
};

CrmOrdersPage.defaultProps = {
  isGlobalAdmin: false,
  setParentSnack: null,
};

export default CrmOrdersPage;
