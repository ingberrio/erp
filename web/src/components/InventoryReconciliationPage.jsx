import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  Box, Typography, Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress,
  IconButton, Menu, AppBar, Toolbar,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { format } from 'date-fns';

import RefreshIcon from '@mui/icons-material/Refresh';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import InventoryIcon from '@mui/icons-material/Inventory';

import JustifyDiscrepancyModal from "./JustifyDiscrepancyModal";
import { api } from '../App';

const InventoryReconciliationPage = ({
  tenantId, isAppReady, userFacilityId, isGlobalAdmin, setParentSnack, hasPermission
}) => {
  // Estados principales
  const [loading, setLoading] = useState(false);
  const [reconciliationData, setReconciliationData] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [subLocations, setSubLocations] = useState([]);
  const [discrepancyReasons, setDiscrepancyReasons] = useState([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState('');
  const [selectedSubLocationId, setSelectedSubLocationId] = useState('');
  const [asOfDate, setAsOfDate] = useState(new Date());

  // Conteo físico
  const [openCountDialog, setOpenCountDialog] = useState(false);
  const [currentBatchForCount, setCurrentBatchForCount] = useState(null);
  const [countQuantity, setCountQuantity] = useState('');
  const [countDate, setCountDate] = useState(new Date());
  const [countNotes, setCountNotes] = useState('');
  const [countDialogLoading, setCountDialogLoading] = useState(false);
  const [countError, setCountError] = useState('');

  // Menú de acciones por fila
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedRowData, setSelectedRowData] = useState(null);

  // Justificación de discrepancia
  const [openJustifyModal, setOpenJustifyModal] = useState(false);
  const [selectedDiscrepancy, setSelectedDiscrepancy] = useState(null);
  const [loadingJustify, setLoadingJustify] = useState(false);

  const RECONCILIATION_PERMISSIONS = {
    view: 'view-inventory-reconciliation',
    registerCount: 'register-physical-count',
    justifyDiscrepancy: 'justify-inventory-discrepancy',
    adjustInventory: 'adjust-inventory'
  };

  // ----------- FETCHS PRINCIPALES -----------

  const fetchReconciliationData = useCallback(async () => {
    if (!isAppReady || !hasPermission(RECONCILIATION_PERMISSIONS.view)) return;
    if (!selectedFacilityId || !asOfDate) {
      setParentSnack('Select a Facility and Cut-off Date.', 'warning');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = {
        facility_id: selectedFacilityId,
        as_of_date: format(asOfDate, 'yyyy-MM-dd'),
      };
      if (selectedSubLocationId) params.sub_location_id = selectedSubLocationId;

      const response = await api.get('/inventory/reconciliation', { params });
      setReconciliationData(response.data.data);
      setParentSnack('Reconciliation data updated.', 'success');
    } catch (error) {
      setParentSnack(
        `Error loading reconciliation data: ${error.response?.data?.message || error.message}`,
        'error'
      );
      setReconciliationData([]);
    } finally {
      setLoading(false);
    }
  }, [isAppReady, selectedFacilityId, selectedSubLocationId, asOfDate, setParentSnack, hasPermission]);

  const fetchFacilities = useCallback(async () => {
    try {
      const headers = tenantId ? { 'X-Tenant-ID': tenantId } : {};
      const response = await api.get('/facilities', { headers });
      const facilitiesData = Array.isArray(response.data.data) ? response.data.data : response.data;
      setFacilities(facilitiesData);
      if (userFacilityId) setSelectedFacilityId(userFacilityId);
      else if (isGlobalAdmin && facilitiesData.length > 0) setSelectedFacilityId(facilitiesData[0].id);
      else if (facilitiesData.length > 0) setSelectedFacilityId(facilitiesData[0].id);
      else setSelectedFacilityId('');
    } catch (error) {
      setParentSnack('Error loading facilities.', 'error');
      setFacilities([]);
      setSelectedFacilityId('');
    }
  }, [setParentSnack, tenantId, userFacilityId, isGlobalAdmin]);

  const fetchSubLocations = useCallback(async () => {
    if (selectedFacilityId) {
      try {
        const response = await api.get(`/facilities/${selectedFacilityId}/sub-locations`);
        setSubLocations(Array.isArray(response.data.data) ? response.data.data : []);
      } catch {
        setParentSnack('Error loading sub-locations.', 'error');
        setSubLocations([]);
      }
    } else {
      setSubLocations([]);
    }
  }, [selectedFacilityId, setParentSnack]);

  const fetchDiscrepancyReasons = useCallback(async () => {
    try {
      const response = await api.get('/discrepancy-reasons');
      setDiscrepancyReasons(Array.isArray(response.data.data) ? response.data.data : []);
    } catch {
      setParentSnack('Error loading discrepancy reasons.', 'error');
      setDiscrepancyReasons([]);
    }
  }, [setParentSnack]);

  useEffect(() => {
    if (isAppReady) {
      fetchFacilities();
      fetchDiscrepancyReasons();
    }
  }, [isAppReady, fetchFacilities, fetchDiscrepancyReasons]);

  useEffect(() => {
    if (selectedFacilityId) {
      fetchSubLocations();
      fetchReconciliationData();
    } else {
      setReconciliationData([]);
    }
  }, [selectedFacilityId, fetchSubLocations, fetchReconciliationData]);

  // ----------- HANDLERS DIALOGOS -----------

  // Conteo físico
  const handleOpenCountDialog = (rowData) => {
    setCurrentBatchForCount(rowData);
    setCountQuantity('');
    setCountDate(new Date());
    setCountNotes('');
    setCountError('');
    setOpenCountDialog(true);
  };

  const handleCloseCountDialog = () => {
    setOpenCountDialog(false);
    setCurrentBatchForCount(null);
  };

  const handleSubmitPhysicalCount = async () => {
    setCountDialogLoading(true);
    setCountError('');
    try {
      if (!currentBatchForCount || countQuantity === null || countQuantity === '' || !countDate) {
        setCountError('Complete all required fields.');
        setCountDialogLoading(false);
        return;
      }
      const payload = {
        batch_id: currentBatchForCount.batch_id,
        counted_quantity: parseFloat(countQuantity),
        count_date: format(countDate, 'yyyy-MM-dd'),
        facility_id: currentBatchForCount.facility_id,
        sub_location_id: currentBatchForCount.sub_location_id,
        notes: countNotes,
      };
      await api.post('/inventory/reconciliation/physical-count', payload);
      setParentSnack('Physical count registered successfully.', 'success');
      handleCloseCountDialog();
      fetchReconciliationData();
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Error registering physical count.';
      setCountError(errorMessage);
      setParentSnack(errorMessage, 'error');
    } finally {
      setCountDialogLoading(false);
    }
  };

  // Acciones fila
  const handleOpenRowMenu = (event, row) => {
    setAnchorEl(event.currentTarget);
    setSelectedRowData(row);
  };

  const handleCloseRowMenu = () => {
    setAnchorEl(null);
    setSelectedRowData(null);
  };

  // ---- NUEVO: Justificación de Discrepancia ----

  const handleJustifyDiscrepancy = () => {
    setOpenJustifyModal(true);
    setSelectedDiscrepancy(selectedRowData);
    handleCloseRowMenu();
  };

  const handleSubmitJustification = async ({ reason_id, notes, discrepancy_id }) => {
    setLoadingJustify(true);
    try {
      await api.put(`/inventory/discrepancies/${discrepancy_id}/justify`, {
        reason_id,
        notes
      });
      setParentSnack('Discrepancy justified successfully.', 'success');
      setOpenJustifyModal(false);
      setSelectedDiscrepancy(null);
      fetchReconciliationData();
    } catch (err) {
      const msg = err.response?.data?.message || 'Error justifying discrepancy';
      setParentSnack(msg, 'error');
    }
    setLoadingJustify(false);
  };
  

const columns = [
  { field: 'batch_name', headerName: 'Batch', width: 200 },
  { field: 'product_type', headerName: 'Product Type', width: 150 },
  { field: 'facility_name', headerName: 'Facility', width: 180 },
  { field: 'sub_location_name', headerName: 'Sub-Location', width: 150 },
  { field: 'logical_quantity', headerName: 'Logical Inv.', type: 'number', width: 130,
    },
  { field: 'logical_unit', headerName: 'Logical Unit', width: 120 },
  {
    field: 'physical_quantity', headerName: 'Physical Inv.', type: 'number', width: 130,
   
  },
  { field: 'physical_unit', headerName: 'Physical Unit', width: 120 },
  {
    field: 'discrepancy', headerName: 'Discrepancy', type: 'number', width: 140,
   
    renderCell: (params) => (
      <Typography color={
        typeof params.value === 'number'
          ? (params.value > 0 ? 'error' : params.value < 0 ? 'warning.main' : 'inherit')
          : 'inherit'
      }>
        {typeof params.value === 'number'
          ? params.value.toFixed(2)
          : params.value
          ? Number(params.value).toFixed(2)
          : 'N/A'}
      </Typography>
    )
  },
  {
    field: 'discrepancy_percentage', headerName: '% Discrep.', type: 'number', width: 130,
    valueFormatter: (params) =>
      !params || params.value == null
        ? 'N/A'
        : typeof params.value === 'number'
          ? params.value.toFixed(2)
          : Number(params.value).toFixed(2),
    renderCell: (params) => (
      <Typography color={
        typeof params.value === 'number'
          ? (params.value > 0 ? 'error' : params.value < 0 ? 'warning.main' : 'inherit')
          : 'inherit'
      }>
        {typeof params.value === 'number'
          ? `${params.value.toFixed(2)}%`
          : params.value
          ? `${Number(params.value).toFixed(2)}%`
          : 'N/A'}
      </Typography>
    )
  },
  { field: 'status', headerName: 'Status', width: 130,
    renderCell: (params) => (
      <Typography color={
        params.value === 'Discrepancia' ? 'error.main' :
        params.value === 'Justificada' ? 'primary.main' :
        params.value === 'No Discrepancy' ? 'success.main' :
        'text.secondary'
      }>
        {params.value}
      </Typography>
    )
  },
  
  { field: 'count_date', headerName: 'Count Date', width: 150 },
  {
    field: 'actions',
    headerName: 'Actions',
    width: 150,
    renderCell: (params) => (
      <Box sx={{ display: 'flex', gap: 1 }}>
        {hasPermission(RECONCILIATION_PERMISSIONS.registerCount) && (
          <IconButton
            color="primary"
            aria-label="Register Count"
            title="Register Physical Count"
            onClick={() => handleOpenCountDialog(params.row)}
          >
            <AddCircleOutlineIcon />
          </IconButton>
        )}
        {hasPermission(RECONCILIATION_PERMISSIONS.justifyDiscrepancy) && params.row.status === 'Discrepancy' && (
          <IconButton
            color="secondary"
            aria-label="Justify"
            title="Justify Discrepancy"
            onClick={(event) => handleOpenRowMenu(event, params.row)}
          >
            <MoreVertIcon />
          </IconButton>
        )}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleCloseRowMenu}
          PaperProps={{
            sx: { bgcolor: '#2d3748', color: '#e2e8f0', boxShadow: '0 4px 8px rgba(0,0,0,0.2)', borderRadius: 2 },
          }}
        >
          {hasPermission(RECONCILIATION_PERMISSIONS.justifyDiscrepancy) && selectedRowData?.status === 'Discrepancy' && (
            <MenuItem onClick={handleJustifyDiscrepancy} sx={{ '&:hover': { bgcolor: '#3a506b' } }}>
              <CheckCircleOutlineIcon sx={{ mr: 1 }} /> Justify Discrepancy
            </MenuItem>
          )}
          {/* Aquí puedes agregar otros MenuItems como Ajustar Inventario */}
        </Menu>
      </Box>
    ),
  },
];
  // ----------- RENDER PRINCIPAL -----------

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 3, backgroundColor: '#1a202c', minHeight: '100vh', color: '#e2e8f0' }}>
        <Typography variant="h4" gutterBottom component="h1" sx={{ color: '#e2e8f0', mb: 3 }}>
          Inventory Reconciliation
        </Typography>
        <AppBar position="static" sx={{ bgcolor: '#2d3748', borderRadius: 1, mb: 3, boxShadow: 3 }}>
          <Toolbar sx={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <FormControl sx={{ minWidth: 200, flexGrow: 1 }}>
              <InputLabel id="facility-select-label" sx={{ color: '#a0aec0' }}>Facility</InputLabel>
              <Select
                labelId="facility-select-label"
                id="facility-select"
                value={selectedFacilityId}
                label="Facility"
                onChange={(e) => {
                  setSelectedFacilityId(e.target.value);
                  setSelectedSubLocationId('');
                }}
                sx={{
                  color: '#e2e8f0',
                  '.MuiOutlinedInput-notchedOutline': { borderColor: '#a0aec0' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#4CAF50' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#e2e8f0' },
                  '.MuiSvgIcon-root': { color: '#e2e8f0' }
                }}
                MenuProps={{
                  PaperProps: {
                    sx: { bgcolor: '#2d3748' }
                  },
                }}
              >
                {facilities.map((facility) => (
                  <MenuItem
                    key={facility.id}
                    value={facility.id}
                    sx={{ color: '#e2e8f0', '&:hover': { bgcolor: '#3a506b' } }}
                  >
                    {facility.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl sx={{ minWidth: 200, flexGrow: 1 }}>
              <InputLabel id="sub-location-select-label" sx={{ color: '#a0aec0' }}>Sub-Location</InputLabel>
              <Select
                labelId="sub-location-select-label"
                id="sub-location-select"
                value={selectedSubLocationId}
                label="Sub-Location"
                onChange={(e) => setSelectedSubLocationId(e.target.value)}
                sx={{
                  color: '#e2e8f0',
                  '.MuiOutlinedInput-notchedOutline': { borderColor: '#a0aec0' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#4CAF50' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#e2e8f0' },
                  '.MuiSvgIcon-root': { color: '#e2e8f0' }
                }}
                disabled={!selectedFacilityId}
              >
                <MenuItem value=""><em>All</em></MenuItem>
                {subLocations.map((subLoc) => (
                  <MenuItem key={subLoc.id} value={subLoc.id}>{subLoc.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <DatePicker
              label="Cut-off Date (Logical)"
              value={asOfDate}
              onChange={(newValue) => setAsOfDate(newValue)}
              slotProps={{
                textField: {
                  sx: {
                    minWidth: 200,
                    flexGrow: 1,
                    '& .MuiInputBase-input': { color: '#e2e8f0' },
                    '& .MuiInputLabel-root': { color: '#a0aec0' },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#a0aec0' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#e2e8f0' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#4CAF50' },
                    '.MuiSvgIcon-root': { color: '#e2e8f0' }
                  }
                }
              }}
            />
            <Button
              variant="contained"
              startIcon={<RefreshIcon />}
              onClick={fetchReconciliationData}
              disabled={loading || !selectedFacilityId}
              sx={{ bgcolor: '#4CAF50', '&:hover': { bgcolor: '#43A047' }, color: '#fff', height: '56px' }}
            >
              Update
            </Button>
          </Toolbar>
        </AppBar>
        <Box sx={{ height: 600, width: '100%', mt: 3 }}>
          <DataGrid
            rows={reconciliationData}
            columns={columns}
            pageSizeOptions={[10, 25, 50]}
            pagination
            loading={loading}
            getRowId={(row) => row.batch_id}
            sx={{
              backgroundColor: '#2d3748',
              color: '#e2e8f0',
              '.MuiDataGrid-columnHeaders': { bgcolor: '#3a506b', color: '#000' },
              '.MuiDataGrid-cell': { borderColor: 'rgba(255,255,255,0.1)' },
              '.MuiDataGrid-row': {
                '&:nth-of-type(odd)': { backgroundColor: 'rgba(255,255,255,0.05)' },
                '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
              },
              '.MuiTablePagination-root': { color: '#e2e8f0' },
              '.MuiSelect-icon': { color: '#e2e8f0' },
              '.MuiDataGrid-menuIcon': { color: '#e2e8f0' },
              '.MuiDataGrid-sortIcon': { color: '#e2e8f0' },
              '.MuiDataGrid-toolbarContainer': {
                color: '#e2e8f0',
                '& .MuiButtonBase-root': { color: '#e2e8f0' },
              },
            }}
          />
        </Box>

        {/* Diálogo para Registrar Conteo Físico */}
        <Dialog open={openCountDialog} onClose={handleCloseCountDialog} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: '#2d3748', color: '#e2e8f0', borderRadius: 2 } }}>
          <DialogTitle sx={{ bgcolor: '#3a506b', color: '#fff', textAlign: 'center' }}>
            Register Physical Count for {currentBatchForCount?.batch_name}
          </DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            <TextField
              margin="dense"
              label="Counted Quantity"
              type="number"
              fullWidth
              value={countQuantity}
              onChange={(e) => setCountQuantity(e.target.value)}
              error={!!countError}
              helperText={countError}
              sx={{
                mb: 2, '& .MuiInputBase-input': { color: '#fff' }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.8)' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
              }}
              InputProps={{ inputProps: { min: 0 } }}
            />
            <TextField
              margin="dense"
              label="Unit of Measure"
              value={currentBatchForCount?.logical_unit || ''}
              fullWidth
              InputProps={{ readOnly: true }}
              sx={{
                mb: 2, '& .MuiInputBase-input': { color: '#fff' }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
              }}
            />
            <DatePicker
              label="Count Date"
              value={countDate}
              onChange={(newValue) => setCountDate(newValue)}
              slotProps={{
                textField: {
                  fullWidth: true,
                  sx: {
                    mb: 2,
                    '& .MuiInputBase-input': { color: '#fff' }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.8)' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
                    '.MuiSvgIcon-root': { color: 'rgba(255,255,255,0.7)' }
                  }
                }
              }}
            />
            <TextField
              margin="dense"
              label="Notes (Optional)"
              type="text"
              fullWidth
              multiline
              rows={3}
              value={countNotes}
              onChange={(e) => setCountNotes(e.target.value)}
              sx={{
                mb: 2, '& .MuiInputBase-input': { color: '#fff' }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.8)' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
              }}
            />
          </DialogContent>
          <DialogActions sx={{ bgcolor: '#3a506b' }}>
            <Button onClick={handleCloseCountDialog} disabled={countDialogLoading} sx={{ color: '#a0aec0' }}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitPhysicalCount}
              disabled={countDialogLoading}
              variant="contained"
              sx={{ bgcolor: '#4CAF50', '&:hover': { bgcolor: '#43A047' } }}
            >
              {countDialogLoading ? <CircularProgress size={24} /> : 'Register Count'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* MODAL DE JUSTIFICACIÓN */}
        <JustifyDiscrepancyModal
          open={openJustifyModal}
          onClose={() => setOpenJustifyModal(false)}
          discrepancy={selectedDiscrepancy}
          reasons={discrepancyReasons}
          onSubmit={handleSubmitJustification}
          loading={loadingJustify}
        />

      </Box>
    </LocalizationProvider>
  );
};

InventoryReconciliationPage.propTypes = {
  tenantId: PropTypes.number,
  isAppReady: PropTypes.bool.isRequired,
  userFacilityId: PropTypes.number,
  isGlobalAdmin: PropTypes.bool.isRequired,
  setParentSnack: PropTypes.func.isRequired,
  hasPermission: PropTypes.func.isRequired,
};

export default InventoryReconciliationPage;
