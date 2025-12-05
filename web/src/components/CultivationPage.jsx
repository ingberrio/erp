// src/components/CultivationPage.jsx
// CACHE BREAKER: Force browser refresh - Updated at 2025-08-26
// This version consolidates all previously developed features, including:
// - Stage and Cultivation Area management (CRUD, DND)
// - Batch management with 'Product Type' field
// - Traceability Event registration (Movement, Cultivation, Harvest, Sampling, Destruction)
// - Traceability Events Export
// - NEW: Batch Processing (Drying/Transformation) functionality
// All UI texts and messages are translated to English.

// FIX: Addressed infinite re-render loop by adjusting useEffect and useCallback dependencies.
// FIX: Corrected HTML nesting error (h6 inside h2) in DialogTitle.
// FIX: Resolved ReferenceError: fetchStages is not defined by ensuring correct scope and dependencies.
// IMPORTANT: This version is built directly on the user's provided full code to avoid line loss.

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { api } from '../App'; // Ensure this import is correct
import {
  Box, Typography, Button, CircularProgress, Snackbar, Alert,
  TextField, Paper, Divider, IconButton, FormControl, InputLabel, Select, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogActions,
  List, ListItem, ListItemText, Grid, Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import GrassIcon from '@mui/icons-material/Grass';
import LocationOnIcon from '@mui/icons-material/LocationOn'; // Icon for location
import HistoryIcon from '@mui/icons-material/History'; // Icon for traceability
import TrendingUpIcon from '@mui/icons-material/TrendingUp'; // Icon for movement
import EcoIcon from '@mui/icons-material/Agriculture'; // Icon for cultivation event
import HarvestIcon from '@mui/icons-material/LocalFlorist'; // Icon for harvest (using flower)
import ScienceIcon from '@mui/icons-material/Science'; // Icon for sampling
import DeleteForeverIcon from '@mui/icons-material/DeleteForever'; // Icon for destruction
import CloseIcon from '@mui/icons-material/Close';
import GetAppIcon from '@mui/icons-material/GetApp'; // Icon for download
import LocalProcessingIcon from '@mui/icons-material/LocalShipping'; // Icon for processing, using LocalShipping as a placeholder for now

import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  closestCorners,
  useDroppable,
} from '@dnd-kit/core';
import {
  sortableKeyboardCoordinates,
  arrayMove,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Import the new TraceabilityEventsGrid component
import TraceabilityEventsGrid from './TraceabilityEventsGrid';


// --- Constants for Messages and Texts (All in English) ---
const SNACK_MESSAGES = {
  FACILITIES_ERROR: 'Error loading facilities.',
  STAGES_ERROR: 'Error loading stages.',
  TENANTS_ERROR: 'Error loading tenants.',
  CULTIVATION_AREAS_ERROR: 'Error loading cultivation areas.',
  STAGE_NAME_REQUIRED: 'Stage name is required.',
  STAGE_NAME_LENGTH_EXCEEDED: 'Stage name cannot exceed 100 characters.',
  STAGE_NAME_INVALID_CHARS: 'Stage name cannot contain special characters like <, >, or {}.',
  AREA_NAME_REQUIRED: 'Cultivation area name is required.',
  AREA_NAME_LENGTH_EXCEEDED: 'Area name cannot exceed 100 characters.',
  AREA_NAME_INVALID_CHARS: 'Area name cannot contain special characters like <, >, or {}.',
  AREA_FACILITY_REQUIRED: 'You must select a facility for the area.',
  TENANT_ID_MISSING: 'Could not determine Tenant ID.',
  STAGE_UPDATED: 'Stage updated successfully.',
  STAGE_CREATED: 'Stage created successfully.',
  STAGE_DELETED: 'Stage deleted successfully.',
  CULTIVATION_AREA_UPDATED: 'Cultivation area updated successfully.',
  CULTIVATION_AREA_CREATED: 'Cultivation area created successfully.',
  CULTIVATION_AREA_DELETED: 'Cultivation area deleted successfully.',
  CULTIVATION_AREA_MOVED: 'Cultivation area moved successfully.',
  DRAG_PERMISSION_DENIED: 'You do not have permission to move areas as a Facility Operator.',
  GENERAL_ERROR_SAVING_STAGE: 'Error saving stage:',
  GENERAL_ERROR_SAVING_AREA: 'Error saving cultivation area:',
  PERMISSION_DENIED: 'You do not have permissions to perform this action.',
  VALIDATION_ERROR: 'Validation error:',
  INVALID_DATA: 'Invalid data:',
  ERROR_DRAGGING: 'Error dragging. Reloading data...',
  CANNOT_DELETE_AREA_WITH_BATCHES: 'Cannot delete cultivation area: It has associated batches.',
  EVENT_REGISTERED_SUCCESS: 'Traceability event registered successfully.',
  BATCH_CREATED: 'Batch created successfully.',
  BATCH_NAME_REQUIRED: 'Batch name is required.',
  BATCH_UNITS_REQUIRED: 'Current batch units are required.',
  BATCH_END_TYPE_REQUIRED: 'Batch end type is required.',
  BATCH_VARIETY_REQUIRED: 'Batch variety is required.',
  BATCH_PRODUCT_TYPE_REQUIRED: 'Batch product type is required.', // Added for new field
  EVENT_REGISTRATION_ERROR: 'Error registering traceability event:',
  MOVEMENT_AREA_EVENT_REGISTERED: 'Cultivation area movement registered successfully.',
  AREA_STAGE_TRANSITION_REGISTERED: 'Area stage transition traceability event registered successfully.',
  HARVEST_BATCH_CREATED: 'Harvest batch created successfully.',
  HARVEST_BATCH_CREATE_ERROR: 'Error creating harvest batch:',
  EXPORT_SUCCESS: 'Traceability events exported successfully.',
  EXPORT_ERROR: 'Error exporting traceability events:',
  STAGE_TRANSITION_SUCCESS: 'Stage transition completed and traceability event registered.',
  STAGE_TRANSITION_WARNING: 'Stage transition completed but traceability event registration failed.',
  BATCH_PROCESSED_SUCCESS: 'Batch processed successfully.', // Added for processing
  BATCH_PROCESS_ERROR: 'Error processing batch:', // Added for processing
  PROCESS_QUANTITY_REQUIRED: 'Processed quantity is required.', // Added for processing
  PROCESS_METHOD_REQUIRED: 'Process method is required.', // Added for processing
  NEW_PRODUCT_TYPE_REQUIRED: 'New product type is required.', // Added for processing
};

const DIALOG_TITLES = {
  CONFIRM_STAGE_DELETION: 'Confirm Stage Deletion',
  CONFIRM_AREA_DELETION: 'Confirm Cultivation Area Deletion',
  EDIT_STAGE: 'Edit Stage',
  CREATE_STAGE: 'Create New Stage',
  EDIT_AREA: 'Edit Cultivation Area',
  CREATE_AREA: 'Create New Cultivation Area',
  AREA_DETAIL: 'Area Detail:',
  REGISTER_EVENT: 'Register Traceability Event',
  ADD_BATCH: 'Add New Batch',
  EXPORT_EVENTS: 'Export Traceability Events',
  PROCESS_BATCH: 'Process Batch (Drying/Transformation)', // Added for processing
};

const BUTTON_LABELS = {
  CANCEL: 'Cancel',
  CONFIRM: 'Confirm',
  SAVE_CHANGES: 'Save Changes',
  CREATE_STAGE: 'Create Stage',
  ADD_STAGE: 'Add Stage',
  ADD_CULTIVATION_AREA: 'Add Cultivation Area',
  CREATE_AREA: 'Create Area',
  ADVANCE_STAGE: 'Advance Stage',
  CREATE_SAMPLE: 'Create Sample',
  ADD_NEW_BATCH: 'Add New Batch',
  CLOSE: 'Close',
  REGISTER_MOVEMENT: 'Register Movement',
  REGISTER_CULTIVATION_EVENT: 'Register Cultivation Event',
  REGISTER_HARVEST: 'Register Harvest',
  REGISTER_SAMPLING: 'Register Sampling',
  REGISTER_DESTRUCTION: 'Register Destruction',
  REGISTER: 'Register',
  CREATE_BATCH: 'Create Batch',
  EXPORT_EVENTS: 'Export Events',
  PROCESS_BATCH: 'Process Batch', // Added for processing
};

// Health Canada Product Types (simplified for initial implementation)
const HEALTH_CANADA_PRODUCT_TYPES = [
  { value: 'Vegetative cannabis plants', label: 'Vegetative Cannabis Plants' },
  { value: 'Fresh cannabis', label: 'Fresh Cannabis' },
  { value: 'Dried cannabis', label: 'Dried Cannabis' },
  { value: 'Seeds', label: 'Seeds' },
  { value: 'Pure Intermediates', label: 'Pure Intermediates' },
  { value: 'Edibles - Solids', label: 'Edibles - Solids' },
  { value: 'Edibles - Non-solids', label: 'Edibles - Non-solids' },
  { value: 'Extracts - Inhaled', label: 'Extracts - Inhaled' },
  { value: 'Extracts - Ingested', label: 'Extracts - Ingested' },
  { value: 'Extracts - Other', label: 'Extracts - Other' },
  { value: 'Topicals', label: 'Topicals' },
  { value: 'Other', label: 'Other' },
];

// SKU-style color functions for consistent UI
const getProductTypeColor = (productType) => {
  switch (productType) {
    case 'Vegetative cannabis plants': return '#388e3c'; // Green - like Sativa
    case 'Fresh cannabis': return '#4caf50'; // Light Green
    case 'Dried cannabis': return '#f57c00'; // Orange - like Medium yield
    case 'Seeds': return '#1976d2'; // Blue - like Hybrid
    case 'Pure Intermediates': return '#7b1fa2'; // Purple - like Indica
    case 'Edibles - Solids': return '#e91e63'; // Pink
    case 'Edibles - Non-solids': return '#9c27b0'; // Deep Purple
    case 'Extracts - Inhaled': return '#00bcd4'; // Cyan
    case 'Extracts - Ingested': return '#009688'; // Teal
    case 'Extracts - Other': return '#607d8b'; // Blue Grey
    case 'Topicals': return '#795548'; // Brown
    case 'Other': return '#616161'; // Gray - like unpackaged
    default: return '#757575';
  }
};

const getStageColor = (stageName) => {
  const name = (stageName || '').toLowerCase();
  if (name.includes('seed') || name.includes('germination')) return '#1976d2'; // Blue
  if (name.includes('vegetat') || name.includes('veg')) return '#388e3c'; // Green
  if (name.includes('flower') || name.includes('bloom')) return '#7b1fa2'; // Purple
  if (name.includes('harvest')) return '#f57c00'; // Orange
  if (name.includes('dry') || name.includes('cure')) return '#795548'; // Brown
  if (name.includes('process') || name.includes('extract')) return '#00bcd4'; // Cyan
  return '#455a64'; // Default Blue Grey
};

// --- Generic Confirmation Dialog Component ---
const ConfirmationDialog = ({ open, title, message, onConfirm, onCancel }) => {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
      PaperProps={{ sx: { bgcolor: '#fff', borderRadius: 2 } }}
    >
      <DialogTitle id="alert-dialog-title" sx={{ color: 'text.primary' }}>{title}</DialogTitle>
      <DialogContent>
        <Typography id="alert-dialog-description" sx={{ color: 'text.secondary' }}>
          {message}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>
          {BUTTON_LABELS.CANCEL}
        </Button>
        <Button onClick={onConfirm} color="error" variant="contained" autoFocus>
          {BUTTON_LABELS.CONFIRM}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

ConfirmationDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  title: PropTypes.string.isRequired,
  message: PropTypes.string.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

// --- Component: BatchItem ---
const BatchItem = ({ batch, setParentSnack, isFacilityOperator }) => {
  const handleAdvanceStage = () => setParentSnack(`Advance stage for batch: ${batch.name}`, 'info');
  const handleCreateSample = () => setParentSnack(`Create sample for batch: ${batch.name}`, 'info');

  return (
    <Paper elevation={1} sx={{ p: 1.5, mb: 1, bgcolor: '#fff', borderRadius: 1, border: '1px solid #e0e0e0' }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#1976d2' }}>
        Batch: {batch.name}
      </Typography>
      <Typography variant="body2" sx={{ color: '#4a5568' }}>
        Units: {batch.current_units}
      </Typography>
      <Typography variant="body2" sx={{ color: '#4a5568' }}>
        Variety: {batch.variety}
      </Typography>
      {batch.product_type && (
        <Box sx={{ mt: 0.5 }}>
          <Chip 
            label={batch.product_type} 
            size="small" 
            sx={{ 
              bgcolor: getProductTypeColor(batch.product_type), 
              color: 'white',
              fontSize: '0.7rem',
              height: '22px'
            }} 
          />
        </Box>
      )}
      {batch.advance_to_harvesting_on && (
        <Typography variant="body2" sx={{ mt: 0.5, color: '#4a5568' }}>
          Harvest: {new Date(batch.advance_to_harvesting_on).toLocaleDateString()}
        </Typography>
      )}
      <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        <Button size="small" variant="outlined" onClick={handleAdvanceStage} disabled={isFacilityOperator}>{BUTTON_LABELS.ADVANCE_STAGE}</Button>
        <Button size="small" variant="outlined" onClick={handleCreateSample} disabled={isFacilityOperator}>{BUTTON_LABELS.CREATE_SAMPLE}</Button>
      </Box>
    </Paper>
  );
};

BatchItem.propTypes = {
  batch: PropTypes.object.isRequired,
  setParentSnack: PropTypes.func.isRequired,
  isFacilityOperator: PropTypes.bool.isRequired,
};

// --- Component: CultivationAreaContent ---
const CultivationAreaContent = ({ area, handleEdit, handleDelete, isFacilityOperator /*, setParentSnack */ }) => {
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Typography variant="body1" sx={{ fontWeight: 600, color: '#1a202c', flexGrow: 1, pr: 1, fontSize: '0.95rem' }}>
          <LocationOnIcon sx={{ fontSize: 18, mr: 0.5, verticalAlign: 'middle', color: '#64748b' }} />
          {area.name}
        </Typography>
        <Box>
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); handleEdit(area); }}
            sx={{ p: 0.5 }}
            aria-label={`Edit area ${area.name}`}
            disabled={isFacilityOperator}
          >
            <EditIcon sx={{ fontSize: 18, color: isFacilityOperator ? '#cbd5e1' : '#1976d2' }} />
          </IconButton>
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); handleDelete(area); }}
            sx={{ p: 0.5 }}
            aria-label={`Delete area ${area.name}`}
            disabled={isFacilityOperator}
          >
            <DeleteIcon sx={{ fontSize: 18, color: isFacilityOperator ? '#cbd5e1' : '#64748b' }} />
          </IconButton>
        </Box>
      </Box>
      {area.description && (
        <Typography variant="body2" sx={{ mt: 0.5, fontSize: 13, color: '#64748b' }}>
          {area.description.length > 70 ? `${area.description.substring(0, 70)}...` : area.description}
        </Typography>
      )}
      {area.capacity_units && (
        <Typography variant="body2" sx={{ 
          mt: 0.5, 
          fontSize: '0.85rem', 
          color: '#475569',
          display: 'flex',
          alignItems: 'center',
          gap: 0.5
        }}>
          <strong>Capacity:</strong> {area.capacity_units} {area.capacity_unit_type || 'units'}
        </Typography>
      )}
      {area.batches && area.batches.length > 0 && (
        <Typography variant="body2" sx={{ 
          mt: 0.5, 
          fontSize: '0.85rem', 
          fontWeight: 600, 
          color: '#1976d2',
          display: 'inline-flex',
          alignItems: 'center',
          bgcolor: '#e3f2fd',
          px: 1,
          py: 0.25,
          borderRadius: '4px'
        }}>
          🌿 {area.batches.length} Batches
        </Typography>
      )}
    </Box>
  );
};

CultivationAreaContent.propTypes = {
  area: PropTypes.object.isRequired,
  handleEdit: PropTypes.func,
  handleDelete: PropTypes.func,
  isFacilityOperator: PropTypes.bool.isRequired,
  setParentSnack: PropTypes.func.isRequired,
};

// --- Component: CultivationAreaItem ---
const CultivationAreaItem = React.memo(({ area, handleEdit, handleDelete, setParentSnack, isFacilityOperator, /* isGlobalAdmin, */ handleOpenAreaDetail }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: area.id,
    data: {
      type: 'CultivationArea',
      cultivationArea: area,
    },
    disabled: isFacilityOperator,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 9999 : 'auto',
    marginBottom: '12px',
    borderRadius: '10px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    padding: '12px',
    cursor: isFacilityOperator ? 'default' : (isDragging ? 'grabbing' : 'grab'),
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} onClick={() => handleOpenAreaDetail(area)}>
      <CultivationAreaContent
        area={area}
        handleEdit={handleEdit}
        handleDelete={handleDelete}
        isFacilityOperator={isFacilityOperator}
        setParentSnack={setParentSnack}
      />
    </div>
  );
});

CultivationAreaItem.propTypes = {
  area: PropTypes.object.isRequired,
  handleEdit: PropTypes.func,
  handleDelete: PropTypes.func,
  setParentSnack: PropTypes.func.isRequired,
  isFacilityOperator: PropTypes.bool.isRequired,
  isGlobalAdmin: PropTypes.bool.isRequired,
  handleOpenAreaDetail: PropTypes.func.isRequired,
};

// --- Component: StageView ---
const StageView = React.memo(({ stage, cultivationAreas, tenantId, refreshCultivationAreas, handleDeleteStage, setParentSnack, setParentConfirmDialog, setParentConfirmDialogOpen, selectedFacilityId, facilities, isFacilityOperator, isGlobalAdmin, /* userFacilityId, */ currentUserId }) => {
  const [openAddAreaDialog, setOpenAddAreaDialog] = useState(false);
  const [areaName, setAreaName] = useState('');
  const [areaDescription, setAreaDescription] = useState(''); 
  const [areaCapacityUnits, setAreaCapacityUnits] = useState('');
  const [areaCapacityUnitType, setAreaCapacityUnitType] = useState('');
  const [areaFacilityId, setAreaFacilityId] = useState(selectedFacilityId);
  const [editingArea, setEditingArea] = useState(null);
  const [areaDialogLoading, setAreaDialogLoading] = useState(false);

  // --- States and Handlers for the Traceability module (within StageView for area detail dialog) ---
  const [openAreaDetailDialog, setOpenAreaDetailDialog] = useState(false);
  const [currentAreaDetail, setCurrentAreaDetail] = useState(null); // The selected cultivation area for detail view

  // States for event registration dialog (now within StageView)
  const [openRegisterEventDialog, setOpenRegisterEventDialog] = useState(false);
  const [currentEventType, setCurrentEventType] = useState(''); // 'movement', 'cultivation', 'harvest', 'sampling', 'destruction'
  const [eventBatchId, setEventBatchId] = useState('');
  const [eventQuantity, setEventQuantity] = useState(''); // For units or count
  const [eventWeight, setEventWeight] = useState(''); // For weight
  const [eventUnit, setEventUnit] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventFromLocation, setEventFromLocation] = useState(''); // For movements
  const [eventToLocation, setEventToLocation] = useState('');     // For movements
  const [eventMethod, setEventMethod] = useState('');             // For destruction / cultivation type
  const [eventReason, setEventReason] = useState('');             // For destruction / sampling purpose
  
  // States for adding batch dialog (original, not harvest)
  const [openAddBatchDialog, setOpenAddBatchDialog] = useState(false);
  const [batchName, setBatchName] = useState('');
  const [batchCurrentUnits, setBatchCurrentUnits] = useState('');
  const [batchUnits, setBatchUnits] = useState('units'); // Unit type: g, kg, units, etc.
  const [batchEndType, setBatchEndType] = useState('');
  const [batchVariety, setBatchVariety] = useState('');
  const [batchProductType, setBatchProductType] = useState(''); // NEW: Product Type for batch
  const [batchProjectedYield, setBatchProjectedYield] = useState('');
  const [batchAdvanceToHarvestingOn, setBatchAdvanceToHarvestingOn] = useState('');
  const [batchDialogLoading, setBatchDialogLoading] = useState(false);

  // States for Process Batch Dialog (NEW)
  const [openProcessBatchDialog, setOpenProcessBatchDialog] = useState(false);
  const [processBatchId, setProcessBatchId] = useState('');
  const [processedQuantity, setProcessedQuantity] = useState('');
  const [processMethod, setProcessMethod] = useState('');
  const [processDescription, setProcessDescription] = useState('');
  const [newProductType, setNewProductType] = useState(''); // For the product type after processing
  const [processDialogLoading, setProcessDialogLoading] = useState(false);


  // Get batches currently in this area for traceability filter
  const batchesInCurrentArea = useMemo(() => {
    return currentAreaDetail?.batches || [];
  }, [currentAreaDetail]);

  // Function to fetch batches for a specific area
  const fetchBatchesForArea = useCallback(async (areaId) => {
    console.log('fetchBatchesForArea: Current tenantId from props:', tenantId);
    console.log('fetchBatchesForArea: isGlobalAdmin from props:', isGlobalAdmin);
    console.log('fetchBatchesForArea: selectedFacilityId from props:', selectedFacilityId);
    console.log('fetchBatchesForArea: facilities from props:', facilities);


    const headers = {};
    let effectiveTenantId = null;

    if (isGlobalAdmin) {
      if (selectedFacilityId) {
        const selectedFac = facilities.find(f => f.id === selectedFacilityId);
        if (selectedFac && selectedFac.tenant_id) {
          effectiveTenantId = String(selectedFac.tenant_id);
          console.log('fetchBatchesForArea: Global Admin, using X-Tenant-ID from selected facility:', effectiveTenantId);
        } else {
          setParentSnack('Error: As Super Admin, the selected facility does not have a valid Tenant ID to load batches.', 'error');
          return []; // Prevents API call if no valid tenant_id
        }
      } else {
        setParentSnack('Error: As Super Admin, you must select a facility to load batches.', 'error');
        return []; // Prevents API call if no facility selected
      }
    } else if (tenantId) {
      effectiveTenantId = String(tenantId);
      console.log('fetchBatchesForArea: Tenant user, using X-Tenant-ID from user:', effectiveTenantId);
    } else {
      setParentSnack('Error: Could not determine Tenant ID to load batches.', 'error');
      return []; // Prevents API call if no tenant_id
    }

    if (effectiveTenantId) {
      headers['X-Tenant-ID'] = effectiveTenantId;
    }

    try {
      const response = await api.get(`/cultivation-areas/${areaId}/batches`, { headers }); // Pass headers here
      console.log('fetchBatchesForArea: Batches fetched successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('fetchBatchesForArea: Error fetching batches for area:', error.response?.data || error.message);
      setParentSnack('Error loading batches for the area.', 'error');
      return [];
    }
  }, [setParentSnack, tenantId, isGlobalAdmin, selectedFacilityId, facilities]); // Add facilities to dependencies


  const handleOpenAreaDetail = useCallback(async (area) => {
    setOpenAreaDetailDialog(true);
    setCurrentAreaDetail(area); // Set the area first so fetchTraceabilityEvents has access
    console.log('StageView: Opening area detail for:', area);
    console.log('StageView: Tenant ID available (from props):', tenantId);
    console.log('StageView: isGlobalAdmin available (from props):', isGlobalAdmin);

    // Load batches for the selected area
    try {
        const batches = await fetchBatchesForArea(area.id);
        // Update currentAreaDetail with batches
        setCurrentAreaDetail(prev => ({ ...prev, batches: batches }));
    } catch (error) {
        console.error('StageView: Error in handleOpenAreaDetail:', error);
        setParentSnack('Error loading area details or batches.', 'error');
    }
  }, [fetchBatchesForArea, tenantId, isGlobalAdmin, setParentSnack]);

  const handleCloseAreaDetail = useCallback(() => {
    setOpenAreaDetailDialog(false);
    setCurrentAreaDetail(null);
  }, []);

  // Handlers for event registration dialog
  const handleOpenRegisterEventDialog = useCallback((eventType) => {
    setCurrentEventType(eventType);
    // Reset form fields when opening
    setEventBatchId('');
    setEventQuantity('');
    setEventWeight(''); // Reset weight
    setEventUnit('');
    setEventDescription('');
    setEventFromLocation('');
    setEventToLocation('');
    setEventMethod('');
    setEventReason('');
    setOpenRegisterEventDialog(true);
  }, []);

  const handleCloseRegisterEventDialog = useCallback(() => {
    setOpenRegisterEventDialog(false);
    setCurrentEventType('');
  }, []);

  const handleRegisterEvent = useCallback(async (e) => {
      e.preventDefault();
      
      if (!currentAreaDetail || !currentAreaDetail.id) {
          setParentSnack('Error: Could not determine cultivation area for the event.', 'error');
          return;
      }
      // Validate currentUserId
      if (!currentUserId) {
          setParentSnack('Error: Could not determine user ID to register the event.', 'error');
          return;
      }
  
      const headers = {};
      let effectiveTenantId = null;
  
      if (isGlobalAdmin) {
          if (selectedFacilityId) {
              const selectedFac = facilities.find(f => f.id === selectedFacilityId);
              if (selectedFac && selectedFac.tenant_id) {
                  effectiveTenantId = String(selectedFac.tenant_id);
              } else {
                  setParentSnack('Error: As Super Admin, the selected facility does not have a valid tenant to register events.', 'error');
                  return;
              }
          } else {
              setParentSnack('Error: As Super Admin, you must select a facility to register events.', 'error');
              return;
          }
      } else if (tenantId) {
          effectiveTenantId = String(tenantId);
      } else {
          setParentSnack('Error: Could not determine Tenant ID to register the event.', 'error');
          return;
      }
  
      if (effectiveTenantId) {
        headers['X-Tenant-ID'] = effectiveTenantId;
      }

      // Validations for events that require batch (except general cultivation)
      // For harvest, eventBatchId (the original batch) IS required.
      if (!eventBatchId && currentEventType !== 'cultivation') { 
          setParentSnack('You must select a batch to register the event.', 'warning');
          return;
      }
      
      // Validate required fields
      if (!selectedFacilityId) {
          setParentSnack('Error: Facility ID is required for traceability events.', 'error');
          return;
      }
      
      if (!currentUserId) {
          setParentSnack('Error: User ID is required for traceability events.', 'error');
          return;
      }
      
      if (!currentAreaDetail?.id) {
          setParentSnack('Error: Area ID is required for traceability events.', 'error');
          return;
      }
  
      // Build the traceability event payload with enhanced data sanitization
      const eventPayload = {
        // Only include batch_id if it has a value
        ...(eventBatchId && { batch_id: parseInt(eventBatchId) }),
        event_type: currentEventType,
        description: eventDescription || null,
        area_id: parseInt(currentAreaDetail.id), // Associate the event with the current area
        facility_id: parseInt(selectedFacilityId), // Associate the event with the current facility
        user_id: parseInt(currentUserId), // Use the authenticated user's ID
        ...(currentEventType === 'movement' && {
          quantity: eventQuantity ? parseFloat(eventQuantity) : null,
          unit: eventUnit || null,
          from_location: eventFromLocation || null,
          to_location: eventToLocation || null,
        }),
        ...(currentEventType === 'cultivation' && {
          method: eventMethod || null,
        }),
        ...(currentEventType === 'harvest' && {
          quantity: eventWeight ? parseFloat(eventWeight) : null, // Wet weight of the original batch
          unit: 'kg', // Assume kg for harvest
          new_batch_id: null, // NOW ALWAYS NULL FOR INITIAL HARVEST
        }),
        ...(currentEventType === 'sampling' && {
          quantity: eventWeight ? parseFloat(eventWeight) : null, // Sample quantity (weight)
          unit: eventUnit || null,
          reason: eventReason || null,
        }),
        ...(currentEventType === 'destruction' && {
          quantity: eventWeight ? parseFloat(eventWeight) : null, // Destroyed quantity (weight/units)
          unit: eventUnit || null,
          method: eventMethod || null,
          reason: eventReason || null,
        }),
      };
      
      // Enhanced data sanitization - convert empty strings and undefined values to null
      Object.keys(eventPayload).forEach(key => {
        if (eventPayload[key] === '' || eventPayload[key] === undefined) {
          eventPayload[key] = null;
        }
      });
      
      console.log('Sanitized traceability event payload:', eventPayload);
  
      try {
        // Make the backend API call to register the traceability event
        const response = await api.post('/traceability-events', eventPayload, { headers });
        console.log('Traceability event registered successfully:', response.data);
  
        setParentSnack(SNACK_MESSAGES.EVENT_REGISTERED_SUCCESS, 'success');
        handleCloseRegisterEventDialog();
        
        // Reload batches for the area to reflect changes
        const updatedBatches = await fetchBatchesForArea(currentAreaDetail.id);
        setCurrentAreaDetail(prev => ({ ...prev, batches: updatedBatches }));
  
      } catch (err) {
        console.group('🚨 Traceability Event Error (CultivationPage)');
        console.error('Full error object:', err);
        console.error('HTTP Status:', err.response?.status);
        console.error('Response data:', err.response?.data);
        console.error('Original event payload sent:', eventPayload);
        console.groupEnd();
        
        let errorMessage = SNACK_MESSAGES.EVENT_REGISTRATION_ERROR;
        
        if (err.response?.status === 422) {
          // Enhanced error handling for validation errors
          let detailedError = err.response?.data?.message || err.message;
          const details = err.response?.data?.details;
          
          if (details) {
            if (Array.isArray(details)) {
              // FastAPI validation errors format
              const validationErrors = details.map(error => {
                const field = error.loc?.join?.('.') || 'field';
                const message = error.msg || error.message || 'validation error';
                return `${field}: ${message}`;
              }).join(', ');
              detailedError = `Validation errors - ${validationErrors}`;
            } else if (typeof details === 'object') {
              const firstDetailKey = Object.keys(details)[0];
              if (firstDetailKey && Array.isArray(details[firstDetailKey]) && details[firstDetailKey].length > 0) {
                detailedError = `${firstDetailKey}: ${details[firstDetailKey][0]}`;
              } else {
                detailedError = `Validation details: ${JSON.stringify(details)}`;
              }
            }
          }
          
          errorMessage = `${errorMessage} ${detailedError}`;
        } else if (err.response && err.response.data) {
            if (err.response.data.message) {
                errorMessage = `${errorMessage} ${err.response.data.message}`;
            }
        } else if (err.message) {
            errorMessage = `${errorMessage} ${err.message}`;
        }
        
        setParentSnack(errorMessage, 'error');
      }
    }, [currentAreaDetail, currentEventType, currentUserId, eventBatchId, eventDescription, eventQuantity, eventWeight, eventUnit, eventFromLocation, eventToLocation, eventMethod, eventReason, isGlobalAdmin, selectedFacilityId, setParentSnack, tenantId, fetchBatchesForArea, handleCloseRegisterEventDialog]);


  // Renders the specific form for each event type
  const renderEventForm = useCallback(() => {
    const unitOptions = ['g', 'kg', 'units', 'ml', 'L']; // Unit options

    return (
      <Box component="form" onSubmit={handleRegisterEvent} sx={{ mt: 2 }}>
        {/* Affected Batch - Always select the original batch */}
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Affected Batch</InputLabel>
          <Select value={eventBatchId} onChange={(e) => setEventBatchId(e.target.value)} required={currentEventType !== 'cultivation'} label="Affected Batch"
          >
            <MenuItem value="" disabled><em>{currentEventType === 'cultivation' ? 'Optional: Select Batch' : 'Select Batch'}</em></MenuItem>
            {batchesInCurrentArea.length === 0 ? (
              <MenuItem value="" disabled><em>No batches available in this area</em></MenuItem>
            ) : (
              batchesInCurrentArea.map(batch => <MenuItem key={batch.id} value={batch.id}>{batch.name}</MenuItem>)
            )}
          </Select>
        </FormControl>

        {currentEventType === 'movement' && (
          <>
            <TextField label="Quantity of Units" type="number" value={eventQuantity} onChange={(e) => setEventQuantity(e.target.value)} fullWidth required sx={{ mb: 2 }} />
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Unit</InputLabel>
              <Select value={eventUnit} onChange={(e) => setEventUnit(e.target.value)} required label="Unit"
              >
                {unitOptions.map(unit => <MenuItem key={unit} value={unit}>{unit}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Origin (e.g., 'Room2')" value={eventFromLocation} onChange={(e) => setEventFromLocation(e.target.value)} fullWidth sx={{ mb: 2 }} />
            <TextField label="Destination (e.g., 'Drying')" value={eventToLocation} onChange={(e) => setEventToLocation(e.target.value)} fullWidth required sx={{ mb: 2 }} />
          </>
        )}

        {currentEventType === 'cultivation' && (
          <TextField label="Event Type (e.g., Watering, Pruning, Application)" value={eventMethod} onChange={(e) => setEventMethod(e.target.value)} fullWidth required sx={{ mb: 2 }} />
        )}

        {currentEventType === 'harvest' && (
          <>
            <Typography variant="body2" sx={{ mb: 2, color: '#64748b' }}>
              Register the wet weight harvested from the selected batch.
            </Typography>
            <TextField label="Wet Weight (kg)" type="number" value={eventWeight} onChange={(e) => setEventWeight(e.target.value)} fullWidth required sx={{ mb: 2 }} />
          </>
        )}

        {currentEventType === 'sampling' && (
          <>
            <TextField label="Sample Quantity (Weight)" type="number" value={eventWeight} onChange={(e) => setEventWeight(e.target.value)} fullWidth required sx={{ mb: 2 }} />
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Sample Unit</InputLabel>
              <Select value={eventUnit} onChange={(e) => setEventUnit(e.target.value)} required label="Sample Unit"
              >
                {unitOptions.map(unit => <MenuItem key={unit} value={unit}>{unit}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Sampling Purpose" value={eventReason} onChange={(e) => setEventReason(e.target.value)} fullWidth sx={{ mb: 2 }} />
          </>
        )}

        {currentEventType === 'destruction' && (
          <>
            <TextField label="Destroyed Quantity (Weight/Units)" type="number" value={eventWeight} onChange={(e) => setEventWeight(e.target.value)} fullWidth required sx={{ mb: 2 }} />
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Destruction Unit</InputLabel>
              <Select value={eventUnit} onChange={(e) => setEventUnit(e.target.value)} required label="Destruction Unit"
              >
                {unitOptions.map(unit => <MenuItem key={unit} value={unit}>{unit}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Destruction Method" value={eventMethod} onChange={(e) => setEventMethod(e.target.value)} fullWidth required sx={{ mb: 2 }} />
            <TextField label="Reason for Destruction" multiline rows={3} value={eventReason} onChange={(e) => setEventReason(e.target.value)} fullWidth required sx={{ mb: 2 }} />
          </>
        )}

        <TextField label="Additional Notes" multiline rows={3} value={eventDescription} onChange={(e) => setEventDescription(e.target.value)} fullWidth sx={{ mb: 2 }} />
        <DialogActions sx={{ bgcolor: '#f8fafc', mt: 2, borderTop: '1px solid #e0e0e0', mx: -3, px: 3, py: 2 }}>
          <Button onClick={handleCloseRegisterEventDialog} sx={{ color: '#64748b' }}>{BUTTON_LABELS.CANCEL}</Button>
          <Button type="submit" variant="contained" sx={{ bgcolor: '#4CAF50', '&:hover': { bgcolor: '#43A047' } }} disabled={isFacilityOperator}>
            {BUTTON_LABELS.REGISTER}
          </Button>
        </DialogActions>
      </Box>
    );
  }, [currentEventType, eventBatchId, eventDescription, eventQuantity, eventWeight, eventUnit, eventFromLocation, eventToLocation, eventMethod, eventReason, batchesInCurrentArea, isFacilityOperator, handleRegisterEvent, handleCloseRegisterEventDialog]);

  // Handlers for adding batch dialog (original, not harvest)
  const handleOpenAddBatchDialog = useCallback(() => {
    setBatchName('');
    setBatchCurrentUnits('');
    setBatchUnits('units'); // Default unit type
    setBatchEndType('');
    setBatchVariety('');
    setBatchProductType(''); // Reset product type field
    setBatchProjectedYield('');
    setBatchAdvanceToHarvestingOn('');
    setOpenAddBatchDialog(true);
    setBatchDialogLoading(false);
  }, []);

  const handleCloseAddBatchDialog = useCallback(() => {
    setOpenAddBatchDialog(false);
    setBatchName('');
    setBatchCurrentUnits('');
    setBatchUnits('units'); // Reset unit type
    setBatchEndType('');
    setBatchVariety('');
    setBatchProductType(''); // Reset product type field
    setBatchProjectedYield('');
    setBatchAdvanceToHarvestingOn('');
    setBatchDialogLoading(false);
  }, []);

  const handleSaveBatch = async (e) => {
    e.preventDefault();
    if (!currentAreaDetail || !currentAreaDetail.id) {
      setParentSnack('Error: Could not determine cultivation area for the new batch.', 'error');
      return;
    }
    if (!batchName.trim()) {
      setParentSnack(SNACK_MESSAGES.BATCH_NAME_REQUIRED, 'warning');
      return;
    }
    if (batchCurrentUnits === '' || isNaN(parseInt(batchCurrentUnits))) {
      setParentSnack(SNACK_MESSAGES.BATCH_UNITS_REQUIRED, 'warning');
      return;
    }
    if (!batchEndType.trim()) {
      setParentSnack(SNACK_MESSAGES.BATCH_END_TYPE_REQUIRED, 'warning');
      return;
    }
    if (!batchVariety.trim()) {
      setParentSnack(SNACK_MESSAGES.BATCH_VARIETY_REQUIRED, 'warning');
      return;
    }
    if (!batchProductType.trim()) { // Validation for product type
      setParentSnack(SNACK_MESSAGES.BATCH_PRODUCT_TYPE_REQUIRED, 'warning');
      return;
    }

    // Validar capacidad del área
    if (currentAreaDetail.capacity_units) {
      const currentUsage = (currentAreaDetail.batches || []).reduce((sum, b) => sum + (parseFloat(b.current_units) || 0), 0);
      const requestedUnits = parseInt(batchCurrentUnits, 10);
      const availableUnits = currentAreaDetail.capacity_units - currentUsage;
      
      if (requestedUnits > availableUnits) {
        setParentSnack(
          `Capacity exceeded! Area "${currentAreaDetail.name}" has ${currentAreaDetail.capacity_units} units capacity. ` +
          `Current usage: ${currentUsage} units. Available: ${availableUnits} units. You requested: ${requestedUnits} units.`,
          'error'
        );
        return;
      }
    }
  
    setBatchDialogLoading(true);
    const headers = {};
    let effectiveTenantId = null;
  
    if (isGlobalAdmin) {
        if (selectedFacilityId) {
            const selectedFac = facilities.find(f => f.id === selectedFacilityId);
            if (selectedFac && selectedFac.tenant_id) {
                effectiveTenantId = String(selectedFac.tenant_id);
                console.log('handleSaveBatch: Global Admin, adding X-Tenant-ID from selected facility:', effectiveTenantId);
            } else {
                setParentSnack('Error: As Super Admin, the selected facility does not have a valid tenant to create a batch.', 'error');
                setBatchDialogLoading(false);
                return;
            }
        } else {
            setParentSnack('Error: As Super Admin, you must select a facility to create a batch.', 'error');
            setBatchDialogLoading(false);
            return;
        }
    } else if (tenantId) {
        effectiveTenantId = String(tenantId);
        console.log('handleSaveBatch: Tenant user, adding X-Tenant-ID from user:', effectiveTenantId);
    } else {
        setParentSnack('Error: Could not determine Tenant ID to create the batch.', 'error');
        setBatchDialogLoading(false);
        return;
    }
  
    if (effectiveTenantId) {
      headers['X-Tenant-ID'] = effectiveTenantId;
    }
  
    try {
      const batchData = {
        name: batchName,
        current_units: parseInt(batchCurrentUnits, 10),
        units: batchUnits, // Unit type (g, kg, units, etc.)
        end_type: batchEndType,
        variety: batchVariety,
        product_type: batchProductType, // Include new product type
        projected_yield: batchProjectedYield === '' ? null : parseFloat(batchProjectedYield),
        advance_to_harvesting_on: batchAdvanceToHarvestingOn || null,
        cultivation_area_id: currentAreaDetail.id, // Associate the batch with the current area
      };
  
      // 1. Create the batch
      const response = await api.post('/batches', batchData, { headers });
      const newBatch = response.data;
      setParentSnack(SNACK_MESSAGES.BATCH_CREATED, 'success');
  
      // 2. Create traceability event with enhanced data sanitization
      try {
        const traceabilityEventPayload = {
          batch_id: parseInt(newBatch.id),
          area_id: parseInt(currentAreaDetail.id),
          facility_id: parseInt(selectedFacilityId),
          user_id: parseInt(currentUserId),
          event_type: 'creation',
          description: `Batch created: ${batchName} (Product Type: ${batchProductType})`, // Include product type in description
          quantity: null,
          unit: null,
          from_location: null,
          to_location: null,
          method: null,
          reason: null,
        };
        
        // Sanitize payload - convert empty strings and undefined values to null
        Object.keys(traceabilityEventPayload).forEach(key => {
          if (traceabilityEventPayload[key] === '' || traceabilityEventPayload[key] === undefined) {
            traceabilityEventPayload[key] = null;
          }
        });
        
        console.log('Sanitized batch creation traceability payload:', traceabilityEventPayload);
        await api.post('/traceability-events', traceabilityEventPayload, { headers });
      } catch (_traceErr) {
        console.error('Error creating traceability event for batch creation:', _traceErr);
        setParentSnack('Batch created, but error creating traceability event.', 'warning');
      }
  
      // 3. Refresh batches and close dialog
      const updatedBatches = await fetchBatchesForArea(currentAreaDetail.id);
      setCurrentAreaDetail(prev => ({ ...prev, batches: updatedBatches }));
      handleCloseAddBatchDialog();
    } catch (err) {
      console.error('Error saving batch:', err.response?.data || err.message);
      const errorMessage = err.response?.data?.message || err.message;
      if (err.response?.status === 422) {
        const errors = err.response?.data?.details;
        const firstError = errors ? Object.values(errors)[0][0] : errorMessage;
        setParentSnack(`${SNACK_MESSAGES.VALIDATION_ERROR} ${firstError}`, 'error');
      } else if (err.response?.status === 400) {
        setParentSnack(`${SNACK_MESSAGES.INVALID_DATA} ${errorMessage}`, 'error');
      } else if (err.response?.status === 403) {
        setParentSnack(SNACK_MESSAGES.PERMISSION_DENIED, 'error');
      } else {
        setParentSnack(`Error saving batch: ${errorMessage}`, 'error');
      }
    } finally {
      setBatchDialogLoading(false);
    }
  };  
  
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
    data: {
      type: 'Stage',
      stageId: stage.id,
    },
  });

  useEffect(() => {
    setAreaFacilityId(selectedFacilityId);
  }, [selectedFacilityId]);


  const handleOpenAddAreaDialog = useCallback((area = null) => {
    setEditingArea(area);
    setAreaName(area ? area.name : '');
    setAreaDescription(area ? (area.description || '') : '');
    setAreaCapacityUnits(area ? (area.capacity_units || '') : '');
    setAreaCapacityUnitType(area ? (area.capacity_unit_type || '') : '');
    setAreaFacilityId(area ? (area.facility_id || selectedFacilityId) : selectedFacilityId);
    setOpenAddAreaDialog(true);
    setAreaDialogLoading(false);
  }, [selectedFacilityId]);

  const handleCloseAddAreaDialog = useCallback(() => {
    setOpenAddAreaDialog(false);
    setEditingArea(null);
    setAreaName('');
    setAreaDescription('');
    setAreaCapacityUnits('');
    setAreaCapacityUnitType('');
    setAreaFacilityId(selectedFacilityId);
    setAreaDialogLoading(false);
  }, [selectedFacilityId]);

  const handleSaveArea = async (e) => {
    e.preventDefault();
    if (!areaName.trim()) {
      setParentSnack(SNACK_MESSAGES.AREA_NAME_REQUIRED, 'warning');
      return;
    }
    if (areaName.length > 100) {
      setParentSnack(SNACK_MESSAGES.AREA_NAME_LENGTH_EXCEEDED, 'warning');
      return;
    }
    if (/[<>{}]/.test(areaName)) {
      setParentSnack(SNACK_MESSAGES.AREA_NAME_INVALID_CHARS, 'warning');
      return;
    }
    if (!areaFacilityId) {
      setParentSnack(SNACK_MESSAGES.AREA_FACILITY_REQUIRED, 'warning');
      return;
    }
    setAreaDialogLoading(true);
    
    const headers = {};
    let effectiveTenantId = null;

    if (isGlobalAdmin) {
        if (selectedFacilityId) {
            const selectedFac = facilities.find(f => f.id === selectedFacilityId);
            if (selectedFac && selectedFac.tenant_id) {
                effectiveTenantId = String(selectedFac.tenant_id);
                // If the backend needs tenant_id in the payload for areas, uncomment the following line
                // areaData.tenant_id = parseInt(effectiveTenantId, 10); 
                console.log('handleSaveArea: Global Admin, adding X-Tenant-ID from selected facility:', effectiveTenantId);
            } else {
                setParentSnack('Error: As Super Admin, the selected facility does not have a valid Tenant ID to create/edit areas.', 'error');
                setAreaDialogLoading(false);
                return;
            }
        } else {
            setParentSnack('Error: As Super Admin, you must select a facility to create/edit areas.', 'error');
            setAreaDialogLoading(false);
            return;
        }
    } else if (tenantId) {
        effectiveTenantId = String(tenantId);
        console.log('handleSaveArea: Tenant user, adding X-Tenant-ID from user:', effectiveTenantId);
    } else {
        setParentSnack('Error: Could not determine Tenant ID to create/edit areas.', 'error');
        setAreaDialogLoading(false);
        return;
    }

    if (effectiveTenantId) {
      headers['X-Tenant-ID'] = effectiveTenantId;
    }

    try {
      const areaData = {
        name: areaName,
        description: areaDescription,
        capacity_units: areaCapacityUnits === '' ? null : parseInt(areaCapacityUnits, 10),
        capacity_unit_type: areaCapacityUnitType,
        facility_id: areaFacilityId,
        current_stage_id: stage.id,
        tenant_id: parseInt(effectiveTenantId, 10), // Add tenant_id to payload
      };

      if (editingArea) {
        await api.put(`/cultivation-areas/${editingArea.id}`, areaData, { headers }); // Pass headers
        setParentSnack(SNACK_MESSAGES.CULTIVATION_AREA_UPDATED, 'success');
      } else {
        await api.post('/cultivation-areas', areaData, { headers }); // Pass headers
        setParentSnack(SNACK_MESSAGES.CULTIVATION_AREA_CREATED, 'success');
      }
      await refreshCultivationAreas(); // Call parent refresh function
      handleCloseAddAreaDialog();
    } catch (err) {
      console.error('Error saving cultivation area:', err);
      const errorMessage = err.response?.data?.message || err.message;
      if (err.response?.status === 422) {
        const errors = err.response?.data?.details;
        const firstError = errors ? Object.values(errors)[0][0] : errorMessage;
        setParentSnack(`${SNACK_MESSAGES.VALIDATION_ERROR} ${firstError}`, 'error');
      } else if (err.response?.status === 400) {
        setParentSnack(`${SNACK_MESSAGES.INVALID_DATA} ${errorMessage}`, 'error');
      } else if (err.response?.status === 403) {
        setParentSnack(SNACK_MESSAGES.PERMISSION_DENIED, 'error');
      } else {
        setParentSnack(`Error deleting area: ${errorMessage}`, 'error');
      }
    } finally {
      setAreaDialogLoading(false);
    }
  };

  const handleDeleteAreaConfirm = useCallback(async (areaToDelete) => {
    setAreaDialogLoading(true); // Activate loading for area dialog
    
    const headers = {};
    let effectiveTenantId = null;

    if (isGlobalAdmin) {
        if (selectedFacilityId) {
            const selectedFac = facilities.find(f => f.id === selectedFacilityId);
            if (selectedFac && selectedFac.tenant_id) {
                effectiveTenantId = String(selectedFac.tenant_id);
            } else {
                setParentSnack('Error: As Super Admin, the selected facility does not have a valid Tenant ID to delete areas.', 'error');
                setAreaDialogLoading(false);
                setParentConfirmDialogOpen(false);
                return;
            }
        } else {
            setParentSnack('Error: As Super Admin, you must select a facility to delete areas.', 'error');
            setAreaDialogLoading(false);
            setParentConfirmDialogOpen(false);
            return;
        }
    } else if (tenantId) {
        effectiveTenantId = String(tenantId);
    } else {
        setParentSnack('Error: Could not determine Tenant ID to delete the area.', 'error');
        setAreaDialogLoading(false);
        setParentConfirmDialogOpen(false);
        return;
    }

    if (effectiveTenantId) {
      headers['X-Tenant-ID'] = effectiveTenantId;
    }

    try {
      await api.delete(`/cultivation-areas/${areaToDelete.id}`, { headers }); // Pass headers here
      setParentSnack(SNACK_MESSAGES.CULTIVATION_AREA_DELETED, 'info');
      await refreshCultivationAreas(); // Call parent refresh function
    } catch (err) {
      console.error('Error deleting cultivation area:', err);
      const errorMessage = err.response?.data?.message || err.message;
      if (err.response?.status === 400) {
        setParentSnack(`${SNACK_MESSAGES.INVALID_DATA} ${errorMessage}`, 'error');
      } else if (err.response?.status === 403) {
        setParentSnack(SNACK_MESSAGES.PERMISSION_DENIED, 'error');
      } else if (err.response?.status === 409) { // Conflict
        setParentSnack(SNACK_MESSAGES.CANNOT_DELETE_AREA_WITH_BATCHES, 'error');
      } else {
        setParentSnack(`Error deleting area: ${errorMessage}`, 'error');
      }
    } finally {
      setParentConfirmDialogOpen(false);
      setAreaDialogLoading(false); // Deactivate loading for area dialog
    }
  }, [refreshCultivationAreas, setParentSnack, setParentConfirmDialogOpen, isGlobalAdmin, selectedFacilityId, facilities, tenantId]);

  const handleDeleteAreaClick = useCallback((areaToDelete) => {
    setParentConfirmDialog({
      title: DIALOG_TITLES.CONFIRM_AREA_DELETION,
      message: `Are you sure you want to delete the cultivation area "${areaToDelete.name}"? This will fail if it has associated batches.`,
      onConfirm: () => handleDeleteAreaConfirm(areaToDelete),
    });
    setParentConfirmDialogOpen(true);
  }, [handleDeleteAreaConfirm, setParentConfirmDialog, setParentConfirmDialogOpen]);

  // Handlers for Process Batch Dialog (NEW)
  const handleOpenProcessBatchDialog = useCallback(() => {
    setProcessBatchId('');
    setProcessedQuantity('');
    setProcessMethod('');
    setProcessDescription('');
    setNewProductType('');
    setOpenProcessBatchDialog(true);
    setProcessDialogLoading(false);
  }, []);

  const handleCloseProcessBatchDialog = useCallback(() => {
    setOpenProcessBatchDialog(false);
    setProcessBatchId('');
    setProcessedQuantity('');
    setProcessMethod('');
    setProcessDescription('');
    setNewProductType('');
    setProcessDialogLoading(false);
  }, []);

  const handleProcessBatch = useCallback(async (e) => {
    e.preventDefault();

    if (!processBatchId) {
      setParentSnack('Please select a batch to process.', 'warning');
      return;
    }
    if (processedQuantity === '' || isNaN(parseFloat(processedQuantity))) {
      setParentSnack(SNACK_MESSAGES.PROCESS_QUANTITY_REQUIRED, 'warning');
      return;
    }
    if (!processMethod.trim()) {
      setParentSnack(SNACK_MESSAGES.PROCESS_METHOD_REQUIRED, 'warning');
      return;
    }
    if (!newProductType.trim()) {
      setParentSnack(SNACK_MESSAGES.NEW_PRODUCT_TYPE_REQUIRED, 'warning');
      return;
    }

    setProcessDialogLoading(true);
    const headers = {};
    let effectiveTenantId = null;

    if (isGlobalAdmin) {
      if (selectedFacilityId) {
        const selectedFac = facilities.find(f => f.id === selectedFacilityId);
        if (selectedFac && selectedFac.tenant_id) {
          effectiveTenantId = String(selectedFac.tenant_id);
        } else {
          setParentSnack('Error: As Super Admin, the selected facility does not have a valid tenant to process batches.', 'error');
          setProcessDialogLoading(false);
          return;
        }
      } else {
        setParentSnack('Error: As Super Admin, you must select a facility to process batches.', 'error');
        setProcessDialogLoading(false);
        return;
      }
    } else if (tenantId) {
      effectiveTenantId = String(tenantId);
    } else {
      setParentSnack('Error: Could not determine Tenant ID to process the batch.', 'error');
      setProcessDialogLoading(false);
      return;
    }

    if (effectiveTenantId) {
      headers['X-Tenant-ID'] = effectiveTenantId;
    }

    try {
      const payload = {
        processedQuantity: parseFloat(processedQuantity),
        processMethod: processMethod,
        processDescription: processDescription,
        newProductType: newProductType,
      };

      /* const response = */ await api.post(`/batches/${processBatchId}/process`, payload, { headers });
      setParentSnack(SNACK_MESSAGES.BATCH_PROCESSED_SUCCESS, 'success');
      handleCloseProcessBatchDialog();
      // Refresh batches to reflect changes in product type and units
      const updatedBatches = await fetchBatchesForArea(currentAreaDetail.id);
      setCurrentAreaDetail(prev => ({ ...prev, batches: updatedBatches }));

    } catch (err) {
      console.error('Error processing batch:', err.response?.data || err.message);
      let errorMessage = SNACK_MESSAGES.BATCH_PROCESS_ERROR;
      if (err.response && err.response.data) {
        if (err.response.data.message) {
          errorMessage = `${errorMessage} ${err.response.data.message}`;
        }
        if (err.response.data.details) {
          const details = err.response.data.details;
          const firstDetailKey = Object.keys(details)[0];
          if (firstDetailKey && Array.isArray(details[firstDetailKey]) && details[firstDetailKey].length > 0) {
            errorMessage = `${errorMessage} ${firstDetailKey}: ${details[firstDetailKey][0]}`;
          } else {
            errorMessage = `${errorMessage} ${JSON.stringify(details)}`;
          }
        }
      } else if (err.message) {
        errorMessage = `${errorMessage} ${err.message}`;
      }
      setParentSnack(errorMessage, 'error');
    } finally {
      setProcessDialogLoading(false);
    }
  }, [processBatchId, processedQuantity, processMethod, processDescription, newProductType, isGlobalAdmin, selectedFacilityId, facilities, tenantId, setParentSnack, handleCloseProcessBatchDialog, fetchBatchesForArea, currentAreaDetail]);

  const selectedBatch = currentAreaDetail?.batches?.find(b => b.id === processBatchId);
  const maxQuantity = selectedBatch?.current_units ?? 0;

  const stageColor = getStageColor(stage.name);

  return (
    <Paper
      sx={{
        bgcolor: '#fff',
        borderRadius: 2,
        p: 1.5,
        minWidth: 280,
        maxWidth: 280,
        flexShrink: 0,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        border: '1px solid #e0e0e0',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 8, height: 24, bgcolor: stageColor, borderRadius: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary', flexGrow: 1 }}>
            {stage.name}
          </Typography>
        </Box>
        <IconButton
          size="small"
          onClick={() => handleDeleteStage(stage)}
          aria-label={`Delete stage ${stage.name}`}
          disabled={isFacilityOperator}
        >
          <DeleteIcon sx={{ fontSize: 18, color: isFacilityOperator ? '#ccc' : '#666' }} />
        </IconButton>
      </Box>
      <Divider sx={{ mb: 1.5 }} />
      <Box
        ref={setNodeRef} // useDroppable ref
        sx={{
          maxHeight: 'calc(100vh - 250px)',
          overflowY: 'auto',
          pr: 1,
          bgcolor: isOver ? 'rgba(25, 118, 210, 0.08)' : 'transparent',
          minHeight: cultivationAreas.length === 0 ? '80px' : 'auto',
          transition: 'background-color 0.2s ease',
          pb: 1,
        }}
      >
        {cultivationAreas.map((area) => (
          <CultivationAreaItem
            key={area.id}
            area={area}
            handleEdit={handleOpenAddAreaDialog}
            handleDelete={handleDeleteAreaClick}
            setParentSnack={setParentSnack}
            isFacilityOperator={isFacilityOperator}
            isGlobalAdmin={isGlobalAdmin}
            handleOpenAreaDetail={handleOpenAreaDetail} // Pass the handler to open area detail
          />
        ))}
        {cultivationAreas.length === 0 && !isOver && (
          <Typography variant="body2" sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
            Drag areas here or add a new one.
          </Typography>
        )}
      </Box>
      <Button
        variant="text"
        startIcon={<AddIcon />}
        onClick={() => handleOpenAddAreaDialog(null)}
        fullWidth
        disabled={isFacilityOperator}
        sx={{ mt: 1, color: isFacilityOperator ? '#ccc' : 'primary.main' }}
      >
        {BUTTON_LABELS.ADD_CULTIVATION_AREA}
      </Button>

      <Dialog open={openAddAreaDialog} onClose={handleCloseAddAreaDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingArea ? DIALOG_TITLES.EDIT_AREA : DIALOG_TITLES.CREATE_AREA}</DialogTitle>
        <form onSubmit={handleSaveArea}>
          <DialogContent sx={{ pt: '20px !important' }}>
            <TextField
              label="Area Name"
              value={areaName}
              onChange={e => setAreaName(e.target.value)}
              fullWidth
              required
              size="small"
              sx={{ mt: 1, mb: 2 }}
              disabled={areaDialogLoading || isFacilityOperator}
              inputProps={{ maxLength: 100 }}
              aria-label="Cultivation area name"
            />
            <TextField
              label="Description"
              value={areaDescription}
              onChange={e => setAreaDescription(e.target.value)}
              fullWidth
              multiline
              rows={3}
              size="small"
              sx={{ mb: 2 }}
              disabled={areaDialogLoading || isFacilityOperator}
              aria-label="Cultivation area description"
            />
            <TextField
              label="Capacity Units"
              value={areaCapacityUnits}
              onChange={e => setAreaCapacityUnits(e.target.value)}
              type="number"
              fullWidth
              size="small"
              sx={{ mb: 2 }}
              disabled={areaDialogLoading || isFacilityOperator}
              aria-label="Capacity units"
            />
            <TextField
              label="Capacity Unit Type"
              value={areaCapacityUnitType}
              onChange={e => setAreaCapacityUnitType(e.target.value)}
              fullWidth
              size="small"
              sx={{ mb: 2 }}
              disabled={areaDialogLoading || isFacilityOperator}
              aria-label="Capacity unit type"
            />
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel id="area-facility-select-label">Assigned Facility</InputLabel>
              <Select
                labelId="area-facility-select-label"
                value={areaFacilityId}
                label="Assigned Facility"
                onChange={(e) => setAreaFacilityId(e.target.value)}
                required
                disabled={areaDialogLoading || isFacilityOperator}
                aria-label="Select assigned facility"
              >
                {facilities.length === 0 ? (
                  <MenuItem value="">
                    <em>No facilities available</em>
                  </MenuItem>
                ) : (
                  facilities.map((f) => (
                    <MenuItem key={f.id} value={f.id}>
                      {f.name}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseAddAreaDialog} disabled={areaDialogLoading || isFacilityOperator}>{BUTTON_LABELS.CANCEL}</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={areaDialogLoading || !areaName.trim() || isFacilityOperator}
            >
              {areaDialogLoading ? <CircularProgress size={24} /> : (editingArea ? BUTTON_LABELS.SAVE_CHANGES : BUTTON_LABELS.CREATE_AREA)}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* --- Area Detail Dialog (Expanded with Traceability) --- */}
      <Dialog open={openAreaDetailDialog} onClose={handleCloseAreaDetail} maxWidth="lg" fullWidth
        PaperProps={{ sx: { minHeight: '80vh', bgcolor: '#fff' } }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            pb: { xs: 2, sm: 1 },
            pt: { xs: 2, sm: 1 },
            px: { xs: 2, sm: 3 },
            gap: 2,
            flexWrap: 'wrap',
            borderBottom: '1px solid #e0e0e0',
            bgcolor: '#fff',
          }}
        >
          {/* FIX: Changed Typography component to "span" to avoid h6 inside h2 nesting error */}
          <Typography component="span" variant="h6" sx={{ fontWeight: 600, flexGrow: 1, minWidth: '150px', color: '#1a202c' }}>
            {DIALOG_TITLES.AREA_DETAIL} {currentAreaDetail?.name}
          </Typography>

          {/* Action Buttons + Close Button aligned */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
            }}
          >
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenAddBatchDialog}
              sx={{
                bgcolor: '#4CAF50',
                color: '#fff',
                '&:hover': { bgcolor: '#43A047' },
                borderRadius: 1,
                textTransform: 'none',
                py: '6px',
                px: '10px',
                fontSize: '0.75rem',
                whiteSpace: 'nowrap',
              }}
              disabled={isFacilityOperator}
            >
              {BUTTON_LABELS.ADD_NEW_BATCH}
            </Button>
            <Button
              variant="contained"
              startIcon={<TrendingUpIcon />}
              onClick={() => handleOpenRegisterEventDialog('movement')}
              sx={{
                bgcolor: '#607d8b',
                color: '#fff',
                '&:hover': { bgcolor: '#546e7a' },
                borderRadius: 1,
                textTransform: 'none',
                py: '6px',
                px: '10px',
                fontSize: '0.75rem',
                whiteSpace: 'nowrap',
              }}
              disabled={isFacilityOperator}
            >
              {BUTTON_LABELS.REGISTER_MOVEMENT}
            </Button>
            <Button
              variant="contained"
              startIcon={<EcoIcon />}
              onClick={() => handleOpenRegisterEventDialog('cultivation')}
              sx={{
                bgcolor: '#607d8b',
                color: '#fff',
                '&:hover': { bgcolor: '#546e7a' },
                borderRadius: 1,
                textTransform: 'none',
                py: '6px',
                px: '10px',
                fontSize: '0.75rem',
                whiteSpace: 'nowrap',
              }}
              disabled={isFacilityOperator}
            >
              {BUTTON_LABELS.REGISTER_CULTIVATION_EVENT}
            </Button>
            <Button
              variant="contained"
              startIcon={<HarvestIcon />}
              onClick={() => handleOpenRegisterEventDialog('harvest')}
              sx={{
                bgcolor: '#607d8b',
                color: '#fff',
                '&:hover': { bgcolor: '#546e7a' },
                borderRadius: 1,
                textTransform: 'none',
                py: '6px',
                px: '10px',
                fontSize: '0.75rem',
                whiteSpace: 'nowrap',
              }}
              disabled={isFacilityOperator}
            >
              {BUTTON_LABELS.REGISTER_HARVEST}
            </Button>
            <Button
              variant="contained"
              startIcon={<ScienceIcon />}
              onClick={() => handleOpenRegisterEventDialog('sampling')}
              sx={{
                bgcolor: '#607d8b',
                color: '#fff',
                '&:hover': { bgcolor: '#546e7a' },
                borderRadius: 1,
                textTransform: 'none',
                py: '6px',
                px: '10px',
                fontSize: '0.75rem',
                whiteSpace: 'nowrap',
              }}
              disabled={isFacilityOperator}
            >
              {BUTTON_LABELS.REGISTER_SAMPLING}
            </Button>
            <Button
              variant="contained"
              startIcon={<DeleteForeverIcon />}
              onClick={() => handleOpenRegisterEventDialog('destruction')}
              sx={{
                bgcolor: '#607d8b',
                color: '#fff',
                '&:hover': { bgcolor: '#546e7a' },
                borderRadius: 1,
                textTransform: 'none',
                py: '6px',
                px: '10px',
                fontSize: '0.75rem',
                whiteSpace: 'nowrap',
              }}
              disabled={isFacilityOperator}
            >
              {BUTTON_LABELS.REGISTER_DESTRUCTION}
            </Button>
            {/* NEW: Process Batch Button */}
            <Button
              variant="contained"
              startIcon={<LocalProcessingIcon />}
              onClick={handleOpenProcessBatchDialog}
              sx={{
                bgcolor: '#800080', // A distinct color for processing
                color: '#fff',
                '&:hover': { bgcolor: '#660066' },
                borderRadius: 1,
                textTransform: 'none',
                py: '6px',
                px: '10px',
                fontSize: '0.75rem',
                whiteSpace: 'nowrap',
              }}
              disabled={isFacilityOperator}
            >
              {BUTTON_LABELS.PROCESS_BATCH}
            </Button>
            {/* Close button (X) */}
            <IconButton
              onClick={handleCloseAreaDetail}
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                color: '#64748b',
                zIndex: 5,
                '&:hover': { bgcolor: '#f1f5f9' }
              }}
              aria-label="Close"
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{
          pt: '20px !important',
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' }, // Column on mobile, row on desktop
          gap: { xs: 3, md: 4 }, // Space between sections
          bgcolor: '#fff',
        }}>
          {/* Left Section: General Info and Batches */}
          <Box sx={{ flexGrow: 1, minWidth: { md: '40%' } }}>
            <Typography variant="h6" sx={{ mb: 2, color: '#1976d2', fontWeight: 500 }}>General Information</Typography>
            <Typography variant="subtitle1" sx={{ mt: 1, mb: 1, color: '#64748b' }}>
              Description: {currentAreaDetail?.description || 'N/A'}
            </Typography>
            <Typography variant="body2" sx={{ color: '#1976d2', fontWeight: 500 }}>
              Capacity: {currentAreaDetail?.capacity_units} {currentAreaDetail?.capacity_unit_type || 'units'}
            </Typography>
            <Typography variant="body2" sx={{ color: '#1a202c' }}>
              Current Stage: {currentAreaDetail?.current_stage?.name || 'Loading...'}
            </Typography>
            <Divider sx={{ my: 2, bgcolor: '#e2e8f0' }} />
            <Typography variant="h6" sx={{ mb: 2, color: '#1976d2', fontWeight: 500 }}>Batches in this Area:</Typography>
            {currentAreaDetail?.batches && currentAreaDetail.batches.length > 0 ? (
              currentAreaDetail.batches.map(batch => (
                <BatchItem key={batch.id} batch={batch} setParentSnack={setParentSnack} isFacilityOperator={isFacilityOperator} />
              ))
            ) : (
              <Typography variant="body2" sx={{ color: '#64748b' }}>
                No batches in this area.
              </Typography>
            )}
          </Box>
          <Box sx={{ width: { md: '55%' }, flexShrink: 0, ml: { md: 4 } }}>
            <TraceabilityEventsGrid
              currentAreaDetail={currentAreaDetail}
              batchesInCurrentArea={batchesInCurrentArea}
              setParentSnack={setParentSnack}
              tenantId={tenantId}
              isGlobalAdmin={isGlobalAdmin}
              selectedFacilityId={selectedFacilityId}
              facilities={facilities}
            />
          </Box>
        </DialogContent>
      </Dialog>

      {/* --- Dialog for Adding New Batch --- */}
      <Dialog open={openAddBatchDialog} onClose={handleCloseAddBatchDialog} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: '#fff', color: '#1a202c', borderRadius: 2 } }}
      >
        <DialogTitle sx={{ bgcolor: '#fff', color: '#1a202c', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e0e0e0' }}>
          {DIALOG_TITLES.ADD_BATCH}
          <IconButton onClick={handleCloseAddBatchDialog} sx={{ color: '#64748b' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <form onSubmit={handleSaveBatch}>
          <DialogContent sx={{ pt: '20px !important' }}>
            {/* Indicador de capacidad */}
            {currentAreaDetail && currentAreaDetail.capacity_units && (
              <Box sx={{ 
                mb: 2, 
                p: 2, 
                bgcolor: '#f0f9ff', 
                borderRadius: 1, 
                border: '1px solid #0ea5e9' 
              }}>
                <Typography variant="body2" sx={{ color: '#0369a1', fontWeight: 'medium' }}>
                  Area Capacity: {currentAreaDetail.capacity_units} {currentAreaDetail.capacity_unit_type || 'units'}
                </Typography>
                <Typography variant="body2" sx={{ color: '#0369a1' }}>
                  Current Usage: {(currentAreaDetail.batches || []).reduce((sum, b) => sum + (parseFloat(b.current_units) || 0), 0)} units
                </Typography>
                <Typography variant="body2" sx={{ 
                  color: (currentAreaDetail.capacity_units - (currentAreaDetail.batches || []).reduce((sum, b) => sum + (parseFloat(b.current_units) || 0), 0)) > 0 ? '#15803d' : '#dc2626',
                  fontWeight: 'bold' 
                }}>
                  Available: {currentAreaDetail.capacity_units - (currentAreaDetail.batches || []).reduce((sum, b) => sum + (parseFloat(b.current_units) || 0), 0)} units
                </Typography>
              </Box>
            )}
            <TextField
              label="Batch Name"
              value={batchName}
              onChange={e => setBatchName(e.target.value)}
              fullWidth
              required
              sx={{ mt: 1, mb: 2 }}
              disabled={batchDialogLoading}
            />
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <TextField
                label="Quantity"
                type="number"
                value={batchCurrentUnits}
                onChange={e => setBatchCurrentUnits(e.target.value)}
                required
                sx={{ flex: 2 }}
                disabled={batchDialogLoading}
                inputProps={{ 
                  max: currentAreaDetail?.capacity_units 
                    ? currentAreaDetail.capacity_units - (currentAreaDetail.batches || []).reduce((sum, b) => sum + (parseFloat(b.current_units) || 0), 0) 
                    : undefined 
                }}
                helperText={currentAreaDetail?.capacity_units 
                  ? `Max available: ${currentAreaDetail.capacity_units - (currentAreaDetail.batches || []).reduce((sum, b) => sum + (parseFloat(b.current_units) || 0), 0)}`
                  : ''
                }
              />
              <FormControl sx={{ flex: 1, minWidth: 100 }}>
                <InputLabel>Unit</InputLabel>
                <Select
                  value={batchUnits}
                  onChange={e => setBatchUnits(e.target.value)}
                  required
                  label="Unit"
                  disabled={batchDialogLoading}
                >
                  <MenuItem value="units">Units</MenuItem>
                  <MenuItem value="g">Grams (g)</MenuItem>
                  <MenuItem value="kg">Kilograms (kg)</MenuItem>
                  <MenuItem value="ml">Milliliters (ml)</MenuItem>
                  <MenuItem value="L">Liters (L)</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>End Type</InputLabel>
              <Select
                value={batchEndType}
                onChange={e => setBatchEndType(e.target.value)}
                required
                label="End Type"
                disabled={batchDialogLoading}
              >
                <MenuItem value="" disabled><em>Select Type</em></MenuItem>
                <MenuItem value="Dried">Dried</MenuItem>
                <MenuItem value="Fresh">Fresh</MenuItem>
                {/* Add more types as needed */}
              </Select>
            </FormControl>
            <TextField
              label="Variety"
              value={batchVariety}
              onChange={e => setBatchVariety(e.target.value)}
              fullWidth
              required
              sx={{ mb: 2 }}
              disabled={batchDialogLoading}
            />
            {/* NEW: Product Type for Batch Creation */}
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Product Type</InputLabel>
              <Select
                value={batchProductType}
                onChange={e => setBatchProductType(e.target.value)}
                required
                label="Product Type"
                disabled={batchDialogLoading}
              >
                <MenuItem value="" disabled><em>Select Product Type</em></MenuItem>
                {HEALTH_CANADA_PRODUCT_TYPES.map(type => (
                  <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Projected Yield"
              type="number"
              value={batchProjectedYield}
              onChange={e => setBatchProjectedYield(e.target.value)}
              fullWidth
              sx={{ mb: 2 }}
              disabled={batchDialogLoading}
            />
            <TextField
              label="Advance to Harvesting On (Optional)"
              type="date"
              value={batchAdvanceToHarvestingOn}
              onChange={e => setBatchAdvanceToHarvestingOn(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
              sx={{ mb: 2 }}
              disabled={batchDialogLoading}
            />
          </DialogContent>
          <DialogActions sx={{ bgcolor: '#f8fafc', borderTop: '1px solid #e0e0e0', px: 3, py: 2 }}>
            <Button onClick={handleCloseAddBatchDialog} disabled={batchDialogLoading} sx={{ color: '#64748b' }}>{BUTTON_LABELS.CANCEL}</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={batchDialogLoading || !batchName.trim() || batchCurrentUnits === '' || !batchEndType.trim() || !batchVariety.trim() || !batchProductType.trim()}
              sx={{
                bgcolor: '#4CAF50',
                '&:hover': { bgcolor: '#43A047' }
              }}
            >
              {batchDialogLoading ? <CircularProgress size={24} /> : BUTTON_LABELS.CREATE_BATCH}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* --- Global Event Registration Dialog --- */}
      <Dialog open={openRegisterEventDialog} onClose={handleCloseRegisterEventDialog} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: '#fff', color: '#1a202c', borderRadius: 2 } }}
      >
        <DialogTitle sx={{ bgcolor: '#fff', color: '#1a202c', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e0e0e0' }}>
          {DIALOG_TITLES.REGISTER_EVENT}
          <IconButton onClick={handleCloseRegisterEventDialog} sx={{ color: '#64748b' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: '20px !important' }}>
          {renderEventForm()}
        </DialogContent>
      </Dialog>

      {/* --- Process Batch Dialog (NEW) --- */}
      <Dialog open={openProcessBatchDialog} onClose={handleCloseProcessBatchDialog} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: '#fff', color: '#1a202c', borderRadius: 2 } }}
      >
        <DialogTitle sx={{ bgcolor: '#fff', color: '#1a202c', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e0e0e0' }}>
          {DIALOG_TITLES.PROCESS_BATCH}
          <IconButton onClick={handleCloseProcessBatchDialog} sx={{ color: '#64748b' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <form onSubmit={handleProcessBatch}>
          <DialogContent sx={{ pt: '20px !important' }}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Batch to Process</InputLabel>
              <Select
                value={processBatchId}
                onChange={(e) => setProcessBatchId(e.target.value)}
                required
                label="Batch to Process"
                disabled={processDialogLoading}
              >
                <MenuItem value="" disabled><em>Select Batch</em></MenuItem>
                {batchesInCurrentArea.length === 0 ? (
                  <MenuItem value="" disabled><em>No batches available in this area</em></MenuItem>
                ) : (
                  batchesInCurrentArea.map(batch => (
                    <MenuItem key={batch.id} value={batch.id}>
                      {batch.name} (Current Units: {batch.current_units})
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>
            <TextField
              label="Processed Quantity"
              type="number"
              value={processedQuantity}
              onChange={e => setProcessedQuantity(e.target.value)}
              inputProps={{ min: 1, max: maxQuantity }}
              fullWidth
              required
              sx={{ mb: 2 }}
              disabled={processDialogLoading}
              helperText={processBatchId ? `Max: ${batchesInCurrentArea.find(b => b.id === processBatchId)?.current_units || 0}` : ''}
            />
            <TextField
              label="Process Method (e.g., Drying, Curing)"
              value={processMethod}
              onChange={e => setProcessMethod(e.target.value)}
              fullWidth
              required
              sx={{ mb: 2 }}
              disabled={processDialogLoading}
            />
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>New Product Type</InputLabel>
              <Select
                value={newProductType}
                onChange={e => setNewProductType(e.target.value)}
                required
                label="New Product Type"
                disabled={processDialogLoading}
              >
                <MenuItem value="" disabled><em>Select New Product Type</em></MenuItem>
                {HEALTH_CANADA_PRODUCT_TYPES.map(type => (
                  <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Process Description (Optional)"
              multiline
              rows={3}
              value={processDescription}
              onChange={e => setProcessDescription(e.target.value)}
              fullWidth
              sx={{ mb: 2 }}
              disabled={processDialogLoading}
            />
          </DialogContent>
          <DialogActions sx={{ bgcolor: '#f8fafc', borderTop: '1px solid #e0e0e0', px: 3, py: 2 }}>
            <Button onClick={handleCloseProcessBatchDialog} disabled={processDialogLoading} sx={{ color: '#64748b' }}>{BUTTON_LABELS.CANCEL}</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={processDialogLoading || !processBatchId || processedQuantity === '' || !processMethod.trim() || !newProductType.trim()}
              sx={{
                bgcolor: '#4CAF50',
                '&:hover': { bgcolor: '#43A047' }
              }}
            >
              {processDialogLoading ? <CircularProgress size={24} /> : BUTTON_LABELS.PROCESS_BATCH}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Paper>
  );
});

StageView.propTypes = {
  stage: PropTypes.object.isRequired,
  cultivationAreas: PropTypes.array.isRequired,
  tenantId: PropTypes.number, // Can be null for Super Admin
  refreshCultivationAreas: PropTypes.func.isRequired, // This is the prop passed from parent
  handleDeleteStage: PropTypes.func.isRequired,
  setParentSnack: PropTypes.func.isRequired,
  setParentConfirmDialog: PropTypes.func.isRequired,
  setParentConfirmDialogOpen: PropTypes.func.isRequired,
  selectedFacilityId: PropTypes.number, // Assuming facilityId is numeric
  facilities: PropTypes.array.isRequired,
  isFacilityOperator: PropTypes.bool.isRequired,
  isGlobalAdmin: PropTypes.bool.isRequired,
  userFacilityId: PropTypes.number, // Added propType for userFacilityId
  currentUserId: PropTypes.number, // NEW: Added propType for currentUserId
};

// --- Main Cultivation Module Component ---
const CultivationPage = ({ tenantId, isAppReady, userFacilityId, currentUserId, isGlobalAdmin, setParentSnack }) => {
// Added for debugging: Checks if this version of the component is loading
  // FORCE CACHE REFRESH - Version updated with enhanced error logging
  const CURRENT_TIMESTAMP = new Date().toISOString();
  console.log("🚀 CultivationPage: Component loaded. Version V2025-08-26-TRACEABILITY-ENABLED.");
  console.log("🔄 CACHE REFRESH FORCED - Enhanced error logging active - " + CURRENT_TIMESTAMP);
  console.log("⚡ HOT RELOAD ACTIVE - This should show current time: " + CURRENT_TIMESTAMP);
  console.log("✅ ENABLED: Traceability events for area movements (backend FormRequest fix)");

  const [facilities, setFacilities] = useState([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState('');
  const [stages, setStages] = useState([]);
  const [rawAreas, setRawAreas] = useState([]);
  const [cultivationAreas, setCultivationAreas] = useState([]);
  const [loading, setLoading] = useState(true); // Main loading state
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });
  const [openStageDialog, setOpenStageDialog] = useState(false);
  const [stageName, setStageName] = useState('');
  const [editingStage, setEditingStage] = useState(null);
  const [stageDialogLoading, setStageDialogLoading] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmDialogData, setConfirmDialogData] = useState({ title: '', message: '', onConfirm: () => {} });
  
  // Dnd-Kit State: activeDraggableId must be in the parent component (CultivationPage)
  const [activeDraggableId, setActiveDraggableId] = useState(null);

  const isFacilityOperator = !!userFacilityId;

  // Reference to the stages container to detect scroll
  const stagesContainerRef = useRef(null);
  // States to control scroll shadow visibility
  const [showLeftShadow, setShowLeftShadow] = useState(false);
  const [showRightShadow, setShowRightShadow] = useState(false); // Corrected state name

  // States for export dialog
  const [openExportDialog, setOpenExportDialog] = useState(false);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [exportLoading, setExportLoading] = useState(false);


  // Utility to show notifications
  const showSnack = useCallback((message, severity = 'success') => {
    setSnack({ open: true, message, severity });
  }, []);

  // Memoization to organize areas by stage
  const organizedAreas = useMemo(() => {
    return stages.length > 0
      ? stages.map(stage => ({
          ...stage,
          cultivationAreas: rawAreas
            .filter(area => area.current_stage_id === stage.id)
            .sort((a, b) => a.order - b.order || 0),
        }))
      : [];
  }, [stages, rawAreas]);

  // Update the organized cultivation areas state
  useEffect(() => {
    setCultivationAreas(organizedAreas);
  }, [organizedAreas]);

  // Function to fetch facilities - Adjusted dependencies to prevent re-render loop
  const fetchFacilities = useCallback(async () => {
    try {
      const headers = {};
      let effectiveTenantId = null;

      // This logic should primarily determine the tenant ID for the API call,
      // not rely on `selectedFacilityId` from state directly if it's being set here.
      // The `selectedFacilityId` state update should happen *after* fetching.
      if (tenantId) {
        effectiveTenantId = String(tenantId);
      } else if (isGlobalAdmin) {
        // For global admin, if a facility is already selected, use its tenant_id for the fetch,
        // but avoid circular dependency if selectedFacilityId is updated *by* this fetch.
        // For initial load, it might be empty.
        // We will handle setting selectedFacilityId *after* the fetch.
      }

      if (effectiveTenantId) {
        headers['X-Tenant-ID'] = effectiveTenantId;
      }

      const response = await api.get('/facilities', { headers });
      let fetchedFacilities = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.data)
        ? response.data.data
        : [];

      return fetchedFacilities; // Return the fetched data
    } catch (error) {
      console.error('Error loading facilities:', error);
      setParentSnack('Error loading facilities', 'error');
      return [];
    }
  }, [tenantId, isGlobalAdmin, setParentSnack]); // Removed facilities and selectedFacilityId from dependencies

  // Function to fetch stages
  const fetchStages = useCallback(async () => {
    console.log("fetchStages called."); // Added log to confirm execution
    try {
      const response = await api.get('/stages');
      const fetchedStages = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.data)
        ? response.data.data
        : [];
      setStages(fetchedStages.sort((a, b) => a.order - b.order));
      return fetchedStages; // Return stages for Promise.all
    } catch (error) {
      console.error('CultivationPage: Error fetching stages:', error);
      setParentSnack(SNACK_MESSAGES.STAGES_ERROR, 'error');
      return [];
    }
  }, [setParentSnack]);


  // Function to fetch cultivation areas
  const fetchCultivationAreas = useCallback(async (currentSelectedFacilityId) => {
    if (!isAppReady || (!tenantId && !isGlobalAdmin)) {
      return;
    }
    if (!currentSelectedFacilityId && !isFacilityOperator && isGlobalAdmin) {
        console.log('fetchCultivationAreas: Global Admin, no facility selected. Skipping area fetch.');
        setRawAreas([]); // Clear areas if no facility selected
        return;
    }

    try {
      let url = '/cultivation-areas';
      if (currentSelectedFacilityId) {
        url = `/facilities/${currentSelectedFacilityId}/cultivation-areas`;
      }
      const response = await api.get(url); // X-Tenant-ID is handled in App.jsx for this call
      const fetchedAreas = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.data)
        ? response.data.data
        : [];
      setRawAreas(fetchedAreas);
    } catch (error) {
      console.error('CultivationPage: Error fetching cultivation areas:', error);
      setParentSnack(SNACK_MESSAGES.CULTIVATION_AREAS_ERROR, 'error');
    }
  }, [tenantId, isAppReady, setParentSnack, isGlobalAdmin, isFacilityOperator]);


  // Effect for initial data loading (facilities, stages)
  useEffect(() => {
    const loadInitialData = async () => {
      if (!isAppReady || (!tenantId && !isGlobalAdmin)) {
        setLoading(false); // Ensure loading state is deactivated if no valid context
        return;
      }

      setLoading(true); // Activate loading state at the start of initial load
      try {
        const fetchedFacs = await fetchFacilities(); // Fetch facilities
        setFacilities(fetchedFacs); // Update facilities state

        // Determine which facility to select and fetch areas for
        let facilityToFetchAreas = null;
        if (isFacilityOperator && userFacilityId) {
          facilityToFetchAreas = userFacilityId;
        } else if (selectedFacilityId && fetchedFacs.some(f => f.id === selectedFacilityId)) {
          // Keep existing selectedFacilityId if it's valid among fetched facilities
          facilityToFetchAreas = selectedFacilityId;
        } else if (fetchedFacs.length > 0) {
          // Otherwise, select the first one
          facilityToFetchAreas = fetchedFacs[0].id;
        }
        
        // Update selectedFacilityId state if it changed
        if (facilityToFetchAreas !== selectedFacilityId) {
            setSelectedFacilityId(facilityToFetchAreas);
        }

        await fetchStages(); // Fetch stages

        // Fetch areas based on the determined facilityToFetchAreas
        if (facilityToFetchAreas) {
          await fetchCultivationAreas(facilityToFetchAreas);
        } else if (isGlobalAdmin && fetchedFacs.length === 0) {
          // If it's a global admin and no facilities, clear areas
          setRawAreas([]);
        }

      } catch (error) {
        console.error('CultivationPage: Error in initial data load:', error);
        setParentSnack('Error loading initial data.', 'error');
      } finally {
        setLoading(false); // Deactivate loading state once all promises resolve
      }
    };

    loadInitialData();
  }, [tenantId, isAppReady, isGlobalAdmin, fetchFacilities, fetchStages, userFacilityId, selectedFacilityId, fetchCultivationAreas, setParentSnack, isFacilityOperator]); // selectedFacilityId is a dependency here because we want to react to its *changes* for area fetching, but fetchFacilities itself doesn't depend on it.

  // Effect to load cultivation areas when the selected facility changes
  useEffect(() => {
    if (isAppReady && (tenantId || isGlobalAdmin) && selectedFacilityId) {
      fetchCultivationAreas(selectedFacilityId);
    } else if (isAppReady && isGlobalAdmin && !selectedFacilityId) {
      setRawAreas([]); // Clear areas if no facility is selected for global admin
    }
  }, [selectedFacilityId, isAppReady, tenantId, isGlobalAdmin, fetchCultivationAreas]);


  // Handlers for Stage UI and Dialogs
  const handleOpenStageDialog = (stage = null) => {
    setEditingStage(stage);
    setStageName(stage ? stage.name : '');
    setOpenStageDialog(true);
    setStageDialogLoading(false);
  };

  const handleCloseStageDialog = () => {
    setOpenStageDialog(false);
    setEditingStage(null);
    setStageName('');
    setStageDialogLoading(false);
  };

  const handleSaveStage = async (e) => {
    e.preventDefault();
    if (!stageName.trim()) {
      showSnack(SNACK_MESSAGES.STAGE_NAME_REQUIRED, 'warning');
      return;
    }
    if (stageName.length > 100) {
      showSnack(SNACK_MESSAGES.STAGE_NAME_LENGTH_EXCEEDED, 'warning');
      return;
    }
    if (/[<>{}]/.test(stageName)) {
      showSnack(SNACK_MESSAGES.STAGE_NAME_INVALID_CHARS, 'warning');
      return;
    }

    setStageDialogLoading(true);
    const headers = {};
    const stageData = { name: stageName };
    let effectiveTenantId = null;

    if (isGlobalAdmin) {
      if (selectedFacilityId) {
        const selectedFac = facilities.find(f => f.id === selectedFacilityId);
        if (selectedFac && selectedFac.tenant_id) {
          effectiveTenantId = String(selectedFac.tenant_id);
          stageData.tenant_id = parseInt(effectiveTenantId, 10); // Add tenant_id to payload
          console.log('handleSaveStage: Global Admin, using X-Tenant-ID from selected facility:', effectiveTenantId);
        } else {
          showSnack('Error: As Super Admin, the selected facility does not have a valid tenant to create/edit stages.', 'error');
          setStageDialogLoading(false);
          return;
        }
      } else {
        showSnack('Error: As Super Admin, you must select a facility to create/edit stages.', 'error');
        setStageDialogLoading(false);
        return;
      }
    } else if (tenantId) {
        effectiveTenantId = String(tenantId);
        stageData.tenant_id = parseInt(effectiveTenantId, 10); // Add tenant_id to payload
        console.log('handleSaveStage: Tenant user, using X-Tenant-ID from user:', effectiveTenantId);
    } else {
        showSnack('Error: Could not determine Tenant ID to create/edit stages.', 'error');
        setStageDialogLoading(false);
        return;
    }

    if (effectiveTenantId) {
      headers['X-Tenant-ID'] = effectiveTenantId;
    }

    try {
      if (editingStage) {
        await api.put(`/stages/${editingStage.id}`, stageData, { headers }); // Pass headers here
        showSnack(SNACK_MESSAGES.STAGE_UPDATED, 'success');
      } else {
        await api.post('/stages', stageData, { headers }); // Pass headers here
        showSnack(SNACK_MESSAGES.STAGE_CREATED, 'success');
      }
      await fetchStages(); // Reload stages to update UI
      handleCloseStageDialog();
    } catch (err) {
      console.error('CultivationPage: Error saving stage:', err);
      const errorMessage = err.response?.data?.message || err.message;
      if (err.response?.status === 422) {
        const errors = err.response?.data?.details;
        const firstError = errors ? Object.values(errors)[0][0] : errorMessage;
        showSnack(`${SNACK_MESSAGES.VALIDATION_ERROR} ${firstError}`, 'error');
      } else if (err.response?.status === 400) {
        showSnack(`${SNACK_MESSAGES.INVALID_DATA} ${errorMessage}`, 'error');
      } else if (err.response?.status === 403) {
        showSnack(SNACK_MESSAGES.PERMISSION_DENIED, 'error');
      } else {
        showSnack(`${SNACK_MESSAGES.GENERAL_ERROR_SAVING_STAGE} ${errorMessage}`, 'error');
      }
    } finally {
      setStageDialogLoading(false);
    }
  };

  const handleDeleteStageConfirm = useCallback(async (stageToDelete) => {
    setLoading(true); // Activate loading while deleting
    
    const headers = {};
    let effectiveTenantId = null;

    if (isGlobalAdmin) {
        if (selectedFacilityId) {
            const selectedFac = facilities.find(f => f.id === selectedFacilityId);
            if (selectedFac && selectedFac.tenant_id) {
                effectiveTenantId = String(selectedFac.tenant_id);
            } else {
                showSnack('Error: As Super Admin, the selected facility does not have a valid tenant to delete stages.', 'error');
                setLoading(false);
                setConfirmDialogOpen(false);
                return;
            }
        } else {
            showSnack('Error: As Super Admin, you must select a facility to delete stages.', 'error');
            setLoading(false);
            setConfirmDialogOpen(false);
            return;
        }
    } else if (tenantId) {
        effectiveTenantId = String(tenantId);
    } else {
        showSnack('Error: Could not determine Tenant ID to delete the stage.', 'error');
        setLoading(false);
        setConfirmDialogOpen(false);
        return;
    }

    if (effectiveTenantId) {
      headers['X-Tenant-ID'] = effectiveTenantId;
    }

    try {
      await api.delete(`/stages/${stageToDelete.id}`, { headers }); // Pass headers here
      showSnack(SNACK_MESSAGES.STAGE_DELETED, 'info');
      await fetchStages(); // Reload stages to update UI
    } catch (err) {
      console.error('CultivationPage: Error deleting stage:', err);
      const errorMessage = err.response?.data?.message || err.message;
      if (err.response?.status === 400) {
        showSnack(`${SNACK_MESSAGES.INVALID_DATA} ${errorMessage}`, 'error');
      } else if (err.response?.status === 403) {
        showSnack(SNACK_MESSAGES.PERMISSION_DENIED, 'error');
      } else {
        showSnack(`Error deleting stage: ${errorMessage}`, 'error');
      }
    } finally {
      setLoading(false); // Deactivate loading
      setConfirmDialogOpen(false);
    }
  }, [fetchStages, showSnack, isGlobalAdmin, selectedFacilityId, facilities, tenantId]); // fetchStages is correctly listed here

  const handleDeleteStageClick = useCallback((stageToDelete) => {
    setConfirmDialogData({
      title: DIALOG_TITLES.CONFIRM_STAGE_DELETION,
      message: `Are you sure you want to delete the stage "${stageToDelete.name}"? This will fail if it has associated cultivation areas.`,
      onConfirm: () => handleDeleteStageConfirm(stageToDelete),
    });
    setConfirmDialogOpen(true);
  }, [handleDeleteStageConfirm]);

  // Dnd-Kit Handlers for CultivationPage (parent)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = useCallback((event) => {
    setActiveDraggableId(event.active.id);
  }, []);

  // Helper function to find the dragged area across all stages
  const findDraggedArea = useCallback((areas, activeId) => {
    for (let i = 0; i < areas.length; i++) {
      const stage = areas[i];
      const areaIndex = stage.cultivationAreas.findIndex(area => area.id === activeId);
      if (areaIndex !== -1) {
        return { draggedArea: stage.cultivationAreas[areaIndex], sourceStage: stage, sourceAreaIndex: areaIndex };
      }
    }
    return { draggedArea: null, sourceStage: null, sourceAreaIndex: -1 };
  }, []);

  // Helper function to parse the drag destination
  const parseDragDestination = useCallback((over) => {
    let targetStageId = over.id;
    let targetAreaId = null;
    if (over.data.current?.type === 'CultivationArea') {
      targetStageId = over.data.current.cultivationArea.current_stage_id;
      targetAreaId = over.id;
    }
    return { targetStageId, targetAreaId };
  }, []);

  // Helper function for drag within the same stage
  const handleSameStageDrag = useCallback(async (sourceStage, destinationStage, sourceAreaIndex, targetAreaId) => {
    const oldIndex = sourceAreaIndex;
    const newIndex = targetAreaId
      ? destinationStage.cultivationAreas.findIndex(area => area.id === targetAreaId)
      : destinationStage.cultivationAreas.length;
    if (oldIndex !== newIndex) {
      const updatedAreas = arrayMove(sourceStage.cultivationAreas, oldIndex, newIndex);
      sourceStage.cultivationAreas = updatedAreas.map((area, idx) => ({ ...area, order: idx }));
      await api.put(`/stages/${sourceStage.id}/cultivation-areas/reorder`, {
        area_ids: updatedAreas.map(area => area.id),
      });
    }
  }, []);

  // Helper function for drag across different stages
  const handleCrossStageDrag = useCallback(async (draggedArea, sourceStage, destinationStage, sourceAreaIndex, targetAreaId) => {
    sourceStage.cultivationAreas.splice(sourceAreaIndex, 1);
    const targetIndex = targetAreaId
      ? destinationStage.cultivationAreas.findIndex(area => area.id === targetAreaId)
      : destinationStage.cultivationAreas.length;
    destinationStage.cultivationAreas.splice(targetIndex, 0, {
      ...draggedArea,
      current_stage_id: destinationStage.id,
    });
    sourceStage.cultivationAreas = sourceStage.cultivationAreas.map((area, idx) => ({ ...area, order: idx }));
    destinationStage.cultivationAreas = destinationStage.cultivationAreas.map((area, idx) => ({ ...area, order: idx }));

    // Update cultivation area in backend
    await api.put(`/cultivation-areas/${draggedArea.id}`, {
      current_stage_id: destinationStage.id,
      order: targetIndex,
      name: draggedArea.name,
      description: draggedArea.description,
      capacity_units: draggedArea.capacity_units,
      capacity_unit_type: draggedArea.capacity_unit_type,
      facility_id: draggedArea.facility_id,
    });
    
    // Update stage ordering
    await api.put(`/stages/${sourceStage.id}/cultivation-areas/reorder`, {
      area_ids: sourceStage.cultivationAreas.map(area => area.id),
    });
    await api.put(`/stages/${destinationStage.id}/cultivation-areas/reorder`, {
      area_ids: destinationStage.cultivationAreas.map(area => area.id),
    });

    // Register area movement traceability event
    try {
      const headers = {};
      let effectiveTenantId = null;
      
      if (isGlobalAdmin) {
        if (selectedFacilityId) {
          const selectedFac = facilities.find(f => f.id === selectedFacilityId);
          if (selectedFac && selectedFac.tenant_id) {
            effectiveTenantId = String(selectedFac.tenant_id);
          }
        }
      } else if (tenantId) {
        effectiveTenantId = String(tenantId);
      }
      
      if (effectiveTenantId) {
        headers['X-Tenant-ID'] = effectiveTenantId;
      }
      
      // Area movement payload (batch_id omitted for area-level movements)
      const areaMovementPayload = {
        event_type: 'movement',
        area_id: parseInt(draggedArea.id),
        facility_id: parseInt(selectedFacilityId),
        user_id: parseInt(currentUserId || 1),
        description: `Area '${draggedArea.name}' moved from '${sourceStage.name}' to '${destinationStage.name}'`,
        from_location: sourceStage.name,
        to_location: destinationStage.name
      };
      
      console.log('🚀 Registering AREA MOVEMENT traceability event (backend fixed):');
      console.log('- Payload:', areaMovementPayload);
      console.log('- Headers:', headers);
      
      await api.post('/traceability-events', areaMovementPayload, { headers });
      
      console.log('✅ SUCCESS: Area movement traceability event registered!');
      setParentSnack(
        `${SNACK_MESSAGES.CULTIVATION_AREA_MOVED} Traceability event registered successfully.`, 
        'success'
      );
      
    } catch (traceabilityError) {
      console.error('🚨 Error registering traceability event:', traceabilityError);
      console.error('Response data:', traceabilityError.response?.data);
      
      setParentSnack(
        `${SNACK_MESSAGES.CULTIVATION_AREA_MOVED} Warning: Could not register traceability event.`,
        'warning'
      );
    }
    
  }, [setParentSnack, isGlobalAdmin, selectedFacilityId, facilities, tenantId, currentUserId]);

  const handleDragEnd = useCallback(async (event) => {
    const { active, over } = event;
    setActiveDraggableId(null);
    if (!over || active.id === over.id) {
      return;
    }

    if (isFacilityOperator) {
      setParentSnack(SNACK_MESSAGES.DRAG_PERMISSION_DENIED, 'error');
      return;
    }

    // Create a deep copy of cultivationAreas to modify
    const newCultivationAreasState = JSON.parse(JSON.stringify(cultivationAreas));
    const { draggedArea, sourceStage, sourceAreaIndex } = findDraggedArea(newCultivationAreasState, active.id);
    if (!draggedArea || !sourceStage) {
      console.error('CultivationPage: Dragged area or source stage not found.');
      return;
    }

    const { targetStageId, targetAreaId } = parseDragDestination(over);
    const destinationStage = newCultivationAreasState.find(stage => stage.id === targetStageId);
    if (!destinationStage) {
      console.error('CultivationPage: Destination stage not found.');
      return;
    }

    try {
      if (sourceStage.id === destinationStage.id) {
        await handleSameStageDrag(sourceStage, destinationStage, sourceAreaIndex, targetAreaId);
      } else {
        await handleCrossStageDrag(draggedArea, sourceStage, destinationStage, sourceAreaIndex, targetAreaId);
      }
      setCultivationAreas(newCultivationAreasState); // Update local state immediately for visual feedback
      // The success message for area movement is now handled within handleCrossStageDrag
    } catch (error) {
      console.error('CultivationPage: Error in drag operation:', error);
      setParentSnack(SNACK_MESSAGES.ERROR_DRAGGING, 'error');
    } finally {
      // Always refresh data from backend to ensure consistency after drag
      await fetchCultivationAreas(selectedFacilityId); 
    }
  }, [cultivationAreas, isFacilityOperator, setParentSnack, findDraggedArea, parseDragDestination, handleSameStageDrag, handleCrossStageDrag, fetchCultivationAreas, selectedFacilityId]);

  // Helper function to get the currently dragged area for DragOverlay
  const getActiveCultivationArea = useCallback(() => {
    if (!activeDraggableId) return null;
    for (const stage of cultivationAreas) {
      const area = stage.cultivationAreas.find(a => a.id === activeDraggableId);
      if (area) return area;
    }
    return null;
  }, [activeDraggableId, cultivationAreas]);

  // Function to update scroll shadow state
  const updateScrollShadows = useCallback(() => {
    if (stagesContainerRef.current) {
      const { scrollWidth, clientWidth, scrollLeft } = stagesContainerRef.current;
      const atLeft = scrollLeft === 0;
      const atRight = scrollLeft + clientWidth >= scrollWidth - 1; // -1 to avoid rounding issues

      setShowLeftShadow(!atLeft);
      setShowRightShadow(!atRight); 
    }
  }, []);

  // Effect to add and clean up scroll event listener
  useEffect(() => {
    const container = stagesContainerRef.current;
    if (container) {
      updateScrollShadows(); // Set initial state
      container.addEventListener('scroll', updateScrollShadows);
      window.addEventListener('resize', updateScrollShadows); // Also on window resize
      return () => {
        container.removeEventListener('scroll', updateScrollShadows);
        window.removeEventListener('resize', updateScrollShadows);
      };
    }
  }, [stages, updateScrollShadows]); // Dependencies: stages to re-evaluate if content changes

  // Dynamic CSS for shadowing
  const scrollShadowStyle = useMemo(() => {
    let shadow = 'none';
    if (showLeftShadow && showRightShadow) { 
      shadow = 'inset 10px 0 8px -8px rgba(0, 0, 0, 0.4), inset -10px 0 8px -8px rgba(0, 0, 0, 0.4)';
    } else if (showLeftShadow) {
      shadow = 'inset 10px 0 8px -8px rgba(0, 0, 0, 0.4)';
    } else if (showRightShadow) { 
      shadow = 'inset -10px 0 8px -8px rgba(0, 0, 0, 0.4)';
    }
    return { boxShadow: shadow, transition: 'box-shadow 0.3s ease-in-out' };
  }, [showLeftShadow, showRightShadow]); 

  // Handler for event export
  const handleExportTraceabilityEvents = useCallback(async () => {
    setExportLoading(true);
    try {
      const headers = {};
      let effectiveTenantId = null;

      if (isGlobalAdmin) {
          if (selectedFacilityId) {
              const selectedFac = facilities.find(f => f.id === selectedFacilityId);
              if (selectedFac && selectedFac.tenant_id) {
                  effectiveTenantId = String(selectedFac.tenant_id);
              } else {
                  setParentSnack('Error: As Super Admin, the selected facility does not have a valid tenant to export.', 'error');
                  setExportLoading(false);
                  return;
              }
          } else {
              setParentSnack('Error: As Super Admin, you must select a facility to export events.', 'error');
              setExportLoading(false);
              return;
          }
      } else if (tenantId) {
          effectiveTenantId = String(tenantId);
      } else {
          setParentSnack('Error: Could not determine Tenant ID to export events.', 'error');
          setExportLoading(false);
          return;
      }

      if (effectiveTenantId) {
        headers['X-Tenant-ID'] = effectiveTenantId;
      }

      let url = `/traceability-events/export?facility_id=${selectedFacilityId}`;
      if (exportStartDate) {
        url += `&start_date=${exportStartDate}`;
      }
      if (exportEndDate) {
        url += `&end_date=${exportEndDate}`;
      }

      const response = await api.get(url, { headers, responseType: 'blob' }); // responseType: 'blob' is crucial for downloading files

      // Create a temporary link for download
      const urlBlob = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = urlBlob;
      link.setAttribute('download', `traceability_events_${new Date().toISOString().split('T')[0]}.csv`); // File name
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(urlBlob); // Clean up URL object

      setParentSnack(SNACK_MESSAGES.EXPORT_SUCCESS, 'success');
      setOpenExportDialog(false); // Close dialog after export

    } catch (error) {
      console.error('Error exporting events:', error.response?.data || error.message);
      let errorMessage = SNACK_MESSAGES.EXPORT_ERROR;
      if (error.response && error.response.data) {
        // Try to read error message from blob if it's JSON
        try {
          const errorText = await error.response.data.text();
          const errorJson = JSON.parse(errorText);
          errorMessage = `${errorMessage} ${errorJson.message || errorText}`;
        } catch {
          errorMessage = `${errorMessage} ${error.response.statusText || error.message}`;
        }
      } else {
        errorMessage = `${errorMessage} ${error.message}`;
      }
      setParentSnack(errorMessage, 'error');
    } finally {
      setExportLoading(false);
    }
  }, [selectedFacilityId, exportStartDate, exportEndDate, isGlobalAdmin, facilities, tenantId, setParentSnack]);


  return (
    <Box sx={{
      p: { xs: 2, sm: 3 },
      minHeight: 'calc(100vh - 64px)',
      bgcolor: '#fff',
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <GrassIcon sx={{ fontSize: 32, color: 'primary.main', mr: 1 }} />
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Cultivation Management
        </Typography>
        {/* Facility Selector */}
        <FormControl size="small" sx={{ minWidth: 200, mr: 1 }}>
          <InputLabel id="facility-select-label">Facility</InputLabel>
          <Select
            labelId="facility-select-label"
            value={selectedFacilityId}
            label="Facility"
            onChange={(e) => {
                setSelectedFacilityId(e.target.value);
            }}
            disabled={loading || facilities.length === 0 || isFacilityOperator}
          >
            {facilities.length === 0 && !loading ? (
              <MenuItem value="">
                <em>No facilities available</em>
              </MenuItem>
            ) : (
              facilities.map((facility) => (
                <MenuItem key={facility.id} value={facility.id}>
                  {facility.name}
                </MenuItem>
              ))
            )}
          </Select>
        </FormControl>
        <Box sx={{ flexGrow: 1 }} /> {/* This will push buttons to the right */}
        
        {/* Export Traceability Events Button */}
        <Button
          variant="contained"
          startIcon={<GetAppIcon />}
          onClick={() => {
            setOpenExportDialog(true);
            // Set default dates: last month
            const today = new Date();
            const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
            setExportEndDate(today.toISOString().split('T')[0]);
            setExportStartDate(lastMonth.toISOString().split('T')[0]);
          }}
          disabled={loading || isFacilityOperator || !selectedFacilityId}
          sx={{
            borderRadius: 2,
            bgcolor: '#007bff', // A blue color for export
            '&:hover': { bgcolor: '#0056b3' },
            mr: 1, // Right margin to separate from the other button
          }}
        >
          {BUTTON_LABELS.EXPORT_EVENTS}
        </Button>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenStageDialog(null)}
          disabled={loading || isFacilityOperator}
          sx={{
            borderRadius: 2,
            bgcolor: '#4CAF50',
            '&:hover': { bgcolor: '#43A047' },
          }}
        >
          {BUTTON_LABELS.ADD_STAGE}
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
          <CircularProgress color="primary" />
          <Typography variant="body1" sx={{ ml: 2 }}>Loading cultivation data...</Typography>
        </Box>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <Box
            ref={stagesContainerRef} // Assign the reference here
            sx={{
              display: 'flex',
              overflowX: 'auto',
              gap: 2,
              pb: 2,
              alignItems: 'flex-start',
              minHeight: '200px',
              position: 'relative', // Necessary for inset shadow
              ...scrollShadowStyle, // Apply dynamic shadow style
              // Hide native scrollbar but keep functionality
              '&::-webkit-scrollbar': { display: 'none' },
              '-ms-overflow-style': 'none',  /* IE and Edge */
              'scrollbar-width': 'none',  /* Firefox */
            }}
          >
            {stages.length === 0 ? (
              <Typography variant="h6" sx={{ color: 'text.secondary', textAlign: 'center', width: '100%', mt: 5 }}>
                No cultivation stages. Add one to get started!
              </Typography>
            ) : (
              stages.map((stage) => (
                <StageView
                  key={stage.id}
                  stage={stage}
                  cultivationAreas={cultivationAreas.find(s => s.id === stage.id)?.cultivationAreas || []}
                  tenantId={tenantId}
                  refreshCultivationAreas={() => fetchCultivationAreas(selectedFacilityId)} // Pass the function with the current ID
                  handleDeleteStage={handleDeleteStageClick}
                  setParentSnack={showSnack}
                  setParentConfirmDialog={setConfirmDialogData}
                  setParentConfirmDialogOpen={setConfirmDialogOpen}
                  selectedFacilityId={selectedFacilityId}
                  facilities={facilities}
                  isFacilityOperator={isFacilityOperator}
                  isGlobalAdmin={isGlobalAdmin}
                  userFacilityId={userFacilityId} // Pass userFacilityId to StageView
                  currentUserId={currentUserId} // Pass currentUserId to StageView
                />
              ))
            )}
          </Box>
          <DragOverlay>
            {activeDraggableId ? (
              <Paper
                sx={{
                  p: 1.5,
                  bgcolor: '#fff',
                  borderRadius: 1.5,
                  boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
                  cursor: 'grabbing',
                  width: '280px',
                  opacity: 0.8,
                }}
              >
                <CultivationAreaContent area={getActiveCultivationArea()} setParentSnack={showSnack} isFacilityOperator={isFacilityOperator} />
              </Paper>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} onClose={() => setSnack({ ...snack, open: false })}>
          {snack.message}
        </Alert>
      </Snackbar>

      <Dialog open={openStageDialog} onClose={handleCloseStageDialog} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: '#fff', color: '#1a202c', borderRadius: 2 } }}
      >
      <DialogTitle sx={{ bgcolor: '#fff', color: '#1a202c', borderBottom: '1px solid #e0e0e0' }}>{editingStage ? DIALOG_TITLES.EDIT_STAGE : DIALOG_TITLES.CREATE_STAGE}</DialogTitle>
        <form onSubmit={handleSaveStage}>
          <DialogContent sx={{ pt: '20px !important' }}>
            <TextField
              label="Stage Name"
              value={stageName}
              onChange={e => setStageName(e.target.value)}
              fullWidth
              required
              sx={{ mt: 1, mb: 2 }}
              disabled={stageDialogLoading}
              helperText={!stageName.trim() && openStageDialog ? SNACK_MESSAGES.STAGE_NAME_REQUIRED : ''}
              error={!stageName.trim() && openStageDialog}
              inputProps={{ maxLength: 100 }}
              aria-label="Stage name"
            />
          </DialogContent>
          <DialogActions sx={{ bgcolor: '#f8fafc', borderTop: '1px solid #e0e0e0', px: 3, py: 2 }}>
            <Button onClick={handleCloseStageDialog} disabled={stageDialogLoading} sx={{ color: '#64748b' }}>{BUTTON_LABELS.CANCEL}</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={stageDialogLoading || !stageName.trim()}
              sx={{
                bgcolor: '#4CAF50',
                '&:hover': { bgcolor: '#43A047' }
              }}
            >
              {stageDialogLoading ? <CircularProgress size={24} /> : (editingStage ? BUTTON_LABELS.SAVE_CHANGES : BUTTON_LABELS.CREATE_STAGE)}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <ConfirmationDialog
        open={confirmDialogOpen}
        title={confirmDialogData.title}
        message={confirmDialogData.message}
        onConfirm={confirmDialogData.onConfirm}
        onCancel={() => setConfirmDialogOpen(false)}
      />

      {/* --- Export Events Dialog --- */}
      <Dialog open={openExportDialog} onClose={() => setOpenExportDialog(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: '#fff', color: '#1a202c', borderRadius: 2 } }}
      >
        <DialogTitle sx={{ bgcolor: '#fff', color: '#1a202c', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e0e0e0' }}>
          {DIALOG_TITLES.EXPORT_EVENTS}
          <IconButton onClick={() => setOpenExportDialog(false)} sx={{ color: '#64748b' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: '20px !important' }}>
          <Typography variant="body2" sx={{ mb: 2, color: '#64748b' }}>
            Select a date range to export traceability events for the current facility.
          </Typography>
          <TextField
            label="Start Date"
            type="date"
            value={exportStartDate}
            onChange={e => setExportStartDate(e.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
            sx={{ mb: 2 }}
            disabled={exportLoading}
          />
          <TextField
            label="End Date"
            type="date"
            value={exportEndDate}
            onChange={e => setExportEndDate(e.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
            sx={{ mb: 2 }}
            disabled={exportLoading}
          />
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#f8fafc', borderTop: '1px solid #e0e0e0', px: 3, py: 2 }}>
          <Button onClick={() => setOpenExportDialog(false)} disabled={exportLoading} sx={{ color: '#64748b' }}>{BUTTON_LABELS.CANCEL}</Button>
          <Button
            onClick={handleExportTraceabilityEvents}
            variant="contained"
            disabled={exportLoading || !selectedFacilityId || !exportStartDate || !exportEndDate}
            sx={{
              bgcolor: '#1976d2',
              '&:hover': { bgcolor: '#1565c0' }
            }}
          >
            {exportLoading ? <CircularProgress size={24} /> : BUTTON_LABELS.EXPORT_EVENTS}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

CultivationPage.propTypes = {
  tenantId: PropTypes.number, // Can be null for Super Admin
  isAppReady: PropTypes.bool.isRequired,
  userFacilityId: PropTypes.number, // Assuming facilityId is numeric
  currentUserId: PropTypes.number, // NEW: Added propType for currentUserId
  isGlobalAdmin: PropTypes.bool.isRequired,
  setParentSnack: PropTypes.func.isRequired, // Added propType for setParentSnack
};

export default CultivationPage;
