// src/components/crm/OrderDetailDrawer.jsx
import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { api } from '../../App';
import {
  Box, Typography, Button, CircularProgress, Chip, IconButton, Tooltip,
  Drawer, Tabs, Tab, Divider, Grid, Paper, TextField, MenuItem,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogActions, FormControl,
  InputLabel, Select, Alert, LinearProgress, Autocomplete,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import PaymentIcon from '@mui/icons-material/Payment';
import InventoryIcon from '@mui/icons-material/Inventory';
import InfoIcon from '@mui/icons-material/Info';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import RefreshIcon from '@mui/icons-material/Refresh';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

// Status configurations
const ORDER_STATUSES = {
  draft: { label: 'Draft', color: '#9e9e9e' },
  pending: { label: 'Pending', color: '#ffa726' },
  approved: { label: 'Approved', color: '#66bb6a' },
  rejected: { label: 'Rejected', color: '#ef5350' },
  cancelled: { label: 'Cancelled', color: '#78909c' },
  completed: { label: 'Completed', color: '#42a5f5' },
};

const SHIPPING_STATUSES = {
  pending: { label: 'Pending', color: '#9e9e9e' },
  processing: { label: 'Processing', color: '#ffa726' },
  packaged: { label: 'Packaged', color: '#29b6f6' },
  shipped: { label: 'Shipped', color: '#66bb6a' },
  delivered: { label: 'Delivered', color: '#43a047' },
  returned: { label: 'Returned', color: '#ef5350' },
};

const ITEM_STATUSES = {
  pending: { label: 'Pending', color: '#9e9e9e' },
  allocated: { label: 'Allocated', color: '#29b6f6' },
  fulfilled: { label: 'Fulfilled', color: '#66bb6a' },
  shipped: { label: 'Shipped', color: '#42a5f5' },
  delivered: { label: 'Delivered', color: '#43a047' },
  cancelled: { label: 'Cancelled', color: '#78909c' },
  returned: { label: 'Returned', color: '#ef5350' },
};

const SHIPMENT_STATUSES = {
  draft: { label: 'Draft', color: '#9e9e9e' },
  pending: { label: 'Pending', color: '#ffa726' },
  label_created: { label: 'Label Created', color: '#29b6f6' },
  picked_up: { label: 'Picked Up', color: '#5c6bc0' },
  in_transit: { label: 'In Transit', color: '#42a5f5' },
  out_for_delivery: { label: 'Out for Delivery', color: '#26c6da' },
  delivered: { label: 'Delivered', color: '#66bb6a' },
  exception: { label: 'Exception', color: '#ef5350' },
  returned: { label: 'Returned', color: '#ff7043' },
  cancelled: { label: 'Cancelled', color: '#78909c' },
};

const PAYMENT_STATUSES = {
  pending: { label: 'Pending', color: '#ffa726' },
  processing: { label: 'Processing', color: '#29b6f6' },
  completed: { label: 'Completed', color: '#66bb6a' },
  failed: { label: 'Failed', color: '#ef5350' },
  refunded: { label: 'Refunded', color: '#ff7043' },
  partially_refunded: { label: 'Partial Refund', color: '#ffb74d' },
  cancelled: { label: 'Cancelled', color: '#78909c' },
};

const PAYMENT_METHODS = {
  bank_transfer: 'Bank Transfer',
  wire_transfer: 'Wire Transfer',
  cheque: 'Cheque',
  credit_card: 'Credit Card',
  debit: 'Debit',
  eft: 'EFT',
  cash: 'Cash',
  credit_note: 'Credit Note',
  other: 'Other',
};

// Utility functions
const formatCurrency = (value, currency = 'CAD') => {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
  }).format(value || 0);
};

const formatDate = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-CA');
};

const formatDateTime = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('en-CA');
};

const StatusChip = ({ status, statusMap }) => {
  const config = statusMap[status] || { label: status, color: '#757575' };
  return (
    <Chip
      label={config.label}
      size="small"
      sx={{ bgcolor: config.color, color: '#fff', fontWeight: 500 }}
    />
  );
};

// Tab Panel Component
function TabPanel({ children, value, index, ...other }) {
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

// ============= MAIN COMPONENT =============
const OrderDetailDrawer = ({ open, onClose, orderId, onOrderUpdate, showSnack }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [paymentSummary, setPaymentSummary] = useState(null);
  
  // Add Item Dialog
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);
  const [availableBatches, setAvailableBatches] = useState([]);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [itemFormData, setItemFormData] = useState({
    quantity_ordered: '',
    unit_price: '',
    discount_percent: 0,
    notes: '',
  });
  const [itemSaving, setItemSaving] = useState(false);
  
  // Add Payment Dialog
  const [addPaymentDialogOpen, setAddPaymentDialogOpen] = useState(false);
  const [paymentFormData, setPaymentFormData] = useState({
    payment_method: 'bank_transfer',
    amount: '',
    reference_number: '',
    payment_notes: '',
  });
  const [paymentSaving, setPaymentSaving] = useState(false);
  
  // Create Shipment Dialog
  const [createShipmentDialogOpen, setCreateShipmentDialogOpen] = useState(false);
  const [shipmentFormData, setShipmentFormData] = useState({
    carrier_name: '',
    tracking_number: '',
    estimated_ship_date: '',
  });
  const [shipmentSaving, setShipmentSaving] = useState(false);

  // Fetch order details
  const fetchOrder = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const response = await api.get(`/crm/orders/${orderId}`);
      // API returns { data: order } so we need to extract correctly
      const orderData = response.data?.data || response.data;
      setOrder(orderData);
    } catch (error) {
      console.error('Error fetching order:', error);
      showSnack?.('Error loading order details', 'error');
    } finally {
      setLoading(false);
    }
  }, [orderId, showSnack]);

  // Fetch order items
  const fetchItems = useCallback(async () => {
    if (!orderId) return;
    try {
      const response = await api.get(`/crm/orders/${orderId}/items`);
      setItems(response.data.items || response.data || []);
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  }, [orderId]);

  // Fetch shipments
  const fetchShipments = useCallback(async () => {
    if (!orderId) return;
    try {
      const response = await api.get(`/crm/shipments?order_id=${orderId}`);
      setShipments(response.data.data || []);
    } catch (error) {
      console.error('Error fetching shipments:', error);
    }
  }, [orderId]);

  // Fetch payment summary
  const fetchPaymentSummary = useCallback(async () => {
    if (!orderId) return;
    try {
      const response = await api.get(`/crm/payments/order-summary/${orderId}`);
      setPaymentSummary(response.data);
    } catch (error) {
      console.error('Error fetching payment summary:', error);
    }
  }, [orderId]);

  // Fetch available batches
  const fetchAvailableBatches = useCallback(async () => {
    setBatchesLoading(true);
    try {
      const response = await api.get('/crm/batches-available');
      setAvailableBatches(response.data.batches || []);
    } catch (error) {
      console.error('Error fetching batches:', error);
    } finally {
      setBatchesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && orderId) {
      fetchOrder();
      fetchItems();
      fetchShipments();
      fetchPaymentSummary();
    }
  }, [open, orderId, fetchOrder, fetchItems, fetchShipments, fetchPaymentSummary]);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const refreshAll = () => {
    fetchOrder();
    fetchItems();
    fetchShipments();
    fetchPaymentSummary();
  };

  // ============= ADD ITEM HANDLERS =============
  const handleOpenAddItem = () => {
    setSelectedBatch(null);
    setItemFormData({ quantity_ordered: '', unit_price: '', discount_percent: 0, notes: '' });
    fetchAvailableBatches();
    setAddItemDialogOpen(true);
  };

  const handleBatchSelect = (batch) => {
    setSelectedBatch(batch);
    if (batch) {
      setItemFormData(prev => ({
        ...prev,
        unit_price: batch.sku?.price_per_unit || batch.estimated_value || '',
      }));
    }
  };

  const handleAddItem = async () => {
    if (!selectedBatch) {
      showSnack?.('Please select a batch', 'warning');
      return;
    }
    if (!itemFormData.quantity_ordered || itemFormData.quantity_ordered <= 0) {
      showSnack?.('Please enter a valid quantity', 'warning');
      return;
    }
    
    setItemSaving(true);
    try {
      await api.post(`/crm/orders/${orderId}/items`, {
        batch_id: selectedBatch.id,
        quantity_ordered: parseFloat(itemFormData.quantity_ordered),
        unit_price: parseFloat(itemFormData.unit_price) || 0,
        discount_percent: parseFloat(itemFormData.discount_percent) || 0,
        notes: itemFormData.notes,
      });
      showSnack?.('Item added successfully', 'success');
      setAddItemDialogOpen(false);
      fetchItems();
      fetchOrder();
      onOrderUpdate?.();
    } catch (error) {
      console.error('Error adding item:', error);
      showSnack?.(error.response?.data?.message || 'Error adding item', 'error');
    } finally {
      setItemSaving(false);
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Are you sure you want to remove this item?')) return;
    try {
      await api.delete(`/crm/orders/${orderId}/items/${itemId}`);
      showSnack?.('Item removed', 'success');
      fetchItems();
      fetchOrder();
      onOrderUpdate?.();
    } catch (error) {
      console.error('Error deleting item:', error);
      showSnack?.(error.response?.data?.message || 'Error removing item', 'error');
    }
  };

  const handleFulfillItem = async (itemId) => {
    try {
      await api.post(`/crm/orders/${orderId}/items/${itemId}/fulfill`);
      showSnack?.('Item fulfilled - inventory allocated', 'success');
      fetchItems();
      fetchOrder();
    } catch (error) {
      console.error('Error fulfilling item:', error);
      showSnack?.(error.response?.data?.message || 'Error fulfilling item', 'error');
    }
  };

  // ============= PAYMENT HANDLERS =============
  const handleOpenAddPayment = () => {
    setPaymentFormData({
      payment_method: 'bank_transfer',
      amount: paymentSummary?.balance_due || '',
      reference_number: '',
      payment_notes: '',
    });
    setAddPaymentDialogOpen(true);
  };

  const handleAddPayment = async () => {
    if (!paymentFormData.amount || paymentFormData.amount <= 0) {
      showSnack?.('Please enter a valid amount', 'warning');
      return;
    }
    
    setPaymentSaving(true);
    try {
      await api.post('/crm/payments', {
        order_id: orderId,
        payment_method: paymentFormData.payment_method,
        amount: parseFloat(paymentFormData.amount),
        reference_number: paymentFormData.reference_number,
        payment_notes: paymentFormData.payment_notes,
        status: 'completed',
      });
      showSnack?.('Payment recorded successfully', 'success');
      setAddPaymentDialogOpen(false);
      fetchPaymentSummary();
      fetchOrder();
      onOrderUpdate?.();
    } catch (error) {
      console.error('Error recording payment:', error);
      showSnack?.(error.response?.data?.message || 'Error recording payment', 'error');
    } finally {
      setPaymentSaving(false);
    }
  };

  // ============= SHIPMENT HANDLERS =============
  const handleOpenCreateShipment = () => {
    setShipmentFormData({
      carrier_name: '',
      tracking_number: '',
      estimated_ship_date: new Date().toISOString().slice(0, 10),
    });
    setCreateShipmentDialogOpen(true);
  };

  const handleCreateShipment = async () => {
    setShipmentSaving(true);
    try {
      // Get pending items to add to shipment
      const pendingItems = items.filter(i => i.status === 'fulfilled' || i.status === 'pending');
      
      await api.post('/crm/shipments', {
        order_id: orderId,
        carrier_name: shipmentFormData.carrier_name,
        tracking_number: shipmentFormData.tracking_number,
        estimated_ship_date: shipmentFormData.estimated_ship_date,
        items: pendingItems.map(item => ({
          order_item_id: item.id,
          quantity_shipped: item.quantity_fulfilled || item.quantity_ordered,
        })),
      });
      showSnack?.('Shipment created successfully', 'success');
      setCreateShipmentDialogOpen(false);
      fetchShipments();
      fetchItems();
      onOrderUpdate?.();
    } catch (error) {
      console.error('Error creating shipment:', error);
      showSnack?.(error.response?.data?.message || 'Error creating shipment', 'error');
    } finally {
      setShipmentSaving(false);
    }
  };

  const handleMarkShipped = async (shipmentId) => {
    try {
      await api.post(`/crm/shipments/${shipmentId}/ship`);
      showSnack?.('Shipment marked as shipped', 'success');
      fetchShipments();
      fetchOrder();
      onOrderUpdate?.();
    } catch (error) {
      console.error('Error shipping:', error);
      showSnack?.(error.response?.data?.message || 'Error marking as shipped', 'error');
    }
  };

  const handleMarkDelivered = async (shipmentId) => {
    try {
      await api.post(`/crm/shipments/${shipmentId}/deliver`);
      showSnack?.('Shipment marked as delivered', 'success');
      fetchShipments();
      fetchOrder();
      onOrderUpdate?.();
    } catch (error) {
      console.error('Error delivering:', error);
      showSnack?.(error.response?.data?.message || 'Error marking as delivered', 'error');
    }
  };

  // ============= RENDER =============
  if (!open) return null;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { width: { xs: '100%', sm: 600, md: 700 }, p: 0 }
      }}
    >
      {/* Header */}
      <Box sx={{ 
        p: 2, 
        bgcolor: '#1976d2', 
        color: '#fff',
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center' 
      }}>
        <Box>
          <Typography variant="h6" fontWeight="bold">
            Order #{order?.order_number || orderId}
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9 }}>
            {order?.account?.name || 'Loading...'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton size="small" sx={{ color: '#fff' }} onClick={refreshAll}>
            <RefreshIcon />
          </IconButton>
          <IconButton size="small" sx={{ color: '#fff' }} onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </Box>

      {loading ? (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Status Bar */}
          <Box sx={{ px: 2, py: 1.5, bgcolor: '#f5f5f5', display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="caption" color="text.secondary">Order Status</Typography>
              <Box><StatusChip status={order?.order_status} statusMap={ORDER_STATUSES} /></Box>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Shipping</Typography>
              <Box><StatusChip status={order?.shipping_status} statusMap={SHIPPING_STATUSES} /></Box>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Payment</Typography>
              <Box>
                <Chip 
                  label={paymentSummary?.is_fully_paid ? 'Paid' : `Due: ${formatCurrency(paymentSummary?.balance_due)}`}
                  size="small"
                  sx={{ 
                    bgcolor: paymentSummary?.is_fully_paid ? '#66bb6a' : '#ffa726', 
                    color: '#fff', 
                    fontWeight: 500 
                  }}
                />
              </Box>
            </Box>
            <Box sx={{ ml: 'auto', textAlign: 'right' }}>
              <Typography variant="caption" color="text.secondary">Total</Typography>
              <Typography variant="h6" fontWeight="bold" color="primary">
                {formatCurrency(order?.grand_total)}
              </Typography>
            </Box>
          </Box>

          {/* Tabs */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={activeTab} onChange={handleTabChange} variant="fullWidth">
              <Tab icon={<InfoIcon />} label="Details" iconPosition="start" />
              <Tab icon={<InventoryIcon />} label={`Items (${items.length})`} iconPosition="start" />
              <Tab icon={<LocalShippingIcon />} label={`Ship (${shipments.length})`} iconPosition="start" />
              <Tab icon={<PaymentIcon />} label="Pay" iconPosition="start" />
            </Tabs>
          </Box>

          {/* Tab Panels */}
          <Box sx={{ p: 2, overflowY: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
            {/* Details Tab */}
            <TabPanel value={activeTab} index={0}>
              {/* Order Info Section */}
              <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom sx={{ color: 'primary.main' }}>
                  Order Information
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={4}>
                    <Typography variant="caption" color="text.secondary" display="block">Account</Typography>
                    <Typography fontWeight="medium">{order?.account?.name || '-'}</Typography>
                  </Grid>
                  <Grid item xs={6} sm={4}>
                    <Typography variant="caption" color="text.secondary" display="block">License #</Typography>
                    <Typography>{order?.customer_license || '-'}</Typography>
                  </Grid>
                  <Grid item xs={6} sm={4}>
                    <Typography variant="caption" color="text.secondary" display="block">Order Type</Typography>
                    <Typography sx={{ textTransform: 'capitalize' }}>{order?.order_type?.replace('-', ' ') || '-'}</Typography>
                  </Grid>
                  <Grid item xs={6} sm={4}>
                    <Typography variant="caption" color="text.secondary" display="block">PO Number</Typography>
                    <Typography>{order?.purchase_order || '-'}</Typography>
                  </Grid>
                  <Grid item xs={6} sm={4}>
                    <Typography variant="caption" color="text.secondary" display="block">Received Date</Typography>
                    <Typography>{formatDate(order?.received_date)}</Typography>
                  </Grid>
                  <Grid item xs={6} sm={4}>
                    <Typography variant="caption" color="text.secondary" display="block">Due Date</Typography>
                    <Typography>{formatDate(order?.due_date)}</Typography>
                  </Grid>
                </Grid>
              </Paper>

              {/* Shipping Address Section */}
              <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom sx={{ color: 'primary.main' }}>
                  Shipping Address
                </Typography>
                <Typography variant="body2">
                  {order?.shipping_address_line1 || 'No address specified'}
                  {order?.shipping_address_line2 && <><br />{order.shipping_address_line2}</>}
                  {(order?.shipping_city || order?.shipping_province) && (
                    <><br />{[order?.shipping_city, order?.shipping_province, order?.shipping_postal_code].filter(Boolean).join(', ')}</>
                  )}
                  {order?.shipping_country && <><br />{order.shipping_country}</>}
                </Typography>
              </Paper>

              {/* Order Summary Section */}
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom sx={{ color: 'primary.main' }}>
                  Order Summary
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography color="text.secondary">Subtotal</Typography>
                    <Typography>{formatCurrency(order?.subtotal)}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography color="text.secondary">Tax</Typography>
                    <Typography>{formatCurrency(order?.tax_amount)}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography color="text.secondary">Shipping</Typography>
                    <Typography>{formatCurrency(order?.shipping_cost)}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography color="text.secondary">Discount</Typography>
                    <Typography color="error.main">-{formatCurrency(order?.discount_amount)}</Typography>
                  </Box>
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography fontWeight="bold" variant="subtitle1">Grand Total</Typography>
                    <Typography fontWeight="bold" variant="subtitle1" color="primary">{formatCurrency(order?.grand_total)}</Typography>
                  </Box>
                </Box>
              </Paper>
            </TabPanel>

            {/* Items Tab */}
            <TabPanel value={activeTab} index={1}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold">Order Items</Typography>
                <Button 
                  variant="contained" 
                  size="small" 
                  startIcon={<AddIcon />}
                  onClick={handleOpenAddItem}
                  disabled={order?.order_status === 'completed' || order?.order_status === 'cancelled'}
                >
                  Add Item
                </Button>
              </Box>
              
              {items.length === 0 ? (
                <Paper sx={{ p: 3, textAlign: 'center', bgcolor: '#fafafa' }}>
                  <InventoryIcon sx={{ fontSize: 48, color: '#ccc', mb: 1 }} />
                  <Typography color="text.secondary">No items added yet</Typography>
                  <Button 
                    variant="outlined" 
                    size="small" 
                    startIcon={<AddIcon />}
                    onClick={handleOpenAddItem}
                    sx={{ mt: 2 }}
                  >
                    Add First Item
                  </Button>
                </Paper>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                        <TableCell>Product / Batch</TableCell>
                        <TableCell align="center">Qty</TableCell>
                        <TableCell align="right">Price</TableCell>
                        <TableCell align="center">Status</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {items.map(item => (
                        <TableRow key={item.id} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight="medium">
                              {item.product_name || 'Unknown Product'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Batch: {item.batch_lot_number || item.batch?.lot_number || '-'}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Typography variant="body2">
                              {item.quantity_ordered} {item.unit}
                            </Typography>
                            {item.quantity_fulfilled > 0 && (
                              <Typography variant="caption" color="success.main">
                                ({item.quantity_fulfilled} fulfilled)
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2">{formatCurrency(item.unit_price)}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              = {formatCurrency(item.line_total)}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <StatusChip status={item.status} statusMap={ITEM_STATUSES} />
                          </TableCell>
                          <TableCell align="right">
                            <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                              {item.status === 'pending' && (
                                <Tooltip title="Fulfill (Allocate Inventory)">
                                  <IconButton 
                                    size="small" 
                                    color="success"
                                    onClick={() => handleFulfillItem(item.id)}
                                  >
                                    <CheckCircleIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                              {(item.status === 'pending' || item.status === 'allocated') && (
                                <Tooltip title="Remove Item">
                                  <IconButton 
                                    size="small" 
                                    color="error"
                                    onClick={() => handleDeleteItem(item.id)}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </TabPanel>

            {/* Shipments Tab */}
            <TabPanel value={activeTab} index={2}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold">Shipments</Typography>
                <Button 
                  variant="contained" 
                  size="small" 
                  startIcon={<LocalShippingIcon />}
                  onClick={handleOpenCreateShipment}
                  disabled={items.length === 0}
                >
                  Create Shipment
                </Button>
              </Box>
              
              {shipments.length === 0 ? (
                <Paper sx={{ p: 3, textAlign: 'center', bgcolor: '#fafafa' }}>
                  <LocalShippingIcon sx={{ fontSize: 48, color: '#ccc', mb: 1 }} />
                  <Typography color="text.secondary">No shipments yet</Typography>
                </Paper>
              ) : (
                shipments.map(shipment => (
                  <Paper key={shipment.id} variant="outlined" sx={{ p: 2, mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
                      <Box>
                        <Typography variant="subtitle2" fontWeight="bold">
                          {shipment.shipment_number}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Manifest: {shipment.manifest_number}
                        </Typography>
                      </Box>
                      <StatusChip status={shipment.status} statusMap={SHIPMENT_STATUSES} />
                    </Box>
                    <Grid container spacing={1} sx={{ mt: 1 }}>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">Carrier</Typography>
                        <Typography variant="body2">{shipment.carrier_name || '-'}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">Tracking</Typography>
                        <Typography variant="body2">{shipment.tracking_number || '-'}</Typography>
                      </Grid>
                    </Grid>
                    <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                      {(shipment.status === 'draft' || shipment.status === 'pending') && (
                        <Button 
                          size="small" 
                          variant="contained" 
                          color="primary"
                          startIcon={<PlayArrowIcon />}
                          onClick={() => handleMarkShipped(shipment.id)}
                        >
                          Mark Shipped
                        </Button>
                      )}
                      {shipment.status === 'in_transit' && (
                        <Button 
                          size="small" 
                          variant="contained" 
                          color="success"
                          startIcon={<CheckCircleIcon />}
                          onClick={() => handleMarkDelivered(shipment.id)}
                        >
                          Mark Delivered
                        </Button>
                      )}
                    </Box>
                  </Paper>
                ))
              )}
            </TabPanel>

            {/* Payments Tab */}
            <TabPanel value={activeTab} index={3}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold">Payments</Typography>
                <Button 
                  variant="contained" 
                  size="small" 
                  startIcon={<PaymentIcon />}
                  onClick={handleOpenAddPayment}
                  disabled={paymentSummary?.is_fully_paid}
                >
                  Record Payment
                </Button>
              </Box>

              {/* Payment Summary */}
              <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: '#f8f9fa' }}>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Order Total</Typography>
                    <Typography variant="h6">{formatCurrency(paymentSummary?.order_total)}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Total Paid</Typography>
                    <Typography variant="h6" color="success.main">{formatCurrency(paymentSummary?.net_paid)}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <LinearProgress 
                      variant="determinate" 
                      value={Math.min(100, ((paymentSummary?.net_paid || 0) / (paymentSummary?.order_total || 1)) * 100)}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Balance Due</Typography>
                    <Typography variant="h6" color={paymentSummary?.balance_due > 0 ? 'error.main' : 'success.main'}>
                      {formatCurrency(paymentSummary?.balance_due)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} textAlign="right">
                    {paymentSummary?.is_fully_paid ? (
                      <Chip icon={<CheckCircleIcon />} label="Fully Paid" color="success" />
                    ) : (
                      <Chip icon={<WarningIcon />} label="Payment Pending" color="warning" />
                    )}
                  </Grid>
                </Grid>
              </Paper>

              {/* Payment List */}
              {paymentSummary?.payments?.length > 0 && (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                        <TableCell>Date</TableCell>
                        <TableCell>Method</TableCell>
                        <TableCell>Reference</TableCell>
                        <TableCell align="right">Amount</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paymentSummary.payments.map(payment => (
                        <TableRow key={payment.id} hover>
                          <TableCell>{formatDate(payment.payment_date)}</TableCell>
                          <TableCell>{PAYMENT_METHODS[payment.payment_method] || payment.payment_method}</TableCell>
                          <TableCell>{payment.reference_number || '-'}</TableCell>
                          <TableCell align="right" sx={{ color: payment.amount < 0 ? 'error.main' : 'success.main' }}>
                            {formatCurrency(payment.amount)}
                          </TableCell>
                          <TableCell>
                            <StatusChip status={payment.status} statusMap={PAYMENT_STATUSES} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </TabPanel>
          </Box>
        </>
      )}

      {/* ============= ADD ITEM DIALOG ============= */}
      <Dialog open={addItemDialogOpen} onClose={() => setAddItemDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ borderBottom: '1px solid #e0e0e0' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <InventoryIcon color="primary" />
            Add Item to Order
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Autocomplete
            options={availableBatches}
            loading={batchesLoading}
            value={selectedBatch}
            onChange={(e, newValue) => handleBatchSelect(newValue)}
            getOptionLabel={(option) => 
              `${option.lot_number} - ${option.variety?.name || option.product_type || 'Unknown'} (${option.current_quantity} ${option.unit_of_measure})`
            }
            renderOption={(props, option) => (
              <li {...props} key={option.id}>
                <Box sx={{ width: '100%' }}>
                  <Typography variant="body2" fontWeight="medium">
                    {option.lot_number} - {option.variety?.name || option.product_type}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Available: {option.current_quantity} {option.unit_of_measure} | 
                    THC: {option.thc_content}% | CBD: {option.cbd_content}%
                  </Typography>
                </Box>
              </li>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Select Batch"
                placeholder="Search by lot number or variety..."
                fullWidth
                margin="normal"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {batchesLoading ? <CircularProgress color="inherit" size={20} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
          
          {selectedBatch && (
            <Paper variant="outlined" sx={{ p: 2, mt: 2, bgcolor: '#f8f9fa' }}>
              <Typography variant="subtitle2" gutterBottom>Selected Batch</Typography>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Lot Number</Typography>
                  <Typography>{selectedBatch.lot_number}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Available</Typography>
                  <Typography>{selectedBatch.current_quantity} {selectedBatch.unit_of_measure}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">THC</Typography>
                  <Typography>{selectedBatch.thc_content}%</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">CBD</Typography>
                  <Typography>{selectedBatch.cbd_content}%</Typography>
                </Grid>
              </Grid>
            </Paper>
          )}
          
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={6}>
              <TextField
                label="Quantity"
                type="number"
                fullWidth
                value={itemFormData.quantity_ordered}
                onChange={(e) => setItemFormData(prev => ({ ...prev, quantity_ordered: e.target.value }))}
                InputProps={{
                  endAdornment: selectedBatch ? <Typography variant="caption">{selectedBatch.unit_of_measure}</Typography> : null
                }}
                helperText={selectedBatch ? `Max: ${selectedBatch.current_quantity}` : ''}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Unit Price"
                type="number"
                fullWidth
                value={itemFormData.unit_price}
                onChange={(e) => setItemFormData(prev => ({ ...prev, unit_price: e.target.value }))}
                InputProps={{ startAdornment: <Typography sx={{ mr: 0.5 }}>$</Typography> }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Notes (optional)"
                fullWidth
                multiline
                rows={2}
                value={itemFormData.notes}
                onChange={(e) => setItemFormData(prev => ({ ...prev, notes: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #e0e0e0' }}>
          <Button onClick={() => setAddItemDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleAddItem}
            disabled={itemSaving || !selectedBatch}
            startIcon={itemSaving ? <CircularProgress size={16} /> : <AddIcon />}
          >
            Add Item
          </Button>
        </DialogActions>
      </Dialog>

      {/* ============= ADD PAYMENT DIALOG ============= */}
      <Dialog open={addPaymentDialogOpen} onClose={() => setAddPaymentDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ borderBottom: '1px solid #e0e0e0' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PaymentIcon color="primary" />
            Record Payment
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            Balance Due: <strong>{formatCurrency(paymentSummary?.balance_due)}</strong>
          </Alert>
          
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Payment Method</InputLabel>
                <Select
                  value={paymentFormData.payment_method}
                  label="Payment Method"
                  onChange={(e) => setPaymentFormData(prev => ({ ...prev, payment_method: e.target.value }))}
                >
                  {Object.entries(PAYMENT_METHODS).map(([value, label]) => (
                    <MenuItem key={value} value={value}>{label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Amount"
                type="number"
                fullWidth
                value={paymentFormData.amount}
                onChange={(e) => setPaymentFormData(prev => ({ ...prev, amount: e.target.value }))}
                InputProps={{ startAdornment: <Typography sx={{ mr: 0.5 }}>$</Typography> }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Reference Number"
                fullWidth
                value={paymentFormData.reference_number}
                onChange={(e) => setPaymentFormData(prev => ({ ...prev, reference_number: e.target.value }))}
                placeholder="Check #, Transaction ID, etc."
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Notes (optional)"
                fullWidth
                multiline
                rows={2}
                value={paymentFormData.payment_notes}
                onChange={(e) => setPaymentFormData(prev => ({ ...prev, payment_notes: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #e0e0e0' }}>
          <Button onClick={() => setAddPaymentDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            color="success"
            onClick={handleAddPayment}
            disabled={paymentSaving}
            startIcon={paymentSaving ? <CircularProgress size={16} /> : <PaymentIcon />}
          >
            Record Payment
          </Button>
        </DialogActions>
      </Dialog>

      {/* ============= CREATE SHIPMENT DIALOG ============= */}
      <Dialog open={createShipmentDialogOpen} onClose={() => setCreateShipmentDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ borderBottom: '1px solid #e0e0e0' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LocalShippingIcon color="primary" />
            Create Shipment
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            This will create a shipment with all fulfilled items from this order.
          </Alert>
          
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Carrier</InputLabel>
                <Select
                  value={shipmentFormData.carrier_name}
                  label="Carrier"
                  onChange={(e) => setShipmentFormData(prev => ({ ...prev, carrier_name: e.target.value }))}
                >
                  <MenuItem value="fedex">FedEx</MenuItem>
                  <MenuItem value="ups">UPS</MenuItem>
                  <MenuItem value="purolator">Purolator</MenuItem>
                  <MenuItem value="canada_post">Canada Post</MenuItem>
                  <MenuItem value="dhl">DHL</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Tracking Number"
                fullWidth
                value={shipmentFormData.tracking_number}
                onChange={(e) => setShipmentFormData(prev => ({ ...prev, tracking_number: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Estimated Ship Date"
                type="date"
                fullWidth
                value={shipmentFormData.estimated_ship_date}
                onChange={(e) => setShipmentFormData(prev => ({ ...prev, estimated_ship_date: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #e0e0e0' }}>
          <Button onClick={() => setCreateShipmentDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleCreateShipment}
            disabled={shipmentSaving}
            startIcon={shipmentSaving ? <CircularProgress size={16} /> : <LocalShippingIcon />}
          >
            Create Shipment
          </Button>
        </DialogActions>
      </Dialog>
    </Drawer>
  );
};

OrderDetailDrawer.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  orderId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onOrderUpdate: PropTypes.func,
  showSnack: PropTypes.func,
};

export default OrderDetailDrawer;
