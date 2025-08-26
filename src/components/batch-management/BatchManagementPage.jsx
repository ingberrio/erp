import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { api } from '../../App';
import {
  Box, Typography, Button, CircularProgress, IconButton, Alert, FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import TransformIcon from '@mui/icons-material/Transform';
import AddBoxIcon from '@mui/icons-material/AddBox';
import { DataGrid } from '@mui/x-data-grid';
import useFacilityOperator from '../../hooks/useFacilityOperator';

import { SNACK_MESSAGES, DIALOG_TITLES, BUTTON_LABELS } from './batchManagement.constants';
import CustomDataGridToolbar from './CustomDataGridToolbar';
import AddEditBatchDialog from './AddEditBatchDialog';
import ConfirmationDialog from './ConfirmationDialog';

function CustomNoRowsOverlay() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'white' }}>
      <Typography>No batches to display for the selected facility.</Typography>
    </Box>
  );
}

const BatchManagementPage = ({ tenantId, isAppReady, userFacilityId, isGlobalAdmin, setParentSnack, hasPermission }) => {
  const [batches, setBatches] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState('');
  const [cultivationAreas, setCultivationAreas] = useState([]);
  const [stages, setStages] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogState, setDialogState] = useState({ type: null, data: null });

  const isFacilityOperator = useFacilityOperator(hasPermission);

  const showSnack = useCallback((message, severity = 'success') => {
    setParentSnack(message, severity);
  }, [setParentSnack]);

  const fetchFacilities = useCallback(async () => {
    try {
      const response = await api.get('/facilities');
      let fetchedFacilities = Array.isArray(response.data) ? response.data : Array.isArray(response.data?.data) ? response.data.data : [];
      if (isFacilityOperator && userFacilityId) {
        fetchedFacilities = fetchedFacilities.filter(f => f.id === userFacilityId);
      }
      return fetchedFacilities;
    } catch (error) {
      showSnack(SNACK_MESSAGES.FACILITIES_ERROR, 'error');
      return [];
    }
  }, [showSnack, isFacilityOperator, userFacilityId]);

  const fetchCultivationAreas = useCallback(async (facilityId) => {
    if (!isAppReady || !facilityId || (!tenantId && !isGlobalAdmin)) return;
    try {
      const response = await api.get(`/facilities/${facilityId}/cultivation-areas`);
      const fetchedAreas = Array.isArray(response.data?.data) ? response.data.data : [];
      setCultivationAreas(fetchedAreas);
    } catch (error) {
      showSnack(SNACK_MESSAGES.CULTIVATION_AREAS_ERROR, 'error');
    }
  }, [isAppReady, tenantId, isGlobalAdmin, showSnack]);

  const fetchStages = useCallback(async () => {
    try {
      const response = await api.get('/stages');
      setStages(Array.isArray(response.data?.data) ? response.data.data : []);
    } catch (error) {
      showSnack(SNACK_MESSAGES.STAGES_ERROR, 'error');
    }
  }, [showSnack]);

  const fetchUsers = useCallback(async (facilityId) => {
    if (!isAppReady || !facilityId || (!tenantId && !isGlobalAdmin)) return;
    const headers = {};
    const selectedFac = facilities.find(f => f.id === facilityId);
    const effectiveTenantId = isGlobalAdmin ? selectedFac?.tenant_id : tenantId;

    if (!effectiveTenantId) {
        showSnack(SNACK_MESSAGES.TENANT_ID_MISSING, 'error');
        setUsers([]);
        return;
    }
    headers['X-Tenant-ID'] = String(effectiveTenantId);
    try {
      const response = await api.get('/tenant-members', { headers });
      setUsers(Array.isArray(response.data) ? response.data : response.data.data || []);
    } catch (error) {
      showSnack("Error fetching users.", "error");
      setUsers([]);
    }
  }, [isAppReady, tenantId, isGlobalAdmin, showSnack, facilities]);

  const fetchBatches = useCallback(async (facilityId) => {
    if (!isAppReady || !facilityId || (!tenantId && !isGlobalAdmin)) {
      setBatches([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const headers = {};
    const selectedFac = facilities.find(f => f.id === facilityId);
    const effectiveTenantId = isGlobalAdmin ? selectedFac?.tenant_id : tenantId;

    if (!effectiveTenantId) {
        showSnack(SNACK_MESSAGES.TENANT_ID_MISSING, 'error');
        setLoading(false);
        setBatches([]);
        return;
    }
    headers['X-Tenant-ID'] = String(effectiveTenantId);
    try {
      const response = await api.get('/batches', { headers });
      setBatches(response.data);
    } catch (error) {
      showSnack(SNACK_MESSAGES.BATCHES_ERROR, 'error');
      setBatches([]);
    } finally {
      setLoading(false);
    }
  }, [isAppReady, tenantId, isGlobalAdmin, showSnack, facilities]);

  useEffect(() => {
    const loadInitialData = async () => {
      if (!isAppReady) return;
      setLoading(true);
      const fetchedFacs = await fetchFacilities();
      setFacilities(fetchedFacs);
      await fetchStages();
      let initialFacilityId = userFacilityId || (fetchedFacs[0]?.id || '');
      setSelectedFacilityId(initialFacilityId);
    };
    loadInitialData();
  }, [isAppReady, tenantId, isGlobalAdmin, userFacilityId, fetchFacilities, fetchStages]);

  useEffect(() => {
    if (selectedFacilityId) {
      fetchBatches(selectedFacilityId);
      fetchCultivationAreas(selectedFacilityId);
      fetchUsers(selectedFacilityId);
    } else {
      setBatches([]);
      setCultivationAreas([]);
      setUsers([]);
      setLoading(false);
    }
  }, [selectedFacilityId, fetchBatches, fetchCultivationAreas, fetchUsers]);

  const handleOpenDialog = useCallback((type, data = null) => {
    console.log(`Opening dialog: ${type}`, data);
    setDialogState({ type, data });
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialogState({ type: null, data: null });
  }, []);

  const handleSaveSuccess = useCallback(() => {
    fetchBatches(selectedFacilityId);
    handleCloseDialog();
  }, [fetchBatches, selectedFacilityId, handleCloseDialog]);

  const handleDeleteBatchConfirm = useCallback(async () => {
    const batchToDelete = dialogState.data;
    if (!batchToDelete) return;

    const headers = {};
    const selectedFac = facilities.find(f => f.id === selectedFacilityId);
    const effectiveTenantId = isGlobalAdmin ? selectedFac?.tenant_id : tenantId;

    if (!effectiveTenantId) {
        showSnack(SNACK_MESSAGES.TENANT_ID_MISSING, 'error');
        return;
    }
    headers['X-Tenant-ID'] = String(effectiveTenantId);

    try {
      await api.delete(`/batches/${batchToDelete.id}`, { headers });
      showSnack(SNACK_MESSAGES.BATCH_DELETED, 'success');
      handleSaveSuccess();
    } catch (error) {
      showSnack(error.response?.data?.message || 'Error deleting batch.', 'error');
      handleCloseDialog();
    }
  }, [dialogState.data, selectedFacilityId, tenantId, isGlobalAdmin, facilities, showSnack, handleSaveSuccess, handleCloseDialog]);

  const columns = useMemo(() => [
    { field: 'name', headerName: 'Batch Name', flex: 1, minWidth: 150 },
    { field: 'variety', headerName: 'Variety', width: 120 },
    { field: 'product_type', headerName: 'Product Type', width: 150 },
    { 
      field: 'current_units', 
      headerName: 'Units', 
      type: 'number', 
      width: 100, 
      valueFormatter: (params) => {
        if (!params.row) return params.value;
        return `${params.value} ${params.row.units || ''}`.trim();
      }
    },
    { field: 'cultivation_area_name', headerName: 'Cultivation Area', flex: 1, minWidth: 150, valueGetter: (params) => cultivationAreas.find(ca => ca.id === params.row.cultivation_area_id)?.name || 'N/A' },
    { field: 'current_stage_name', headerName: 'Current Stage', width: 130, valueGetter: (params) => stages.find(s => s.id === cultivationAreas.find(ca => ca.id === params.row.cultivation_area_id)?.current_stage_id)?.name || 'N/A' },
    { field: 'is_packaged', headerName: 'Packaged', width: 100, type: 'boolean' },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 250,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <IconButton size="small" onClick={() => handleOpenDialog('DETAIL', params.row)}><VisibilityIcon /></IconButton>
          <IconButton size="small" onClick={() => handleOpenDialog('EDIT', params.row)} disabled={isFacilityOperator}><EditIcon /></IconButton>
          <IconButton size="small" onClick={() => handleOpenDialog('SPLIT', params.row)} disabled={isFacilityOperator || params.row.current_units <= 1}><CallSplitIcon /></IconButton>
          <IconButton size="small" onClick={() => handleOpenDialog('PROCESS', params.row)} disabled={isFacilityOperator || params.row.current_units <= 0}><TransformIcon /></IconButton>
          <IconButton size="small" onClick={() => handleOpenDialog('ADJUSTMENT', params.row)} disabled={isFacilityOperator}><AddBoxIcon /></IconButton>
          <IconButton size="small" onClick={() => handleOpenDialog('DELETE_CONFIRM', params.row)} disabled={isFacilityOperator}><DeleteIcon /></IconButton>
        </Box>
      ),
    },
  ], [isFacilityOperator, cultivationAreas, stages, handleOpenDialog]);

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, minHeight: 'calc(100vh - 64px)', bgcolor: '#1a202c', color: '#fff' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>Batch Management</Typography>
        {isGlobalAdmin && facilities.length > 0 && (
            <FormControl sx={{ minWidth: 200, ml: 2, bgcolor: '#2d3748', borderRadius: 1 }}>
                <InputLabel sx={{ color: '#e2e8f0' }}>Select Facility</InputLabel>
                <Select value={selectedFacilityId} onChange={(e) => setSelectedFacilityId(e.target.value)} sx={{ color: '#e2e8f0', '.MuiSvgIcon-root': { color: '#e2e8f0' } }}>
                    {facilities.map(fac => <MenuItem key={fac.id} value={fac.id}>{fac.name}</MenuItem>)}
                </Select>
            </FormControl>
        )}
        <Box sx={{ ml: 'auto' }}>
            <Button startIcon={<AddIcon />} onClick={() => handleOpenDialog('ADD', null)}>{BUTTON_LABELS.ADD_NEW_BATCH}</Button>
            <Button startIcon={<LocalShippingIcon />} onClick={() => handleOpenDialog('ADD_EXTERNAL', null)} sx={{ ml: 1 }}>{BUTTON_LABELS.REGISTER_EXTERNAL_BATCH}</Button>
        </Box>
      </Box>

      {isGlobalAdmin && !selectedFacilityId && !loading && (
          <Alert severity="info" sx={{ bgcolor: '#3a506b', color: '#e2e8f0' }}>Please select a facility to view batches.</Alert>
      )}

      <Box sx={{ height: 650, width: '100%' }}>
         <DataGrid
            rows={batches}
            columns={columns}
            getRowId={(row) => row.id}
            loading={loading}
            components={{ Toolbar: CustomDataGridToolbar, NoRowsOverlay: CustomNoRowsOverlay }}
            sx={{ bgcolor: '#2d3748', color: '#e2e8f0', border: 'none' }}
          />
      </Box>
      
      <AddEditBatchDialog
        open={dialogState.type === 'ADD' || dialogState.type === 'EDIT'}
        editingBatch={dialogState.type === 'EDIT' ? dialogState.data : null}
        onClose={handleCloseDialog}
        onSaveSuccess={handleSaveSuccess}
        {...{ facilities, cultivationAreas, stages, selectedFacilityId, tenantId, isGlobalAdmin, showSnack, isFacilityOperator, users }}
      />

      <ConfirmationDialog
        open={dialogState.type === 'DELETE_CONFIRM'}
        title={DIALOG_TITLES.CONFIRM_BATCH_DELETION}
        message={`Are you sure you want to delete the batch "${dialogState.data?.name}"? This action cannot be undone.`}
        onConfirm={handleDeleteBatchConfirm}
        onCancel={handleCloseDialog}
      />

    </Box>
  );
};

BatchManagementPage.propTypes = {
  tenantId: PropTypes.number,
  isAppReady: PropTypes.bool.isRequired,
  userFacilityId: PropTypes.number,
  isGlobalAdmin: PropTypes.bool.isRequired,
  setParentSnack: PropTypes.func.isRequired,
  hasPermission: PropTypes.func.isRequired,
};

export default BatchManagementPage;