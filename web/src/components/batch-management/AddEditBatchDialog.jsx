import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { api } from '../../App';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, FormControl, InputLabel, Select, MenuItem, CircularProgress, FormControlLabel, Checkbox
} from '@mui/material';
import { DIALOG_TITLES, BUTTON_LABELS, SNACK_MESSAGES, HEALTH_CANADA_PRODUCT_TYPES, UNIT_OPTIONS } from './batchManagement.constants';
import { formatDate } from './batchManagement.utils';

const AddEditBatchDialog = ({ open, editingBatch, onClose, onSaveSuccess, facilities, cultivationAreas, selectedFacilityId, tenantId, isGlobalAdmin, showSnack, isFacilityOperator }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({});

  useEffect(() => {
    const initialData = {
      name: editingBatch?.name || '',
      current_units: editingBatch?.current_units || '',
      units: editingBatch?.units || 'g',
      end_type: editingBatch?.end_type || '',
      variety: editingBatch?.variety || '',
      product_type: editingBatch?.product_type || '',
      projected_yield: editingBatch?.projected_yield || '',
      advance_to_harvesting_on: editingBatch?.advance_to_harvesting_on ? formatDate(editingBatch.advance_to_harvesting_on) : '',
      cultivation_area_id: editingBatch?.cultivation_area_id || '',
      origin_type: editingBatch?.origin_type || 'internal',
      origin_details: editingBatch?.origin_details || '',
      is_packaged: editingBatch?.is_packaged || false,
      sub_location: editingBatch?.sub_location || '',
    };
    setFormData(initialData);
  }, [editingBatch, open]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    // Basic validation
    if (!formData.name.trim()) { showSnack(SNACK_MESSAGES.BATCH_NAME_REQUIRED, 'warning'); return; }
    if (!formData.cultivation_area_id) { showSnack(SNACK_MESSAGES.BATCH_AREA_REQUIRED, 'warning'); return; }

    setLoading(true);
    const headers = {};
    const selectedFac = facilities.find(f => f.id === selectedFacilityId);
    const effectiveTenantId = isGlobalAdmin ? selectedFac?.tenant_id : tenantId;

    if (!effectiveTenantId) {
        showSnack(SNACK_MESSAGES.TENANT_ID_MISSING, 'error');
        setLoading(false);
        return;
    }
    headers['X-Tenant-ID'] = String(effectiveTenantId);

    const payload = { ...formData, facility_id: selectedFacilityId };

    try {
      if (editingBatch) {
        await api.put(`/batches/${editingBatch.id}`, payload, { headers });
      } else {
        await api.post('/batches', payload, { headers });
      }
      showSnack(editingBatch ? SNACK_MESSAGES.BATCH_UPDATED : SNACK_MESSAGES.BATCH_CREATED, 'success');
      onSaveSuccess();
    } catch (error) {
      showSnack(error.response?.data?.message || 'Error saving batch', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ component: 'form', onSubmit: handleSave, sx: { bgcolor: '#fff', color: '#1a202c', borderRadius: 2 } }}>
      <DialogTitle sx={{ bgcolor: '#fff', color: '#1a202c', borderBottom: '1px solid #e0e0e0' }}>{editingBatch ? DIALOG_TITLES.EDIT_BATCH : DIALOG_TITLES.ADD_BATCH}</DialogTitle>
      <DialogContent sx={{ pt: '20px !important' }}>
        <TextField name="name" label="Batch Name" value={formData.name || ''} onChange={handleChange} fullWidth margin="dense" required />
        <TextField name="current_units" label="Current Units" value={formData.current_units || ''} onChange={handleChange} fullWidth margin="dense" type="number" required />
        <FormControl fullWidth margin="dense" required>
            <InputLabel>Unit</InputLabel>
            <Select name="units" value={formData.units || 'g'} onChange={handleChange}>
                {UNIT_OPTIONS.map(unit => <MenuItem key={unit} value={unit}>{unit}</MenuItem>)}
            </Select>
        </FormControl>
        <TextField name="variety" label="Variety" value={formData.variety || ''} onChange={handleChange} fullWidth margin="dense" required />
        <FormControl fullWidth margin="dense" required>
            <InputLabel>Product Type</InputLabel>
            <Select name="product_type" value={formData.product_type || ''} onChange={handleChange}>
                {HEALTH_CANADA_PRODUCT_TYPES.map(pt => <MenuItem key={pt.value} value={pt.value}>{pt.label}</MenuItem>)}
            </Select>
        </FormControl>
        <FormControl fullWidth margin="dense" required>
            <InputLabel>Cultivation Area</InputLabel>
            <Select name="cultivation_area_id" value={formData.cultivation_area_id || ''} onChange={handleChange}>
                {cultivationAreas.map(area => <MenuItem key={area.id} value={area.id}>{area.name}</MenuItem>)}
            </Select>
        </FormControl>
        <TextField name="end_type" label="End Type" value={formData.end_type || ''} onChange={handleChange} fullWidth margin="dense" required />
        <TextField name="projected_yield" label="Projected Yield" value={formData.projected_yield || ''} onChange={handleChange} fullWidth margin="dense" type="number" />
        <TextField name="advance_to_harvesting_on" label="Harvest Date" value={formData.advance_to_harvesting_on || ''} onChange={handleChange} fullWidth margin="dense" type="date" InputLabelProps={{ shrink: true }} />
        <TextField name="sub_location" label="Sub-location" value={formData.sub_location || ''} onChange={handleChange} fullWidth margin="dense" />
        <FormControlLabel control={<Checkbox name="is_packaged" checked={formData.is_packaged || false} onChange={handleChange} />} label="Is Packaged" />
      </DialogContent>
      <DialogActions sx={{ bgcolor: '#f8fafc', borderTop: '1px solid #e0e0e0' }}>
        <Button onClick={onClose} disabled={loading}>{BUTTON_LABELS.CANCEL}</Button>
        <Button type="submit" variant="contained" disabled={loading}>
          {loading ? <CircularProgress size={24} /> : (editingBatch ? BUTTON_LABELS.SAVE_CHANGES : BUTTON_LABELS.CREATE_BATCH)}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

AddEditBatchDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  editingBatch: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onSaveSuccess: PropTypes.func.isRequired,
  facilities: PropTypes.array.isRequired,
  cultivationAreas: PropTypes.array.isRequired,
  selectedFacilityId: PropTypes.any.isRequired,
  tenantId: PropTypes.number,
  isGlobalAdmin: PropTypes.bool.isRequired,
  showSnack: PropTypes.func.isRequired,
  isFacilityOperator: PropTypes.bool.isRequired,
};

export default AddEditBatchDialog;