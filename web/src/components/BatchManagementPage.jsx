// src/components/BatchManagementPage.jsx
// This version includes all developed functionalities, consolidated and updated:
// - Product Type field in Add/Edit Batch dialog.
// - NewProductType field in Process Batch dialog.
// - Register External Batches (Paso 2.2 for Health Canada compliance).
// - New traceability event type 'loss_theft' (Paso 2.3).
// - 'is_packaged' boolean field in the Add/Edit Batch dialog and displayed in the list.
// - 'units' field (Unit of Measure) in the Add/Edit Batch and External Batch forms.
// - FIX: Addressed TypeError in DataGrid valueGetter for cultivation_area_name with more robust checks.
// - FIX: Corrected logic for current_stage_name in DataGrid with more robust checks.
// - FIX: Implemented Tenant ID handling for Global Admin when fetching /tenant-members.
// - FIX: Ensured facility_id is sent in batch processing payload and refined quantity validation.
// - FIX: Guaranteed 'processed_quantity' is always sent as a valid number in the process batch payload.
// - FIX: Corrected the useState initialization for 'confirmDialogData' to resolve 'is not iterable' error.
// - FIX: Corrected payload keys in handleProcessBatch to match Laravel's camelCase validation rules.
// - FIX: Added facility_id to the payload for batch processing to resolve NOT NULL constraint violation in traceability events.
// - FIX: Corrected typo in handleCloseRegisterEventEventDialog to handleCloseRegisterEventDialog.
// - INTEGRATION: Integrated frontend with Laravel API for Traceability Events (fetch and store).
// - NEW: Added inventory adjustment functionality with sub_location field
// - SECURITY: Enhanced input validation, sanitization, rate limiting, and audit logging
// All UI texts and messages are translated to English.
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { api } from '../App'; // Asegúrate de que esta importación sea correcta
import {
  Box, Typography, Button, CircularProgress, Snackbar, Alert,
  TextField, Paper, Divider, IconButton, FormControl, InputLabel, Select, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogActions,
  List, ListItem, ListItemText, Grid, Chip, FormControlLabel, Checkbox, ListItemIcon,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, TableSortLabel, InputAdornment, Tooltip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import HistoryIcon from '@mui/icons-material/History'; // Icono para trazabilidad
import TrendingUpIcon from '@mui/icons-material/TrendingUp'; // Icono para movimiento
import EcoIcon from '@mui/icons-material/Agriculture'; // Icono para evento de cultivo (usando Agriculture)
import RefreshIcon from '@mui/icons-material/Refresh'; // Icon for refresh
import HarvestIcon from '@mui/icons-material/LocalFlorist'; // Icono para cosecha (usando flor)
import ScienceIcon from '@mui/icons-material/Science'; // Icono para muestreo
import DeleteForeverIcon from '@mui/icons-material/DeleteForever'; // Icono para destrucción
import InventoryIcon from '@mui/icons-material/Inventory'; // Main icon for batches
import EditIcon from '@mui/icons-material/Edit'; // Icono para edit
import DeleteIcon from '@mui/icons-material/Delete'; // Icono para delete
import VisibilityIcon from '@mui/icons-material/Visibility'; // Icono para view details
import CallSplitIcon from '@mui/icons-material/CallSplit'; // Icono para split batch
import TransformIcon from '@mui/icons-material/Transform'; // Icono para process batch (used AutorenewIcon previously, TransformIcon is more fitting)
import SearchIcon from '@mui/icons-material/Search'; // Icono para search
import FilterListIcon from '@mui/icons-material/FilterList'; // Icono para filter
import ClearIcon from '@mui/icons-material/Clear'; // Icono para clear filter
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline'; // Icono para Loss/Theft
import LocalShippingIcon from '@mui/icons-material/LocalShipping'; // Icono para external batches
import AddBoxIcon from '@mui/icons-material/AddBox'; // Icono para ajuste de inventario
import ArchiveIcon from '@mui/icons-material/Archive'; // Icono para archivar batch
import RestoreIcon from '@mui/icons-material/Restore'; // Icono para restaurar batch archivado
// Import DataGrid and individual components for the Toolbar as per documentation
import {
  DataGrid,
  GridToolbarContainer,
  GridToolbarColumnsButton,
  GridToolbarFilterButton,
  GridToolbarDensitySelector,
  GridToolbarExport,
  GridToolbarQuickFilter,
} from '@mui/x-data-grid'; // Import the custom hook for facility operator logic
import useFacilityOperator from '../hooks/useFacilityOperator';

// Import security utilities
import {
  sanitizeInput,
  validateNumericInput,
  validateStringInput,
  validateBatchData,
  createRateLimiter,
  createAuditLog
} from './batch-management/batchManagement.utils';

// Import constants including security rules
import {
  SNACK_MESSAGES,
  DIALOG_TITLES,
  BUTTON_LABELS,
  HEALTH_CANADA_PRODUCT_TYPES,
  UNIT_OPTIONS,
  EVENT_TYPES,
  SECURITY_RULES,
  AUDIT_ACTIONS
} from './batch-management/batchManagement.constants';


// Helper to format date to YYYY-MM-DD
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
// --- Confirmation Dialog Component ---
const ConfirmationDialog = ({ open, title, message, onConfirm, onCancel }) => {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
      PaperProps={{ sx: { bgcolor: '#fff', color: '#1a202c', borderRadius: 2 } }}
    >
      <DialogTitle id="alert-dialog-title" sx={{ color: '#1a202c', borderBottom: '1px solid #e0e0e0' }}>{title}</DialogTitle>
      <DialogContent sx={{ pt: '20px !important' }}>
        <Typography id="alert-dialog-description" sx={{ color: '#4a5568' }}>
          {message}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ bgcolor: '#f8fafc', borderTop: '1px solid #e0e0e0' }}>
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
// --- Custom Toolbar Component for DataGrid ---
function CustomDataGridToolbar() {
  return (
    <GridToolbarContainer
      sx={{
        bgcolor: '#fff !important',
        color: '#1a202c !important',
        borderBottom: '1px solid #e0e0e0',
        padding: '8px',
        borderRadius: '4px 4px 0 0',
        minHeight: '48px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '8px',
        '& .MuiButtonBase-root': {
          color: '#1976d2 !important',
          '&:hover': {
            bgcolor: 'rgba(25,118,210,0.08)',
          },
        },
        '& .MuiInputBase-root': {
          color: '#1a202c !important',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: '#e0e0e0 !important',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#1976d2 !important',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#1976d2 !important',
          },
        },
        '& .MuiInputBase-input': {
          color: '#1a202c !important',
        },
        '& .MuiInputLabel-root': {
          color: 'rgba(0,0,0,0.6) !important',
        },
        '& .MuiSvgIcon-root': {
          color: '#1a202c !important',
        },
      }}
    >
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        <GridToolbarColumnsButton />
        <GridToolbarFilterButton />
        <GridToolbarDensitySelector />
        <GridToolbarExport />
      </Box>
      <GridToolbarQuickFilter
        sx={{
          width: { xs: '100%', sm: 'auto' },
          minWidth: '150px',
          ml: { sm: 2 },
        }}
      />
    </GridToolbarContainer>
  );
}

const BatchManagementPage = React.memo(({ tenantId, isAppReady, userFacilityId, isGlobalAdmin, setParentSnack, hasPermission }) => {
  const [batches, setBatches] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState('');
  const [cultivationAreas, setCultivationAreas] = useState([]);
  const [stages, setStages] = useState([]);
  const [users, setUsers] = useState([]); // For event registration (e.g., responsible user)
  const [varieties, setVarieties] = useState([]); // List of varieties from Production module
  const [loading, setLoading] = useState(true);
  
  // Performance optimization: Use refs to prevent unnecessary re-renders
  const batchesRef = useRef([]);
  const facilitiesRef = useRef([]);
  const cultivationAreasRef = useRef([]);
  const stagesRef = useRef([]);
  const usersRef = useRef([]);
  const varietiesRef = useRef([]);
  
  // Cache for API responses to reduce unnecessary requests
  const apiCacheRef = useRef(new Map());
  
  // Security: Rate limiting for API calls
  const rateLimiterRef = useRef(createRateLimiter(SECURITY_RULES.RATE_LIMIT_REQUESTS, SECURITY_RULES.RATE_LIMIT_WINDOW_MS));
  
  // Security: Track user actions for audit logging
  const auditLogRef = useRef([]);
  
  // Security: Input validation state
  const [validationErrors, setValidationErrors] = useState({});
  
  // Auto-generate batch name function
  const generateBatchName = useCallback(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    // Get existing batches to find the next sequence number
    const currentBatches = batchesRef.current.length > 0 ? batchesRef.current : batches;
    
    // Pattern: BT-YYYYMMDD-XXX where XXX is a 3-digit sequence
    const datePrefix = `BT-${year}${month}${day}`;
    
    // Find all batches that start with today's prefix
    const todayBatches = currentBatches.filter(b => 
      b.name && b.name.startsWith(datePrefix)
    );
    
    // Extract sequence numbers and find the max
    let maxSequence = 0;
    todayBatches.forEach(b => {
      const match = b.name.match(new RegExp(`^${datePrefix}-(\\d+)`));
      if (match) {
        const seq = parseInt(match[1], 10);
        if (seq > maxSequence) maxSequence = seq;
      }
    });
    
    // Next sequence number
    const nextSequence = String(maxSequence + 1).padStart(3, '0');
    
    return `${datePrefix}-${nextSequence}`;
  }, [batches]);
  
  // Snackbar state (using parent snack for consistency) - Optimized with useMemo
  const showSnack = useCallback((message, severity = 'success') => {
    if (typeof setParentSnack === 'function') {
      setParentSnack(message, severity);
    }
  }, [setParentSnack]);
  
  // Security: Enhanced API call wrapper with rate limiting and audit logging
  const secureApiCall = useCallback(async (apiCall, action, entityType, entityId = null) => {
    // Rate limiting check
    const rateLimitResult = rateLimiterRef.current();
    if (!rateLimitResult.allowed) {
      const waitTime = Math.ceil(rateLimitResult.retryAfter / 1000);
      showSnack(`${SNACK_MESSAGES.SECURITY_RATE_LIMIT_EXCEEDED} Wait ${waitTime} seconds.`, 'warning');
      
      // Log rate limit violation
      const auditLog = createAuditLog(
        AUDIT_ACTIONS.RATE_LIMIT_EXCEEDED,
        entityType,
        entityId,
        users.find(u => u.current)?.id || null,
        { action, rateLimitWindow: SECURITY_RULES.RATE_LIMIT_WINDOW_MS }
      );
      auditLogRef.current.push(auditLog);
      console.warn('Rate limit exceeded:', auditLog);
      
      throw new Error('Rate limit exceeded');
    }
    
    try {
      const result = await apiCall();
      
      // Log successful action
      const auditLog = createAuditLog(
        action,
        entityType,
        entityId,
        users.find(u => u.current)?.id || null,
        { success: true }
      );
      auditLogRef.current.push(auditLog);
      
      return result;
    } catch (error) {
      // Log failed action
      const auditLog = createAuditLog(
        action,
        entityType,
        entityId,
        users.find(u => u.current)?.id || null,
        { 
          success: false, 
          error: error.message,
          statusCode: error.response?.status
        }
      );
      auditLogRef.current.push(auditLog);
      
      throw error;
    }
  }, [showSnack, users]);
  // Add/Edit Batch Dialog States
  const [openBatchDialog, setOpenBatchDialog] = useState(false);
  const [editingBatch, setEditingBatch] = useState(null);
  const [batchName, setBatchName] = useState('');
  const [batchCurrentUnits, setBatchCurrentUnits] = useState('');
  const [batchUnit, setBatchUnit] = useState('g'); // NEW: State for batch unit, default to 'g'
  const [batchEndType, setBatchEndType] = useState('');
  const [batchVariety, setBatchVariety] = useState('');
  const [batchProductType, setBatchProductType] = useState('');
  const [batchProjectedYield, setBatchProjectedYield] = useState('');
  const [batchAdvanceToHarvestingOn, setBatchAdvanceToHarvestingOn] = useState('');
  const [batchCultivationAreaId, setBatchCultivationAreaId] = useState('');
  const [batchDialogLoading, setBatchDialogLoading] = useState(false);
  const [batchOriginType, setBatchOriginType] = useState('internal'); // Default to internal
  const [batchOriginDetails, setBatchOriginDetails] = useState('');
  const [isPackaged, setIsPackaged] = useState(false); // State for is_packaged
  const [batchSubLocation, setBatchSubLocation] = useState(''); // NEW: State for sub_location

  // Calculate available capacity for each cultivation area
  const getAreaAvailableCapacity = useCallback((areaId) => {
    if (!areaId) return null;
    
    const area = cultivationAreas.find(a => a.id === areaId);
    if (!area) return null;
    
    const totalCapacity = parseFloat(area.capacity_units) || 0;
    
    // Sum units from all active batches in this area (excluding the one being edited)
    const currentBatches = batchesRef.current.length > 0 ? batchesRef.current : batches;
    const usedCapacity = currentBatches
      .filter(b => b.cultivation_area_id === areaId && b.status === 'active' && (!editingBatch || b.id !== editingBatch.id))
      .reduce((sum, b) => sum + (parseFloat(b.current_units) || 0), 0);
    
    const availableCapacity = totalCapacity - usedCapacity;
    
    return {
      total: totalCapacity,
      used: usedCapacity,
      available: Math.max(0, availableCapacity),
      unit: area.capacity_unit_type || 'units'
    };
  }, [cultivationAreas, batches, editingBatch]);

  // Batch Detail/Traceability States
  const [openBatchDetailDialog, setOpenBatchDetailDialog] = useState(false);
  const [currentBatchDetail, setCurrentBatchDetail] = useState(null);
  const [traceabilityEvents, setTraceabilityEvents] = useState([]);
  const [selectedBatchForTraceability, setSelectedBatchForTraceability] = useState('all'); // Filter for traceability events
  // Traceability Event Dialog States
  const [openRegisterEventDialog, setOpenRegisterEventDialog] = useState(false);
  const [currentEventType, setCurrentEventType] = useState('');
  const [eventBatchId, setEventBatchId] = useState('');
  const [eventQuantity, setEventQuantity] = useState('');
  const [eventUnit, setEventUnit] = useState('');
  const [eventDescription, setEventDescription] = useState(''); // Used for notes/description in DB
  const [eventFromLocation, setEventFromLocation] = useState('');
  const [eventToLocation, setEventToLocation] = useState('');
  const [eventMethod, setEventMethod] = useState('');
  const [eventReason, setEventReason] = useState('');
  const [eventNewBatchId, setEventNewBatchId] = useState(''); // For harvest
  const [eventResponsibleUserId, setEventResponsibleUserId] = useState(''); // Responsible user for event
  const [eventDialogLoading, setEventDialogLoading] = useState(false);

  // Split Batch Dialog States
  const [openSplitBatchDialog, setOpenSplitBatchDialog] = useState(false);
  const [batchToSplit, setBatchToSplit] = useState(null);
  const [splitQuantity, setSplitQuantity] = useState('');
  const [newSplitBatchName, setNewSplitBatchName] = useState('');
  const [splitBatchCultivationAreaId, setSplitBatchCultivationAreaId] = useState('');
  const [newSplitBatchProductType, setNewSplitBatchProductType] = useState(''); // NEW: Product type for new split batch
  const [splitBatchDialogLoading, setSplitBatchDialogLoading] = useState(false);
  // Process Batch Dialog States
  const [openProcessBatchDialog, setOpenProcessBatchDialog] = useState(false);
  const [batchToProcess, setBatchToProcess] = useState(null);
  const [processedQuantity, setProcessedQuantity] = useState('');
  const [processMethod, setProcessMethod] = useState('');
  const [processNotes, setProcessNotes] = useState(''); // For notes in processing
  const [newProductType, setNewProductType] = useState('');
  const [processBatchDialogLoading, setProcessBatchDialogLoading] = useState(false);
  // External Batch Dialog States
  const [openExternalBatchDialog, setOpenExternalBatchDialog] = useState(false);
  const [externalBatchName, setExternalBatchName] = useState('');
  const [externalBatchUnits, setExternalBatchUnits] = useState('');
  const [externalBatchUnit, setExternalBatchUnit] = useState('g'); // NEW: State for external batch unit, default to 'g'
  const [externalBatchProductType, setExternalBatchProductType] = useState('');
  const [externalBatchVariety, setExternalBatchVariety] = useState('');
  const [externalBatchOriginDetails, setExternalBatchOriginDetails] = useState('');
  const [externalBatchCultivationAreaId, setExternalBatchCultivationAreaId] = useState('');
  const [externalBatchDialogLoading, setExternalBatchDialogLoading] = useState(false);

  // Confirmation Dialog States
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  // FIX: Corrected useState initialization for confirmDialogData
  const [confirmDialogData, setConfirmDialogData] = useState({ title: '', message: '', onConfirm: () => {} });
  
  // -------------------- NEW: ESTADOS PARA AJUSTE DE INVENTARIO --------------------
  const [openAdjustmentDialog, setOpenAdjustmentDialog] = useState(false);
  const [adjustmentQuantity, setAdjustmentQuantity] = useState('');
  const [adjustmentUnit, setAdjustmentUnit] = useState('g');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [selectedBatchForAdjustment, setSelectedBatchForAdjustment] = useState(null);
  const [adjustmentDialogLoading, setAdjustmentDialogLoading] = useState(false);
  // ------------------------------------------------------------------------

  // Filters - Currently managed by DataGrid's built-in filtering
  const [searchTerm, setSearchTerm] = useState("");
  const [filterProductType, setFilterProductType] = useState("");
  const [filterCultivationAreaId, setFilterCultivationAreaId] = useState("");
  
  // Table pagination and sorting states (Accounts style)
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [orderBy, setOrderBy] = useState('name');
  const [order, setOrder] = useState('asc');
  
  const isFacilityOperator = useFacilityOperator(hasPermission);

  // --- Data Fetching Functions ---
  const fetchFacilities = useCallback(async () => {
    const cacheKey = `facilities_${isFacilityOperator}_${userFacilityId}`;
    
    // Check cache first
    if (apiCacheRef.current.has(cacheKey)) {
      const cachedData = apiCacheRef.current.get(cacheKey);
      if (Date.now() - cachedData.timestamp < 300000) { // 5-minute cache
        return cachedData.data;
      }
    }
    
    try {
      const response = await api.get('/facilities');
      let fetchedFacilities = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.data)
        ? response.data.data
        : [];
      
      if (isFacilityOperator && userFacilityId) {
        fetchedFacilities = fetchedFacilities.filter(f => f.id === userFacilityId);
      }
      
      // Cache the result
      apiCacheRef.current.set(cacheKey, {
        data: fetchedFacilities,
        timestamp: Date.now()
      });
      
      facilitiesRef.current = fetchedFacilities;
      console.log('BatchManagementPage: Fetched Facilities:', fetchedFacilities);
      return fetchedFacilities;
    } catch (error) {
      console.error('BatchManagementPage: Error fetching facilities:', error);
      showSnack(SNACK_MESSAGES.FACILITIES_ERROR, 'error');
      return [];
    }
  }, [showSnack, isFacilityOperator, userFacilityId]);
  const fetchCultivationAreas = useCallback(async (currentSelectedFacilityId) => {
    if (!isAppReady || (!tenantId && !isGlobalAdmin)) {
      return [];
    }
    if (!currentSelectedFacilityId && !isFacilityOperator && isGlobalAdmin) {
      console.log('BatchManagementPage: Global Admin, no facility selected. Skipping area fetch.');
      setCultivationAreas([]);
      cultivationAreasRef.current = [];
      return [];
    }
    
    const cacheKey = `cultivation_areas_${currentSelectedFacilityId}`;
    
    // Check cache first
    if (apiCacheRef.current.has(cacheKey)) {
      const cachedData = apiCacheRef.current.get(cacheKey);
      if (Date.now() - cachedData.timestamp < 300000) { // 5-minute cache
        setCultivationAreas(cachedData.data);
        return cachedData.data;
      }
    }
    
    try {
      let url = '/cultivation-areas';
      if (currentSelectedFacilityId) {
        url = `/facilities/${currentSelectedFacilityId}/cultivation-areas`;
      }
      const response = await api.get(url);
      const fetchedAreas = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.data)
        ? response.data.data
        : [];
      
      // Cache the result
      apiCacheRef.current.set(cacheKey, {
        data: fetchedAreas,
        timestamp: Date.now()
      });
      
      setCultivationAreas(fetchedAreas);
      cultivationAreasRef.current = fetchedAreas;
      return fetchedAreas;
    } catch (error) {
      console.error('BatchManagementPage: Error fetching cultivation areas:', error);
      showSnack(SNACK_MESSAGES.CULTIVATION_AREAS_ERROR, 'error');
      return [];
    }
  }, [tenantId, isAppReady, showSnack, isGlobalAdmin, isFacilityOperator]);
  const fetchStages = useCallback(async () => {
    const cacheKey = 'stages';
    
    // Check cache first
    if (apiCacheRef.current.has(cacheKey)) {
      const cachedData = apiCacheRef.current.get(cacheKey);
      if (Date.now() - cachedData.timestamp < 600000) { // 10-minute cache for stages (less likely to change)
        setStages(cachedData.data);
        return cachedData.data;
      }
    }
    
    try {
      const response = await api.get('/stages');
      const fetchedStages = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.data)
        ? response.data.data
        : [];
      
      // Cache the result
      apiCacheRef.current.set(cacheKey, {
        data: fetchedStages,
        timestamp: Date.now()
      });
      
      setStages(fetchedStages);
      stagesRef.current = fetchedStages;
      return fetchedStages;
    } catch (error) {
      console.error('BatchManagementPage: Error fetching stages:', error);
      showSnack(SNACK_MESSAGES.STAGES_ERROR, 'error');
      return [];
    }
  }, [showSnack]);
  const fetchUsers = useCallback(async (currentSelectedFacilityId) => {
    if (!isAppReady || (!tenantId && !isGlobalAdmin)) return;
    
    const cacheKey = `users_${currentSelectedFacilityId || 'none'}`;
    
    // Check cache first
    if (apiCacheRef.current.has(cacheKey)) {
      const cachedData = apiCacheRef.current.get(cacheKey);
      if (Date.now() - cachedData.timestamp < 300000) { // 5-minute cache
        setUsers(cachedData.data);
        return;
      }
    }
    
    const headers = {};
    let effectiveTenantId = null;
    
    if (isGlobalAdmin) {
        if (currentSelectedFacilityId) {
            const selectedFac = facilitiesRef.current.find(f => f.id === currentSelectedFacilityId);
            if (selectedFac && selectedFac.tenant_id) {
                effectiveTenantId = String(selectedFac.tenant_id);
            } else {
                console.warn('fetchUsers: Global Admin - Selected facility has no valid Tenant ID. Cannot fetch users.');
                setUsers([]);
                return;
            }
        } else {
            console.log('fetchUsers: Global Admin, no facility selected. Not fetching tenant members.');
            setUsers([]);
            return;
        }
    } else if (tenantId) {
        effectiveTenantId = String(tenantId);
    } else {
        showSnack(SNACK_MESSAGES.TENANT_ID_MISSING, 'error');
        setUsers([]);
        return;
    }
    
    if (effectiveTenantId) {
      headers['X-Tenant-ID'] = effectiveTenantId;
    }
    
    try {
      const response = await api.get('/tenant-members', { headers });
      const fetchedUsers = Array.isArray(response.data) ? response.data : response.data.data || [];
      
      // Cache the result
      apiCacheRef.current.set(cacheKey, {
        data: fetchedUsers,
        timestamp: Date.now()
      });
      
      setUsers(fetchedUsers);
      usersRef.current = fetchedUsers;
    } catch (error) {
      console.error("Error fetching users:", error.response?.data || error.message);
      showSnack("Error fetching users: " + (error.response?.data?.message || error.message), "error");
      setUsers([]);
    }
  }, [isAppReady, tenantId, isGlobalAdmin, showSnack]);

  // Fetch varieties from Production module
  const fetchVarieties = useCallback(async () => {
    if (!isAppReady || (!tenantId && !isGlobalAdmin)) return;
    
    const cacheKey = 'varieties_all';
    
    // Check cache first
    if (apiCacheRef.current.has(cacheKey)) {
      const cachedData = apiCacheRef.current.get(cacheKey);
      if (Date.now() - cachedData.timestamp < 300000) { // 5-minute cache
        setVarieties(cachedData.data);
        return;
      }
    }
    
    try {
      const response = await api.get('/production/varieties?is_active=1');
      const fetchedVarieties = Array.isArray(response.data) 
        ? response.data 
        : response.data.data || [];
      
      // Cache the result
      apiCacheRef.current.set(cacheKey, {
        data: fetchedVarieties,
        timestamp: Date.now()
      });
      
      setVarieties(fetchedVarieties);
      varietiesRef.current = fetchedVarieties;
      console.log('BatchManagementPage: Fetched Varieties:', fetchedVarieties);
    } catch (error) {
      console.error("Error fetching varieties:", error.response?.data || error.message);
      showSnack("Error fetching varieties: " + (error.response?.data?.message || error.message), "error");
      setVarieties([]);
    }
  }, [isAppReady, tenantId, isGlobalAdmin, showSnack]);

  const fetchBatches = useCallback(async (currentSelectedFacilityId) => {
    if (!isAppReady || (!tenantId && !isGlobalAdmin)) {
      setBatches([]);
      return;
    }
    if (!currentSelectedFacilityId && !isFacilityOperator && isGlobalAdmin) {
      console.log('BatchManagementPage: Global Admin, no facility selected. Skipping batch fetch.');
      setBatches([]);
      batchesRef.current = [];
      setLoading(false);
      return;
    }
    
    const cacheKey = `batches_${currentSelectedFacilityId || 'none'}`;
    
    // Check cache first for non-critical updates
    if (apiCacheRef.current.has(cacheKey)) {
      const cachedData = apiCacheRef.current.get(cacheKey);
      if (Date.now() - cachedData.timestamp < 30000) { // 30-second cache for batches
        setBatches(cachedData.data);
        setLoading(false);
        return;
      }
    }
    
    setLoading(true);
    const headers = {};
    let effectiveTenantId = null;
    
    if (isGlobalAdmin) {
        if (currentSelectedFacilityId) {
            const selectedFac = facilitiesRef.current.find(f => f.id === currentSelectedFacilityId);
            if (selectedFac && selectedFac.tenant_id) {
                effectiveTenantId = String(selectedFac.tenant_id);
                console.log('fetchBatches: Global Admin, using effectiveTenantId from selected facility:', effectiveTenantId);
            } else {
                showSnack('Error: As Super Admin, the selected facility does not have a valid Tenant ID to load batches.', 'error');
                setLoading(false);
                setBatches([]);
                return;
            }
        } else {
            console.log('fetchBatches: Global Admin, no facility selected. Not fetching batches.');
            setBatches([]);
            setLoading(false);
            return;
        }
    } else if (tenantId) {
        effectiveTenantId = String(tenantId);
        console.log('fetchBatches: Tenant user, using effectiveTenantId from tenantId prop:', effectiveTenantId);
    } else {
        showSnack(SNACK_MESSAGES.TENANT_ID_MISSING, 'error');
        setLoading(false);
        setBatches([]);
        return;
    }
    
    if (effectiveTenantId) {
      headers['X-Tenant-ID'] = effectiveTenantId;
    }
    
    try {
      const response = await api.get('/batches', { headers });
      const fetchedBatches = response.data || [];
      
      // Cache the result
      apiCacheRef.current.set(cacheKey, {
        data: fetchedBatches,
        timestamp: Date.now()
      });
      
      setBatches(fetchedBatches);
      batchesRef.current = fetchedBatches;
    } catch (error) {
      console.error('BatchManagementPage: Error fetching batches:', error.response?.data || error.message);
      showSnack(SNACK_MESSAGES.BATCHES_ERROR, 'error');
      setBatches([]);
    } finally {
      setLoading(false);
    }
  }, [isAppReady, tenantId, isGlobalAdmin, showSnack, isFacilityOperator]);
  // --- ACTUALIZACIÓN: FETCH DE EVENTOS DE TRAZABILIDAD DESDE LA API ---
  const fetchTraceabilityEvents = useCallback(async (batchId) => {
    if (!selectedFacilityId) {
      console.warn('fetchTraceabilityEvents: No facility selected. Cannot fetch traceability events.');
      return [];
    }
    
    const cacheKey = `traceability_events_${batchId}_${selectedFacilityId}`;
    
    // Check cache first
    if (apiCacheRef.current.has(cacheKey)) {
      const cachedData = apiCacheRef.current.get(cacheKey);
      if (Date.now() - cachedData.timestamp < 60000) { // 1-minute cache for traceability events
        return cachedData.data;
      }
    }
    
    const headers = {};
    let effectiveTenantId = null;
    
    if (isGlobalAdmin) {
        if (selectedFacilityId) {
            const selectedFac = facilitiesRef.current.find(f => f.id === selectedFacilityId);
            if (selectedFac && selectedFac.tenant_id) {
                effectiveTenantId = String(selectedFac.tenant_id);
            } else {
                showSnack('Error: As Super Admin, the selected facility does not have a valid Tenant ID to load traceability events.', 'error');
                return [];
            }
        } else {
            console.warn('fetchTraceabilityEvents: Global Admin, no facility selected. Cannot fetch traceability events.');
            return [];
        }
    } else if (tenantId) {
        effectiveTenantId = String(tenantId);
    } else {
        showSnack(SNACK_MESSAGES.TENANT_ID_MISSING, 'error');
        return [];
    }
    
    if (effectiveTenantId) {
      headers['X-Tenant-ID'] = effectiveTenantId;
    }
    
    try {
      // Fetch traceability events
      const eventsResponse = await api.get('/traceability-events', {
        headers,
        params: {
          batch_id: batchId,
          facility_id: selectedFacilityId,
        }
      });
      
      const traceabilityEvents = Array.isArray(eventsResponse.data) ? eventsResponse.data : [];
      
      // Also fetch loss/theft reports for this batch
      let lossTheftReports = [];
      try {
        const lossTheftResponse = await api.get('/loss-theft-reports', {
          headers,
          params: {
            facility_id: selectedFacilityId,
          }
        });
        // The API returns: { data: { current_page, data: [...reports], ... }, summary: {...} }
        // So we need lossTheftResponse.data.data.data for the actual reports array
        let allReports = [];
        if (Array.isArray(lossTheftResponse.data)) {
          allReports = lossTheftResponse.data;
        } else if (lossTheftResponse.data?.data?.data) {
          // Paginated response: response.data = { data: { data: [...] }, summary: {...} }
          allReports = lossTheftResponse.data.data.data;
        } else if (lossTheftResponse.data?.data) {
          allReports = Array.isArray(lossTheftResponse.data.data) 
            ? lossTheftResponse.data.data 
            : [];
        }
        
        console.log('Loss/Theft reports fetched:', allReports);
        console.log('Looking for batch_id:', batchId);
        
        // Filter by batch_id and format as events (compare as numbers)
        lossTheftReports = allReports
          .filter(report => Number(report.batch_id) === Number(batchId))
          .map(report => ({
            id: report.id,
            event_type: 'loss_theft',
            batch_id: report.batch_id,
            batch_name: report.batch?.name || `Batch ${report.batch_id}`,
            description: `${report.incident_type || 'Loss/Theft'}: ${report.description || 'N/A'} (${report.quantity_lost} ${report.unit})`,
            quantity: report.quantity_lost,
            unit: report.unit,
            user_id: report.reported_by_user_id,
            user_name: report.reported_by?.name || report.reportedBy?.name || `User ${report.reported_by_user_id}`,
            created_at: report.incident_date || report.created_at,
            is_loss_theft_report: true, // Flag to identify this is from loss_theft_reports table
          }));
        
        console.log('Filtered loss/theft reports:', lossTheftReports);
      } catch (lossTheftError) {
        console.warn('Could not fetch loss/theft reports:', lossTheftError.message);
      }
      
      // Combine and sort by date (newest first)
      const allEvents = [...traceabilityEvents, ...lossTheftReports].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );
      
      // Cache the result
      apiCacheRef.current.set(cacheKey, {
        data: allEvents,
        timestamp: Date.now()
      });
      
      return allEvents;
    } catch (error) {
      console.error('BatchManagementPage: Error fetching traceability events:', error.response?.data || error.message);
      showSnack('Error loading traceability events: ' + (error.response?.data?.message || error.message), 'error');
      return [];
    }
  }, [selectedFacilityId, isGlobalAdmin, tenantId, showSnack]);

  // --- Initial Load and Re-load Effects --- Optimized for performance
  useEffect(() => {
    const loadInitialData = async () => {
      if (!isAppReady || (!tenantId && !isGlobalAdmin)) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        // Fetch facilities, stages, and varieties in parallel
        const [fetchedFacs] = await Promise.all([
          fetchFacilities(),
          fetchStages(),
          fetchVarieties()
        ]);
        
        setFacilities(fetchedFacs);
        
        let initialFacilityId = '';
        if (isFacilityOperator && userFacilityId) {
          initialFacilityId = userFacilityId;
        } else if (isGlobalAdmin) {
          const facilityWithTenantId = fetchedFacs.find(f => f.tenant_id);
          if (facilityWithTenantId) {
            initialFacilityId = facilityWithTenantId.id;
            console.log('BatchManagementPage: Global Admin - Initial facility with tenant_id:', initialFacilityId);
          } else {
            console.warn('BatchManagementPage: Global Admin - No facilities found with a valid tenant_id. Displaying message.');
          }
        } else if (fetchedFacs.length > 0) {
          initialFacilityId = fetchedFacs[0].id;
        }
        
        setSelectedFacilityId(initialFacilityId);
      } catch (error) {
        console.error('BatchManagementPage: Error in initial data load:', error);
        showSnack('Error loading initial batch data.', 'error');
        setLoading(false);
      }
    };
    loadInitialData();
  }, [isAppReady, tenantId, isGlobalAdmin, fetchFacilities, userFacilityId, showSnack, fetchStages, fetchVarieties, isFacilityOperator]);
  useEffect(() => {
    if (isAppReady && (tenantId || isGlobalAdmin)) {
      if (selectedFacilityId) {
        // Invalidate cache when facility changes
        const cacheKeysToInvalidate = [
          `batches_${selectedFacilityId}`,
          `cultivation_areas_${selectedFacilityId}`,
          `users_${selectedFacilityId}`
        ];
        cacheKeysToInvalidate.forEach(key => apiCacheRef.current.delete(key));
        
        // Fetch data in parallel for better performance
        Promise.all([
          fetchBatches(selectedFacilityId),
          fetchCultivationAreas(selectedFacilityId),
          fetchUsers(selectedFacilityId)
        ]).catch(error => {
          console.error('Error fetching facility data:', error);
        });
      } else if (isGlobalAdmin) {
        setBatches([]);
        setCultivationAreas([]);
        setUsers([]);
        setLoading(false);
      } else {
        setBatches([]);
        setCultivationAreas([]);
        setUsers([]);
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, [selectedFacilityId, isAppReady, tenantId, isGlobalAdmin, fetchBatches, fetchCultivationAreas, fetchUsers]);

  // --- Batch Handlers (CRUD) ---
  const handleOpenBatchDialog = useCallback((batch = null) => {
    setEditingBatch(batch);
    // Auto-generate batch name for new batches
    setBatchName(batch ? batch.name : generateBatchName());
    setBatchCurrentUnits(batch ? batch.current_units : '');
    setBatchUnit(batch ? batch.units || 'g' : 'g');
    setBatchEndType(batch ? batch.end_type : '');
    setBatchVariety(batch ? batch.variety : '');
    setBatchProductType(batch ? batch.product_type || '' : '');
    setBatchProjectedYield(batch ? (batch.projected_yield || '') : '');
    setBatchAdvanceToHarvestingOn(batch ? (batch.advance_to_harvesting_on ? new Date(batch.advance_to_harvesting_on).toISOString().split('T')[0] : '') : '');
    setBatchCultivationAreaId(batch ? batch.cultivation_area_id : '');
    setBatchOriginType(batch ? batch.origin_type || 'internal' : 'internal');
    setBatchOriginDetails(batch ? batch.origin_details || '' : '');
    setIsPackaged(batch ? batch.is_packaged : false);
    setBatchSubLocation(batch ? batch.sub_location || '' : ''); // NEW: Set sub_location
    setOpenBatchDialog(true);
    setBatchDialogLoading(false);
    console.log('handleOpenBatchDialog: isFacilityOperator:', isFacilityOperator);
  }, [isFacilityOperator, generateBatchName]);
  const handleCloseBatchDialog = useCallback(() => {
    setOpenBatchDialog(false);
    setEditingBatch(null);
    setBatchName('');
    setBatchCurrentUnits('');
    setBatchUnit('g');
    setBatchEndType('');
    setBatchVariety('');
    setBatchProductType('');
    setBatchProjectedYield('');
    setBatchAdvanceToHarvestingOn('');
    setBatchCultivationAreaId('');
    setBatchOriginType('internal');
    setBatchOriginDetails('');
    setIsPackaged(false);
    setBatchSubLocation(''); // NEW: Reset sub_location
    setBatchDialogLoading(false);
  }, []);
  // Optimized form validation function with enhanced security
  const validateBatchForm = useCallback(() => {
    const errors = [];
    setValidationErrors({});
    
    // Enhanced validation using security utilities
    const nameValidation = validateStringInput(batchName, 1, SECURITY_RULES.BATCH_NAME_MAX_LENGTH, SECURITY_RULES.BATCH_NAME_PATTERN);
    if (!nameValidation.isValid) {
      errors.push(`Batch name: ${nameValidation.error}`);
      setValidationErrors(prev => ({ ...prev, batchName: nameValidation.error }));
    }
    
    const unitsValidation = validateNumericInput(batchCurrentUnits, SECURITY_RULES.MIN_QUANTITY, SECURITY_RULES.MAX_QUANTITY);
    if (!unitsValidation.isValid) {
      errors.push(`Current units: ${unitsValidation.error}`);
      setValidationErrors(prev => ({ ...prev, batchCurrentUnits: unitsValidation.error }));
    }
    
    if (!batchUnit.trim()) {
      errors.push(SNACK_MESSAGES.BATCH_UNIT_REQUIRED);
      setValidationErrors(prev => ({ ...prev, batchUnit: 'Unit is required' }));
    }
    
    const varietyValidation = validateStringInput(batchVariety, 1, SECURITY_RULES.VARIETY_MAX_LENGTH, SECURITY_RULES.VARIETY_PATTERN);
    if (!varietyValidation.isValid) {
      errors.push(`Variety: ${varietyValidation.error}`);
      setValidationErrors(prev => ({ ...prev, batchVariety: varietyValidation.error }));
    }
    
    if (!batchEndType.trim()) errors.push(SNACK_MESSAGES.BATCH_END_TYPE_REQUIRED);
    if (!batchProductType.trim()) errors.push(SNACK_MESSAGES.BATCH_PRODUCT_TYPE_REQUIRED);
    if (!batchCultivationAreaId) errors.push(SNACK_MESSAGES.BATCH_AREA_REQUIRED);
    if (!batchOriginType.trim()) errors.push(SNACK_MESSAGES.BATCH_ORIGIN_TYPE_REQUIRED);
    
    if (batchOriginType === 'external' && batchOriginDetails) {
      const originValidation = validateStringInput(batchOriginDetails, 1, SECURITY_RULES.ORIGIN_DETAILS_MAX_LENGTH);
      if (!originValidation.isValid) {
        errors.push(`Origin details: ${originValidation.error}`);
        setValidationErrors(prev => ({ ...prev, batchOriginDetails: originValidation.error }));
      }
    } else if (batchOriginType === 'external' && !batchOriginDetails.trim()) {
      errors.push("External origin details are required.");
    }
    
    return errors;
  }, [batchName, batchCurrentUnits, batchUnit, batchEndType, batchVariety, batchProductType, batchCultivationAreaId, batchOriginType, batchOriginDetails]);
  
  const handleSaveBatch = useCallback(async (e) => {
    e.preventDefault();
    
    // Enhanced validation with security checks
    const validationErrors = validateBatchForm();
    if (validationErrors.length > 0) {
      showSnack(validationErrors[0], 'warning');
      return;
    }

    setBatchDialogLoading(true);
    
    try {
      // Security: Validate and sanitize batch data
      const batchDataToValidate = {
        name: batchName,
        current_units: parseFloat(batchCurrentUnits),
        units: batchUnit,
        end_type: batchEndType,
        variety: batchVariety,
        product_type: batchProductType,
        projected_yield: batchProjectedYield === '' ? null : parseFloat(batchProjectedYield),
        advance_to_harvesting_on: batchAdvanceToHarvestingOn || null,
        cultivation_area_id: batchCultivationAreaId,
        origin_type: batchOriginType,
        origin_details: batchOriginDetails || null,
        is_packaged: isPackaged,
        facility_id: selectedFacilityId,
        sub_location: batchSubLocation || null,
      };
      
      const validation = validateBatchData(batchDataToValidate);
      if (!validation.isValid) {
        showSnack(`Data validation failed: ${validation.errors.join(', ')}`, 'error');
        setBatchDialogLoading(false);
        return;
      }
      
      // Use sanitized data
      const batchData = validation.sanitizedData;
      
      const headers = {};
      let effectiveTenantId = null;
      
      if (isGlobalAdmin) {
          if (selectedFacilityId) {
              const selectedFac = facilitiesRef.current.find(f => f.id === selectedFacilityId);
              if (selectedFac && selectedFac.tenant_id) {
                  effectiveTenantId = String(selectedFac.tenant_id);
              } else {
                  showSnack('Error: As Super Admin, the selected facility does not have a valid Tenant ID to create/edit batches.', 'error');
                  setBatchDialogLoading(false);
                  return;
              }
          } else {
              showSnack('Error: As Super Admin, you must select a facility to create/edit batches.', 'error');
              setBatchDialogLoading(false);
              return;
          }
      } else if (tenantId) {
          effectiveTenantId = String(tenantId);
      } else {
          showSnack(SNACK_MESSAGES.TENANT_ID_MISSING, 'error');
          setBatchDialogLoading(false);
          return;
      }
      
      if (effectiveTenantId) {
        headers['X-Tenant-ID'] = effectiveTenantId;
      }
      
      // Secure API call with audit logging
      const apiCall = async () => {
        if (editingBatch) {
          return await api.put(`/batches/${editingBatch.id}`, batchData, { headers });
        } else {
          return await api.post('/batches', batchData, { headers });
        }
      };
      
      await secureApiCall(
        apiCall,
        editingBatch ? AUDIT_ACTIONS.BATCH_UPDATED : AUDIT_ACTIONS.BATCH_CREATED,
        'batch',
        editingBatch?.id || null
      );
      
      showSnack(editingBatch ? SNACK_MESSAGES.BATCH_UPDATED : SNACK_MESSAGES.BATCH_CREATED, 'success');
      
      // Invalidate cache and refresh data
      apiCacheRef.current.delete(`batches_${selectedFacilityId}`);
      await fetchBatches(selectedFacilityId);
      handleCloseBatchDialog();
    } catch (err) {
      console.error('Error saving batch:', err.response?.data || err.message);
      const errorMessage = err.response?.data?.message || err.message;
      
      // Enhanced error handling with security logging
      if (err.response?.status === 422) {
        const errors = err.response?.data?.details;
        const firstError = errors ? Object.values(errors)[0][0] : errorMessage;
        showSnack(`${SNACK_MESSAGES.VALIDATION_ERROR} ${firstError}`, 'error');
      } else if (err.response?.status === 400) {
        showSnack(`${SNACK_MESSAGES.INVALID_DATA} ${errorMessage}`, 'error');
      } else if (err.response?.status === 403) {
        showSnack(SNACK_MESSAGES.PERMISSION_DENIED, 'error');
        // Log unauthorized access attempt
        const auditLog = createAuditLog(
          AUDIT_ACTIONS.UNAUTHORIZED_ACCESS,
          'batch',
          editingBatch?.id || null,
          users.find(u => u.current)?.id || null,
          { action: editingBatch ? 'update' : 'create', error: errorMessage }
        );
        auditLogRef.current.push(auditLog);
      } else if (err.message === 'Rate limit exceeded') {
        // Rate limit error already handled by secureApiCall
      } else {
        showSnack(`Error saving batch: ${errorMessage}`, 'error');
      }
    } finally {
      setBatchDialogLoading(false);
    }
  }, [validateBatchForm, showSnack, isGlobalAdmin, selectedFacilityId, tenantId, editingBatch, batchName, batchCurrentUnits, batchUnit, batchEndType, batchVariety, batchProductType, batchProjectedYield, batchAdvanceToHarvestingOn, batchCultivationAreaId, batchOriginType, batchOriginDetails, isPackaged, batchSubLocation, fetchBatches, handleCloseBatchDialog, secureApiCall, users]);
  const handleDeleteBatchConfirm = useCallback(async (batchToDelete) => {
    setLoading(true);
    const headers = {};
    let effectiveTenantId = null;
    
    if (isGlobalAdmin) {
      if (selectedFacilityId) {
          const selectedFac = facilitiesRef.current.find(f => f.id === selectedFacilityId);
          if (selectedFac && selectedFac.tenant_id) {
              effectiveTenantId = String(selectedFac.tenant_id);
          } else {
              showSnack('Error: As Super Admin, the selected facility does not have a valid Tenant ID to delete batches.', 'error');
              setLoading(false);
              setConfirmDialogOpen(false);
              return;
          }
      } else {
          showSnack('Error: As Super Admin, you must select a facility to delete batches.', 'error');
          setLoading(false);
          setConfirmDialogOpen(false);
          return;
      }
    } else if (tenantId) {
        effectiveTenantId = String(tenantId);
    } else {
        showSnack(SNACK_MESSAGES.TENANT_ID_MISSING, 'error');
        setLoading(false);
        setConfirmDialogOpen(false);
        return;
    }
    
    if (effectiveTenantId) {
      headers['X-Tenant-ID'] = effectiveTenantId;
    }
    
    try {
      await api.delete(`/batches/${batchToDelete.id}`, { headers });
      showSnack(SNACK_MESSAGES.BATCH_DELETED, 'info');
      
      // Invalidate cache and refresh data
      apiCacheRef.current.delete(`batches_${selectedFacilityId}`);
      await fetchBatches(selectedFacilityId);
    } catch (err) {
      console.error('Error deleting batch:', err.response?.data || err.message);
      const errorMessage = err.response?.data?.message || err.message;
      if (err.response?.status === 409) {
        // Show the specific message from the server (e.g., "This batch has X associated events...")
        showSnack(errorMessage || SNACK_MESSAGES.CANNOT_DELETE_BATCH_WITH_EVENTS, 'error');
      } else if (err.response?.status === 403) {
        showSnack(SNACK_MESSAGES.PERMISSION_DENIED, 'error');
      } else {
        showSnack(`Error deleting batch: ${errorMessage}`, 'error');
      }
    } finally {
      setLoading(false);
      setConfirmDialogOpen(false);
    }
  }, [fetchBatches, showSnack, isGlobalAdmin, selectedFacilityId, tenantId]);
  const handleDeleteBatchClick = useCallback((batchToDelete) => {
    setConfirmDialogData({
      title: DIALOG_TITLES.CONFIRM_BATCH_DELETION,
      message: `Are you sure you want to delete the batch "${batchToDelete.name}"? This will fail if it has associated traceability events.`,
      onConfirm: () => handleDeleteBatchConfirm(batchToDelete),
    });
    setConfirmDialogOpen(true);
  }, [handleDeleteBatchConfirm]);

  // --- State for Archive Dialog ---
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');
  const [batchToArchive, setBatchToArchive] = useState(null);

  // Handler to open archive dialog
  const handleOpenArchiveDialog = useCallback((batch) => {
    setBatchToArchive(batch);
    setArchiveReason('');
    setArchiveDialogOpen(true);
  }, []);

  // Handler to close archive dialog
  const handleCloseArchiveDialog = useCallback(() => {
    setArchiveDialogOpen(false);
    setBatchToArchive(null);
    setArchiveReason('');
  }, []);

  // Handler to archive a batch
  const handleArchiveBatch = useCallback(async () => {
    if (!batchToArchive || !archiveReason.trim()) {
      showSnack('Please provide a reason for archiving.', 'error');
      return;
    }
    
    setLoading(true);
    const headers = {};
    let effectiveTenantId = null;
    
    if (isGlobalAdmin) {
      if (selectedFacilityId) {
        const selectedFac = facilitiesRef.current.find(f => f.id === selectedFacilityId);
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
    
    try {
      await api.post(`/batches/${batchToArchive.id}/archive`, { reason: archiveReason }, { headers });
      showSnack('Batch archived successfully. All traceability data has been preserved.', 'success');
      
      // Invalidate cache and refresh data
      apiCacheRef.current.delete(`batches_${selectedFacilityId}`);
      await fetchBatches(selectedFacilityId);
      handleCloseArchiveDialog();
    } catch (err) {
      console.error('Error archiving batch:', err.response?.data || err.message);
      showSnack(`Error archiving batch: ${err.response?.data?.message || err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [batchToArchive, archiveReason, isGlobalAdmin, selectedFacilityId, tenantId, showSnack, fetchBatches, handleCloseArchiveDialog]);

  // Handler to restore an archived batch
  const handleRestoreBatch = useCallback(async (batch) => {
    setLoading(true);
    const headers = {};
    let effectiveTenantId = null;
    
    if (isGlobalAdmin) {
      if (selectedFacilityId) {
        const selectedFac = facilitiesRef.current.find(f => f.id === selectedFacilityId);
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
    
    try {
      await api.post(`/batches/${batch.id}/restore`, {}, { headers });
      showSnack('Batch restored successfully.', 'success');
      
      // Invalidate cache and refresh data
      apiCacheRef.current.delete(`batches_${selectedFacilityId}`);
      await fetchBatches(selectedFacilityId);
    } catch (err) {
      console.error('Error restoring batch:', err.response?.data || err.message);
      showSnack(`Error restoring batch: ${err.response?.data?.message || err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [isGlobalAdmin, selectedFacilityId, tenantId, showSnack, fetchBatches]);

  // --- Handlers for Batch Details and Traceability ---
  const handleOpenBatchDetail = useCallback(async (batch) => {
    setCurrentBatchDetail(batch);
    setSelectedBatchForTraceability('all');
    setOpenBatchDetailDialog(true);
    try {
        const events = await fetchTraceabilityEvents(batch.id);
        setTraceabilityEvents(events);
    } catch (error) {
        console.error('BatchManagementPage: Error loading traceability events:', error);
        showSnack('Error loading traceability events.', 'error');
    }
  }, [fetchTraceabilityEvents, showSnack]);
  const handleCloseBatchDetailDialog = useCallback(() => {
    setOpenBatchDetailDialog(false);
    setCurrentBatchDetail(null);
    setTraceabilityEvents([]);
    setSelectedBatchForTraceability('all');
  }, []);
  
  // Handler to delete a traceability event
  const handleDeleteTraceabilityEvent = useCallback((event) => {
    setConfirmDialogData({
      title: 'Confirm Event Deletion',
      message: `Are you sure you want to delete this ${event.event_type} event? This action cannot be undone.`,
      onConfirm: async () => {
        setLoading(true);
        try {
          const headers = {};
          let effectiveTenantId = tenantId;
          
          if (isGlobalAdmin && selectedFacilityId) {
            const selectedFacility = facilities.find(f => f.id === selectedFacilityId);
            if (selectedFacility?.tenant_id) {
              effectiveTenantId = selectedFacility.tenant_id;
            }
          }
          
          if (effectiveTenantId) {
            headers['X-Tenant-ID'] = effectiveTenantId;
          }
          
          // Determine the endpoint based on event source
          let endpoint = '';
          if (event.is_loss_theft_report || event.event_type === 'loss_theft') {
            // Loss/theft reports are in a separate table
            endpoint = `/loss-theft-reports/${event.id}`;
          } else {
            endpoint = `/traceability-events/${event.id}`;
          }
          
          await api.delete(endpoint, { headers });
          showSnack('Event deleted successfully.', 'success');
          
          // Refresh traceability events
          if (currentBatchDetail) {
            const events = await fetchTraceabilityEvents(currentBatchDetail.id);
            setTraceabilityEvents(events);
          }
          
          // Invalidate batch cache
          apiCacheRef.current.delete(`batches_${selectedFacilityId}`);
        } catch (err) {
          console.error('Error deleting event:', err.response?.data || err.message);
          showSnack(`Error deleting event: ${err.response?.data?.message || err.message}`, 'error');
        } finally {
          setLoading(false);
          setConfirmDialogOpen(false);
        }
      },
    });
    setConfirmDialogOpen(true);
  }, [tenantId, isGlobalAdmin, selectedFacilityId, facilities, showSnack, currentBatchDetail, fetchTraceabilityEvents]);

  // Handlers for event registration dialog
  const handleOpenRegisterEventDialog = useCallback((eventType, batchIdToPreselect = '') => {
    setCurrentEventType(eventType);
    setEventBatchId(batchIdToPreselect);
    setEventQuantity('');
    setEventUnit('');
    setEventDescription('');
    setEventFromLocation('');
    setEventToLocation('');
    setEventMethod('');
    setEventReason('');
    setEventNewBatchId('');
    setEventResponsibleUserId('');
    setOpenRegisterEventDialog(true);
  }, []);
  const handleCloseRegisterEventDialog = useCallback(() => {
    setOpenRegisterEventDialog(false);
    setCurrentEventType('');
    setEventDialogLoading(false);
  }, []);
  // --- ACTUALIZACIÓN: REGISTRO DE EVENTOS DE TRAZABILIDAD A LA API ---
  const handleRegisterEvent = async (e) => {
    e.preventDefault();
    if (!currentEventType) { showSnack(SNACK_MESSAGES.EVENT_TYPE_REQUIRED, 'warning'); return; }
    if (!eventBatchId) { showSnack(SNACK_MESSAGES.EVENT_BATCH_REQUIRED, 'warning'); return; }
    if (!eventResponsibleUserId) { showSnack("Responsible user is required.", 'warning'); return; }
    if (!selectedFacilityId) { showSnack("Facility ID is missing. Cannot register event.", 'error'); return; }
    
    // Get the selected batch to extract area_id
    const selectedBatch = batches.find(b => b.id === eventBatchId);
    if (!selectedBatch) {
      showSnack("Could not find the selected batch.", "error");
      return;
    }
    
    if (!selectedBatch.cultivation_area_id) {
      showSnack("Selected batch does not have a cultivation area assigned.", "warning");
      return;
    }

    let eventData = {
      batch_id: eventBatchId,
      event_type: currentEventType,
      user_id: eventResponsibleUserId,
      facility_id: selectedFacilityId,
      area_id: selectedBatch.cultivation_area_id,
      description: eventDescription,
    };
    switch (currentEventType) {
      case 'movement':
        if (!eventToLocation) { showSnack(SNACK_MESSAGES.EVENT_NEW_LOCATION_REQUIRED, "warning"); return; }
        eventData.from_location = eventFromLocation || null;
        eventData.to_location = eventToLocation;
        eventData.quantity = eventQuantity === '' ? null : parseFloat(eventQuantity);
        eventData.unit = eventUnit || null;
        break;
      case 'cultivation':
        if (!eventMethod.trim()) { showSnack("Cultivation method is required.", "warning"); return; }
        eventData.method = eventMethod;
        break;
      case 'harvest':
        if (eventQuantity === '' || isNaN(parseFloat(eventQuantity)) || parseFloat(eventQuantity) <= 0) { showSnack(SNACK_MESSAGES.EVENT_HARVEST_QUANTITY_REQUIRED, "warning"); return; }
        eventData.quantity = parseFloat(eventQuantity);
        eventData.unit = eventUnit || 'g';
        eventData.new_batch_id = eventNewBatchId || null;
        break;
      case 'sampling':
        if (eventQuantity === '' || isNaN(parseFloat(eventQuantity)) || parseFloat(eventQuantity) <= 0) { showSnack(SNACK_MESSAGES.EVENT_SAMPLING_QUANTITY_REQUIRED, "warning"); return; }
        if (!eventUnit.trim()) { showSnack("Sample unit is required.", "warning"); return; }
        if (!eventReason.trim()) { showSnack("Sampling reason is required.", "warning"); return; }
        eventData.quantity = parseFloat(eventQuantity);
        eventData.unit = eventUnit;
        eventData.reason = eventReason;
        break;
      case 'destruction':
        if (eventQuantity === '' || isNaN(parseFloat(eventQuantity)) || parseFloat(eventQuantity) <= 0) { showSnack(SNACK_MESSAGES.EVENT_DESTRUCTION_QUANTITY_REQUIRED, "warning"); return; }
        if (!eventUnit.trim()) { showSnack("Destruction unit is required.", "warning"); return; }
        if (!eventMethod.trim()) { showSnack("Destruction method is required.", "warning"); return; }
        if (!eventReason.trim()) { showSnack("Destruction reason is required.", "warning"); return; }
        eventData.quantity = parseFloat(eventQuantity);
        eventData.unit = eventUnit;
        eventData.method = eventMethod;
        eventData.reason = eventReason;
        break;
      case 'loss_theft':
        if (eventQuantity === '' || isNaN(parseFloat(eventQuantity)) || parseFloat(eventQuantity) <= 0) { showSnack(SNACK_MESSAGES.LOSS_THEFT_QUANTITY_REQUIRED, "warning"); return; }
        if (!eventUnit.trim()) { showSnack(SNACK_MESSAGES.LOSS_THEFT_UNIT_REQUIRED, "warning"); return; }
        if (!eventReason.trim()) { showSnack(SNACK_MESSAGES.LOSS_THEFT_REASON_REQUIRED, "warning"); return; }
        eventData.quantity = parseFloat(eventQuantity);
        eventData.unit = eventUnit;
        eventData.reason = eventReason;
        break;
      case 'processing':
        if (eventQuantity === '' || isNaN(parseFloat(eventQuantity)) || parseFloat(eventQuantity) <= 0) { showSnack(SNACK_MESSAGES.PROCESSED_QUANTITY_INVALID, "warning"); return; }
        if (!eventUnit.trim()) { showSnack("Processing unit is required.", "warning"); return; }
        if (!eventMethod.trim()) { showSnack("Processing method is required.", "warning"); return; }
        eventData.quantity = parseFloat(eventQuantity);
        eventData.unit = eventUnit;
        eventData.method = eventMethod;
        eventData.description = eventDescription;
        break;
      // NEW: Caso para ajuste de inventario
      case 'inventory_adjustment':
        if (eventQuantity === '' || isNaN(parseFloat(eventQuantity))) { showSnack("Adjustment quantity is required.", "warning"); return; }
        if (!eventUnit.trim()) { showSnack("Adjustment unit is required.", "warning"); return; }
        if (!eventReason.trim()) { showSnack("Adjustment reason is required.", "warning"); return; }
        eventData.quantity = parseFloat(eventQuantity);
        eventData.unit = eventUnit;
        eventData.reason = eventReason;
        break;
      default:
        break;
    }
    setEventDialogLoading(true);
    const headers = {};
    let effectiveTenantId = null;
    if (isGlobalAdmin) {
        if (selectedFacilityId) {
            const selectedFac = facilities.find(f => f.id === selectedFacilityId);
            if (selectedFac && selectedFac.tenant_id) {
                effectiveTenantId = String(selectedFac.tenant_id);
            } else {
                showSnack('Error: As Super Admin, the selected facility does not have a valid Tenant ID to register traceability events.', 'error');
                setEventDialogLoading(false);
                return;
            }
        } else {
            showSnack('Error: As Super Admin, you must select a facility to register traceability events.', 'error');
            setEventDialogLoading(false);
            return;
        }
    } else if (tenantId) {
        effectiveTenantId = String(tenantId);
    } else {
        showSnack(SNACK_MESSAGES.TENANT_ID_MISSING, 'error');
        setEventDialogLoading(false);
        return;
    }
    if (effectiveTenantId) {
      headers['X-Tenant-ID'] = effectiveTenantId;
    }
    try {
      // Validate and sanitize event data before sending
      const sanitizedEventData = {
        ...eventData,
        facility_id: parseInt(eventData.facility_id),
        area_id: parseInt(eventData.area_id),
        user_id: parseInt(eventData.user_id),
        batch_id: eventData.batch_id ? parseInt(eventData.batch_id) : null,
        quantity: eventData.quantity !== null && eventData.quantity !== undefined ? parseFloat(eventData.quantity) : null
      };

      // Remove empty strings and convert to null
      Object.keys(sanitizedEventData).forEach(key => {
        if (sanitizedEventData[key] === '') {
          sanitizedEventData[key] = null;
        }
      });

      console.log('Original event data:', eventData);
      console.log('Sanitized traceability event payload:', sanitizedEventData);
      
      await api.post('/traceability-events', sanitizedEventData, { headers });
      showSnack(SNACK_MESSAGES.EVENT_REGISTERED_SUCCESS, "success");
      
      // Invalidate cache and refresh data
      apiCacheRef.current.delete(`batches_${selectedFacilityId}`);
      await fetchBatches(selectedFacilityId);
      
      if (currentBatchDetail) {
        const updatedEvents = await fetchTraceabilityEvents(currentBatchDetail.id);
        setTraceabilityEvents(updatedEvents);
      }
      handleCloseRegisterEventDialog();
    } catch (error) {
      console.group('🚨 Traceability Event Error');
      console.error('Full error object:', error);
      console.error('HTTP Status:', error.response?.status);
      console.error('Response data:', error.response?.data);
      console.error('Original event data sent:', eventData);
      console.groupEnd();
      
      const errorMessage = error.response?.data?.message || error.message;
      
      if (error.response?.status === 422) {
        // Enhanced error handling for validation errors
        let detailedError = errorMessage;
        const details = error.response?.data?.details;
        
        if (details) {
          if (Array.isArray(details)) {
            const messages = details.map(err => err.msg || err.message || JSON.stringify(err));
            detailedError = `Validation errors: ${messages.join(', ')}`;
          } else if (typeof details === 'object') {
            const messages = Object.entries(details).map(([field, errors]) => 
              `${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`
            );
            detailedError = `Validation errors: ${messages.join('; ')}`;
          } else {
            detailedError = `Validation error: ${details}`;
          }
        } else if (error.response?.data?.message) {
          detailedError = `Validation error: ${error.response.data.message}`;
        }
        
        showSnack(detailedError, 'error');
        console.error('Detailed validation error:', detailedError);
      } else if (error.response?.status === 400) {
        showSnack(`${SNACK_MESSAGES.INVALID_DATA} ${errorMessage}`, 'error');
      } else if (error.response?.status === 403) {
        showSnack(SNACK_MESSAGES.PERMISSION_DENIED, 'error');
      } else {
        showSnack('Error registering event: ' + errorMessage, "error");
      }
    } finally {
      setEventDialogLoading(false);
    }
  };

  // --- Handlers for Batch Splitting ---
  const handleOpenSplitBatchDialog = useCallback((batch) => {
    setBatchToSplit(batch);
    setSplitQuantity('');
    setNewSplitBatchName(`${batch.name} - Split`);
    setSplitBatchCultivationAreaId(batch.cultivation_area_id || '');
    setNewSplitBatchProductType(batch.product_type || '');
    setOpenSplitBatchDialog(true);
    setSplitBatchDialogLoading(false);
  }, []);
  const handleCloseSplitBatchDialog = useCallback(() => {
    setOpenSplitBatchDialog(false);
    setBatchToSplit(null);
    setSplitQuantity('');
    setNewSplitBatchName('');
    setSplitBatchCultivationAreaId('');
    setNewSplitBatchProductType('');
    setSplitBatchDialogLoading(false);
  }, []);
  const handleSplitBatch = async (e) => {
    e.preventDefault();
    if (!batchToSplit) return;
    const quantity = parseFloat(splitQuantity);
    if (isNaN(quantity) || quantity <= 0 || quantity >= batchToSplit.current_units) {
      showSnack(SNACK_MESSAGES.SPLIT_QUANTITY_INVALID, 'warning');
      return;
    }
    if (!newSplitBatchName.trim()) {
      showSnack(SNACK_MESSAGES.NEW_BATCH_NAME_REQUIRED, 'warning');
      return;
    }
    if (!splitBatchCultivationAreaId) {
      showSnack(SNACK_MESSAGES.DESTINATION_AREA_REQUIRED, 'warning');
      return;
    }
    if (!newSplitBatchProductType.trim()) {
      showSnack(SNACK_MESSAGES.NEW_PRODUCT_TYPE_REQUIRED, 'warning');
      return;
    }
    setSplitBatchDialogLoading(true);
    const headers = {};
    let effectiveTenantId = null;
    if (isGlobalAdmin) {
        if (selectedFacilityId) {
            const selectedFac = facilities.find(f => f.id === selectedFacilityId);
            if (selectedFac && selectedFac.tenant_id) {
                effectiveTenantId = String(selectedFac.tenant_id);
            } else {
                showSnack('Error: As Super Admin, the selected facility does not have a valid Tenant ID to split batches.', 'error');
                setSplitBatchDialogLoading(false);
                return;
            }
        } else {
            showSnack('Error: As Super Admin, you must select a facility to split batches.', 'error');
            setSplitBatchDialogLoading(false);
            return;
        }
    } else if (tenantId) {
        effectiveTenantId = String(tenantId);
    } else {
        showSnack(SNACK_MESSAGES.TENANT_ID_MISSING, 'error');
        setSplitBatchDialogLoading(false);
        return;
    }
    if (effectiveTenantId) {
      headers['X-Tenant-ID'] = effectiveTenantId;
    }
    try {
      await api.post(`/batches/${batchToSplit.id}/split`, {
        splitQuantity: quantity,
        newBatchName: newSplitBatchName,
        newCultivationAreaId: splitBatchCultivationAreaId,
        newBatchProductType: newSplitBatchProductType,
      }, { headers });
      showSnack(SNACK_MESSAGES.BATCH_SPLIT_SUCCESS, 'success');
      await fetchBatches(selectedFacilityId);
      handleCloseSplitBatchDialog();
    } catch (err) {
      console.error('Error splitting batch:', err.response?.data || err.message);
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
        showSnack(`${SNACK_MESSAGES.BATCH_SPLIT_ERROR} ${errorMessage}`, 'error');
      }
    } finally {
      setSplitBatchDialogLoading(false);
    }
  };
  // --- Handlers for Batch Processing ---
  const handleOpenProcessBatchDialog = useCallback((batch) => {
    setBatchToProcess(batch);
    setProcessedQuantity(batch.current_units);
    setProcessMethod('');
    setProcessNotes('');
    setNewProductType(batch.product_type || '');
    setOpenProcessBatchDialog(true);
    setProcessBatchDialogLoading(false);
  }, []);
  const handleCloseProcessBatchDialog = useCallback(() => {
    setOpenProcessBatchDialog(false);
    setBatchToProcess(null);
    setProcessedQuantity('');
    setProcessMethod('');
    setProcessNotes('');
    setNewProductType('');
    setProcessBatchDialogLoading(false);
  }, []);
  const handleProcessBatch = async (e) => {
    e.preventDefault();
    if (!batchToProcess) return;
    const quantity = parseFloat(processedQuantity);
    if (isNaN(quantity) || quantity <= 0 || quantity > batchToProcess.current_units) {
      showSnack(SNACK_MESSAGES.PROCESSED_QUANTITY_INVALID, 'warning');
      return;
    }
    if (!processMethod.trim()) {
      showSnack(SNACK_MESSAGES.PROCESS_METHOD_REQUIRED, 'warning');
      return;
    }
    if (!newProductType.trim()) {
      showSnack(SNACK_MESSAGES.NEW_PRODUCT_TYPE_REQUIRED, 'warning');
      return;
    }
    setProcessBatchDialogLoading(true);
    const headers = {};
    let effectiveTenantId = null;
    if (isGlobalAdmin) {
        if (selectedFacilityId) {
            const selectedFac = facilities.find(f => f.id === selectedFacilityId);
            if (selectedFac && selectedFac.tenant_id) {
                effectiveTenantId = String(selectedFac.tenant_id);
            } else {
                showSnack('Error: As Super Admin, the selected facility does not have a valid Tenant ID to process batches.', 'error');
                setProcessBatchDialogLoading(false);
                return;
            }
        } else {
            showSnack('Error: As Super Admin, you must select a facility to process batches.', 'error');
            setProcessBatchDialogLoading(false);
            return;
        }
    } else if (tenantId) {
        effectiveTenantId = String(tenantId);
    } else {
        showSnack(SNACK_MESSAGES.TENANT_ID_MISSING, 'error');
        setProcessBatchDialogLoading(false);
        return;
    }
    if (effectiveTenantId) {
      headers['X-Tenant-ID'] = effectiveTenantId;
    }
    try {
      const processData = {
        processedQuantity: Number(processedQuantity),
        processMethod: processMethod,
        processDescription: processNotes,
        newProductType: newProductType,
        facility_id: selectedFacilityId,
      };
      console.log('Sending process batch payload:', processData);
      await api.post(`/batches/${batchToProcess.id}/process`, processData, { headers });
      showSnack(SNACK_MESSAGES.BATCH_PROCESSED_SUCCESS, 'success');
      await fetchBatches(selectedFacilityId);
      handleCloseProcessBatchDialog();
    } catch (err) {
      console.error('Error processing batch:', err.response?.data || err.message);
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
        showSnack(`${SNACK_MESSAGES.BATCH_PROCESSED_ERROR} ${errorMessage}`, 'error');
      }
    } finally {
      setProcessBatchDialogLoading(false);
    }
  };
  // --- Handlers for Registering External Batch ---
  const generateExternalBatchName = useCallback(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const datePrefix = `EXT-${year}${month}${day}`;
    
    // Find existing external batches with same date prefix to determine next sequence
    const existingBatchesWithPrefix = batches.filter(b => 
      b.name && b.name.startsWith(datePrefix)
    );
    
    let maxSequence = 0;
    existingBatchesWithPrefix.forEach(b => {
      const match = b.name.match(new RegExp(`^${datePrefix}-(\\d+)$`));
      if (match) {
        const seq = parseInt(match[1], 10);
        if (seq > maxSequence) maxSequence = seq;
      }
    });
    
    const nextSequence = String(maxSequence + 1).padStart(3, '0');
    return `${datePrefix}-${nextSequence}`;
  }, [batches]);

  const handleOpenExternalBatchDialog = useCallback(() => {
    setExternalBatchName(generateExternalBatchName());
    setExternalBatchUnits('');
    setExternalBatchUnit('g');
    setExternalBatchProductType('');
    setExternalBatchVariety('');
    setExternalBatchOriginDetails('');
    setExternalBatchCultivationAreaId('');
    setOpenExternalBatchDialog(true);
    setExternalBatchDialogLoading(false);
  }, [generateExternalBatchName]);
  const handleCloseExternalBatchDialog = useCallback(() => {
    setOpenExternalBatchDialog(false);
    setExternalBatchName('');
    setExternalBatchUnits('');
    setExternalBatchUnit('g');
    setExternalBatchProductType('');
    setExternalBatchVariety('');
    setExternalBatchOriginDetails('');
    setExternalBatchCultivationAreaId('');
    setExternalBatchDialogLoading(false);
  }, []);
  const handleSaveExternalBatch = async (e) => {
    e.preventDefault();
    if (!externalBatchName.trim()) { showSnack(SNACK_MESSAGES.BATCH_NAME_REQUIRED, 'warning'); return; }
    if (externalBatchUnits === '' || isNaN(parseFloat(externalBatchUnits))) { showSnack(SNACK_MESSAGES.BATCH_UNITS_REQUIRED, 'warning'); return; }
    if (!externalBatchUnit.trim()) { showSnack(SNACK_MESSAGES.BATCH_UNIT_REQUIRED, 'warning'); return; }
    if (!externalBatchProductType.trim()) { showSnack(SNACK_MESSAGES.BATCH_PRODUCT_TYPE_REQUIRED, 'warning'); return; }
    if (!externalBatchVariety.trim()) { showSnack(SNACK_MESSAGES.BATCH_VARIETY_REQUIRED, 'warning'); return; }
    if (!externalBatchCultivationAreaId) { showSnack(SNACK_MESSAGES.BATCH_AREA_REQUIRED, 'warning'); return; }
    if (!externalBatchOriginDetails.trim()) { showSnack('External origin details are required.', 'warning'); return; }

    setExternalBatchDialogLoading(true);
    const headers = {};
    let effectiveTenantId = null;
    if (isGlobalAdmin) {
        if (selectedFacilityId) {
            const selectedFac = facilities.find(f => f.id === selectedFacilityId);
            if (selectedFac && selectedFac.tenant_id) {
                effectiveTenantId = String(selectedFac.tenant_id);
            } else {
                showSnack('Error: As Super Admin, the selected facility does not have a valid Tenant ID to register external batches.', 'error');
                setExternalBatchDialogLoading(false);
                return;
            }
        } else {
            showSnack('Error: As Super Admin, you must select a facility to register external batches.', 'error');
            setExternalBatchDialogLoading(false);
            return;
        }
    } else if (tenantId) {
        effectiveTenantId = String(tenantId);
    } else {
        showSnack(SNACK_MESSAGES.TENANT_ID_MISSING, 'error');
        setExternalBatchDialogLoading(false);
        return;
    }
    if (effectiveTenantId) {
      headers['X-Tenant-ID'] = effectiveTenantId;
    }
    try {
      const batchData = {
        name: externalBatchName,
        current_units: parseFloat(externalBatchUnits),
        units: externalBatchUnit,
        product_type: externalBatchProductType,
        variety: externalBatchVariety,
        cultivation_area_id: externalBatchCultivationAreaId,
        origin_type: 'external_purchase',
        end_type: 'N/A',
        projected_yield: null,
        advance_to_harvesting_on: null,
        is_packaged: false,
        facility_id: selectedFacilityId,
        origin_details: externalBatchOriginDetails,
      };
      await api.post('/batches', batchData, { headers });
      showSnack(SNACK_MESSAGES.EXTERNAL_BATCH_CREATED, 'success');
      await fetchBatches(selectedFacilityId);
      handleCloseExternalBatchDialog();
    } catch (err) {
      console.error('Error registering external batch:', err.response?.data || err.message);
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
        showSnack(`${SNACK_MESSAGES.EXTERNAL_BATCH_ERROR} ${errorMessage}`, 'error');
      }
    } finally {
      setExternalBatchDialogLoading(false);
    }
  };

  // -------------------- NEW: HANDLERS PARA AJUSTE DE INVENTARIO --------------------
  const handleOpenAdjustmentDialog = useCallback((batch) => {
    setSelectedBatchForAdjustment(batch);
    setAdjustmentQuantity('');
    setAdjustmentUnit(batch.units || 'g');
    setAdjustmentReason('');
    setOpenAdjustmentDialog(true);
    setAdjustmentDialogLoading(false);
  }, []);

  const handleCloseAdjustmentDialog = useCallback(() => {
    setOpenAdjustmentDialog(false);
    setSelectedBatchForAdjustment(null);
    setAdjustmentQuantity('');
    setAdjustmentUnit('g');
    setAdjustmentReason('');
    setAdjustmentDialogLoading(false);
  }, []);

  const handleRegisterAdjustment = async (e) => {
    e.preventDefault();
    if (
      !selectedBatchForAdjustment ||
      adjustmentQuantity === '' ||
      isNaN(parseFloat(adjustmentQuantity)) ||
      !adjustmentUnit ||
      !adjustmentReason.trim()
    ) {
      showSnack(SNACK_MESSAGES.INVENTORY_ADJUSTMENT_REQUIRED, 'warning');
      return;
    }
    setAdjustmentDialogLoading(true);
    const headers = {};
    let effectiveTenantId = null;
    
    if (isGlobalAdmin) {
      if (selectedFacilityId) {
        const selectedFac = facilities.find(f => f.id === selectedFacilityId);
        if (selectedFac && selectedFac.tenant_id) {
          effectiveTenantId = String(selectedFac.tenant_id);
        } else {
          showSnack('Error: As Super Admin, the selected facility does not have a valid Tenant ID.', 'error');
          setAdjustmentDialogLoading(false);
          return;
        }
      } else {
        showSnack('Error: As Super Admin, you must select a facility.', 'error');
        setAdjustmentDialogLoading(false);
        return;
      }
    } else if (tenantId) {
      effectiveTenantId = String(tenantId);
    } else {
      showSnack(SNACK_MESSAGES.TENANT_ID_MISSING, 'error');
      setAdjustmentDialogLoading(false);
      return;
    }
    
    if (effectiveTenantId) {
      headers['X-Tenant-ID'] = effectiveTenantId;
    }

    try {
      // Sanitize the payload data to ensure correct data types
      const adjustmentPayload = {
        batch_id: parseInt(selectedBatchForAdjustment.id),
        event_type: 'inventory_adjustment',
        facility_id: parseInt(selectedFacilityId),
        area_id: parseInt(selectedBatchForAdjustment.cultivation_area_id),
        quantity: parseFloat(adjustmentQuantity),
        unit: adjustmentUnit,
        reason: adjustmentReason,
        sub_location: selectedBatchForAdjustment.sub_location || null,
        user_id: parseInt(eventResponsibleUserId || 1),
      };
      
      console.log('Sending sanitized inventory adjustment payload:', adjustmentPayload);
      await api.post('/traceability-events', adjustmentPayload, { headers });
      
      showSnack(SNACK_MESSAGES.INVENTORY_ADJUSTMENT_SUCCESS, 'success');
      
      // Invalidate cache and refresh data
      apiCacheRef.current.delete(`batches_${selectedFacilityId}`);
      await fetchBatches(selectedFacilityId);
      handleCloseAdjustmentDialog();
    } catch (err) {
      console.error('Error registering inventory adjustment:', err.response?.data || err.message);
      
      let errorMessage = err.response?.data?.message || err.message;
      
      if (err.response?.status === 422) {
        // Enhanced error handling for validation errors
        if (err.response?.data?.details) {
          const errors = err.response.data.details;
          if (Array.isArray(errors)) {
            errorMessage = errors.map(error => error.msg || error.message || JSON.stringify(error)).join(', ');
          } else if (typeof errors === 'object') {
            errorMessage = Object.values(errors).flat().join(', ');
          } else {
            errorMessage = JSON.stringify(errors);
          }
        }
        console.error('Validation error details:', err.response.data);
      }
      
      showSnack(`${SNACK_MESSAGES.INVENTORY_ADJUSTMENT_ERROR} ${errorMessage}`, 'error');
    } finally {
      setAdjustmentDialogLoading(false);
    }
  };
  // ------------------------------------------------------------------------

  // Render the specific form for each event type
  const renderEventForm = useCallback(() => {
    return (
      <Box component="form" onSubmit={handleRegisterEvent} sx={{ mt: 2 }}>
        <FormControl fullWidth margin="dense" sx={{ mb: 2 }}>
          <InputLabel sx={{ color: 'rgba(0,0,0,0.6)' }}>Affected Batch</InputLabel>
          <Select
            value={eventBatchId}
            onChange={(e) => setEventBatchId(e.target.value)}
            required
            sx={{
              color: '#1a202c',
              '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' },
              '.MuiSvgIcon-root': { color: '#1a202c' }
            }}
            MenuProps={{ PaperProps: { sx: { bgcolor: '#fff', color: '#1a202c' } } }}
            disabled={eventDialogLoading}
          >
            <MenuItem value=""><em>Select Batch</em></MenuItem>
            {batches.length === 0 ? (
              <MenuItem value="" disabled><em>No batches available</em></MenuItem>
            ) : (
              batches.map(batch => <MenuItem key={batch.id} value={batch.id}>{batch.name}</MenuItem>)
            )}
          </Select>
        </FormControl>
        <FormControl fullWidth margin="dense" sx={{ mb: 2 }}>
          <InputLabel sx={{ color: 'rgba(0,0,0,0.6)' }}>Event Type</InputLabel>
          <Select
            value={currentEventType}
            onChange={(e) => setCurrentEventType(e.target.value)}
            required
            sx={{
              color: '#1a202c',
              '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' },
              '.MuiSvgIcon-root': { color: '#1a202c' }
            }}
            MenuProps={{ PaperProps: { sx: { bgcolor: '#fff', color: '#1a202c' } } }}
            disabled={eventDialogLoading}
          >
            <MenuItem value=""><em>Select Event Type</em></MenuItem>
            {EVENT_TYPES.map((type) => (
              <MenuItem key={type.value} value={type.value}>
                <ListItemIcon sx={{ color: '#1a202c', minWidth: 36 }}>
                  {type.icon && <type.icon fontSize="small" />}
                </ListItemIcon>
                <ListItemText primary={type.label} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          margin="dense"
          label="Event Date"
          type="date"
          fullWidth
          value={formatDate(new Date())}
          InputLabelProps={{ shrink: true }}
          sx={{ mb: 2, '& .MuiInputBase-input': { color: '#1a202c' }, '& .MuiInputLabel-root': { color: 'rgba(0,0,0,0.6)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' } }}
          disabled={true}
        />
        {(currentEventType === 'movement') && (
          <>
            <TextField
              label="Quantity"
              type="number"
              value={eventQuantity}
              onChange={(e) => setEventQuantity(e.target.value)}
              fullWidth
              sx={{ mb: 2, '& .MuiInputBase-input': { color: '#1a202c' }, '& .MuiInputLabel-root': { color: 'rgba(0,0,0,0.6)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' } }}
              disabled={eventDialogLoading}
            />
            <FormControl fullWidth margin="dense" sx={{ mb: 2 }}>
              <InputLabel sx={{ color: 'rgba(0,0,0,0.6)' }}>Unit</InputLabel>
              <Select
                value={eventUnit}
                onChange={(e) => setEventUnit(e.target.value)}
                sx={{
                  color: '#1a202c',
                  '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' },
                  '.MuiSvgIcon-root': { color: '#1a202c' }
                }}
                MenuProps={{ PaperProps: { sx: { bgcolor: '#fff', color: '#1a202c' } } }}
                disabled={eventDialogLoading}
              >
                <MenuItem value=""><em>Select Unit</em></MenuItem>
                {UNIT_OPTIONS.map(unit => <MenuItem key={unit} value={unit}>{unit}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField
              label="From Location (e.g., 'Room2')"
              value={eventFromLocation}
              onChange={(e) => setEventFromLocation(e.target.value)}
              fullWidth
              sx={{ mb: 2, '& .MuiInputBase-input': { color: '#1a202c' }, '& .MuiInputLabel-root': { color: 'rgba(0,0,0,0.6)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' } }}
              disabled={eventDialogLoading}
            />
            <TextField
              label="To Location (e.g., 'Drying Area')"
              value={eventToLocation}
              onChange={(e) => setEventToLocation(e.target.value)}
              fullWidth
              required
              sx={{ mb: 2, '& .MuiInputBase-input': { color: '#1a202c' }, '& .MuiInputLabel-root': { color: 'rgba(0,0,0,0.6)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' } }}
              disabled={eventDialogLoading}
            />
          </>
        )}
        {currentEventType === 'cultivation' && (
          <TextField
            label="Method (e.g., Irrigation, Pruning, Application)"
            value={eventMethod}
            onChange={(e) => setEventMethod(e.target.value)}
            fullWidth
            required
            sx={{ mb: 2, '& .MuiInputBase-input': { color: '#1a202c' }, '& .MuiInputLabel-root': { color: 'rgba(0,0,0,0.6)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' } }}
            disabled={eventDialogLoading}
          />
        )}
        {currentEventType === 'harvest' && (
          <>
            <TextField
              label="Wet Weight (g)"
              type="number"
              value={eventQuantity}
              onChange={(e) => setEventQuantity(e.target.value)}
              fullWidth
              required
              sx={{ mb: 2, '& .MuiInputBase-input': { color: '#1a202c' }, '& .MuiInputLabel-root': { color: 'rgba(0,0,0,0.6)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' } }}
              disabled={eventDialogLoading}
            />
            <TextField
              label="New Harvest Batch ID (Optional)"
              value={eventNewBatchId}
              onChange={(e) => setEventNewBatchId(e.target.value)}
              fullWidth
              sx={{ mb: 2, '& .MuiInputBase-input': { color: '#1a202c' }, '& .MuiInputLabel-root': { color: 'rgba(0,0,0,0.6)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' } }}
              disabled={eventDialogLoading}
            />
          </>
        )}
        {currentEventType === 'sampling' && (
          <>
            <TextField
              label="Sample Quantity"
              type="number"
              value={eventQuantity}
              onChange={(e) => setEventQuantity(e.target.value)}
              fullWidth
              required
              sx={{ mb: 2, '& .MuiInputBase-input': { color: '#1a202c' }, '& .MuiInputLabel-root': { color: 'rgba(0,0,0,0.6)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' } }}
              disabled={eventDialogLoading}
            />
            <FormControl fullWidth margin="dense" sx={{ mb: 2 }}>
              <InputLabel sx={{ color: 'rgba(0,0,0,0.6)' }}>Sample Unit</InputLabel>
              <Select
                value={eventUnit}
                onChange={(e) => setEventUnit(e.target.value)}
                required
                sx={{
                  color: '#1a202c',
                  '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' },
                  '.MuiSvgIcon-root': { color: '#1a202c' }
                }}
                MenuProps={{ PaperProps: { sx: { bgcolor: '#fff', color: '#1a202c' } } }}
                disabled={eventDialogLoading}
              >
                <MenuItem value=""><em>Select Unit</em></MenuItem>
                {UNIT_OPTIONS.map(unit => <MenuItem key={unit} value={unit}>{unit}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField
              label="Purpose of Sampling"
              value={eventReason}
              onChange={(e) => setEventReason(e.target.value)}
              fullWidth
              sx={{ mb: 2, '& .MuiInputBase-input': { color: '#1a202c' }, '& .MuiInputLabel-root': { color: 'rgba(0,0,0,0.6)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' } }}
              disabled={eventDialogLoading}
            />
          </>
        )}
        {currentEventType === 'destruction' && (
          <>
            <TextField
              label="Quantity Destroyed"
              type="number"
              value={eventQuantity}
              onChange={(e) => setEventQuantity(e.target.value)}
              fullWidth
              required
              sx={{ mb: 2, '& .MuiInputBase-input': { color: '#1a202c' }, '& .MuiInputLabel-root': { color: 'rgba(0,0,0,0.6)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' } }}
              disabled={eventDialogLoading}
            />
            <FormControl fullWidth margin="dense" sx={{ mb: 2 }}>
              <InputLabel sx={{ color: 'rgba(0,0,0,0.6)' }}>Unit of Destruction</InputLabel>
              <Select
                value={eventUnit}
                onChange={(e) => setEventUnit(e.target.value)}
                required
                sx={{
                  color: '#1a202c',
                  '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' },
                  '.MuiSvgIcon-root': { color: '#1a202c' }
                }}
                MenuProps={{ PaperProps: { sx: { bgcolor: '#fff', color: '#1a202c' } } }}
                disabled={eventDialogLoading}
              >
                <MenuItem value=""><em>Select Unit</em></MenuItem>
                {UNIT_OPTIONS.map(unit => <MenuItem key={unit} value={unit}>{unit}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField
              label="Method of Destruction"
              value={eventMethod}
              onChange={(e) => setEventMethod(e.target.value)}
              fullWidth
              required
              sx={{ mb: 2, '& .MuiInputBase-input': { color: '#1a202c' }, '& .MuiInputLabel-root': { color: 'rgba(0,0,0,0.6)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' } }}
              disabled={eventDialogLoading}
            />
            <TextField
              label="Reason for Destruction"
              multiline
              rows={3}
              value={eventReason}
              onChange={(e) => setEventReason(e.target.value)}
              fullWidth
              required
              sx={{ mb: 2, '& .MuiInputBase-input': { color: '#1a202c' }, '& .MuiInputLabel-root': { color: 'rgba(0,0,0,0.6)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' } }}
              disabled={eventDialogLoading}
            />
          </>
        )}
        {currentEventType === 'loss_theft' && (
          <>
            <TextField
              label="Quantity Lost/Stolen"
              type="number"
              value={eventQuantity}
              onChange={(e) => setEventQuantity(e.target.value)}
              fullWidth
              required
              sx={{ mb: 2, '& .MuiInputBase-input': { color: '#1a202c' }, '& .MuiInputLabel-root': { color: 'rgba(0,0,0,0.6)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' } }}
              disabled={eventDialogLoading}
            />
            <FormControl fullWidth margin="dense" sx={{ mb: 2 }}>
              <InputLabel sx={{ color: 'rgba(0,0,0,0.6)' }}>Unit of Loss/Theft</InputLabel>
              <Select
                value={eventUnit}
                onChange={(e) => setEventUnit(e.target.value)}
                required
                sx={{
                  color: '#1a202c',
                  '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' },
                  '.MuiSvgIcon-root': { color: '#1a202c' }
                }}
                MenuProps={{ PaperProps: { sx: { bgcolor: '#fff', color: '#1a202c' } } }}
                disabled={eventDialogLoading}
              >
                <MenuItem value=""><em>Select Unit</em></MenuItem>
                {UNIT_OPTIONS.map(unit => <MenuItem key={unit} value={unit}>{unit}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField
              label="Reason for Loss/Theft"
              multiline
              rows={3}
              value={eventReason}
              onChange={(e) => setEventReason(e.target.value)}
              fullWidth
              required
              sx={{ mb: 2, '& .MuiInputBase-input': { color: '#1a202c' }, '& .MuiInputLabel-root': { color: 'rgba(0,0,0,0.6)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' } }}
              disabled={eventDialogLoading}
            />
          </>
        )}
        {currentEventType === 'processing' && (
          <>
            <TextField
              label="Processed Quantity (g)"
              type="number"
              value={eventQuantity}
              onChange={(e) => setEventQuantity(e.target.value)}
              fullWidth
              required
              inputProps={{ min: 0, step: "any" }}
              InputLabelProps={{ shrink: true }}
              sx={{ mb: 2, '& .MuiInputBase-input': { color: '#1a202c' }, '& .MuiInputLabel-root': { color: 'rgba(0,0,0,0.6)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' } }}
              disabled={eventDialogLoading}
            />
            <FormControl fullWidth margin="dense" sx={{ mb: 2 }}>
              <InputLabel sx={{ color: 'rgba(0,0,0,0.6)' }}>Unit</InputLabel>
              <Select
                value={eventUnit}
                onChange={(e) => setEventUnit(e.target.value)}
                required
                sx={{
                  color: '#1a202c',
                  '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' },
                  '.MuiSvgIcon-root': { color: '#1a202c' }
                }}
                MenuProps={{ PaperProps: { sx: { bgcolor: '#fff', color: '#1a202c' } } }}
                disabled={eventDialogLoading}
              >
                <MenuItem value=""><em>Select Unit</em></MenuItem>
                {UNIT_OPTIONS.map(unit => <MenuItem key={unit} value={unit}>{unit}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField
              label="Method"
              type="text"
              fullWidth
              value={eventMethod}
              onChange={(e) => setEventMethod(e.target.value)}
              required
              InputLabelProps={{ shrink: true }}
              sx={{ mb: 2, '& .MuiInputBase-input': { color: '#1a202c' }, '& .MuiInputLabel-root': { color: 'rgba(0,0,0,0.6)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' } }}
              disabled={eventDialogLoading}
            />
          </>
        )}
        <TextField
          margin="dense"
          label="Notes"
          type="text"
          fullWidth
          multiline
          rows={2}
          value={eventDescription}
          onChange={(e) => setEventDescription(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ mb: 2, '& .MuiInputBase-input': { color: '#1a202c' }, '& .MuiInputLabel-root': { color: 'rgba(0,0,0,0.6)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' } }}
          disabled={eventDialogLoading}
        />
        <FormControl fullWidth margin="dense" sx={{ mb: 2 }}>
          <InputLabel sx={{ color: 'rgba(0,0,0,0.6)' }}>Responsible User</InputLabel>
          <Select
            value={eventResponsibleUserId}
            onChange={(e) => setEventResponsibleUserId(e.target.value)}
            required
            sx={{
              color: '#1a202c',
              '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' },
              '.MuiSvgIcon-root': { color: '#1a202c' }
            }}
            MenuProps={{ PaperProps: { sx: { bgcolor: '#fff', color: '#1a202c' } } }}
            disabled={eventDialogLoading}
          >
            <MenuItem value=""><em>Select Responsible User</em></MenuItem>
            {users.map(user => <MenuItem key={user.id} value={user.id}>{user.name}</MenuItem>)}
          </Select>
        </FormControl>
        <DialogActions sx={{ bgcolor: '#f8fafc', mt: 2 }}>
          <Button onClick={handleCloseRegisterEventDialog} disabled={eventDialogLoading} sx={{ color: '#64748b' }}>{BUTTON_LABELS.CANCEL}</Button>
          <Button
            type="submit"
            variant="contained"
            disabled={eventDialogLoading || isFacilityOperator || !currentEventType || !eventBatchId || !eventResponsibleUserId ||
              ((currentEventType === 'movement' && !eventToLocation) ||
                ((currentEventType === 'harvest' || currentEventType === 'sampling' || currentEventType === 'destruction' || currentEventType === 'loss_theft' || currentEventType === 'processing') && (eventQuantity === '' || isNaN(parseFloat(eventQuantity)) || parseFloat(eventQuantity) <= 0)) ||
                (currentEventType === 'loss_theft' && (!eventUnit.trim() || !eventReason.trim())) ||
                (currentEventType === 'destruction' && (!eventUnit.trim() || !eventMethod.trim() || !eventReason.trim())) ||
                (currentEventType === 'sampling' && !eventReason.trim()) ||
                (currentEventType === 'cultivation' && !eventMethod.trim()) ||
                (currentEventType === 'processing' && (!eventMethod.trim() || eventQuantity === '' || isNaN(parseFloat(eventQuantity)) || parseFloat(eventQuantity) <= 0))
              )}
            sx={{
              bgcolor: '#4CAF50',
              '&:hover': { bgcolor: '#43A047' }
            }}
          >
            {eventDialogLoading ? <CircularProgress size={24} /> : BUTTON_LABELS.REGISTER}
          </Button>
        </DialogActions>
      </Box>
    );
  }, [currentEventType, eventBatchId, eventQuantity, eventUnit, eventDescription, eventFromLocation, eventToLocation, eventMethod, eventReason, eventNewBatchId, handleRegisterEvent, handleCloseRegisterEventDialog, batches, users, eventDialogLoading, isFacilityOperator, showSnack, selectedFacilityId, batchCultivationAreaId]);
  // Optimized filtering with memoization and performance improvements
  const filteredAndCleanedBatches = useMemo(() => {
    // Use cached data if available
    const currentBatches = batchesRef.current.length > 0 ? batchesRef.current : batches;
    
    let result = currentBatches;
    
    // Apply filters efficiently
    if (filterProductType || filterCultivationAreaId || searchTerm) {
      result = currentBatches.filter(batch => {
        if (!batch || typeof batch.id === 'undefined' || batch.id === null) {
          return false;
        }
        
        // Product type filter
        if (filterProductType && batch.product_type !== filterProductType) {
          return false;
        }
        
        // Cultivation area filter
        if (filterCultivationAreaId && batch.cultivation_area_id !== parseInt(filterCultivationAreaId)) {
          return false;
        }
        
        // Search term filter
        if (searchTerm) {
          const lowerCaseSearchTerm = searchTerm.toLowerCase();
          const searchableFields = [
            batch.name,
            batch.variety,
            batch.product_type,
            batch.origin_details
          ].filter(Boolean); // Remove null/undefined values
          
          const matchesSearch = searchableFields.some(field => 
            field.toLowerCase().includes(lowerCaseSearchTerm)
          );
          
          if (!matchesSearch) {
            return false;
          }
        }
        
        return true;
      });
    } else {
      // If no filters, just clean the data
      result = currentBatches.filter(batch => 
        batch && typeof batch.id !== 'undefined' && batch.id !== null
      );
    }
    
    // Apply sorting
    result = [...result].sort((a, b) => {
      let aValue = a[orderBy];
      let bValue = b[orderBy];
      
      // Handle null/undefined values
      if (aValue == null) aValue = '';
      if (bValue == null) bValue = '';
      
      // Convert to lowercase for string comparison
      if (typeof aValue === 'string') aValue = aValue.toLowerCase();
      if (typeof bValue === 'string') bValue = bValue.toLowerCase();
      
      if (order === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
    
    console.log("Cleaned batches for Table:", result);
    return result;
  }, [batches, filterProductType, filterCultivationAreaId, searchTerm, orderBy, order]);
  
  // Total count for pagination
  const totalCount = filteredAndCleanedBatches.length;
  
  // Paginated batches for display
  const paginatedBatches = useMemo(() => {
    const startIndex = page * rowsPerPage;
    return filteredAndCleanedBatches.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredAndCleanedBatches, page, rowsPerPage]);
  
  // Table sorting handler
  const handleSort = useCallback((property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  }, [orderBy, order]);
  
  // Pagination handlers
  const handleChangePage = useCallback((event, newPage) => {
    setPage(newPage);
  }, []);
  
  const handleChangeRowsPerPage = useCallback((event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  }, []);
  
  // Clear filters handler
  const handleClearFilters = useCallback(() => {
    setSearchTerm('');
    setFilterProductType('');
    setFilterCultivationAreaId('');
    setPage(0);
  }, []);
  // Currently unused but kept for potential future use
  // const handleClearFilters = useCallback(() => {
  //   setSearchTerm("");
  //   setFilterProductType("");
  //   setFilterCultivationAreaId("");
  // }, []);
  // Definition of columns for DataGrid - Optimized with memoization
  const columns = useMemo(() => {
    // Cache the cultivation areas and stages maps for better performance
    const cultivationAreasMap = new Map(
      (cultivationAreasRef.current.length > 0 ? cultivationAreasRef.current : cultivationAreas)
        .map(area => [area.id, area])
    );
    const stagesMap = new Map(
      (stagesRef.current.length > 0 ? stagesRef.current : stages)
        .map(stage => [stage.id, stage])
    );
    
    return [
      { field: 'name', headerName: 'Batch Name', flex: 1, minWidth: 150, renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography 
            variant="body2" 
            sx={{ 
              color: params.row.is_archived ? '#9ca3af' : '#1a202c',
              fontStyle: params.row.is_archived ? 'italic' : 'normal',
            }}
          >
            {params.value}
          </Typography>
          {params.row.is_archived && (
            <Chip 
              label="Archived" 
              size="small" 
              sx={{ 
                bgcolor: 'rgba(255, 152, 0, 0.2)', 
                color: '#ff9800', 
                fontSize: '0.65rem',
                height: 20,
              }} 
            />
          )}
        </Box>
      )},
      { field: 'variety', headerName: 'Variety', width: 100, renderCell: (params) => (
        <Typography variant="body2" sx={{ color: '#1a202c' }}>{params.value}</Typography>
      )},
      { field: 'product_type', headerName: 'Product Type', width: 150, renderCell: (params) => (
        <Typography variant="body2" sx={{ color: '#1a202c' }}>{params.value || 'N/A'}</Typography>
      )},
      { field: 'current_units', headerName: 'Units', type: 'number', width: 95, renderCell: (params) => (
        <Typography variant="body2" sx={{ color: '#1a202c' }}>{params.value} {params.row?.units}</Typography>
      )},
      { field: 'end_type', headerName: 'End Type', width: 95, renderCell: (params) => (
        <Typography variant="body2" sx={{ color: '#1a202c' }}>{params.value}</Typography>
      )},
      {
        field: 'projected_yield',
        headerName: 'Projected Yield',
        type: 'number',
        width: 140,
        renderCell: (params) => (
          <Typography variant="body2" sx={{ color: '#1a202c' }}>
            {params.value !== null && params.value !== undefined ? `${params.value} kg` : 'N/A'}
          </Typography>
        )
      },
      {
        field: 'advance_to_harvesting_on',
        headerName: 'Harvest Date',
        width: 120,
        renderCell: (params) => (
          <Typography variant="body2" sx={{ color: '#1a202c' }}>
            {params.value ? new Date(params.value).toLocaleDateString() : 'N/A'}
          </Typography>
        )
      },
      {
        field: 'cultivation_area_name',
        headerName: 'Cultivation Area',
        flex: 1, minWidth: 150,
        valueGetter: (params) => {
          if (!params || !params.row || params.row.cultivation_area_id == null) {
              return '';
          }
          const area = cultivationAreasMap.get(params.row.cultivation_area_id);
          return area ? area.name : '';
        },
        renderCell: (params) => (
          <Typography variant="body2" sx={{ color: '#1a202c' }}>{params.value}</Typography>
        )
      },
      {
        field: 'current_stage_name',
        headerName: 'Current Stage',
        width: 120,
        valueGetter: (params) => {
          if (!params || !params.row || params.row.cultivation_area_id == null) {
              return '';
          }
          const area = cultivationAreasMap.get(params.row.cultivation_area_id);
          if (area && area.current_stage_id != null) {
              const stage = stagesMap.get(area.current_stage_id);
              return stage ? stage.name : 'N/A';
          }
          return 'N/A';
        },
        renderCell: (params) => (
          <Typography variant="body2" sx={{ color: '#1a202c' }}>{params.value}</Typography>
        )
      },
      {
        field: 'is_packaged',
        headerName: 'Packaged',
        width: 100,
        type: 'boolean',
        renderCell: (params) => (
          <Typography variant="body2" sx={{ color: '#1a202c' }}>{params.value ? 'Yes' : 'No'}</Typography>
        )
      },
      {
        field: 'sub_location',
        headerName: 'Sub-location',
        width: 140,
        renderCell: (params) => (
          <Typography variant="body2" sx={{ color: '#1a202c' }}>
            {params.value || '—'}
          </Typography>
        )
      },
      {
        field: 'actions',
        headerName: 'Actions',
        width: 300,
        sortable: false,
        filterable: false,
        renderCell: (params) => (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton
              size="small"
              color="info"
              onClick={() => handleOpenBatchDetail(params.row)}
              aria-label={`View details of ${params.row.name}`}
            >
              <VisibilityIcon sx={{ fontSize: 20, color: '#90caf9' }} />
            </IconButton>
            <IconButton
              size="small"
              color="primary"
              onClick={() => handleOpenBatchDialog(params.row)}
              aria-label={`Edit ${params.row.name}`}
              disabled={isFacilityOperator || params.row.is_archived}
              title="Edit Batch"
            >
              <EditIcon sx={{ fontSize: 20, color: isFacilityOperator || params.row.is_archived ? '#666' : '#fff' }} />
            </IconButton>
            <IconButton
              size="small"
              color="secondary"
              onClick={() => handleOpenSplitBatchDialog(params.row)}
              aria-label={`Split ${params.row.name}`}
              disabled={isFacilityOperator || params.row.current_units <= 1 || params.row.is_archived}
              title="Split Batch"
            >
              <CallSplitIcon sx={{ fontSize: 20, color: isFacilityOperator || params.row.current_units <= 1 || params.row.is_archived ? '#666' : '#ffa726' }} />
            </IconButton>
            <IconButton
              size="small"
              color="success"
              onClick={() => handleOpenProcessBatchDialog(params.row)}
              aria-label={`Process ${params.row.name}`}
              disabled={isFacilityOperator || params.row.current_units <= 0 || params.row.is_archived}
              title="Process Batch"
            >
              <TransformIcon sx={{ fontSize: 20, color: isFacilityOperator || params.row.current_units <= 0 || params.row.is_archived ? '#666' : '#4CAF50' }} />
            </IconButton>
            
            <IconButton
              size="small"
              color="primary"
              onClick={() => handleOpenAdjustmentDialog(params.row)}
              aria-label={`Inventory Adjustment for ${params.row.name}`}
              disabled={isFacilityOperator || params.row.is_archived}
              title="Inventory Adjustment"
            >
              <AddBoxIcon sx={{ fontSize: 20, color: isFacilityOperator || params.row.is_archived ? '#666' : '#4CAF50' }} />
            </IconButton>
            
            {/* Archive/Restore Button */}
            {params.row.is_archived ? (
              <IconButton
                size="small"
                onClick={() => handleRestoreBatch(params.row)}
                aria-label={`Restore ${params.row.name}`}
                disabled={isFacilityOperator}
                title="Restore Batch"
                sx={{ color: '#4CAF50' }}
              >
                <RestoreIcon sx={{ fontSize: 20 }} />
              </IconButton>
            ) : (
              <IconButton
                size="small"
                onClick={() => handleOpenArchiveDialog(params.row)}
                aria-label={`Archive ${params.row.name}`}
                disabled={isFacilityOperator}
                title="Archive Batch (preserves traceability)"
                sx={{ color: '#ff9800' }}
              >
                <ArchiveIcon sx={{ fontSize: 20 }} />
              </IconButton>
            )}
            
            <IconButton
              size="small"
              color="error"
              onClick={() => handleDeleteBatchClick(params.row)}
              aria-label={`Delete ${params.row.name}`}
              disabled={isFacilityOperator}
              title="Delete Batch (fails if has events/reports)"
            >
              <DeleteIcon sx={{ fontSize: 20, color: isFacilityOperator ? '#666' : '#f44336' }} />
            </IconButton>
          </Box>
        ),
      },
    ];
  }, [handleOpenBatchDetail, handleOpenBatchDialog, handleDeleteBatchClick, handleOpenSplitBatchDialog, handleOpenProcessBatchDialog, isFacilityOperator, cultivationAreas, stages, handleOpenAdjustmentDialog, handleOpenArchiveDialog, handleRestoreBatch]);
  
  // Function to get dynamic label and placeholder for origin_details
  const getOriginDetailsLabel = useCallback(() => {
    switch (batchOriginType) {
      case 'seeds':
        return { label: 'Seed Provider / Seed Lot', placeholder: 'Ex: Green Genetics Lot #XYZ' };
      case 'clones':
        return { label: 'Mother Plant ID', placeholder: 'Ex: Mother #123' };
      case 'tissue_culture':
        return { label: 'Lab / Tissue Lot', placeholder: 'Ex: BioLab Lot TC-456' };
      case 'external':
        return { label: 'External Provider / External Lot ID', placeholder: 'Ex: FarmCo Lot #ABC' };
      default:
        return { label: 'Origin Details', placeholder: 'Additional information about the origin' };
    }
  }, [batchOriginType]);
  // Function to get dynamic label and placeholder for externalBatchOriginDetails
  const getExternalOriginDetailsLabel = useCallback(() => {
    return { label: 'External Origin Details', placeholder: 'Ex: Provider name, invoice number, import lot' };
  }, []);

  return (
    <Box sx={{ p: 0 }}>
      {/* Header - Compact style like Accounts */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <InventoryIcon sx={{ fontSize: 24, color: '#1976d2' }} />
          <Typography variant="h6" fontWeight="bold">Batch Management</Typography>
          <Chip label={totalCount} size="small" color="primary" />
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh">
            <IconButton onClick={() => fetchBatches(selectedFacilityId)} disabled={loading} size="small">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => handleOpenBatchDialog(null)}
            disabled={loading || isFacilityOperator || !selectedFacilityId}
            sx={{ textTransform: 'none', bgcolor: '#4CAF50', '&:hover': { bgcolor: '#43A047' } }}
          >
            {BUTTON_LABELS.ADD_NEW_BATCH}
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={<LocalShippingIcon />}
            onClick={handleOpenExternalBatchDialog}
            disabled={loading || isFacilityOperator || !selectedFacilityId}
            sx={{ textTransform: 'none', bgcolor: '#007bff', '&:hover': { bgcolor: '#0056b3' } }}
          >
            {BUTTON_LABELS.REGISTER_EXTERNAL_BATCH}
          </Button>
        </Box>
      </Box>

      {/* Filters - Same style as Accounts */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Search by name, variety..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ minWidth: 250 }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment>,
            }}
          />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Facility</InputLabel>
            <Select
              value={selectedFacilityId}
              label="Facility"
              onChange={(e) => { setSelectedFacilityId(e.target.value); setPage(0); }}
              disabled={loading || facilities.length === 0 || isFacilityOperator}
            >
              {facilities.length === 0 && !loading ? (
                <MenuItem value=""><em>No facilities</em></MenuItem>
              ) : (
                facilities.map((facility) => (
                  <MenuItem key={facility.id} value={facility.id}>{facility.name}</MenuItem>
                ))
              )}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Product Type</InputLabel>
            <Select
              value={filterProductType}
              label="Product Type"
              onChange={(e) => { setFilterProductType(e.target.value); setPage(0); }}
            >
              <MenuItem value="">All Types</MenuItem>
              {HEALTH_CANADA_PRODUCT_TYPES.map((type) => (
                <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Area</InputLabel>
            <Select
              value={filterCultivationAreaId}
              label="Area"
              onChange={(e) => { setFilterCultivationAreaId(e.target.value); setPage(0); }}
            >
              <MenuItem value="">All Areas</MenuItem>
              {cultivationAreas.map((area) => (
                <MenuItem key={area.id} value={area.id}>{area.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            size="small"
            startIcon={<FilterListIcon />}
            onClick={handleClearFilters}
          >
            Clear Filters
          </Button>
        </Box>
      </Paper>

      {/* Batches Table - Same style as SKUs */}
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
                  Batch Name
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'variety'}
                  direction={orderBy === 'variety' ? order : 'asc'}
                  onClick={() => handleSort('variety')}
                >
                  Variety
                </TableSortLabel>
              </TableCell>
              <TableCell>Product Type</TableCell>
              <TableCell align="right">Units</TableCell>
              <TableCell>End Type</TableCell>
              <TableCell align="right">Projected Yield</TableCell>
              <TableCell>Harvest Date</TableCell>
              <TableCell>Cultivation Area</TableCell>
              <TableCell>Current Stage</TableCell>
              <TableCell align="center">Packaged</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={11} align="center" sx={{ py: 4 }}><CircularProgress size={24} /></TableCell>
              </TableRow>
            ) : paginatedBatches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    {!selectedFacilityId ? 'Please select a facility to view batches' : 'No batches found'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              paginatedBatches.map((batch) => {
                const area = cultivationAreas.find(a => a.id === batch.cultivation_area_id);
                const stage = area ? stages.find(s => s.id === area.current_stage_id) : null;
                return (
                  <TableRow key={batch.id} hover>
                    <TableCell><Typography fontWeight="medium">{batch.name}</Typography></TableCell>
                    <TableCell>{batch.variety || '-'}</TableCell>
                    <TableCell>{batch.product_type || '-'}</TableCell>
                    <TableCell align="right">{batch.current_units} {batch.units}</TableCell>
                    <TableCell>{batch.end_type || '-'}</TableCell>
                    <TableCell align="right">
                      {batch.projected_yield != null ? `${batch.projected_yield} kg` : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {batch.advance_to_harvesting_on 
                        ? new Date(batch.advance_to_harvesting_on).toLocaleDateString() 
                        : 'N/A'}
                    </TableCell>
                    <TableCell>{area?.name || '-'}</TableCell>
                    <TableCell>{stage?.name || 'N/A'}</TableCell>
                    <TableCell align="center">{batch.is_packaged ? 'Yes' : 'No'}</TableCell>
                    <TableCell align="center">
                      <Tooltip title="View Details">
                        <IconButton size="small" onClick={() => handleOpenBatchDetail(batch)}>
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => handleOpenBatchDialog(batch)} disabled={isFacilityOperator || batch.is_archived}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Split Batch">
                        <IconButton 
                          size="small" 
                          onClick={() => handleOpenSplitBatchDialog(batch)} 
                          disabled={isFacilityOperator || batch.current_units <= 1 || batch.is_archived}
                        >
                          <CallSplitIcon fontSize="small" color="warning" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Process Batch">
                        <IconButton 
                          size="small" 
                          onClick={() => handleOpenProcessBatchDialog(batch)} 
                          disabled={isFacilityOperator || batch.current_units <= 0 || batch.is_archived}
                        >
                          <TransformIcon fontSize="small" color="success" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Inventory Adjustment">
                        <IconButton size="small" onClick={() => handleOpenAdjustmentDialog(batch)} disabled={isFacilityOperator || batch.is_archived}>
                          <AddBoxIcon fontSize="small" color="success" />
                        </IconButton>
                      </Tooltip>
                      {/* Archive/Restore Button */}
                      {batch.is_archived ? (
                        <Tooltip title="Restore Batch">
                          <IconButton 
                            size="small" 
                            onClick={() => handleRestoreBatch(batch)} 
                            disabled={isFacilityOperator}
                            sx={{ color: '#4CAF50' }}
                          >
                            <RestoreIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        <Tooltip title="Archive Batch (preserves traceability)">
                          <IconButton 
                            size="small" 
                            onClick={() => handleOpenArchiveDialog(batch)} 
                            disabled={isFacilityOperator}
                            sx={{ color: '#ff9800' }}
                          >
                            <ArchiveIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Delete (fails if has events/reports)">
                        <IconButton size="small" color="error" onClick={() => handleDeleteBatchClick(batch)} disabled={isFacilityOperator}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })
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
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </TableContainer>

      {/* --- Add/Edit Batch Dialog --- */}
      <Dialog open={openBatchDialog} onClose={handleCloseBatchDialog} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: '#fff', color: '#1a202c', borderRadius: 2 } }}
      >
        <DialogTitle sx={{ bgcolor: '#fff', color: '#1a202c', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e0e0e0' }}>
          {editingBatch ? DIALOG_TITLES.EDIT_BATCH : DIALOG_TITLES.ADD_BATCH}
          <IconButton onClick={handleCloseBatchDialog} sx={{ color: '#64748b' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <form onSubmit={handleSaveBatch}>
          <DialogContent sx={{ pt: '20px !important' }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 2 }}>
              <TextField
                autoFocus
                margin="dense"
                label="Batch Name"
                type="text"
                fullWidth
                value={batchName}
                onChange={e => {
                  const sanitized = sanitizeInput(e.target.value);
                  setBatchName(sanitized);
                  if (sanitized !== e.target.value) {
                    showSnack(SNACK_MESSAGES.SECURITY_INPUT_SANITIZED, 'info');
                  }
                }}
                required
                error={!!validationErrors.batchName}
                helperText={validationErrors.batchName || (!editingBatch ? 'Auto-generated. You can modify if needed.' : '')}
                inputProps={{ maxLength: SECURITY_RULES.BATCH_NAME_MAX_LENGTH }}
                InputLabelProps={{ shrink: true }}
                disabled={batchDialogLoading || isFacilityOperator}
              />
              {!editingBatch && (
                <Tooltip title="Generate new name">
                  <IconButton 
                    onClick={() => setBatchName(generateBatchName())}
                    disabled={batchDialogLoading || isFacilityOperator}
                    sx={{ mt: 1.5 }}
                  >
                    <RefreshIcon />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
            
            {/* Cultivation Area - FIRST to show available capacity */}
            <FormControl fullWidth margin="dense" sx={{ mb: 1 }}>
              <InputLabel sx={{ color: 'rgba(0,0,0,0.6)' }}>Cultivation Area *</InputLabel>
              <Select
                value={batchCultivationAreaId}
                onChange={e => setBatchCultivationAreaId(e.target.value)}
                required
                label="Cultivation Area *"
                sx={{
                  color: '#1a202c',
                  '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' },
                  '.MuiSvgIcon-root': { color: '#1a202c' }
                }}
                MenuProps={{ PaperProps: { sx: { bgcolor: '#fff', color: '#1a202c' } } }}
                disabled={batchDialogLoading || isFacilityOperator}
              >
                <MenuItem value=""><em>Select Area</em></MenuItem>
                {cultivationAreas.length === 0 ? (
                  <MenuItem value="" disabled><em>No cultivation areas available in the selected facility</em></MenuItem>
                ) : (
                  cultivationAreas.map(area => {
                    const capacity = getAreaAvailableCapacity(area.id);
                    return (
                      <MenuItem key={area.id} value={area.id}>
                        {area.name} ({stages.find(s => s.id === area.current_stage_id)?.name || 'No Stage'})
                        {capacity && ` - Available: ${capacity.available.toFixed(0)} ${capacity.unit}`}
                      </MenuItem>
                    );
                  })
                )}
              </Select>
            </FormControl>
            
            {/* Show capacity info when area is selected */}
            {batchCultivationAreaId && (() => {
              const capacity = getAreaAvailableCapacity(batchCultivationAreaId);
              if (capacity) {
                return (
                  <Box sx={{ 
                    mb: 2, 
                    p: 1.5, 
                    bgcolor: capacity.available > 0 ? '#e8f5e9' : '#ffebee', 
                    borderRadius: 1,
                    border: `1px solid ${capacity.available > 0 ? '#4CAF50' : '#f44336'}`
                  }}>
                    <Typography variant="body2" sx={{ color: '#1a202c', fontWeight: 500 }}>
                      📊 Area Capacity: {capacity.total.toFixed(0)} {capacity.unit}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#666' }}>
                      Used: {capacity.used.toFixed(0)} {capacity.unit} | 
                      <strong style={{ color: capacity.available > 0 ? '#2e7d32' : '#d32f2f' }}> Available: {capacity.available.toFixed(0)} {capacity.unit}</strong>
                    </Typography>
                  </Box>
                );
              }
              return null;
            })()}
            
            {/* Current Units - After area selection so user knows the limit */}
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <TextField
                margin="dense"
                label="Initial Units"
                type="number"
                fullWidth
                value={batchCurrentUnits}
                onChange={e => {
                  const validation = validateNumericInput(e.target.value, SECURITY_RULES.MIN_QUANTITY, SECURITY_RULES.MAX_QUANTITY);
                  setBatchCurrentUnits(e.target.value);
                  if (!validation.isValid) {
                    setValidationErrors(prev => ({ ...prev, batchCurrentUnits: validation.error }));
                  } else {
                    // Also validate against available capacity
                    const capacity = getAreaAvailableCapacity(batchCultivationAreaId);
                    if (capacity && parseFloat(e.target.value) > capacity.available) {
                      setValidationErrors(prev => ({ 
                        ...prev, 
                        batchCurrentUnits: `Exceeds available capacity (${capacity.available.toFixed(0)} ${capacity.unit})` 
                      }));
                    } else {
                      setValidationErrors(prev => ({ ...prev, batchCurrentUnits: undefined }));
                    }
                  }
                }}
                required
                error={!!validationErrors.batchCurrentUnits}
                helperText={validationErrors.batchCurrentUnits || (batchCultivationAreaId ? `Max: ${getAreaAvailableCapacity(batchCultivationAreaId)?.available.toFixed(0) || '∞'} units` : 'Select area first')}
                inputProps={{ 
                  step: "any",
                  min: SECURITY_RULES.MIN_QUANTITY,
                  max: batchCultivationAreaId ? getAreaAvailableCapacity(batchCultivationAreaId)?.available : SECURITY_RULES.MAX_QUANTITY
                }}
                InputLabelProps={{ shrink: true }}
                sx={{ '& .MuiInputBase-input': { color: '#1a202c' }, '& .MuiInputLabel-root': { color: 'rgba(0,0,0,0.6)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' } }}
                disabled={batchDialogLoading || isFacilityOperator}
              />
              <FormControl margin="dense" sx={{ minWidth: 120 }}>
                <InputLabel sx={{ color: 'rgba(0,0,0,0.6)' }}>Unit</InputLabel>
                <Select
                  value={batchUnit}
                  onChange={e => setBatchUnit(e.target.value)}
                  required
                  sx={{
                    color: '#1a202c',
                    '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' },
                    '.MuiSvgIcon-root': { color: '#1a202c' }
                  }}
                  MenuProps={{ PaperProps: { sx: { bgcolor: '#fff', color: '#1a202c' } } }}
                  disabled={batchDialogLoading || isFacilityOperator}
                >
                  <MenuItem value=""><em>Select Unit</em></MenuItem>
                  {UNIT_OPTIONS.map(unit => <MenuItem key={unit} value={unit}>{unit}</MenuItem>)}
                </Select>
              </FormControl>
            </Box>
            <FormControl fullWidth margin="dense" sx={{ mb: 2 }}>
              <InputLabel sx={{ color: 'rgba(0,0,0,0.6)' }}>End Type</InputLabel>
              <Select
                value={batchEndType}
                onChange={e => setBatchEndType(e.target.value)}
                required
                sx={{
                  color: '#1a202c',
                  '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' },
                  '.MuiSvgIcon-root': { color: '#1a202c' }
                }}
                MenuProps={{ PaperProps: { sx: { bgcolor: '#fff', color: '#1a202c' } } }}
                disabled={batchDialogLoading || isFacilityOperator}
              >
                <MenuItem value=""><em>Select Type</em></MenuItem>
                <MenuItem value="Dried">Dried</MenuItem>
                <MenuItem value="Fresh">Fresh</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth margin="dense" sx={{ mb: 2 }} error={!!validationErrors.batchVariety}>
              <InputLabel sx={{ color: 'rgba(0,0,0,0.6)' }}>Variety *</InputLabel>
              <Select
                value={batchVariety}
                label="Variety *"
                onChange={e => setBatchVariety(e.target.value)}
                required
                sx={{
                  color: '#1a202c',
                  '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' },
                  '.MuiSvgIcon-root': { color: '#1a202c' }
                }}
                MenuProps={{ PaperProps: { sx: { bgcolor: '#fff', color: '#1a202c' } } }}
                disabled={batchDialogLoading || isFacilityOperator}
              >
                <MenuItem value=""><em>Select Variety</em></MenuItem>
                {varieties.map((variety) => (
                  <MenuItem key={variety.id} value={variety.name}>{variety.name}</MenuItem>
                ))}
              </Select>
              {validationErrors.batchVariety && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                  {validationErrors.batchVariety}
                </Typography>
              )}
            </FormControl>
            <FormControl fullWidth margin="dense" sx={{ mb: 2 }}>
              <InputLabel sx={{ color: 'rgba(0,0,0,0.6)' }}>Product Type</InputLabel>
              <Select
                value={batchProductType}
                onChange={e => setBatchProductType(e.target.value)}
                required
                sx={{
                  color: '#1a202c',
                  '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' },
                  '.MuiSvgIcon-root': { color: '#1a202c' }
                }}
                MenuProps={{ PaperProps: { sx: { bgcolor: '#fff', color: '#1a202c' } } }}
                disabled={batchDialogLoading || isFacilityOperator}
              >
                <MenuItem value=""><em>Select Product Type</em></MenuItem>
                {HEALTH_CANADA_PRODUCT_TYPES.map(type => (
                  <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth margin="dense" sx={{ mb: 2 }}>
              <InputLabel sx={{ color: 'rgba(0,0,0,0.6)' }}>Origin Type</InputLabel>
              <Select
                value={batchOriginType}
                onChange={e => {
                  setBatchOriginType(e.target.value);
                  setBatchOriginDetails('');
                }}
                required
                sx={{
                  color: '#1a202c',
                  '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' },
                  '.MuiSvgIcon-root': { color: '#1a202c' }
                }}
                MenuProps={{ PaperProps: { sx: { bgcolor: '#fff', color: '#1a202c' } } }}
                disabled={batchDialogLoading || isFacilityOperator}
              >
                <MenuItem value=""><em>Select Origin</em></MenuItem>
                <MenuItem value="internal">Internal</MenuItem>
                <MenuItem value="external">External</MenuItem>
              </Select>
            </FormControl>
            {batchOriginType === 'external' && (
              <TextField
                label={getOriginDetailsLabel().label}
                placeholder={getOriginDetailsLabel().placeholder}
                value={batchOriginDetails}
                onChange={e => setBatchOriginDetails(e.target.value)}
                fullWidth
                multiline
                rows={2}
                sx={{ mb: 2, '& .MuiInputBase-input': { color: '#1a202c' }, '& .MuiInputLabel-root': { color: 'rgba(0,0,0,0.6)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' } }}
                disabled={batchDialogLoading || isFacilityOperator}
              />
            )}
            <TextField
              label="Projected Yield"
              type="number"
              value={batchProjectedYield}
              onChange={e => setBatchProjectedYield(e.target.value)}
              fullWidth
              inputProps={{ step: "any" }}
              InputLabelProps={{ shrink: true }}
              sx={{ mb: 2, '& .MuiInputBase-input': { color: '#1a202c' }, '& .MuiInputLabel-root': { color: 'rgba(0,0,0,0.6)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' } }}
              disabled={batchDialogLoading || isFacilityOperator}
            />
            <TextField
              label="Advance to Harvesting On (Optional)"
              type="date"
              value={batchAdvanceToHarvestingOn}
              onChange={e => setBatchAdvanceToHarvestingOn(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
              sx={{ mb: 2, '& .MuiInputBase-input': { color: '#1a202c' }, '& .MuiInputLabel-root': { color: 'rgba(0,0,0,0.6)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' } }}
              disabled={batchDialogLoading || isFacilityOperator}
            />
            {/* Sub-location field */}
            <TextField
              margin="dense"
              label="Sub-location"
              type="text"
              fullWidth
              value={batchSubLocation}
              onChange={e => setBatchSubLocation(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ mb: 2, '& .MuiInputBase-input': { color: '#1a202c' }, '& .MuiInputLabel-root': { color: 'rgba(0,0,0,0.6)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' } }}
              disabled={batchDialogLoading || isFacilityOperator}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={isPackaged}
                  onChange={(e) => setIsPackaged(e.target.checked)}
                  sx={{
                    color: 'rgba(0,0,0,0.6)',
                    '&.Mui-checked': {
                      color: '#4CAF50',
                    },
                  }}
                  disabled={batchDialogLoading || isFacilityOperator}
                />
              }
              label={<Typography sx={{ color: '#1a202c' }}>Is Packaged?</Typography>}
              sx={{ mb: 2 }}
            />
          </DialogContent>
          <DialogActions sx={{ bgcolor: '#f8fafc' }}>
            <Button onClick={handleCloseBatchDialog} disabled={batchDialogLoading || isFacilityOperator} sx={{ color: '#64748b' }}>{BUTTON_LABELS.CANCEL}</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={(() => {
                const isDisabled = batchDialogLoading || !batchName.trim() || batchCurrentUnits === '' || !batchUnit.trim() || !batchEndType.trim() || !batchVariety.trim() || !batchProductType.trim() || !batchCultivationAreaId || !batchOriginType.trim() || (batchOriginType === 'external' && !batchOriginDetails.trim()) || isFacilityOperator;
                return isDisabled;
              })()}
              sx={{
                bgcolor: '#4CAF50',
                '&:hover': { bgcolor: '#43A047' }
              }}
            >
              {batchDialogLoading ? <CircularProgress size={24} /> : (editingBatch ? BUTTON_LABELS.SAVE_CHANGES : BUTTON_LABELS.CREATE_BATCH)}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
      {/* --- Batch Detail Dialog (with Traceability) --- */}
      <Dialog open={openBatchDetailDialog} onClose={handleCloseBatchDetailDialog} maxWidth="lg" fullWidth
        PaperProps={{ sx: { bgcolor: '#fff', color: '#1a202c', borderRadius: 2, minHeight: '80vh' } }}
      >
        <DialogTitle sx={{ bgcolor: '#fff', color: '#1a202c', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e0e0e0' }}>
          {DIALOG_TITLES.BATCH_DETAIL} {currentBatchDetail?.name}
          <IconButton onClick={handleCloseBatchDetailDialog} sx={{ color: '#64748b' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        
        {/* Action Buttons Toolbar - Consistent style */}
        <Box sx={{ 
          px: 3, 
          py: 1.5, 
          bgcolor: '#fafafa',
          borderBottom: '1px solid #e0e0e0',
        }}>
          <Typography variant="subtitle2" sx={{ color: '#666', mb: 1, fontWeight: 500 }}>
            Register Event:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<TrendingUpIcon />}
              onClick={() => handleOpenRegisterEventDialog('movement', currentBatchDetail.id)}
              sx={{ textTransform: 'none', borderColor: '#1976d2', color: '#1976d2', '&:hover': { bgcolor: '#e3f2fd', borderColor: '#1565c0' } }}
              disabled={isFacilityOperator || !hasPermission('register-traceability-events')}
            >
              Movement
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<EcoIcon />}
              onClick={() => handleOpenRegisterEventDialog('cultivation', currentBatchDetail.id)}
              sx={{ textTransform: 'none', borderColor: '#1976d2', color: '#1976d2', '&:hover': { bgcolor: '#e3f2fd', borderColor: '#1565c0' } }}
              disabled={isFacilityOperator || !hasPermission('register-traceability-events')}
            >
              Cultivation
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<HarvestIcon />}
              onClick={() => handleOpenRegisterEventDialog('harvest', currentBatchDetail.id)}
              sx={{ textTransform: 'none', borderColor: '#1976d2', color: '#1976d2', '&:hover': { bgcolor: '#e3f2fd', borderColor: '#1565c0' } }}
              disabled={isFacilityOperator || !hasPermission('register-traceability-events')}
            >
              Harvest
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<ScienceIcon />}
              onClick={() => handleOpenRegisterEventDialog('sampling', currentBatchDetail.id)}
              sx={{ textTransform: 'none', borderColor: '#1976d2', color: '#1976d2', '&:hover': { bgcolor: '#e3f2fd', borderColor: '#1565c0' } }}
              disabled={isFacilityOperator || !hasPermission('register-traceability-events')}
            >
              Sampling
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<DeleteForeverIcon />}
              onClick={() => handleOpenRegisterEventDialog('destruction', currentBatchDetail.id)}
              sx={{ textTransform: 'none', borderColor: '#ef6c00', color: '#ef6c00', '&:hover': { bgcolor: '#fff3e0', borderColor: '#e65100' } }}
              disabled={isFacilityOperator || !hasPermission('register-traceability-events')}
            >
              Destruction
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<RemoveCircleOutlineIcon />}
              onClick={() => handleOpenRegisterEventDialog('loss_theft', currentBatchDetail.id)}
              sx={{ textTransform: 'none', borderColor: '#d32f2f', color: '#d32f2f', '&:hover': { bgcolor: '#ffebee', borderColor: '#b71c1c' } }}
              disabled={isFacilityOperator || !hasPermission('register-traceability-events')}
            >
              Loss/Theft
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddBoxIcon />}
              onClick={() => handleOpenAdjustmentDialog(currentBatchDetail)}
              sx={{ textTransform: 'none', borderColor: '#4CAF50', color: '#4CAF50', '&:hover': { bgcolor: '#e8f5e9', borderColor: '#388E3C' } }}
              disabled={isFacilityOperator || !hasPermission('register-traceability-events')}
            >
              Adjustment
            </Button>
          </Box>
        </Box>
        
        <DialogContent sx={{
          pt: '20px !important',
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: { xs: 3, md: 4 },
        }}>
          <Box sx={{ flexGrow: 1, minWidth: { md: '40%' } }}>
            <Typography variant="h6" sx={{ mb: 2, color: '#1a202c' }}>General Information</Typography>
            <Typography variant="subtitle1" sx={{ mt: 1, mb: 1, color: '#1a202c' }}>
              Variety: {currentBatchDetail?.variety || 'N/A'}
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              Product Type: {currentBatchDetail?.product_type || 'N/A'}
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              Current Units: {currentBatchDetail?.current_units} {currentBatchDetail?.units || 'g'}
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              End Type: {currentBatchDetail?.end_type || 'N/A'}
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              Projected Yield: {currentBatchDetail?.projected_yield || 'N/A'}
            </Typography>
            {currentBatchDetail?.advance_to_harvesting_on && (
              <Typography variant="body2" sx={{ color: '#64748b' }}>
                Harvest Date: {new Date(currentBatchDetail.advance_to_harvesting_on).toLocaleDateString()}
              </Typography>
            )}
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              Cultivation Area: {cultivationAreas.find(area => area.id === currentBatchDetail?.cultivation_area_id)?.name || 'N/A'}
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              Current Stage: {stages.find(s => s.id === cultivationAreas.find(area => area.id === currentBatchDetail?.cultivation_area_id)?.current_stage_id)?.name || 'N/A'}
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              Packaged: {currentBatchDetail?.is_packaged ? 'Yes' : 'No'}
            </Typography>
            {/* NEW: Mostrar sub_location */}
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              Sub-location: {currentBatchDetail?.sub_location || '—'}
            </Typography>
            <Divider sx={{ my: 2, borderColor: '#e0e0e0' }} />
            <Typography variant="body2" sx={{ color: '#1a202c', fontWeight: 'bold' }}>
              Origin Type: {(() => {
                switch (currentBatchDetail?.origin_type) {
                  case 'internal': return 'Internal';
                  case 'external': return 'External';
                  default: return 'N/A';
                }
              })()}
            </Typography>
            {currentBatchDetail?.origin_details && (
              <Typography variant="body2" sx={{ color: '#64748b' }}>
                Origin Details: {currentBatchDetail.origin_details}
              </Typography>
            )}
          </Box>
          <Box sx={{ width: { md: '60%' }, flexShrink: 0, ml: { md: 4 } }}>
            <Typography variant="h6" sx={{ mb: 2, color: '#1a202c', display: 'flex', alignItems: 'center' }}>
              <HistoryIcon sx={{ mr: 1, color: '#64748b' }} />
              Traceability Events
            </Typography>
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel sx={{ color: 'rgba(0,0,0,0.6)' }}>View Events for</InputLabel>
              <Select
                value={selectedBatchForTraceability}
                onChange={(e) => setSelectedBatchForTraceability(e.target.value)}
                label="View Events for"
                sx={{
                  color: '#1a202c',
                  '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.87)' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1976d2' },
                  '.MuiSvgIcon-root': { color: '#1a202c' },
                }}
                MenuProps={{
                  PaperProps: {
                    sx: { bgcolor: '#fff', color: '#1a202c' },
                  },
                }}
              >
                <MenuItem value="all">All Batches</MenuItem>
                {currentBatchDetail && <MenuItem value={currentBatchDetail.id}>{currentBatchDetail.name}</MenuItem>}
              </Select>
            </FormControl>
            
            {/* Audit Log / Timeline Style */}
            <Box sx={{ 
              maxHeight: '350px', 
              overflowY: 'auto', 
              bgcolor: '#f8fafc',
              borderRadius: 2,
              border: '1px solid #e2e8f0',
              p: 0
            }}>
              {traceabilityEvents.length > 0 ? (
                <Box sx={{ position: 'relative' }}>
                  {traceabilityEvents.map((event, index) => {
                    // Determine event color based on type
                    const getEventColor = (type) => {
                      const colors = {
                        'archive': '#f97316',
                        'restore': '#22c55e',
                        'loss_theft': '#ef4444',
                        'adjustment': '#3b82f6',
                        'adjustment_loss': '#ef4444',
                        'split': '#8b5cf6',
                        'process': '#06b6d4',
                        'movement': '#6366f1',
                        'harvest': '#84cc16',
                        'sampling': '#f59e0b',
                        'destruction': '#dc2626',
                      };
                      return colors[type] || '#64748b';
                    };
                    
                    const eventColor = getEventColor(event.event_type);
                    
                    return (
                      <Box 
                        key={event.id} 
                        sx={{ 
                          display: 'flex',
                          borderBottom: index < traceabilityEvents.length - 1 ? '1px solid #e2e8f0' : 'none',
                          '&:hover': { bgcolor: '#f1f5f9' },
                          transition: 'background-color 0.15s'
                        }}
                      >
                        {/* Timeline indicator */}
                        <Box sx={{ 
                          width: 50, 
                          flexShrink: 0, 
                          display: 'flex', 
                          flexDirection: 'column', 
                          alignItems: 'center',
                          pt: 2,
                          position: 'relative'
                        }}>
                          <Box sx={{ 
                            width: 10, 
                            height: 10, 
                            borderRadius: '50%', 
                            bgcolor: eventColor,
                            boxShadow: `0 0 0 3px ${eventColor}22`,
                            zIndex: 1
                          }} />
                          {index < traceabilityEvents.length - 1 && (
                            <Box sx={{ 
                              width: 2, 
                              flexGrow: 1, 
                              bgcolor: '#e2e8f0',
                              mt: 0.5
                            }} />
                          )}
                        </Box>
                        
                        {/* Event content */}
                        <Box sx={{ flex: 1, py: 1.5, pr: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Chip 
                                label={event.event_type.replace('_', ' ').toUpperCase()} 
                                size="small"
                                sx={{ 
                                  bgcolor: `${eventColor}15`,
                                  color: eventColor,
                                  fontWeight: 600,
                                  fontSize: '0.65rem',
                                  height: 20,
                                  '& .MuiChip-label': { px: 1 }
                                }}
                              />
                              <Typography variant="caption" sx={{ color: '#64748b' }}>
                                {event.batch_name || `Batch #${event.batch_id}`}
                              </Typography>
                            </Box>
                            <Tooltip title="Delete event">
                              <IconButton 
                                size="small" 
                                onClick={() => handleDeleteTraceabilityEvent(event)}
                                disabled={isFacilityOperator || !hasPermission('register-traceability-events')}
                                sx={{ 
                                  color: '#94a3b8', 
                                  p: 0.5,
                                  '&:hover': { color: '#ef4444', bgcolor: '#fef2f2' } 
                                }}
                              >
                                <DeleteIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                          
                          <Typography variant="body2" sx={{ color: '#334155', mb: 0.5, lineHeight: 1.4 }}>
                            {event.description || event.method || event.reason || 'No description'}
                          </Typography>
                          
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Typography variant="caption" sx={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Box component="span" sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: '#cbd5e1' }} />
                              {new Date(event.created_at).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric', 
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                              by <Box component="span" sx={{ color: '#64748b', fontWeight: 500 }}>{event.user_name || `User #${event.user_id}`}</Box>
                            </Typography>
                            {event.quantity && (
                              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500 }}>
                                {event.quantity} {event.unit || 'units'}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              ) : (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <HistoryIcon sx={{ fontSize: 40, color: '#cbd5e1', mb: 1 }} />
                  <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                    No traceability events registered for this batch.
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        </DialogContent>
      </Dialog>
      {/* --- Global Event Registration Dialog --- */}
      <Dialog open={openRegisterEventDialog} onClose={handleCloseRegisterEventDialog} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: '#fff', color: '#1a202c', borderRadius: 2 } }}
      >
        <DialogTitle sx={{ bgcolor: '#f8fafc', color: '#1a202c', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {DIALOG_TITLES.REGISTER_EVENT}
          <IconButton onClick={handleCloseRegisterEventDialog} sx={{ color: '#1a202c' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: '20px !important' }}>
          {renderEventForm()}
        </DialogContent>
      </Dialog>
      {/* --- Split Batch Dialog --- */}
      <Dialog open={openSplitBatchDialog} onClose={handleCloseSplitBatchDialog} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: '#fff', color: '#1a202c', borderRadius: 2 } }}
      >
        <DialogTitle sx={{ bgcolor: '#f8fafc', color: '#1a202c', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {DIALOG_TITLES.SPLIT_BATCH} {batchToSplit?.name}
          <IconButton onClick={handleCloseSplitBatchDialog} sx={{ color: '#1a202c' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <form onSubmit={handleSplitBatch}>
          <DialogContent sx={{ pt: '20px !important' }}>
            <Typography variant="body1" sx={{ mb: 2, color: '#1a202c' }}>
              Current units of batch: {batchToSplit?.current_units || 0} {batchToSplit?.units || 'g'}
            </Typography>
            <TextField
              label="Quantity to split"
              type="number"
              value={splitQuantity}
              onChange={e => setSplitQuantity(e.target.value)}
              fullWidth
              required
              inputProps={{ min: 0.01, max: (batchToSplit?.current_units || 0) - 0.01, step: "any" }}
              sx={{ mt: 1, mb: 2, '& .MuiInputBase-input': { color: '#1a202c' }, '& .MuiInputLabel-root': { color: 'rgba(0,0,0,0.6)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' } }}
              disabled={splitBatchDialogLoading || isFacilityOperator}
            />
            <TextField
              label="Name the new batch"
              value={newSplitBatchName}
              onChange={e => setNewSplitBatchName(e.target.value)}
              fullWidth
              required
              InputLabelProps={{ shrink: true }}
              sx={{ mb: 2, '& .MuiInputBase-input': { color: '#1a202c' }, '& .MuiInputLabel-root': { color: 'rgba(0,0,0,0.6)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' } }}
              disabled={splitBatchDialogLoading || isFacilityOperator}
            />
            <FormControl fullWidth margin="dense" sx={{ mb: 2 }}>
              <InputLabel sx={{ color: 'rgba(0,0,0,0.6)' }}>New Batch Product Type</InputLabel>
              <Select
                value={newSplitBatchProductType}
                onChange={e => setNewSplitBatchProductType(e.target.value)}
                required
                sx={{
                  color: '#1a202c',
                  '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' },
                  '.MuiSvgIcon-root': { color: '#1a202c' }
                }}
                MenuProps={{ PaperProps: { sx: { bgcolor: '#fff', color: '#1a202c' } } }}
                disabled={splitBatchDialogLoading || isFacilityOperator}
              >
                <MenuItem value=""><em>Select Product Type</em></MenuItem>
                {HEALTH_CANADA_PRODUCT_TYPES.map(type => (
                  <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth margin="dense" sx={{ mb: 2 }}>
              <InputLabel sx={{ color: 'rgba(0,0,0,0.6)' }}>Destination Cultivation Area</InputLabel>
              <Select
                value={splitBatchCultivationAreaId}
                onChange={e => setSplitBatchCultivationAreaId(e.target.value)}
                required
                sx={{
                  color: '#1a202c',
                  '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' },
                  '.MuiSvgIcon-root': { color: '#1a202c' }
                }}
                MenuProps={{ PaperProps: { sx: { bgcolor: '#fff', color: '#1a202c' } } }}
                disabled={splitBatchDialogLoading || isFacilityOperator}
              >
                <MenuItem value=""><em>Select Area</em></MenuItem>
                {cultivationAreas.length === 0 ? (
                  <MenuItem value="" disabled><em>No cultivation areas available in the selected facility</em></MenuItem>
                ) : (
                  cultivationAreas.map(area => <MenuItem key={area.id} value={area.id}>{area.name} ({stages.find(s => s.id === area.current_stage_id)?.name || 'No Stage'})</MenuItem>)
                )}
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions sx={{ bgcolor: '#f8fafc' }}>
            <Button onClick={handleCloseSplitBatchDialog} disabled={splitBatchDialogLoading || isFacilityOperator} sx={{ color: '#64748b' }}>{BUTTON_LABELS.CANCEL}</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={splitBatchDialogLoading || !splitQuantity || parseFloat(splitQuantity) <= 0 || parseFloat(splitQuantity) >= (batchToSplit?.current_units || 0) || !newSplitBatchName.trim() || !newSplitBatchProductType.trim() || !splitBatchCultivationAreaId || isFacilityOperator}
              sx={{
                bgcolor: '#ff9800',
                '&:hover': { bgcolor: '#fb8c00' }
              }}
            >
              {splitBatchDialogLoading ? <CircularProgress size={24} /> : BUTTON_LABELS.SPLIT_BATCH}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
      {/* --- Process Batch Dialog --- */}
      <Dialog open={openProcessBatchDialog} onClose={handleCloseProcessBatchDialog} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: '#fff', color: '#1a202c', borderRadius: 2 } }}
      >
        <DialogTitle sx={{ bgcolor: '#f8fafc', color: '#1a202c', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {DIALOG_TITLES.PROCESS_BATCH} {batchToProcess?.name}
          <IconButton onClick={handleCloseProcessBatchDialog} sx={{ color: '#1a202c' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <form onSubmit={handleProcessBatch}>
          <DialogContent sx={{ pt: '20px !important' }}>
            <Typography variant="body1" sx={{ mb: 2, color: '#1a202c' }}>
              Current units of batch: {batchToProcess?.current_units || 0} {batchToProcess?.units || 'g'}
            </Typography>
            <TextField
              label="Processed Quantity (Final units after processing)"
              type="number"
              value={processedQuantity}
              onChange={e => setProcessedQuantity(e.target.value)}
              fullWidth
              required
              inputProps={{ min: 0, step: "any" }}
              InputLabelProps={{ shrink: true, sx: { color: 'rgba(0,0,0,0.6)' } }}
              sx={{ mt: 1, mb: 2, '& .MuiInputBase-input': { color: '#1a202c' }, '& .MuiInputLabel-root': { color: 'rgba(0,0,0,0.6)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' } }}
              disabled={processBatchDialogLoading || isFacilityOperator}
            />
            <FormControl fullWidth margin="dense" sx={{ mb: 2 }}>
              <InputLabel sx={{ color: 'rgba(0,0,0,0.6)' }}>Processing Method</InputLabel>
              <Select
                value={processMethod}
                onChange={e => setProcessMethod(e.target.value)}
                required
                sx={{
                  color: '#1a202c',
                  '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' },
                  '.MuiSvgIcon-root': { color: '#1a202c' }
                }}
                MenuProps={{ PaperProps: { sx: { bgcolor: '#fff', color: '#1a202c' } } }}
                disabled={processBatchDialogLoading || isFacilityOperator}
              >
                <MenuItem value=""><em>Select Method</em></MenuItem>
                <MenuItem value="Lyophilization">Lyophilization</MenuItem>
                <MenuItem value="Air Drying">Air Drying</MenuItem>
                <MenuItem value="Curing">Curing</MenuItem>
                <MenuItem value="Trimming">Trimming</MenuItem>
                <MenuItem value="Extraction">Extraction</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth margin="dense" sx={{ mb: 2 }}>
              <InputLabel sx={{ color: 'rgba(0,0,0,0.6)' }}>New Product Type</InputLabel>
              <Select
                value={newProductType}
                onChange={e => setNewProductType(e.target.value)}
                required
                sx={{
                  color: '#1a202c',
                  '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' },
                  '.MuiSvgIcon-root': { color: '#1a202c' }
                }}
                MenuProps={{ PaperProps: { sx: { bgcolor: '#fff', color: '#1a202c' } } }}
                disabled={processBatchDialogLoading || isFacilityOperator}
              >
                <MenuItem value=""><em>Select New Product Type</em></MenuItem>
                {HEALTH_CANADA_PRODUCT_TYPES.map(type => (
                  <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Notes"
              value={processNotes}
              onChange={e => setProcessNotes(e.target.value)}
              fullWidth
              multiline
              rows={3}
              InputLabelProps={{ shrink: true }}
              sx={{ mb: 2, '& .MuiInputBase-input': { color: '#1a202c' }, '& .MuiInputLabel-root': { color: 'rgba(0,0,0,0.6)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' } }}
              disabled={processBatchDialogLoading || isFacilityOperator}
            />
          </DialogContent>
          <DialogActions sx={{ bgcolor: '#f8fafc' }}>
            <Button onClick={handleCloseProcessBatchDialog} disabled={processBatchDialogLoading || isFacilityOperator} sx={{ color: '#64748b' }}>{BUTTON_LABELS.CANCEL}</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={processBatchDialogLoading || processedQuantity === '' || isNaN(parseFloat(processedQuantity)) || parseFloat(processedQuantity) <= 0 || parseFloat(processedQuantity) > (batchToProcess?.current_units || 0) || !processMethod.trim() || !newProductType.trim() || isFacilityOperator}
              sx={{
                bgcolor: '#4CAF50',
                '&:hover': { bgcolor: '#43A047' }
              }}
            >
              {processBatchDialogLoading ? <CircularProgress size={24} /> : BUTTON_LABELS.PROCESS}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
      {/* --- External Batch Registration Dialog --- */}
      <Dialog open={openExternalBatchDialog} onClose={handleCloseExternalBatchDialog} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: '#fff', color: '#1a202c', borderRadius: 2 } }}
      >
        <DialogTitle sx={{ bgcolor: '#f8fafc', color: '#1a202c', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {DIALOG_TITLES.REGISTER_EXTERNAL_BATCH}
          <IconButton onClick={handleCloseExternalBatchDialog} sx={{ color: '#1a202c' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <form onSubmit={handleSaveExternalBatch}>
          <DialogContent sx={{ pt: '20px !important' }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 2 }}>
              <TextField
                label="External Batch Name"
                value={externalBatchName}
                onChange={e => setExternalBatchName(e.target.value)}
                fullWidth
                required
                InputLabelProps={{ shrink: true }}
                sx={{ mt: 1, '& .MuiInputBase-input': { color: '#1a202c' }, '& .MuiInputLabel-root': { color: 'rgba(0,0,0,0.6)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' } }}
                disabled={externalBatchDialogLoading || isFacilityOperator}
                helperText="Auto-generated. You can modify if needed."
              />
              <Tooltip title="Generate new name">
                <IconButton 
                  onClick={() => setExternalBatchName(generateExternalBatchName())} 
                  sx={{ mt: 1.5 }}
                  disabled={externalBatchDialogLoading || isFacilityOperator}
                >
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <TextField
                label="Units Received"
                type="number"
                value={externalBatchUnits}
                onChange={e => setExternalBatchUnits(e.target.value)}
                fullWidth
                required
                inputProps={{ step: "any" }}
                InputLabelProps={{ shrink: true }}
                sx={{ '& .MuiInputBase-input': { color: '#1a202c' }, '& .MuiInputLabel-root': { color: 'rgba(0,0,0,0.6)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' } }}
                disabled={externalBatchDialogLoading || isFacilityOperator}
              />
              <FormControl margin="dense" sx={{ minWidth: 120 }}>
                <InputLabel sx={{ color: 'rgba(0,0,0,0.6)' }}>Unit</InputLabel>
                <Select
                  value={externalBatchUnit}
                  onChange={e => setExternalBatchUnit(e.target.value)}
                  required
                  sx={{
                    color: '#1a202c',
                    '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' },
                    '.MuiSvgIcon-root': { color: '#1a202c' }
                  }}
                  MenuProps={{ PaperProps: { sx: { bgcolor: '#fff', color: '#1a202c' } } }}
                  disabled={externalBatchDialogLoading || isFacilityOperator}
                >
                  <MenuItem value=""><em>Select Unit</em></MenuItem>
                  {UNIT_OPTIONS.map(unit => <MenuItem key={unit} value={unit}>{unit}</MenuItem>)}
                </Select>
              </FormControl>
            </Box>
            <FormControl fullWidth margin="dense" sx={{ mb: 2 }}>
              <InputLabel sx={{ color: 'rgba(0,0,0,0.6)' }}>Product Type</InputLabel>
              <Select
                value={externalBatchProductType}
                onChange={e => setExternalBatchProductType(e.target.value)}
                required
                sx={{
                  color: '#1a202c',
                  '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' },
                  '.MuiSvgIcon-root': { color: '#1a202c' }
                }}
                MenuProps={{ PaperProps: { sx: { bgcolor: '#fff', color: '#1a202c' } } }}
                disabled={externalBatchDialogLoading || isFacilityOperator}
              >
                <MenuItem value=""><em>Select Product Type</em></MenuItem>
                {HEALTH_CANADA_PRODUCT_TYPES.map(type => (
                  <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth margin="dense" sx={{ mb: 2 }}>
              <InputLabel sx={{ color: 'rgba(0,0,0,0.6)' }}>Variety *</InputLabel>
              <Select
                value={externalBatchVariety}
                label="Variety *"
                onChange={e => setExternalBatchVariety(e.target.value)}
                required
                sx={{
                  color: '#1a202c',
                  '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' },
                  '.MuiSvgIcon-root': { color: '#1a202c' }
                }}
                MenuProps={{ PaperProps: { sx: { bgcolor: '#fff', color: '#1a202c' } } }}
                disabled={externalBatchDialogLoading || isFacilityOperator}
              >
                <MenuItem value=""><em>Select Variety</em></MenuItem>
                {varieties.map((variety) => (
                  <MenuItem key={variety.id} value={variety.name}>{variety.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label={getExternalOriginDetailsLabel().label}
              placeholder={getExternalOriginDetailsLabel().placeholder}
              value={externalBatchOriginDetails}
              onChange={e => setExternalBatchOriginDetails(e.target.value)}
              fullWidth
              multiline
              rows={2}
              required
              InputLabelProps={{ shrink: true }}
              sx={{ mb: 2, '& .MuiInputBase-input': { color: '#1a202c' }, '& .MuiInputLabel-root': { color: 'rgba(0,0,0,0.6)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' } }}
              disabled={externalBatchDialogLoading || isFacilityOperator}
            />
            <FormControl fullWidth margin="dense" sx={{ mb: 2 }}>
              <InputLabel sx={{ color: 'rgba(0,0,0,0.6)' }}>Receiving Cultivation Area</InputLabel>
              <Select
                value={externalBatchCultivationAreaId}
                onChange={e => setExternalBatchCultivationAreaId(e.target.value)}
                required
                sx={{
                  color: '#1a202c',
                  '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' },
                  '.MuiSvgIcon-root': { color: '#1a202c' }
                }}
                MenuProps={{ PaperProps: { sx: { bgcolor: '#fff', color: '#1a202c' } } }}
                disabled={externalBatchDialogLoading || isFacilityOperator}
              >
                <MenuItem value=""><em>Select Area</em></MenuItem>
                {cultivationAreas.length === 0 ? (
                  <MenuItem value="" disabled><em>No cultivation areas available in the selected facility</em></MenuItem>
                ) : (
                  cultivationAreas.map(area => <MenuItem key={area.id} value={area.id}>{area.name} ({stages.find(s => s.id === area.current_stage_id)?.name || 'No Stage'})</MenuItem>)
                )}
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions sx={{ bgcolor: '#f8fafc' }}>
            <Button onClick={handleCloseExternalBatchDialog} disabled={externalBatchDialogLoading || isFacilityOperator} sx={{ color: '#64748b' }}>{BUTTON_LABELS.CANCEL}</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={externalBatchDialogLoading || !externalBatchName.trim() || externalBatchUnits === '' || !externalBatchUnit.trim() || !externalBatchProductType.trim() || !externalBatchVariety.trim() || !externalBatchOriginDetails.trim() || !externalBatchCultivationAreaId || isFacilityOperator}
              sx={{
                bgcolor: '#007bff',
                '&:hover': { bgcolor: '#0056b3' }
              }}
            >
              {externalBatchDialogLoading ? <CircularProgress size={24} /> : BUTTON_LABELS.REGISTER_EXTERNAL_BATCH}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
      
      {/* --- NEW: DIÁLOGO DE AJUSTE DE INVENTARIO --- */}
      <Dialog 
        open={openAdjustmentDialog} 
        onClose={handleCloseAdjustmentDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { bgcolor: '#fff', color: '#1a202c', borderRadius: 2 } }}
      >
        <DialogTitle sx={{ 
          bgcolor: '#f8fafc', 
          color: '#1a202c', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center' 
        }}>
          {DIALOG_TITLES.INVENTORY_ADJUSTMENT}
          <IconButton onClick={handleCloseAdjustmentDialog} sx={{ color: '#1a202c' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: '20px !important' }}>
          <Box component="form" onSubmit={handleRegisterAdjustment}>
            <Typography sx={{ mb: 2, color: '#1a202c' }}>
              Batch: <b>{selectedBatchForAdjustment?.name || ''}</b>
            </Typography>
            <Typography sx={{ mb: 2, color: '#64748b' }}>
              Current Units: {selectedBatchForAdjustment?.current_units} {selectedBatchForAdjustment?.units}
            </Typography>
            <TextField
              label="Adjustment Quantity"
              type="number"
              fullWidth
              value={adjustmentQuantity}
              onChange={e => setAdjustmentQuantity(e.target.value)}
              sx={{ mb: 2, '& .MuiInputBase-input': { color: '#1a202c' }, '& .MuiInputLabel-root': { color: 'rgba(0,0,0,0.6)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' } }}
              disabled={adjustmentDialogLoading}
              required
              inputProps={{ step: "any" }}
            />
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel sx={{ color: 'rgba(0,0,0,0.6)' }}>Unit</InputLabel>
              <Select
                value={adjustmentUnit}
                onChange={e => setAdjustmentUnit(e.target.value)}
                disabled={adjustmentDialogLoading}
                required
                sx={{
                  color: '#1a202c',
                  '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' },
                  '.MuiSvgIcon-root': { color: '#1a202c' }
                }}
                MenuProps={{ PaperProps: { sx: { bgcolor: '#fff', color: '#1a202c' } } }}
              >
                {UNIT_OPTIONS.map(unit => (
                  <MenuItem key={unit} value={unit}>{unit}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Reason for Adjustment"
              fullWidth
              value={adjustmentReason}
              onChange={e => setAdjustmentReason(e.target.value)}
              disabled={adjustmentDialogLoading}
              required
              multiline
              rows={3}
              sx={{ mb: 2, '& .MuiInputBase-input': { color: '#1a202c' }, '& .MuiInputLabel-root': { color: 'rgba(0,0,0,0.6)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' } }}
            />
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel sx={{ color: 'rgba(0,0,0,0.6)' }}>Responsible User</InputLabel>
              <Select
                value={eventResponsibleUserId}
                onChange={e => setEventResponsibleUserId(e.target.value)}
                required
                sx={{
                  color: '#1a202c',
                  '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' },
                  '.MuiSvgIcon-root': { color: '#1a202c' }
                }}
                MenuProps={{ PaperProps: { sx: { bgcolor: '#fff', color: '#1a202c' } } }}
                disabled={adjustmentDialogLoading}
              >
                <MenuItem value=""><em>Select Responsible User</em></MenuItem>
                {users.map(user => <MenuItem key={user.id} value={user.id}>{user.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#f8fafc' }}>
          <Button onClick={handleCloseAdjustmentDialog} color="secondary" sx={{ color: '#64748b' }}>
            {BUTTON_LABELS.CANCEL}
          </Button>
          <Button
            onClick={handleRegisterAdjustment}
            color="primary"
            disabled={adjustmentDialogLoading || !adjustmentQuantity || !adjustmentUnit || !adjustmentReason.trim() || !eventResponsibleUserId}
            type="submit"
            variant="contained"
            sx={{
              bgcolor: '#4CAF50',
              '&:hover': { bgcolor: '#43A047' }
            }}
          >
            {adjustmentDialogLoading ? <CircularProgress size={24} /> : BUTTON_LABELS.REGISTER_ADJUSTMENT}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Archive Batch Dialog */}
      <Dialog
        open={archiveDialogOpen}
        onClose={handleCloseArchiveDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#fff',
            color: '#1a202c',
            borderRadius: 3,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          borderBottom: '1px solid #e2e8f0',
          pb: 2
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ 
              bgcolor: '#fff7ed', 
              p: 1, 
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ArchiveIcon sx={{ color: '#ea580c', fontSize: 28 }} />
            </Box>
            <Typography variant="h6" fontWeight={600}>Archive Batch</Typography>
          </Box>
          <IconButton onClick={handleCloseArchiveDialog} size="small" sx={{ color: '#64748b' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Alert 
            severity="info" 
            sx={{ 
              mb: 3, 
              bgcolor: '#eff6ff',
              border: '1px solid #bfdbfe',
              '& .MuiAlert-icon': { color: '#2563eb' },
              borderRadius: 2
            }}
          >
            <Typography variant="body2" sx={{ color: '#1e40af' }}>
              <strong>Health Canada Compliance:</strong> Archiving preserves all traceability data while removing the batch from active view. 
              This is the recommended approach for batches that cannot be deleted due to associated reports or events.
            </Typography>
          </Alert>
          
          {batchToArchive && (
            <Paper 
              elevation={0} 
              sx={{ 
                p: 2, 
                mb: 3, 
                bgcolor: '#f8fafc', 
                borderRadius: 2,
                border: '1px solid #e2e8f0'
              }}
            >
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Batch Name
                  </Typography>
                  <Typography variant="body1" fontWeight={600} sx={{ color: '#1e293b' }}>
                    {batchToArchive.name}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Current Units
                  </Typography>
                  <Typography variant="body1" fontWeight={600} sx={{ color: '#1e293b' }}>
                    {batchToArchive.current_units} {batchToArchive.units}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Product Type
                  </Typography>
                  <Typography variant="body1" sx={{ color: '#1e293b' }}>
                    {batchToArchive.product_type || 'N/A'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Variety
                  </Typography>
                  <Typography variant="body1" sx={{ color: '#1e293b' }}>
                    {batchToArchive.variety || 'N/A'}
                  </Typography>
                </Grid>
              </Grid>
            </Paper>
          )}
          
          <TextField
            fullWidth
            label="Reason for Archiving"
            required
            multiline
            rows={4}
            value={archiveReason}
            onChange={(e) => setArchiveReason(e.target.value)}
            placeholder="Explain why this batch is being archived (e.g., 'Batch completed lifecycle', 'Administrative closure', 'Product sold out', etc.)"
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: '#fff',
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#f97316',
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#ea580c',
                },
              },
              '& .MuiInputLabel-root.Mui-focused': {
                color: '#ea580c',
              },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: '1px solid #e2e8f0', gap: 1 }}>
          <Button 
            onClick={handleCloseArchiveDialog} 
            variant="outlined"
            sx={{ 
              color: '#64748b', 
              borderColor: '#cbd5e1',
              '&:hover': { 
                bgcolor: '#f1f5f9',
                borderColor: '#94a3b8'
              }
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleArchiveBatch}
            variant="contained"
            disabled={!archiveReason.trim() || loading}
            startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <ArchiveIcon />}
            sx={{ 
              bgcolor: '#ea580c', 
              '&:hover': { bgcolor: '#c2410c' },
              '&:disabled': { bgcolor: '#fed7aa', color: '#9a3412' },
              px: 3
            }}
          >
            Archive Batch
          </Button>
        </DialogActions>
      </Dialog>
      
      <ConfirmationDialog
        open={confirmDialogOpen}
        title={confirmDialogData.title}
        message={confirmDialogData.message}
        onConfirm={confirmDialogData.onConfirm}
        onCancel={() => setConfirmDialogOpen(false)}
      />
    </Box>
  );
});

// Define prop types
BatchManagementPage.propTypes = {
  tenantId: PropTypes.number,
  isAppReady: PropTypes.bool.isRequired,
  userFacilityId: PropTypes.number,
  isGlobalAdmin: PropTypes.bool.isRequired,
  setParentSnack: PropTypes.func.isRequired,
  hasPermission: PropTypes.func.isRequired,
};

// Display name for debugging
BatchManagementPage.displayName = 'BatchManagementPage';

export default BatchManagementPage;