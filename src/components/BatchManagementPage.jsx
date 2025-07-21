// src/components/BatchManagementPage.jsx
// Esta versión incluye todas las funcionalidades desarrolladas hasta ahora:
// - Campo 'product_type' en el diálogo Añadir/Editar Lote.
// - Campo 'newProductType' en el diálogo Procesar Lote.
// - Funcionalidad para registrar Lotes Externos (Paso 2.2).
// - Nuevo tipo de evento de trazabilidad 'loss_theft' (Paso 2.3).
// Se han revisado y consolidado todos los cambios para asegurar la integridad del archivo.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { api } from '../App'; // Asegúrate de que esta importación sea correcta
import {
  Box, Typography, Button, CircularProgress, Snackbar, Alert,
  TextField, Paper, Divider, IconButton, FormControl, InputLabel, Select, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogActions,
  List, ListItem, ListItemText, Grid,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import HistoryIcon from '@mui/icons-material/History'; // Icono para trazabilidad
import TrendingUpIcon from '@mui/icons-material/TrendingUp'; // Icono para movimiento
import EcoIcon from '@mui/icons-material/Agriculture'; // Icono para evento de cultivo (usando Agriculture)
import HarvestIcon from '@mui/icons-material/LocalFlorist'; // Icono para cosecha (usando flor)
import ScienceIcon from '@mui/icons-material/Science'; // Icono para muestreo
import DeleteForeverIcon from '@mui/icons-material/DeleteForever'; // Icono para destrucción
import InventoryIcon from '@mui/icons-material/Inventory'; // Icono principal para lotes
import EditIcon from '@mui/icons-material/Edit'; // Icono para editar
import DeleteIcon from '@mui/icons-material/Delete'; // Icono para eliminar
import VisibilityIcon from '@mui/icons-material/Visibility'; // Icono para ver detalles
import CallSplitIcon from '@mui/icons-material/CallSplit'; // Icono para dividir lote
import AutorenewIcon from '@mui/icons-material/Autorenew'; // Icono para procesar lote (transformación)
import LocalShippingIcon from '@mui/icons-material/LocalShipping'; // Icono para lotes externos/recibidos
import WarningIcon from '@mui/icons-material/Warning'; // NUEVO: Icono para pérdida/robo

// Importar DataGrid y componentes individuales para la Toolbar según la documentación
// Asumiendo compatibilidad con Data Grid MUI X v8.8.0
import {
  DataGrid,
  GridToolbarContainer,
  GridToolbarColumnsButton,
  GridToolbarFilterButton,
  GridToolbarDensitySelector,
  GridToolbarExport,
  GridToolbarQuickFilter,
} from '@mui/x-data-grid';

// --- Constantes para Mensajes y Textos ---
const SNACK_MESSAGES = {
  FACILITIES_ERROR: 'Error loading facilities.',
  BATCHES_ERROR: 'Error loading batches.',
  STAGES_ERROR: 'Error loading stages.', // Needed for cultivation area selector
  CULTIVATION_AREAS_ERROR: 'Error loading cultivation areas.', // Needed for cultivation area selector
  TENANT_ID_MISSING: 'Could not determine Tenant ID.',
  PERMISSION_DENIED: 'You do not have permission to perform this action.',
  VALIDATION_ERROR: 'Validation error:',
  INVALID_DATA: 'Invalid data:',
  EVENT_REGISTERED_SUCCESS: 'Traceability event successfully registered (simulated).',
  BATCH_CREATED: 'Batch created successfully.',
  BATCH_UPDATED: 'Batch updated successfully.',
  BATCH_DELETED: 'Batch deleted successfully.',
  BATCH_SPLIT_SUCCESS: 'Batch successfully split.', // New message
  BATCH_SPLIT_ERROR: 'Error splitting the batch.', // New message
  BATCH_NAME_REQUIRED: 'Batch name is required.',
  BATCH_UNITS_REQUIRED: 'Current batch units are required.',
  BATCH_END_TYPE_REQUIRED: 'Batch end type is required.',
  BATCH_VARIETY_REQUIRED: 'Batch variety is required.',
  BATCH_AREA_REQUIRED: 'You must select a cultivation area for the batch.',
  CANNOT_DELETE_BATCH_WITH_EVENTS: 'Cannot delete batch: It has associated traceability events.',
  SPLIT_QUANTITY_INVALID: 'The split quantity must be greater than 0 and less than the current batch units.', // New
  NEW_BATCH_NAME_REQUIRED: 'New batch name is required.', // New
  DESTINATION_AREA_REQUIRED: 'You must select a destination cultivation area for the new batch.', // New
  BATCH_ORIGIN_TYPE_REQUIRED: 'Batch origin type is required.', // New
  BATCH_PRODUCT_TYPE_REQUIRED: 'Batch product type is required.', // NEW
  BATCH_PROCESSED_SUCCESS: 'Batch processed successfully.', // New
  BATCH_PROCESSED_ERROR: 'Error processing the batch.', // New
  PROCESSED_QUANTITY_INVALID: 'Processed quantity must be a valid number, not negative, and not greater than current units.', // New
  PROCESS_METHOD_REQUIRED: 'Processing method is required.', // New
  NEW_PRODUCT_TYPE_REQUIRED: 'New product type is required.', // NEW
  EXTERNAL_BATCH_CREATED: 'External batch successfully registered.', // NEW
  EXTERNAL_BATCH_ERROR: 'Error registering external batch:', // NEW
  LOSS_THEFT_QUANTITY_REQUIRED: 'Loss/theft quantity is required.', // NEW
  LOSS_THEFT_UNIT_REQUIRED: 'Loss/theft unit is required.', // NEW
  LOSS_THEFT_REASON_REQUIRED: 'Loss/theft reason is required.', // NEW
};


const DIALOG_TITLES = {
  ADD_BATCH: 'Add New Batch',
  EDIT_BATCH: 'Edit Batch',
  BATCH_DETAIL: 'Batch Details:',
  REGISTER_EVENT: 'Register Traceability Event',
  CONFIRM_BATCH_DELETION: 'Confirm Batch Deletion',
  SPLIT_BATCH: 'Split Batch', // New title
  PROCESS_BATCH: 'Process Batch', // New title
  REGISTER_EXTERNAL_BATCH: 'Register External Batch', // NEW
};

const BUTTON_LABELS = {
  CANCEL: 'Cancel',
  CONFIRM: 'Confirm',
  SAVE_CHANGES: 'Save Changes',
  CREATE_BATCH: 'Create Batch',
  ADD_NEW_BATCH: 'Add New Batch',
  CLOSE: 'Close',
  REGISTER_MOVEMENT: 'Register Movement',
  REGISTER_CULTIVATION_EVENT: 'Register Cultivation Event',
  REGISTER_HARVEST: 'Register Harvest',
  REGISTER_SAMPLING: 'Register Sampling',
  REGISTER_DESTRUCTION: 'Register Destruction',
  REGISTER_LOSS_THEFT: 'Register Loss/Theft', // NEW
  REGISTER: 'Register',
  VIEW_DETAILS: 'View Details',
  DELETE: 'Delete',
  EDIT: 'Edit',
  SPLIT_BATCH: 'Split Batch', // New label
  CREATE_NEW_BATCH: 'Create New Batch', // For split dialog
  PROCESS: 'Process', // New label
  REGISTER_EXTERNAL_BATCH: 'Register External Batch', // NEW
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

// --- Componente de Diálogo de Confirmación Genérico ---
const ConfirmationDialog = ({ open, title, message, onConfirm, onCancel }) => {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
      PaperProps={{ sx: { bgcolor: '#2d3748', color: '#e2e8f0', borderRadius: 2 } }}
    >
      <DialogTitle id="alert-dialog-title" sx={{ color: '#e2e8f0' }}>{title}</DialogTitle>
      <DialogContent>
        <Typography id="alert-dialog-description" sx={{ color: '#a0aec0' }}>
          {message}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} sx={{ color: '#a0aec0' }}>
          {BUTTON_LABELS.CANCEL}
        </Button>
        <Button onClick={onConfirm} color="error" autoFocus sx={{ color: '#fc8181' }}>
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

// --- Componente de Toolbar Personalizada para DataGrid (según docs) ---
function CustomDataGridToolbar() {
  return (
    <GridToolbarContainer
      sx={{
        // Fondo oscuro para la toolbar, con !important para forzar el estilo
        bgcolor: '#3a506b !important',
        // Color de texto claro para la toolbar, con !important
        color: '#e2e8f0 !important',
        borderBottom: '1px solid #4a5568',
        padding: '8px',
        borderRadius: '4px 4px 0 0',
        minHeight: '48px', // Asegurar altura mínima para la toolbar
        display: 'flex',
        justifyContent: 'space-between', // Para alinear los botones a la izquierda y el filtro a la derecha
        alignItems: 'center',
        flexWrap: 'wrap', // Permite que los elementos se envuelvan en pantallas pequeñas
        gap: '8px', // Espacio entre elementos de la toolbar

        // Estilos para los botones (GridToolbarButton) dentro de la toolbar
        '& .MuiButtonBase-root': {
          color: '#e2e8f0 !important', // Color de los iconos y texto de los botones
          '&:hover': {
            bgcolor: 'rgba(255,255,255,0.1)', // Efecto hover
          },
        },
        // Estilos para el campo de búsqueda (GridToolbarQuickFilter)
        '& .MuiInputBase-root': { // Contenedor del input (TextField)
          color: '#e2e8f0 !important', // Color del texto de entrada
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(255,255,255,0.5) !important', // Borde del input
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(255,255,255,0.8) !important',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#fff !important',
          },
        },
        '& .MuiInputBase-input': { // El input real
          color: '#e2e8f0 !important', // Color del texto de entrada real
        },
        '& .MuiInputLabel-root': { // La etiqueta flotante
          color: 'rgba(255,255,255,0.7) !important', // Etiqueta del input
        },
        // Estilos para los iconos dentro de la toolbar (ej. icono de búsqueda, filtro)
        '& .MuiSvgIcon-root': {
          color: '#e2e8f0 !important',
        },
      }}
    >
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        <GridToolbarColumnsButton />
        <GridToolbarFilterButton />
        <GridToolbarDensitySelector />
        <GridToolbarExport />
      </Box>
      {/* GridToolbarQuickFilter con estilos específicos para visibilidad */}
      <GridToolbarQuickFilter
        sx={{
          width: { xs: '100%', sm: 'auto' }, // Ancho responsivo
          minWidth: '150px', // Asegurar que no sea demasiado pequeño
          ml: { sm: 2 }, // Margen a la izquierda para separación en pantallas grandes
          // Los estilos para el input interno ya están definidos en GridToolbarContainer,
          // pero se pueden sobrescribir aquí si es necesario para mayor especificidad.
        }}
      />
    </GridToolbarContainer>
  );
}


const BatchManagementPage = ({ tenantId, isAppReady, userFacilityId, isGlobalAdmin, setParentSnack }) => {
  const [batches, setBatches] = useState([]);
  const [facilities, setFacilities] = useState([]); // Para el selector de instalaciones
  const [selectedFacilityId, setSelectedFacilityId] = useState(''); // Estado para el filtro de instalaciones
  const [cultivationAreas, setCultivationAreas] = useState([]); // Para el selector en el diálogo de lote
  const [stages, setStages] = useState([]); // Para obtener el nombre de la etapa de un área
  const [loading, setLoading] = useState(true);

  // Estados para el diálogo de añadir/editar lote
  const [openBatchDialog, setOpenBatchDialog] = useState(false);
  const [editingBatch, setEditingBatch] = useState(null);
  const [batchName, setBatchName] = useState('');
  const [batchCurrentUnits, setBatchCurrentUnits] = useState('');
  const [batchEndType, setBatchEndType] = useState('');
  const [batchVariety, setBatchVariety] = useState('');
  const [batchProductType, setBatchProductType] = useState(''); // NUEVO: Estado para product_type
  const [batchProjectedYield, setBatchProjectedYield] = useState('');
  const [batchAdvanceToHarvestingOn, setBatchAdvanceToHarvestingOn] = useState('');
  const [batchCultivationAreaId, setBatchCultivationAreaId] = useState(''); // Nueva propiedad para el área de cultivo
  const [batchDialogLoading, setBatchDialogLoading] = useState(false);
  // NUEVOS ESTADOS para el origen del lote
  const [batchOriginType, setBatchOriginType] = useState('');
  const [batchOriginDetails, setBatchOriginDetails] = useState('');


  // Estados para el diálogo de detalle de lote/trazabilidad
  const [openBatchDetailDialog, setOpenBatchDetailDialog] = useState(false);
  const [currentBatchDetail, setCurrentBatchDetail] = useState(null);
  const [traceabilityEvents, setTraceabilityEvents] = useState([]);
  // FIX: Declarar selectedBatchForTraceability aquí
  const [selectedBatchForTraceability, setSelectedBatchForTraceability] = useState('all');


  // Estados para el diálogo de registro de eventos
  const [openRegisterEventDialog, setOpenRegisterEventDialog] = useState(false);
  const [currentEventType, setCurrentEventType] = useState(''); // 'movement', 'cultivation', 'harvest', 'sampling', 'destruction', 'loss_theft'
  const [eventBatchId, setEventBatchId] = useState(''); // Lote al que se aplica el evento
  const [eventQuantity, setEventQuantity] = useState('');
  const [eventUnit, setEventUnit] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventFromLocation, setEventFromLocation] = useState(''); // Para movimientos
  const [eventToLocation, setEventToLocation] = useState('');     // Para movimientos
  const [eventMethod, setEventMethod] = useState('');             // Para destrucción / tipo de cultivo
  const [eventReason, setEventReason] = useState('');             // Para destrucción / propósito muestreo / pérdida-robo
  const [eventNewBatchId, setEventNewBatchId] = useState('');     // Para cosecha

  // NUEVOS ESTADOS para el diálogo de dividir lote
  const [openSplitBatchDialog, setOpenSplitBatchDialog] = useState(false);
  const [batchToSplit, setBatchToSplit] = useState(null);
  const [splitQuantity, setSplitQuantity] = useState('');
  const [newSplitBatchName, setNewSplitBatchName] = useState('');
  const [splitBatchCultivationAreaId, setSplitBatchCultivationAreaId] = useState('');
  const [splitBatchDialogLoading, setSplitBatchDialogLoading] = useState(false);

  // NUEVOS ESTADOS para el diálogo de procesar lote
  const [openProcessBatchDialog, setOpenProcessBatchDialog] = useState(false);
  const [batchToProcess, setBatchToProcess] = useState(null);
  const [processedQuantity, setProcessedQuantity] = useState('');
  const [processMethod, setProcessMethod] = useState('');
  const [processNotes, setProcessNotes] = useState('');
  const [newProductType, setNewProductType] = useState(''); // NUEVO: Estado para el nuevo tipo de producto
  const [processBatchDialogLoading, setProcessBatchDialogLoading] = useState(false);

  // NUEVOS ESTADOS para el diálogo de registrar lote externo
  const [openExternalBatchDialog, setOpenExternalBatchDialog] = useState(false);
  const [externalBatchName, setExternalBatchName] = useState('');
  const [externalBatchUnits, setExternalBatchUnits] = useState('');
  const [externalBatchProductType, setExternalBatchProductType] = useState('');
  const [externalBatchVariety, setExternalBatchVariety] = useState('');
  const [externalBatchOriginDetails, setExternalBatchOriginDetails] = useState('');
  const [externalBatchCultivationAreaId, setExternalBatchCultivationAreaId] = useState('');
  const [externalBatchDialogLoading, setExternalBatchDialogLoading] = useState(false);


  // Estados para el diálogo de confirmación
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmDialogData, setConfirmDialogData] = useState({ title: '', message: '', onConfirm: () => {} });

  const isFacilityOperator = !!userFacilityId;

  // --- Funciones de Fetching ---

  const fetchFacilities = useCallback(async () => {
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
      console.log('BatchManagementPage: Fetched Facilities:', fetchedFacilities); // Log para depuración
      return fetchedFacilities;
    } catch (error) {
      console.error('BatchManagementPage: Error fetching facilities:', error);
      setParentSnack(SNACK_MESSAGES.FACILITIES_ERROR, 'error');
      return [];
    }
  }, [setParentSnack, isFacilityOperator, userFacilityId]);

  const fetchCultivationAreas = useCallback(async (currentSelectedFacilityId) => {
    if (!isAppReady || (!tenantId && !isGlobalAdmin)) {
      return [];
    }
    if (!currentSelectedFacilityId && !isFacilityOperator && isGlobalAdmin) {
        console.log('BatchManagementPage: Global Admin, no facility selected. Skipping area fetch.');
        setCultivationAreas([]);
        return [];
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
      setCultivationAreas(fetchedAreas);
      return fetchedAreas;
    } catch (error) {
      console.error('BatchManagementPage: Error fetching cultivation areas:', error);
      setParentSnack(SNACK_MESSAGES.CULTIVATION_AREAS_ERROR, 'error');
      return [];
    }
  }, [tenantId, isAppReady, setParentSnack, isGlobalAdmin, isFacilityOperator]);

  const fetchStages = useCallback(async () => {
    try {
      const response = await api.get('/stages');
      const fetchedStages = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.data)
        ? response.data.data
        : [];
      setStages(fetchedStages);
      return fetchedStages;
    } catch (error) {
      console.error('BatchManagementPage: Error fetching stages:', error);
      setParentSnack(SNACK_MESSAGES.STAGES_ERROR, 'error');
      return [];
    }
  }, [setParentSnack]);

  const fetchBatches = useCallback(async (currentSelectedFacilityId) => {
    if (!isAppReady || (!tenantId && !isGlobalAdmin)) {
      setBatches([]);
      return;
    }

    if (!currentSelectedFacilityId && !isFacilityOperator && isGlobalAdmin) {
      console.log('BatchManagementPage: Global Admin, no facility selected. Skipping batch fetch.');
      setBatches([]);
      setLoading(false);
      return;
    }

    setLoading(true); // Activa el loading antes de la llamada API
    const headers = {};
    let effectiveTenantId = null;

    if (isGlobalAdmin) {
        if (currentSelectedFacilityId) {
            const selectedFac = facilities.find(f => f.id === currentSelectedFacilityId);
            if (selectedFac && selectedFac.tenant_id) {
                effectiveTenantId = String(selectedFac.tenant_id);
                console.log('fetchBatches: Global Admin, using effectiveTenantId from selected facility:', effectiveTenantId); // Log para depuración
            } else {
                setParentSnack('Error: Como Super Admin, la instalación seleccionada no tiene un Tenant ID válido para cargar lotes.', 'error');
                setLoading(false); // Desactiva el loading en caso de error
                setBatches([]);
                return;
            }
        } else {
            // Global Admin sin instalación seleccionada, no debería cargar lotes
            console.log('fetchBatches: Global Admin, no facility selected. Not fetching batches.'); // Log para depuración
            setBatches([]);
            setLoading(false);
            return;
        }
    } else if (tenantId) {
        effectiveTenantId = String(tenantId);
        console.log('fetchBatches: Tenant user, using effectiveTenantId from tenantId prop:', effectiveTenantId); // Log para depuración
    } else {
        setParentSnack(SNACK_MESSAGES.TENANT_ID_MISSING, 'error');
        setLoading(false);
        setBatches([]);
        return;
    }

    if (effectiveTenantId) {
      headers['X-Tenant-ID'] = effectiveTenantId;
    }

    try {
      const response = await api.get('/batches', { headers });
      setBatches(response.data);
    } catch (error) {
      console.error('BatchManagementPage: Error fetching batches:', error.response?.data || error.message);
      setParentSnack(SNACK_MESSAGES.BATCHES_ERROR, 'error');
      setBatches([]);
    } finally {
      setLoading(false); // Desactiva el loading al finalizar la llamada (éxito o error)
    }
  }, [isAppReady, tenantId, isGlobalAdmin, setParentSnack, isFacilityOperator, facilities]);

  // Mock data for traceability events (replace with API call later)
  const fetchTraceabilityEvents = useCallback(async (batchId) => {
    // Simula una llamada API
    return new Promise(resolve => {
      setTimeout(() => {
        const mockEvents = [
          { id: 1, date: '2025-07-01 08:00', type: 'Entrada de Lote', batch_id: 1, details: 'Lote transferido desde Propagación.', user: 'Eduard Berrio' },
          { id: 2, date: '2025-07-03 10:30', type: 'Aplicación Nutriente', batch_id: 1, details: 'Aplicación de Nutriente X (50g).', user: 'Juan Pérez' },
          { id: 3, date: '2025-07-05 02:00', type: 'Riego', batch_id: 2, details: 'Riego general del área.', user: 'Ana Gómez' },
          { id: 4, date: '2025-07-08 09:00', type: 'Muestreo', batch_id: 1, details: 'Muestra tomada para análisis de THC.', user: 'Eduard Berrio' },
          { id: 5, date: '2025-07-10 03:00', type: 'Salida de Lote', batch_id: 1, details: 'Lote transferido a Vegetación (Room3).', user: 'Juan Pérez' },
          { id: 6, date: '2025-07-15 11:00', type: 'Cosecha', batch_id: 2, details: 'Cosecha completada. Peso húmedo: 2.5 kg.', user: 'Ana Gómez' },
          { id: 7, date: '2025-07-15 11:30', type: 'Salida de Lote', batch_id: 2, details: 'Lote de cosecha transferido a Área de Secado.', user: 'Ana Gómez' },
          { id: 8, date: '2025-07-18 14:00', type: 'Pérdida/Robo', batch_id: 1, details: '10g perdidos durante el traslado.', user: 'Eduard Berrio' }, // Mock para el nuevo evento
        ];
        // Filtra por lote si se selecciona uno
        const filteredEvents = selectedBatchForTraceability === 'all'
          ? mockEvents.filter(event => event.batch_id === batchId) // Si es 'all', muestra todos los eventos del lote actual
          : mockEvents.filter(event => event.batch_id === batchId && event.batch_id === selectedBatchForTraceability); // Si se selecciona un lote específico, filtra por ese
        resolve(filteredEvents);
      }, 500); // Simula un delay de red
    });
  }, [selectedBatchForTraceability]); // Añadir selectedBatchForTraceability como dependencia


  // --- Effects de Carga Inicial y Re-carga ---

  useEffect(() => {
    const loadInitialData = async () => {
      if (!isAppReady || (!tenantId && !isGlobalAdmin)) {
        setLoading(false);
        return;
      }
      setLoading(true); // Activa el loading para la carga inicial
      try {
        const fetchedFacs = await fetchFacilities();
        setFacilities(fetchedFacs); // Asegurarse de que facilities se guarde en el estado
        await fetchStages(); // Cargar etapas al inicio
        let initialFacilityId = ''; // Default to empty

        if (isFacilityOperator && userFacilityId) {
          initialFacilityId = userFacilityId;
        } else if (isGlobalAdmin) {
          // Para Super Admin, buscar la primera instalación que tenga un tenant_id
          const facilityWithTenantId = fetchedFacs.find(f => f.tenant_id);
          if (facilityWithTenantId) {
            initialFacilityId = facilityWithTenantId.id;
            console.log('BatchManagementPage: Global Admin - Initial facility with tenant_id:', initialFacilityId);
          } else {
            console.warn('BatchManagementPage: Global Admin - No facilities found with a valid tenant_id. Displaying message.');
            // Si no hay instalaciones con tenant_id, initialFacilityId se queda vacío.
            // fetchBatches y fetchCultivationAreas lo manejarán.
          }
        } else if (fetchedFacs.length > 0) {
          // Para usuarios de inquilino regular, usar la primera instalación si está disponible
          initialFacilityId = fetchedFacs[0].id;
        }
        
        setSelectedFacilityId(initialFacilityId);

      } catch (error) {
        console.error('BatchManagementPage: Error in initial data load:', error);
        setParentSnack('Error al cargar datos iniciales de lotes.', 'error');
        setLoading(false); // Desactiva el loading si hay un error en la carga inicial de facilities
      }
    };
    loadInitialData();
  }, [isAppReady, tenantId, isGlobalAdmin, fetchFacilities, userFacilityId, setParentSnack, fetchStages]);

  // Este useEffect se encargará de cargar los lotes y áreas cada vez que
  // selectedFacilityId cambie (ya sea por la carga inicial o por la selección del usuario).
  useEffect(() => {
    if (isAppReady && (tenantId || isGlobalAdmin)) {
      if (selectedFacilityId) {
        fetchBatches(selectedFacilityId);
        fetchCultivationAreas(selectedFacilityId);
      } else if (isGlobalAdmin) { // Si es global admin y no hay instalación seleccionada, limpiar datos
        setBatches([]);
        setCultivationAreas([]);
        setLoading(false); // Desactiva el loading si no hay facility seleccionada para global admin
      } else { // Usuario de inquilino sin selectedFacilityId (caso que no debería ocurrir si loadInitialData funciona bien)
        setBatches([]);
        setCultivationAreas([]);
        setLoading(false); // Desactiva el loading
      }
    } else { // App no lista o sin contexto de inquilino/admin
      setLoading(false);
    }
  }, [selectedFacilityId, isAppReady, tenantId, isGlobalAdmin, fetchBatches, fetchCultivationAreas]);


  // --- Handlers para Lotes (CRUD) ---

  const handleOpenBatchDialog = useCallback((batch = null) => {
    setEditingBatch(batch);
    setBatchName(batch ? batch.name : '');
    setBatchCurrentUnits(batch ? batch.current_units : '');
    setBatchEndType(batch ? batch.end_type : '');
    setBatchVariety(batch ? batch.variety : '');
    setBatchProductType(batch ? batch.product_type || '' : ''); // NUEVO: Inicializar product_type
    setBatchProjectedYield(batch ? (batch.projected_yield || '') : '');
    setBatchAdvanceToHarvestingOn(batch ? (batch.advance_to_harvesting_on ? new Date(batch.advance_to_harvesting_on).toISOString().split('T')[0] : '') : '');
    setBatchCultivationAreaId(batch ? batch.cultivation_area_id : '');
    // Inicializar los nuevos campos de origen
    setBatchOriginType(batch ? batch.origin_type || '' : '');
    setBatchOriginDetails(batch ? batch.origin_details || '' : '');
    setOpenBatchDialog(true);
    setBatchDialogLoading(false);
  }, []);

  const handleCloseBatchDialog = useCallback(() => {
    setOpenBatchDialog(false);
    setEditingBatch(null);
    setBatchName('');
    setBatchCurrentUnits('');
    setBatchEndType('');
    setBatchVariety('');
    setBatchProductType(''); // Resetear
    setBatchProjectedYield('');
    setBatchAdvanceToHarvestingOn('');
    setBatchCultivationAreaId('');
    setBatchOriginType(''); // Resetear
    setBatchOriginDetails(''); // Resetear
    setBatchDialogLoading(false);
  }, []);

  const handleSaveBatch = async (e) => {
    e.preventDefault();
    if (!batchName.trim()) { setParentSnack(SNACK_MESSAGES.BATCH_NAME_REQUIRED, 'warning'); return; }
    if (batchCurrentUnits === '' || isNaN(parseInt(batchCurrentUnits))) { setParentSnack(SNACK_MESSAGES.BATCH_UNITS_REQUIRED, 'warning'); return; }
    if (!batchEndType.trim()) { setParentSnack(SNACK_MESSAGES.BATCH_END_TYPE_REQUIRED, 'warning'); return; }
    if (!batchVariety.trim()) { setParentSnack(SNACK_MESSAGES.BATCH_VARIETY_REQUIRED, 'warning'); return; }
    if (!batchProductType.trim()) { setParentSnack(SNACK_MESSAGES.BATCH_PRODUCT_TYPE_REQUIRED, 'warning'); return; } // NUEVO: Validar product_type
    if (!batchCultivationAreaId) { setParentSnack(SNACK_MESSAGES.BATCH_AREA_REQUIRED, 'warning'); return; }
    // Nueva validación para el tipo de origen
    if (!batchOriginType.trim()) { setParentSnack(SNACK_MESSAGES.BATCH_ORIGIN_TYPE_REQUIRED, 'warning'); return; }


    setBatchDialogLoading(true);
    const headers = {};
    let effectiveTenantId = null;

    if (isGlobalAdmin) {
        if (selectedFacilityId) {
            const selectedFac = facilities.find(f => f.id === selectedFacilityId);
            if (selectedFac && selectedFac.tenant_id) {
                effectiveTenantId = String(selectedFac.tenant_id);
            } else {
                setParentSnack('Error: Como Super Admin, la instalación seleccionada no tiene un inquilino válido para crear/editar lotes.', 'error');
                setBatchDialogLoading(false);
                return;
            }
        } else {
            setParentSnack('Error: Como Super Admin, debe seleccionar una instalación para crear/editar lotes.', 'error');
            setBatchDialogLoading(false);
            return;
        }
    } else if (tenantId) {
        effectiveTenantId = String(tenantId);
    } else {
        setParentSnack(SNACK_MESSAGES.TENANT_ID_MISSING, 'error');
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
        end_type: batchEndType,
        variety: batchVariety,
        product_type: batchProductType, // NUEVO: Incluir product_type
        projected_yield: batchProjectedYield === '' ? null : parseFloat(batchProjectedYield),
        advance_to_harvesting_on: batchAdvanceToHarvestingOn || null,
        cultivation_area_id: batchCultivationAreaId,
        origin_type: batchOriginType, // Incluir nuevo campo
        origin_details: batchOriginDetails || null, // Incluir nuevo campo
      };

      if (editingBatch) {
        await api.put(`/batches/${editingBatch.id}`, batchData, { headers });
        setParentSnack(SNACK_MESSAGES.BATCH_UPDATED, 'success');
      } else {
        await api.post('/batches', batchData, { headers });
        setParentSnack(SNACK_MESSAGES.BATCH_CREATED, 'success');
      }
      await fetchBatches(selectedFacilityId); // Recargar lotes
      handleCloseBatchDialog();
    } catch (err) {
      console.error('Error al guardar lote:', err.response?.data || err.message);
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
        setParentSnack(`Error al guardar lote: ${errorMessage}`, 'error');
      }
    } finally {
      setBatchDialogLoading(false);
    }
  };

  const handleDeleteBatchConfirm = useCallback(async (batchToDelete) => {
    setLoading(true);
    const headers = {};
    let effectiveTenantId = null;

    if (isGlobalAdmin) {
      if (selectedFacilityId) {
          const selectedFac = facilities.find(f => f.id === selectedFacilityId);
          if (selectedFac && selectedFac.tenant_id) {
              effectiveTenantId = String(selectedFac.tenant_id);
          } else {
              setParentSnack('Error: Como Super Admin, la instalación seleccionada no tiene un Tenant ID válido para eliminar lotes.', 'error');
              setLoading(false);
              setConfirmDialogOpen(false);
              return;
          }
      } else {
          setParentSnack('Error: Como Super Admin, debe seleccionar una instalación para eliminar lotes.', 'error');
          setLoading(false);
          setConfirmDialogOpen(false);
          return;
      }
    } else if (tenantId) {
        effectiveTenantId = String(tenantId);
    } else {
        setParentSnack(SNACK_MESSAGES.TENANT_ID_MISSING, 'error');
        setLoading(false);
        setConfirmDialogOpen(false);
        return;
    }

    if (effectiveTenantId) {
      headers['X-Tenant-ID'] = effectiveTenantId;
    }

    try {
      await api.delete(`/batches/${batchToDelete.id}`, { headers });
      setParentSnack(SNACK_MESSAGES.BATCH_DELETED, 'info');
      await fetchBatches(selectedFacilityId);
    } catch (err) {
      console.error('Error al eliminar lote:', err.response?.data || err.message);
      const errorMessage = err.response?.data?.message || err.message;
      if (err.response?.status === 409) { // Conflict
        setParentSnack(SNACK_MESSAGES.CANNOT_DELETE_BATCH_WITH_EVENTS, 'error');
      } else if (err.response?.status === 403) {
        setParentSnack(SNACK_MESSAGES.PERMISSION_DENIED, 'error');
      } else {
        setParentSnack(`Error al eliminar lote: ${errorMessage}`, 'error');
      }
    } finally {
      setLoading(false);
      setConfirmDialogOpen(false);
    }
  }, [fetchBatches, setParentSnack, isGlobalAdmin, selectedFacilityId, facilities, tenantId]);

  const handleDeleteBatchClick = useCallback((batchToDelete) => {
    setConfirmDialogData({
      title: DIALOG_TITLES.CONFIRM_BATCH_DELETION,
      message: `¿Estás seguro de que quieres eliminar el lote "${batchToDelete.name}"? Esto fallará si tiene eventos de trazabilidad asociados.`,
      onConfirm: () => handleDeleteBatchConfirm(batchToDelete),
    });
    setConfirmDialogOpen(true);
  }, [handleDeleteBatchConfirm]);

  // --- Handlers para Detalle y Trazabilidad de Lotes ---

  const handleOpenBatchDetail = useCallback(async (batch) => {
    setCurrentBatchDetail(batch);
    // Resetear el filtro de trazabilidad al abrir un nuevo detalle de lote
    setSelectedBatchForTraceability('all');
    setOpenBatchDetailDialog(true);
    // Cargar eventos de trazabilidad para el lote seleccionado
    try {
        const events = await fetchTraceabilityEvents(batch.id);
        setTraceabilityEvents(events);
    } catch (error) {
        console.error('BatchManagementPage: Error loading traceability events:', error);
        setParentSnack('Error al cargar eventos de trazabilidad.', 'error');
    }
  }, [fetchTraceabilityEvents, setParentSnack]);

  const handleCloseBatchDetailDialog = useCallback(() => {
    setOpenBatchDetailDialog(false);
    setCurrentBatchDetail(null);
    setTraceabilityEvents([]);
    setSelectedBatchForTraceability('all'); // Asegurarse de resetear al cerrar
  }, []);

  // Handlers para el diálogo de registro de eventos
  const handleOpenRegisterEventDialog = useCallback((eventType, batchIdToPreselect = '') => {
    setCurrentEventType(eventType);
    setEventBatchId(batchIdToPreselect); // Preselecciona el lote si se pasó
    // Resetear otros campos del formulario al abrir
    setEventQuantity('');
    setEventUnit('');
    setEventDescription('');
    setEventFromLocation('');
    setEventToLocation('');
    setEventMethod('');
    setEventReason('');
    setEventNewBatchId('');
    setOpenRegisterEventDialog(true);
  }, []);

  const handleCloseRegisterEventDialog = useCallback(() => {
    setOpenRegisterEventDialog(false);
    setCurrentEventType('');
  }, []);

  const handleRegisterEvent = async (e) => {
    e.preventDefault();
    // Validaciones específicas para el nuevo evento 'loss_theft'
    if (currentEventType === 'loss_theft') {
      if (eventQuantity === '' || isNaN(parseFloat(eventQuantity)) || parseFloat(eventQuantity) <= 0) {
        setParentSnack(SNACK_MESSAGES.LOSS_THEFT_QUANTITY_REQUIRED, 'warning');
        return;
      }
      if (!eventUnit.trim()) {
        setParentSnack(SNACK_MESSAGES.LOSS_THEFT_UNIT_REQUIRED, 'warning');
        return;
      }
      if (!eventReason.trim()) {
        setParentSnack(SNACK_MESSAGES.LOSS_THEFT_REASON_REQUIRED, 'warning');
        return;
      }
    }

    // Aquí iría la lógica para enviar los datos a la API de trazabilidad
    // Por ahora, solo mostramos un snackbar
    setParentSnack(SNACK_MESSAGES.EVENT_REGISTERED_SUCCESS, 'success');
    handleCloseRegisterEventDialog();
    // En una implementación real, aquí se llamaría a fetchTraceabilityEvents
    // para actualizar la lista de eventos después de registrar uno nuevo.
    if (currentBatchDetail) {
      const updatedEvents = await fetchTraceabilityEvents(currentBatchDetail.id);
      setTraceabilityEvents(updatedEvents);
    }
  };

  // --- Handlers para la división de lotes ---
  const handleOpenSplitBatchDialog = useCallback((batch) => {
    setBatchToSplit(batch);
    setSplitQuantity('');
    setNewSplitBatchName(`${batch.name} - Split`); // Nombre sugerido
    setSplitBatchCultivationAreaId(batch.cultivation_area_id || ''); // Sugerir área actual
    setOpenSplitBatchDialog(true);
    setSplitBatchDialogLoading(false);
  }, []);

  const handleCloseSplitBatchDialog = useCallback(() => {
    setOpenSplitBatchDialog(false);
    setBatchToSplit(null);
    setSplitQuantity('');
    setNewSplitBatchName('');
    setSplitBatchCultivationAreaId('');
    setSplitBatchDialogLoading(false);
  }, []);

  const handleSplitBatch = async (e) => {
    e.preventDefault();
    if (!batchToSplit) return;

    const quantity = parseInt(splitQuantity, 10);
    // Validar que la cantidad a dividir sea mayor que 0 y menor que las unidades actuales del lote.
    // Si es igual, el lote original quedaría con 0 unidades, lo cual es una "transferencia total" o "finalización", no una división.
    // Si quieres permitir que el lote original quede con 0, cambia `quantity >= batchToSplit.current_units` a `quantity > batchToSplit.current_units`
    if (isNaN(quantity) || quantity <= 0 || quantity >= batchToSplit.current_units) {
      setParentSnack(SNACK_MESSAGES.SPLIT_QUANTITY_INVALID, 'warning');
      return;
    }
    if (!newSplitBatchName.trim()) {
      setParentSnack(SNACK_MESSAGES.NEW_BATCH_NAME_REQUIRED, 'warning');
      return;
    }
    if (!splitBatchCultivationAreaId) {
      setParentSnack(SNACK_MESSAGES.DESTINATION_AREA_REQUIRED, 'warning');
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
                setParentSnack('Error: Como Super Admin, la instalación seleccionada no tiene un inquilino válido para dividir lotes.', 'error');
                setSplitBatchDialogLoading(false);
                return;
            }
        } else {
            setParentSnack('Error: Como Super Admin, debe seleccionar una instalación para dividir lotes.', 'error');
            setSplitBatchDialogLoading(false);
            return;
        }
    } else if (tenantId) {
        effectiveTenantId = String(tenantId);
    } else {
        setParentSnack(SNACK_MESSAGES.TENANT_ID_MISSING, 'error');
        setSplitBatchDialogLoading(false);
        return;
    }

    if (effectiveTenantId) {
      headers['X-Tenant-ID'] = effectiveTenantId;
    }

    try {
      // LLAMADA REAL A LA API DE BACKEND PARA DIVIDIR EL LOTE
      const response = await api.post(`/batches/${batchToSplit.id}/split`, {
        splitQuantity: quantity,
        newBatchName: newSplitBatchName,
        newCultivationAreaId: splitBatchCultivationAreaId,
      }, { headers });

      setParentSnack(SNACK_MESSAGES.BATCH_SPLIT_SUCCESS, 'success');
      await fetchBatches(selectedFacilityId); // Recargar todos los lotes para ver los cambios
      handleCloseSplitBatchDialog();
    } catch (err) {
      console.error('Error al dividir lote:', err.response?.data || err.message);
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
        setParentSnack(`${SNACK_MESSAGES.BATCH_SPLIT_ERROR} ${errorMessage}`, 'error');
      }
    } finally {
      setSplitBatchDialogLoading(false);
    }
  };

  // --- NUEVOS Handlers para Procesar Lote ---
  const handleOpenProcessBatchDialog = useCallback((batch) => {
    setBatchToProcess(batch);
    setProcessedQuantity(batch.current_units); // Sugerir la cantidad actual por defecto
    setProcessMethod('');
    setProcessNotes('');
    setNewProductType(''); // NUEVO: Resetear el nuevo tipo de producto
    setOpenProcessBatchDialog(true);
    setProcessBatchDialogLoading(false);
  }, []);

  const handleCloseProcessBatchDialog = useCallback(() => {
    setOpenProcessBatchDialog(false);
    setBatchToProcess(null);
    setProcessedQuantity('');
    setProcessMethod('');
    setProcessNotes('');
    setNewProductType(''); // NUEVO: Resetear el nuevo tipo de producto
    setProcessBatchDialogLoading(false);
  }, []);

  const handleProcessBatch = async (e) => {
    e.preventDefault();
    if (!batchToProcess) return;

    const quantity = parseFloat(processedQuantity); // Usar parseFloat para permitir decimales
    if (isNaN(quantity) || quantity < 0 || quantity > batchToProcess.current_units) {
      setParentSnack(SNACK_MESSAGES.PROCESSED_QUANTITY_INVALID, 'warning');
      return;
    }
    if (!processMethod.trim()) {
      setParentSnack(SNACK_MESSAGES.PROCESS_METHOD_REQUIRED, 'warning');
      return;
    }
    if (!newProductType.trim()) { // NUEVO: Validar newProductType
      setParentSnack(SNACK_MESSAGES.NEW_PRODUCT_TYPE_REQUIRED, 'warning');
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
                setParentSnack('Error: Como Super Admin, la instalación seleccionada no tiene un inquilino válido para procesar lotes.', 'error');
                setProcessBatchDialogLoading(false);
                return;
            }
        } else {
            setParentSnack('Error: Como Super Admin, debe seleccionar una instalación para procesar lotes.', 'error');
            setProcessBatchDialogLoading(false);
            return;
        }
    } else if (tenantId) {
        effectiveTenantId = String(tenantId);
    } else {
        setParentSnack(SNACK_MESSAGES.TENANT_ID_MISSING, 'error');
        setProcessBatchDialogLoading(false);
        return;
    }

    if (effectiveTenantId) {
      headers['X-Tenant-ID'] = effectiveTenantId;
    }

    try {
      const response = await api.post(`/batches/${batchToProcess.id}/process`, {
        processedQuantity: quantity,
        processMethod: processMethod,
        processDescription: processNotes,
        newProductType: newProductType, // NUEVO: Incluir newProductType
      }, { headers });

      setParentSnack(SNACK_MESSAGES.BATCH_PROCESSED_SUCCESS, 'success');
      await fetchBatches(selectedFacilityId); // Recargar todos los lotes para ver los cambios
      handleCloseProcessBatchDialog();
    } catch (err) {
      console.error('Error al procesar lote:', err.response?.data || err.message);
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
        setParentSnack(`${SNACK_MESSAGES.BATCH_PROCESSED_ERROR} ${errorMessage}`, 'error');
      }
    } finally {
      setProcessBatchDialogLoading(false);
    }
  };

  // --- NUEVOS Handlers para Registrar Lote Externo ---
  const handleOpenExternalBatchDialog = useCallback(() => {
    setExternalBatchName('');
    setExternalBatchUnits('');
    setExternalBatchProductType('');
    setExternalBatchVariety('');
    setExternalBatchOriginDetails('');
    setExternalBatchCultivationAreaId('');
    setOpenExternalBatchDialog(true);
    setExternalBatchDialogLoading(false);
  }, []);

  const handleCloseExternalBatchDialog = useCallback(() => {
    setOpenExternalBatchDialog(false);
    setExternalBatchName('');
    setExternalBatchUnits('');
    setExternalBatchProductType('');
    setExternalBatchVariety('');
    setExternalBatchOriginDetails('');
    setExternalBatchCultivationAreaId('');
    setExternalBatchDialogLoading(false);
  }, []);

  const handleSaveExternalBatch = async (e) => {
    e.preventDefault();
    if (!externalBatchName.trim()) { setParentSnack(SNACK_MESSAGES.BATCH_NAME_REQUIRED, 'warning'); return; }
    if (externalBatchUnits === '' || isNaN(parseInt(externalBatchUnits))) { setParentSnack(SNACK_MESSAGES.BATCH_UNITS_REQUIRED, 'warning'); return; }
    if (!externalBatchProductType.trim()) { setParentSnack(SNACK_MESSAGES.BATCH_PRODUCT_TYPE_REQUIRED, 'warning'); return; }
    if (!externalBatchVariety.trim()) { setParentSnack(SNACK_MESSAGES.BATCH_VARIETY_REQUIRED, 'warning'); return; }
    if (!externalBatchCultivationAreaId) { setParentSnack(SNACK_MESSAGES.BATCH_AREA_REQUIRED, 'warning'); return; }
    if (!externalBatchOriginDetails.trim()) { setParentSnack('Detalles del origen externo son obligatorios.', 'warning'); return; }


    setExternalBatchDialogLoading(true);
    const headers = {};
    let effectiveTenantId = null;

    if (isGlobalAdmin) {
        if (selectedFacilityId) {
            const selectedFac = facilities.find(f => f.id === selectedFacilityId);
            if (selectedFac && selectedFac.tenant_id) {
                effectiveTenantId = String(selectedFac.tenant_id);
            } else {
                setParentSnack('Error: Como Super Admin, la instalación seleccionada no tiene un inquilino válido para registrar lotes externos.', 'error');
                setExternalBatchDialogLoading(false);
                return;
            }
        } else {
            setParentSnack('Error: Como Super Admin, debe seleccionar una instalación para registrar lotes externos.', 'error');
            setExternalBatchDialogLoading(false);
            return;
        }
    } else if (tenantId) {
        effectiveTenantId = String(tenantId);
    } else {
        setParentSnack(SNACK_MESSAGES.TENANT_ID_MISSING, 'error');
        setExternalBatchDialogLoading(false);
        return;
    }

    if (effectiveTenantId) {
      headers['X-Tenant-ID'] = effectiveTenantId;
    }

    try {
      const batchData = {
        name: externalBatchName,
        current_units: parseInt(externalBatchUnits, 10),
        product_type: externalBatchProductType,
        variety: externalBatchVariety,
        cultivation_area_id: externalBatchCultivationAreaId,
        origin_type: 'external_purchase', // Siempre 'external_purchase' para lotes externos
        origin_details: externalBatchOriginDetails,
        end_type: 'N/A', // O un valor predeterminado si no aplica para lotes externos al inicio
        projected_yield: null,
        advance_to_harvesting_on: null,
      };

      await api.post('/batches', batchData, { headers });
      setParentSnack(SNACK_MESSAGES.EXTERNAL_BATCH_CREATED, 'success');
      await fetchBatches(selectedFacilityId); // Recargar lotes
      handleCloseExternalBatchDialog();
    } catch (err) {
      console.error('Error al registrar lote externo:', err.response?.data || err.message);
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
        setParentSnack(`${SNACK_MESSAGES.EXTERNAL_BATCH_ERROR} ${errorMessage}`, 'error');
      }
    } finally {
      setExternalBatchDialogLoading(false);
    }
  };


  // Renderiza el formulario específico para cada tipo de evento
  const renderEventForm = useCallback(() => {
    const unitOptions = ['g', 'kg', 'unidades', 'ml', 'L'];

    return (
      <Box component="form" onSubmit={handleRegisterEvent} sx={{ mt: 2 }}>
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel sx={{ color: '#fff' }}>Lote Afectado</InputLabel>
          <Select value={eventBatchId} onChange={(e) => setEventBatchId(e.target.value)} required sx={{ color: '#fff', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' }, '.MuiSvgIcon-root': { color: '#fff' } }}
            MenuProps={{ PaperProps: { sx: { bgcolor: '#004060', color: '#fff' } } }}
          >
            <MenuItem value="" disabled><em>Seleccionar Lote</em></MenuItem>
            {batches.length === 0 ? (
              <MenuItem value="" disabled><em>No hay lotes disponibles</em></MenuItem>
            ) : (
              batches.map(batch => <MenuItem key={batch.id} value={batch.id}>{batch.name}</MenuItem>)
            )}
          </Select>
        </FormControl>

        {currentEventType === 'movement' && (
          <>
            <TextField label="Cantidad" type="number" value={eventQuantity} onChange={(e) => setEventQuantity(e.target.value)} fullWidth required sx={{ mb: 2, '& .MuiInputBase-input': { color: '#fff' }, '& .MuiInputLabel-root': { color: '#fff' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' } }} />
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel sx={{ color: '#fff' }}>Unidad</InputLabel>
              <Select value={eventUnit} onChange={(e) => setEventUnit(e.target.value)} required sx={{ color: '#fff', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' }, '.MuiSvgIcon-root': { color: '#fff' } }}
                MenuProps={{ PaperProps: { sx: { bgcolor: '#004060', color: '#fff' } } }}
              >
                {unitOptions.map(unit => <MenuItem key={unit} value={unit}>{unit}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Origen (ej. 'Room2')" value={eventFromLocation} onChange={(e) => setEventFromLocation(e.target.value)} fullWidth sx={{ mb: 2, '& .MuiInputBase-input': { color: '#fff' }, '& .MuiInputLabel-root': { color: '#fff' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' } }} />
            <TextField label="Destino (ej. 'Secado')" value={eventToLocation} onChange={(e) => setEventToLocation(e.target.value)} fullWidth required sx={{ mb: 2, '& .MuiInputBase-input': { color: '#fff' }, '& .MuiInputLabel-root': { color: '#fff' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' } }} />
          </>
        )}

        {currentEventType === 'cultivation' && (
          <TextField label="Tipo de Evento (ej. Riego, Poda, Aplicación)" value={eventMethod} onChange={(e) => setEventMethod(e.target.value)} fullWidth required sx={{ mb: 2, '& .MuiInputBase-input': { color: '#fff' }, '& .MuiInputLabel-root': { color: '#fff' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' } }} />
        )}

        {currentEventType === 'harvest' && (
          <>
            <TextField label="Peso Húmedo (g)" type="number" value={eventQuantity} onChange={(e) => setEventQuantity(e.target.value)} fullWidth required sx={{ mb: 2, '& .MuiInputBase-input': { color: '#fff' }, '& .MuiInputLabel-root': { color: '#fff' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' } }} />
            <TextField label="Nuevo ID de Lote de Cosecha" value={eventNewBatchId} onChange={(e) => setEventNewBatchId(e.target.value)} fullWidth required sx={{ mb: 2, '& .MuiInputBase-input': { color: '#fff' }, '& .MuiInputLabel-root': { color: '#fff' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' } }} />
          </>
        )}

        {currentEventType === 'sampling' && (
          <>
            <TextField label="Cantidad de Muestra" type="number" value={eventQuantity} onChange={(e) => setEventQuantity(e.target.value)} fullWidth required sx={{ mb: 2, '& .MuiInputBase-input': { color: '#fff' }, '& .MuiInputLabel-root': { color: '#fff' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' } }} />
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel sx={{ color: '#fff' }}>Unidad de Muestra</InputLabel>
              <Select value={eventUnit} onChange={(e) => setEventUnit(e.target.value)} required sx={{ color: '#fff', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' }, '.MuiSvgIcon-root': { color: '#fff' } }}
                MenuProps={{ PaperProps: { sx: { bgcolor: '#004060', color: '#fff' } } }}
              >
                {unitOptions.map(unit => <MenuItem key={unit} value={unit}>{unit}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Propósito del Muestreo" value={eventReason} onChange={(e) => setEventReason(e.target.value)} fullWidth sx={{ mb: 2, '& .MuiInputBase-input': { color: '#fff' }, '& .MuiInputLabel-root': { color: '#fff' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' } }} />
          </>
        )}

        {currentEventType === 'destruction' && (
          <>
            <TextField label="Cantidad Destruida" type="number" value={eventQuantity} onChange={(e) => setEventQuantity(e.target.value)} fullWidth required sx={{ mb: 2, '& .MuiInputBase-input': { color: '#fff' }, '& .MuiInputLabel-root': { color: '#fff' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' } }} />
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel sx={{ color: '#fff' }}>Unidad de Destrucción</InputLabel>
              <Select value={eventUnit} onChange={(e) => setEventUnit(e.target.value)} required sx={{ color: '#fff', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' }, '.MuiSvgIcon-root': { color: '#fff' } }}
                MenuProps={{ PaperProps: { sx: { bgcolor: '#004060', color: '#fff' } } }}
              >
                {unitOptions.map(unit => <MenuItem key={unit} value={unit}>{unit}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Método de Destrucción" value={eventMethod} onChange={(e) => setEventMethod(e.target.value)} fullWidth required sx={{ mb: 2, '& .MuiInputBase-input': { color: '#fff' }, '& .MuiInputLabel-root': { color: '#fff' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' } }} />
            <TextField label="Razón de la Destrucción" multiline rows={3} value={eventReason} onChange={(e) => setEventReason(e.target.value)} fullWidth required sx={{ mb: 2, '& .MuiInputBase-input': { color: '#fff' }, '& .MuiInputLabel-root': { color: '#fff' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' } }} />
          </>
        )}

        {/* NUEVO: Formulario para el evento de Pérdida/Robo */}
        {currentEventType === 'loss_theft' && (
          <>
            <TextField label="Cantidad Perdida/Robada" type="number" value={eventQuantity} onChange={(e) => setEventQuantity(e.target.value)} fullWidth required sx={{ mb: 2, '& .MuiInputBase-input': { color: '#fff' }, '& .MuiInputLabel-root': { color: '#fff' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' } }} />
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel sx={{ color: '#fff' }}>Unidad de Pérdida/Robo</InputLabel>
              <Select value={eventUnit} onChange={(e) => setEventUnit(e.target.value)} required sx={{ color: '#fff', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' }, '.MuiSvgIcon-root': { color: '#fff' } }}
                MenuProps={{ PaperProps: { sx: { bgcolor: '#004060', color: '#fff' } } }}
              >
                {unitOptions.map(unit => <MenuItem key={unit} value={unit}>{unit}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Razón de Pérdida/Robo" multiline rows={3} value={eventReason} onChange={(e) => setEventReason(e.target.value)} fullWidth required sx={{ mb: 2, '& .MuiInputBase-input': { color: '#fff' }, '& .MuiInputLabel-root': { color: '#fff' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' } }} />
          </>
        )}

        <TextField label="Notas Adicionales" multiline rows={3} value={eventDescription} onChange={(e) => setEventDescription(e.target.value)} fullWidth sx={{ mb: 2, '& .MuiInputBase-input': { color: '#fff' }, '& .MuiInputLabel-root': { color: '#fff' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' } }} />
        <DialogActions sx={{ bgcolor: '#3a506b', mt: 2 }}>
          <Button onClick={handleCloseRegisterEventDialog} sx={{ color: '#a0aec0' }}>{BUTTON_LABELS.CANCEL}</Button>
          <Button type="submit" variant="contained" sx={{ bgcolor: '#4CAF50', '&:hover': { bgcolor: '#43A047' } }} disabled={isFacilityOperator}>{BUTTON_LABELS.REGISTER}</Button>
        </DialogActions>
      </Box>
    );
  }, [currentEventType, eventBatchId, eventQuantity, eventUnit, eventDescription, eventFromLocation, eventToLocation, eventMethod, eventReason, eventNewBatchId, handleRegisterEvent, handleCloseRegisterEventDialog, batches, isFacilityOperator]);

  // Filtrar y limpiar los datos de los lotes para el DataGrid
  const cleanedBatches = useMemo(() => {
    console.log("Raw batches state:", batches); // Log the raw batches state
    if (!Array.isArray(batches)) {
      console.warn("DataGrid: 'batches' prop is not an array:", batches);
      return [];
    }
    const filtered = batches.filter(batch => {
      if (!batch || typeof batch.id === 'undefined' || batch.id === null) {
        console.warn("DataGrid: Filtering out invalid batch (missing/null ID or not an object):", batch); // Log invalid batch
        return false;
      }
      return true;
    });
    console.log("Cleaned batches for DataGrid:", filtered); // Log the cleaned batches
    return filtered;
  }, [batches]);

  // Definición de las columnas para el DataGrid
  const columns = useMemo(() => [
    { field: 'name', headerName: 'Batch Name', flex: 1, minWidth: 150, renderCell: (params) => ( // Flexible
      <Typography variant="body2" sx={{ color: '#e2e8f0' }}>{params.value}</Typography>
    )},
    { field: 'variety', headerName: 'Variety', width: 100, renderCell: (params) => ( // Fixed width
      <Typography variant="body2" sx={{ color: '#e2e8f0' }}>{params.value}</Typography>
    )},
    { field: 'product_type', headerName: 'Product Type', width: 150, renderCell: (params) => ( // NEW: Column for product_type
      <Typography variant="body2" sx={{ color: '#e2e8f0' }}>{params.value || 'N/A'}</Typography>
    )},
    { field: 'current_units', headerName: 'Units', type: 'number', width: 95, renderCell: (params) => ( // Fixed width, adjusted
      <Typography variant="body2" sx={{ color: '#e2e8f0' }}>{params.value}</Typography>
    )},
    { field: 'end_type', headerName: 'End Type', width: 95, renderCell: (params) => ( // Fixed width, adjusted
      <Typography variant="body2" sx={{ color: '#e2e8f0' }}>{params.value}</Typography>
    )},
    {
      field: 'projected_yield',
      headerName: 'Projected Yield',
      type: 'number',
      width: 140, // Fixed width, increased for "Projected Yield"
      renderCell: (params) => (
        <Typography variant="body2" sx={{ color: '#e2e8f0' }}>
          {params.value !== null && params.value !== undefined ? `${params.value} kg` : 'N/A'}
        </Typography>
      )
    },
    {
      field: 'advance_to_harvesting_on',
      headerName: 'Harvest Date',
      width: 120, // Fixed width, adjusted
      renderCell: (params) => (
        <Typography variant="body2" sx={{ color: '#e2e8f0' }}>
          {params.value ? new Date(params.value).toLocaleDateString() : 'N/A'}
        </Typography>
      )
    },
    {
      field: 'cultivation_area_name',
      headerName: 'Cultivation Area',
      flex: 1, minWidth: 150,
      valueGetter: (params) => {
        if (!params || !params.row) return '';
        if (params.row.cultivation_area && params.row.cultivation_area.name) {
            return params.row.cultivation_area.name;
        }
        const cultivationAreaId = params.row.cultivation_area_id;
        if (cultivationAreaId === undefined || cultivationAreaId === null) {
            return '';
        }
        if (!Array.isArray(cultivationAreas)) {
            return '';
        }
        const area = cultivationAreas.find(ca => ca.id === cultivationAreaId);
        return area ? area.name : '';
      },
      renderCell: (params) => (
        <Typography variant="body2" sx={{ color: '#e2e8f0' }}>{params.value}</Typography>
      )
    },
    
    {
      field: 'current_stage_name',
      headerName: 'Current Stage',
      width: 120, // Fixed width, adjusted
      valueGetter: (params) => {
        if (!params || !params.row) return '';
        if (params.row.cultivation_area && params.row.cultivation_area.name) {
            return params.row.cultivation_area.name;
        }
        const cultivationAreaId = params.row.cultivation_area_id;
        if (cultivationAreaId === undefined || cultivationAreaId === null) {
            return '';
        }
        if (!Array.isArray(cultivationAreas)) {
            return '';
        }
        const area = cultivationAreas.find(ca => ca.id === cultivationAreaId);
        return area ? area.name : '';
      },
      renderCell: (params) => (
        <Typography variant="body2" sx={{ color: '#e2e8f0' }}>{params.value}</Typography>
      )
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 200, // Increased to accommodate the new button
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
            disabled={isFacilityOperator}
          >
            <EditIcon sx={{ fontSize: 20, color: isFacilityOperator ? '#666' : '#fff' }} />
          </IconButton>
          <IconButton
            size="small"
            color="secondary" // Changed to secondary for differentiation
            onClick={() => handleOpenSplitBatchDialog(params.row)}
            aria-label={`Split ${params.row.name}`}
            disabled={isFacilityOperator || params.row.current_units <= 1} // Cannot split if 1 or fewer units
          >
            <CallSplitIcon sx={{ fontSize: 20, color: isFacilityOperator || params.row.current_units <= 1 ? '#666' : '#ffa726' }} /> {/* Orange color */}
          </IconButton>
          {/* NEW PROCESS BUTTON */}
          <IconButton
            size="small"
            color="success" // Color for processing action
            onClick={() => handleOpenProcessBatchDialog(params.row)}
            aria-label={`Process ${params.row.name}`}
            disabled={isFacilityOperator || params.row.current_units <= 0} // Cannot process if no units
          >
            <AutorenewIcon sx={{ fontSize: 20, color: isFacilityOperator || params.row.current_units <= 0 ? '#666' : '#4CAF50' }} /> {/* Green for process */}
          </IconButton>
          <IconButton
            size="small"
            color="error"
            onClick={() => handleDeleteBatchClick(params.row)}
            aria-label={`Delete ${params.row.name}`}
            disabled={isFacilityOperator}
          >
            <DeleteIcon sx={{ fontSize: 20, color: isFacilityOperator ? '#666' : '#f44336' }} />
          </IconButton>
        </Box>
      ),
    },
  ], [handleOpenBatchDetail, handleOpenBatchDialog, handleDeleteBatchClick, handleOpenSplitBatchDialog, handleOpenProcessBatchDialog, isFacilityOperator, cultivationAreas, stages]);
  
  console.log("DataGrid will render with batches:", cleanedBatches); // Final log before DataGrid

  // Función para obtener el label y placeholder dinámico para origin_details
  const getOriginDetailsLabel = useCallback(() => {
    switch (batchOriginType) {
      case 'seeds':
        return { label: 'Proveedor de Semillas / Lote de Semillas', placeholder: 'Ej: Green Genetics Lote #XYZ' };
      case 'clones':
        return { label: 'ID de Planta Madre', placeholder: 'Ej: Madre #123' };
      case 'tissue_culture':
        return { label: 'Laboratorio / Lote de Tejido', placeholder: 'Ej: BioLab Lote TC-456' };
      case 'external_purchase':
        return { label: 'Proveedor Externo / ID de Lote Externo', placeholder: 'Ej: FarmCo Lote #ABC' };
      default:
        return { label: 'Detalles del Origen', placeholder: 'Información adicional sobre el origen' };
    }
  }, [batchOriginType]);

  // Función para obtener el label y placeholder dinámico para externalBatchOriginDetails
  const getExternalOriginDetailsLabel = useCallback(() => {
    return { label: 'Detalles del Origen Externo', placeholder: 'Ej: Nombre del proveedor, número de factura, lote de importación' };
  }, []);


  return (
    <Box sx={{
      p: { xs: 2, sm: 3 },
      minHeight: 'calc(100vh - 64px)',
      bgcolor: '#004d80',
      color: '#fff',
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <InventoryIcon sx={{ fontSize: 32, color: '#fff', mr: 1 }} />
        <Typography variant="h5" sx={{ fontWeight: 600, color: '#fff' }}>
          Gestión de Lotes
        </Typography>
        <FormControl sx={{ minWidth: 200, mr: 1 }}>
          <InputLabel id="facility-select-label" sx={{ color: '#fff' }}>Instalación</InputLabel>
          <Select
            labelId="facility-select-label"
            value={selectedFacilityId}
            label="Instalación"
            onChange={(e) => {
                setSelectedFacilityId(e.target.value);
            }}
            disabled={loading || facilities.length === 0 || isFacilityOperator}
            sx={{
              color: '#fff',
              '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.8)' },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
              '.MuiSvgIcon-root': { color: '#fff' },
            }}
            MenuProps={{
              PaperProps: {
                sx: { bgcolor: '#004060', color: '#fff' },
              },
            }}
          >
            {facilities.length === 0 && !loading ? (
              <MenuItem value="" sx={{ color: '#aaa' }}>
                <em>No hay instalaciones disponibles</em>
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
        <Box sx={{ flexGrow: 1 }} />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenBatchDialog(null)}
          disabled={loading || isFacilityOperator}
          sx={{
            borderRadius: 2,
            bgcolor: '#4CAF50',
            '&:hover': { bgcolor: '#43A047' },
            mr: 1, // Añadir margen a la derecha
          }}
        >
          {BUTTON_LABELS.ADD_NEW_BATCH}
        </Button>
        {/* NUEVO BOTÓN PARA REGISTRAR LOTE EXTERNO */}
        <Button
          variant="contained"
          startIcon={<LocalShippingIcon />}
          onClick={handleOpenExternalBatchDialog}
          disabled={loading || isFacilityOperator || !selectedFacilityId} // Deshabilitar si no hay instalación seleccionada
          sx={{
            borderRadius: 2,
            bgcolor: '#007bff', // Un color diferente para distinguirlo
            '&:hover': { bgcolor: '#0056b3' },
          }}
        >
          {BUTTON_LABELS.REGISTER_EXTERNAL_BATCH}
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400, color: '#fff' }}> {/* Altura ajustada para el spinner */}
          <CircularProgress color="inherit" />
          <Typography variant="body1" sx={{ ml: 2, color: '#fff' }}>Cargando lotes...</Typography>
        </Box>
      ) : (
        <Box sx={{ height: 'auto', minHeight: 400, width: '100%' }}>
          {cleanedBatches.length === 0 && selectedFacilityId ? (
            <Typography variant="h6" sx={{ color: '#aaa', textAlign: 'center', width: '100%', mt: 5 }}>
              No hay lotes disponibles para esta instalación.
            </Typography>
          ) : cleanedBatches.length === 0 && !selectedFacilityId && isGlobalAdmin && facilities.length > 0 ? (
            <Typography variant="h6" sx={{ color: '#aaa', textAlign: 'center', width: '100%', mt: 5 }}>
              Como Super Admin, por favor selecciona una instalación con un Tenant ID válido para ver los lotes.
            </Typography>
          ) : cleanedBatches.length === 0 && !selectedFacilityId && isGlobalAdmin && facilities.length === 0 ? (
            <Typography variant="h6" sx={{ color: '#aaa', textAlign: 'center', width: '100%', mt: 5 }}>
              Como Super Admin, no hay instalaciones registradas en el sistema. Por favor, crea una instalación.
            </Typography>
          ) : (
            <DataGrid
              rows={cleanedBatches}
              columns={columns}
              getRowId={(row) => row.id || row.ID || row.batch_id || row.batchId || row._id || row.id}
              pageSize={10}
              pageSizeOptions={[5, 10, 25, 50]}
              initialState={{
                pagination: {
                  paginationModel: { pageSize: 10 },
                },
              }}
              disableRowSelectionOnClick
              // Usar nuestro componente de toolbar personalizado
              slots={{ toolbar: CustomDataGridToolbar }}
              sx={{
                bgcolor: '#2d3748', // Fondo del DataGrid
                color: '#e2e8f0', // Color de texto general
                border: 'none', // Sin borde
                minHeight: 350,
                // Estilos para los encabezados de columna
                '& .MuiDataGrid-columnHeaders': {
                  bgcolor: '#3a506b',
                  borderBottom: '1px solid #4a5568',
                },
                // Estilos para el texto dentro de los encabezados, asegurando visibilidad
                '& .MuiDataGrid-columnHeaderTitle': {
                  fontWeight: 'bold',
                  color: '#4f5155 !important', // Asegurar que el texto del título sea blanco y visible
                },
                // Estilos para los iconos de ordenación en los encabezados
                '& .MuiDataGrid-iconButtonContainer': {
                  color: '#e2e8f0 !important', // Color de los iconos de ordenación
                },
                '& .MuiDataGrid-sortIcon': {
                  color: '#4cb051 !important', // Color del icono de ordenación
                },
                // Estilos para las celdas de datos
                '& .MuiDataGrid-cell': {
                  borderColor: 'rgba(255,255,255,0.1)',
                  color: '#e2e8f0',
                },
                // Estilos para las filas (efecto cebra y hover)
                '& .MuiDataGrid-row': {
                  '&:nth-of-type(odd)': {
                    backgroundColor: 'rgba(0,0,0,0.05)', // Rayas cebra suaves
                  },
                  '&:hover': {
                    backgroundColor: 'rgba(255,255,255,0.1)', // Fondo al pasar el ratón
                  },
                },
                // Estilos para el pie de página (paginación)
                '& .MuiDataGrid-footerContainer': {
                  bgcolor: '#3a506b',
                  color: '#fff',
                  borderTop: '1px solid #4a5568',
                },
                '& .MuiTablePagination-root': {
                  color: '#000', // Color del texto de la paginación
                },
                // Estilos para los selectores de paginación (rows per page)
                '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                  color: '#fff !important', // Texto de "Rows per page" y el contador
                },
                '& .MuiTablePagination-select': {
                  color: '#fff !important', // El número del selector (ej. "10")
                  '.MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255,255,255,0.5) !important', // Borde del selector
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255,255,255,0.8) !important',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#fff !important',
                  },
                },
                '& .MuiTablePagination-actions .MuiButtonBase-root': {
                  color: '#fff !important', // Botones de flecha de paginación
                },
                // Estilos para los iconos generales del DataGrid (ordenación, paginación)
                '& .MuiSvgIcon-root': {
                  color: '#4cb051',
                },
                // Estilos para el overlay de carga/sin filas
                '& .MuiDataGrid-overlay': {
                  bgcolor: '#2d3748',
                },
                // Estilos para el spinner de carga
                '& .MuiCircularProgress-root': {
                  color: '#4cb051',
                },
              }}
            />
          )}
        </Box>
      )}

      {/* --- Diálogo para Añadir/Editar Lote --- */}
      <Dialog open={openBatchDialog} onClose={handleCloseBatchDialog} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: '#2d3748', color: '#e2e8f0', borderRadius: 2 } }}
      >
        <DialogTitle sx={{ bgcolor: '#3a506b', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {editingBatch ? DIALOG_TITLES.EDIT_BATCH : DIALOG_TITLES.ADD_BATCH}
          <IconButton onClick={handleCloseBatchDialog} sx={{ color: '#e2e8f0' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <form onSubmit={handleSaveBatch}>
          <DialogContent sx={{ pt: '20px !important' }}>
            <TextField
              label="Nombre del Lote"
              value={batchName}
              onChange={e => setBatchName(e.target.value)}
              fullWidth
              required
              sx={{ mt: 1, mb: 2, '& .MuiInputBase-input': { color: '#fff' }, '& .MuiInputLabel-root': { color: '#fff' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' } }}
              disabled={batchDialogLoading || isFacilityOperator}
            />
            <TextField
              label="Unidades Actuales"
              type="number"
              value={batchCurrentUnits}
              onChange={e => setBatchCurrentUnits(e.target.value)}
              fullWidth
              required
              sx={{ mb: 2, '& .MuiInputBase-input': { color: '#fff' }, '& .MuiInputLabel-root': { color: '#fff' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' } }}
              disabled={batchDialogLoading || isFacilityOperator}
            />
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel sx={{ color: '#fff' }}>Tipo de Finalización</InputLabel>
              <Select
                value={batchEndType}
                onChange={e => setBatchEndType(e.target.value)}
                required
                sx={{ color: '#fff', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' }, '.MuiSvgIcon-root': { color: '#fff' } }}
                MenuProps={{ PaperProps: { sx: { bgcolor: '#004060', color: '#fff' } } }}
                disabled={batchDialogLoading || isFacilityOperator}
              >
                <MenuItem value="" disabled><em>Seleccionar Tipo</em></MenuItem>
                <MenuItem value="Dried">Dried</MenuItem>
                <MenuItem value="Fresh">Fresh</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Variedad"
              value={batchVariety}
              onChange={e => setBatchVariety(e.target.value)}
              fullWidth
              required
              sx={{ mb: 2, '& .MuiInputBase-input': { color: '#fff' }, '& .MuiInputLabel-root': { color: '#fff' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' } }}
              disabled={batchDialogLoading || isFacilityOperator}
            />
            {/* NUEVO: Campo para Product Type */}
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel sx={{ color: '#fff' }}>Tipo de Producto</InputLabel>
              <Select
                value={batchProductType}
                onChange={e => setBatchProductType(e.target.value)}
                required
                sx={{ color: '#fff', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' }, '.MuiSvgIcon-root': { color: '#fff' } }}
                MenuProps={{ PaperProps: { sx: { bgcolor: '#004060', color: '#fff' } } }}
                disabled={batchDialogLoading || isFacilityOperator}
              >
                <MenuItem value="" disabled><em>Seleccionar Tipo de Producto</em></MenuItem>
                {HEALTH_CANADA_PRODUCT_TYPES.map(type => (
                  <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel sx={{ color: '#fff' }}>Tipo de Origen</InputLabel>
              <Select
                value={batchOriginType}
                onChange={e => {
                  setBatchOriginType(e.target.value);
                  setBatchOriginDetails(''); // Limpiar detalles al cambiar el tipo
                }}
                required
                sx={{ color: '#fff', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' }, '.MuiSvgIcon-root': { color: '#fff' } }}
                MenuProps={{ PaperProps: { sx: { bgcolor: '#004060', color: '#fff' } } }}
                disabled={batchDialogLoading || isFacilityOperator}
              >
                <MenuItem value="" disabled><em>Seleccionar Origen</em></MenuItem>
                <MenuItem value="seeds">Semillas</MenuItem>
                <MenuItem value="clones">Clones (Planta Madre)</MenuItem>
                <MenuItem value="tissue_culture">Cultivo de Tejido</MenuItem>
                <MenuItem value="external_purchase">Compra Externa</MenuItem>
              </Select>
            </FormControl>
            {batchOriginType && ( // Mostrar campo de detalles solo si se selecciona un tipo de origen
              <TextField
                label={getOriginDetailsLabel().label}
                placeholder={getOriginDetailsLabel().placeholder}
                value={batchOriginDetails}
                onChange={e => setBatchOriginDetails(e.target.value)}
                fullWidth
                multiline
                rows={2}
                sx={{ mb: 2, '& .MuiInputBase-input': { color: '#fff' }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' } }}
                disabled={batchDialogLoading || isFacilityOperator}
              />
            )}
            <TextField
              label="Rendimiento Proyectado"
              type="number"
              value={batchProjectedYield}
              onChange={e => setBatchProjectedYield(e.target.value)}
              fullWidth
              sx={{ mb: 2, '& .MuiInputBase-input': { color: '#fff' }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' } }}
              disabled={batchDialogLoading || isFacilityOperator}
            />
            <TextField
              label="Fecha de Cosecha (Opcional)"
              type="date"
              value={batchAdvanceToHarvestingOn}
              onChange={e => setBatchAdvanceToHarvestingOn(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
              sx={{ mb: 2, '& .MuiInputBase-input': { color: '#fff' }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' } }}
              disabled={batchDialogLoading || isFacilityOperator}
            />
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel sx={{ color: '#fff' }}>Área de Cultivo</InputLabel>
              <Select
                value={batchCultivationAreaId}
                onChange={e => setBatchCultivationAreaId(e.target.value)}
                required
                sx={{ color: '#fff', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' }, '.MuiSvgIcon-root': { color: '#fff' } }}
                MenuProps={{ PaperProps: { sx: { bgcolor: '#004060', color: '#fff' } } }}
                disabled={batchDialogLoading || isFacilityOperator}
              >
                <MenuItem value="" disabled><em>Seleccionar Área</em></MenuItem>
                {cultivationAreas.length === 0 ? (
                  <MenuItem value="" disabled><em>No hay áreas de cultivo disponibles en la instalación seleccionada</em></MenuItem>
                ) : (
                  cultivationAreas.map(area => <MenuItem key={area.id} value={area.id}>{area.name} ({area.current_stage?.name || 'Sin Etapa'})</MenuItem>)
                )}
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions sx={{ bgcolor: '#3a506b' }}>
            <Button onClick={handleCloseBatchDialog} disabled={batchDialogLoading || isFacilityOperator} sx={{ color: '#a0aec0' }}>{BUTTON_LABELS.CANCEL}</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={batchDialogLoading || !batchName.trim() || batchCurrentUnits === '' || !batchEndType.trim() || !batchVariety.trim() || !batchProductType.trim() || !batchCultivationAreaId || !batchOriginType.trim() || isFacilityOperator}
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

      {/* --- Diálogo de Detalle del Lote (con Trazabilidad) --- */}
      <Dialog open={openBatchDetailDialog} onClose={handleCloseBatchDetailDialog} maxWidth="lg" fullWidth
        PaperProps={{ sx: { bgcolor: '#2d3748', color: '#e2e8f0', borderRadius: 2, minHeight: '80vh' } }}
      >
        <DialogTitle sx={{
          bgcolor: '#3a506b',
          color: '#fff',
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
          pb: { xs: 2, sm: 1 },
          pt: { xs: 2, sm: 1 },
          px: { xs: 2, sm: 3 },
          gap: { xs: 2, sm: 1 },
          flexWrap: 'wrap',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#fff', mr: 1 }}>
              {DIALOG_TITLES.BATCH_DETAIL} {currentBatchDetail?.name}
            </Typography>
            <IconButton onClick={handleCloseBatchDetailDialog} sx={{ color: '#e2e8f0', ml: 'auto' }}>
              <CloseIcon />
            </IconButton>
          </Box>

          <Box sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1,
            alignItems: 'center',
            flexGrow: 1,
            justifyContent: { xs: 'flex-start', sm: 'flex-end' },
          }}>
            <Button
              variant="contained"
              startIcon={<TrendingUpIcon />}
              onClick={() => handleOpenRegisterEventDialog('movement', currentBatchDetail.id)}
              sx={{ bgcolor: '#4a5568', color: '#e2e8f0', '&:hover': { bgcolor: '#66748c' }, borderRadius: 1, textTransform: 'none', py: '6px', px: '10px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
              disabled={isFacilityOperator}
            >
              {BUTTON_LABELS.REGISTER_MOVEMENT}
            </Button>
            <Button
              variant="contained"
              startIcon={<EcoIcon />}
              onClick={() => handleOpenRegisterEventDialog('cultivation', currentBatchDetail.id)}
              sx={{ bgcolor: '#4a5568', color: '#e2e8f0', '&:hover': { bgcolor: '#66748c' }, borderRadius: 1, textTransform: 'none', py: '6px', px: '10px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
              disabled={isFacilityOperator}
            >
              {BUTTON_LABELS.REGISTER_CULTIVATION_EVENT}
            </Button>
            <Button
              variant="contained"
              startIcon={<HarvestIcon />}
              onClick={() => handleOpenRegisterEventDialog('harvest', currentBatchDetail.id)}
              sx={{ bgcolor: '#4a5568', color: '#e2e8f0', '&:hover': { bgcolor: '#66748c' }, borderRadius: 1, textTransform: 'none', py: '6px', px: '10px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
              disabled={isFacilityOperator}
            >
              {BUTTON_LABELS.REGISTER_HARVEST}
            </Button>
            <Button
              variant="contained"
              startIcon={<ScienceIcon />}
              onClick={() => handleOpenRegisterEventDialog('sampling', currentBatchDetail.id)}
              sx={{ bgcolor: '#4a5568', color: '#e2e8f0', '&:hover': { bgcolor: '#66748c' }, borderRadius: 1, textTransform: 'none', py: '6px', px: '10px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
              disabled={isFacilityOperator}
            >
              {BUTTON_LABELS.REGISTER_SAMPLING}
            </Button>
            <Button
              variant="contained"
              startIcon={<DeleteForeverIcon />}
              onClick={() => handleOpenRegisterEventDialog('destruction', currentBatchDetail.id)}
              sx={{ bgcolor: '#4a5568', color: '#e2e8f0', '&:hover': { bgcolor: '#66748c' }, borderRadius: 1, textTransform: 'none', py: '6px', px: '10px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
              disabled={isFacilityOperator}
            >
              {BUTTON_LABELS.REGISTER_DESTRUCTION}
            </Button>
            {/* NUEVO BOTÓN PARA REGISTRAR PÉRDIDA/ROBO */}
            <Button
              variant="contained"
              startIcon={<WarningIcon />}
              onClick={() => handleOpenRegisterEventDialog('loss_theft', currentBatchDetail.id)}
              sx={{
                bgcolor: '#d32f2f', // Rojo para advertencia/peligro
                color: '#fff',
                '&:hover': { bgcolor: '#b71c1c' },
                borderRadius: 1,
                textTransform: 'none',
                py: '6px',
                px: '10px',
                fontSize: '0.75rem',
                whiteSpace: 'nowrap',
              }}
              disabled={isFacilityOperator}
            >
              {BUTTON_LABELS.REGISTER_LOSS_THEFT}
            </Button>
          </Box>
        </DialogTitle>
        <DialogContent sx={{
          pt: '20px !important',
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: { xs: 3, md: 4 },
        }}>
          {/* Sección Izquierda: Información General del Lote */}
          <Box sx={{ flexGrow: 1, minWidth: { md: '40%' } }}>
            <Typography variant="h6" sx={{ mb: 2, color: '#e2e8f0' }}>Información General</Typography>
            <Typography variant="subtitle1" sx={{ mt: 1, mb: 1, color: '#e2e8f0' }}>
              Variedad: {currentBatchDetail?.variety || 'N/A'}
            </Typography>
            <Typography variant="body2" sx={{ color: '#a0aec0' }}>
              Tipo de Producto: {currentBatchDetail?.product_type || 'N/A'} {/* NUEVO: Mostrar product_type */}
            </Typography>
            <Typography variant="body2" sx={{ color: '#a0aec0' }}>
              Unidades Actuales: {currentBatchDetail?.current_units}
            </Typography>
            <Typography variant="body2" sx={{ color: '#a0aec0' }}>
              Tipo de Finalización: {currentBatchDetail?.end_type || 'N/A'}
            </Typography>
            <Typography variant="body2" sx={{ color: '#a0aec0' }}>
              Rendimiento Proyectado: {currentBatchDetail?.projected_yield || 'N/A'}
            </Typography>
            {currentBatchDetail?.advance_to_harvesting_on && (
              <Typography variant="body2" sx={{ color: '#a0aec0' }}>
                Fecha de Cosecha: {new Date(currentBatchDetail.advance_to_harvesting_on).toLocaleDateString()}
              </Typography>
            )}
            <Typography variant="body2" sx={{ color: '#a0aec0' }}>
              Área de Cultivo: {currentBatchDetail?.cultivation_area?.name || 'N/A'}
            </Typography>
            <Typography variant="body2" sx={{ color: '#a0aec0' }}>
              Etapa Actual: {currentBatchDetail?.cultivation_area?.current_stage?.name || 'N/A'}
            </Typography>
            <Divider sx={{ my: 2, borderColor: '#4a5568' }} /> {/* Divisor para separar */}
            <Typography variant="body2" sx={{ color: '#e2e8f0', fontWeight: 'bold' }}>
              Tipo de Origen: {(() => {
                switch (currentBatchDetail?.origin_type) {
                  case 'seeds': return 'Semillas';
                  case 'clones': return 'Clones';
                  case 'tissue_culture': return 'Cultivo de Tejido';
                  case 'external_purchase': return 'Compra Externa';
                  default: return 'N/A';
                }
              })()}
            </Typography>
            {currentBatchDetail?.origin_details && (
              <Typography variant="body2" sx={{ color: '#a0aec0' }}>
                Detalles del Origen: {currentBatchDetail.origin_details}
              </Typography>
            )}
          </Box>

          {/* Sección Derecha: Trazabilidad del Lote */}
          <Box sx={{ width: { md: '60%' }, flexShrink: 0, ml: { md: 4 } }}>
            <Typography variant="h6" sx={{ mb: 2, color: '#e2e8f0', display: 'flex', alignItems: 'center' }}>
              <HistoryIcon sx={{ mr: 1, color: '#a0aec0' }} />
              Eventos de Trazabilidad
            </Typography>

            {/* Los botones de acción se han movido al DialogTitle */}

            {/* Filtro de Lotes para Trazabilidad */}
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel sx={{ color: '#fff' }}>Ver Eventos para</InputLabel>
              <Select
                value={selectedBatchForTraceability}
                onChange={(e) => setSelectedBatchForTraceability(e.target.value)}
                label="Ver Eventos para"
                sx={{
                  color: '#fff',
                  '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.8)' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
                  '.MuiSvgIcon-root': { color: '#fff' },
                }}
                MenuProps={{
                  PaperProps: {
                    sx: { bgcolor: '#004060', color: '#fff' },
                  },
                }}
              >
                <MenuItem value="all">Todos los Lotes</MenuItem>
                {/* currentBatchDetail.batches no existe aquí, debería ser currentBatchDetail.id para filtrar por el lote actual */}
                {/* Si necesitas filtrar eventos por lotes relacionados, la mock data de fetchTraceabilityEvents debería manejarlo */}
                {/* Por ahora, este filtro es solo para la mock data */}
                {currentBatchDetail && <MenuItem value={currentBatchDetail.id}>{currentBatchDetail.name}</MenuItem>}
              </Select>
            </FormControl>

            {/* Tabla/Lista de Eventos de Trazabilidad */}
            <Box sx={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #4a5568', borderRadius: 1, mb: 2 }}>
              <List disablePadding>
                {/* Encabezados de la tabla */}
                <ListItem sx={{ bgcolor: '#3a506b', py: 1, borderBottom: '1px solid #4a5568' }}>
                  <Grid container spacing={1}>
                    <Grid item xs={2}><Typography variant="caption" sx={{ fontWeight: 600, color: '#fff' }}>Fecha/Hora</Typography></Grid>
                    <Grid item xs={2}><Typography variant="caption" sx={{ fontWeight: 600, color: '#fff' }}>Tipo Evento</Typography></Grid>
                    <Grid item xs={2}><Typography variant="caption" sx={{ fontWeight: 600, color: '#fff' }}>Lote</Typography></Grid>
                    <Grid item xs={4}><Typography variant="caption" sx={{ fontWeight: 600, color: '#fff' }}>Detalles</Typography></Grid>
                    <Grid item xs={2}><Typography variant="caption" sx={{ fontWeight: 600, color: '#fff' }}>Realizado Por</Typography></Grid>
                  </Grid>
                </ListItem>
                {traceabilityEvents.length > 0 ? (
                  traceabilityEvents.map(event => (
                    <ListItem key={event.id} sx={{ py: 1,  '&:last-child': { borderBottom: 'none' } }}>
                      <Grid container spacing={1}>
                        <Grid item xs={2}><Typography variant="body2" sx={{ color: '#e2e8f0', fontSize: 12 }}>{event.date}</Typography></Grid>
                        <Grid item xs={2}><Typography variant="body2" sx={{ color: '#e2e8f0', fontSize: 12 }}>{event.type}</Typography></Grid>
                        <Grid item xs={2}><Typography variant="body2" sx={{ color: '#e2e8f0', fontSize: 12 }}>{event.batch_id}</Typography></Grid> {/* Usar batch_id */}
                        <Grid item xs={4}><Typography variant="body2" sx={{ color: '#a0aec0', fontSize: 12 }}>{event.details}</Typography></Grid>
                        <Grid item xs={2}><Typography variant="body2" sx={{ color: '#a0aec0', fontSize: 12 }}>{event.user}</Typography></Grid>
                      </Grid>
                    </ListItem>
                  ))
                ) : (
                  <ListItem>
                    <ListItemText primary="No hay eventos de trazabilidad registrados para este lote." primaryTypographyProps={{ sx: { color: '#a0aec0', textAlign: 'center', py: 2 } }} />
                  </ListItem>
                )}
              </List>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>

      {/* --- Diálogo Global de Registro de Eventos --- */}
      <Dialog open={openRegisterEventDialog} onClose={handleCloseRegisterEventDialog} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: '#2d3748', color: '#e2e8f0', borderRadius: 2 } }}
      >
        <DialogTitle sx={{ bgcolor: '#3a506b', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {DIALOG_TITLES.REGISTER_EVENT}
          <IconButton onClick={handleCloseRegisterEventDialog} sx={{ color: '#e2e8f0' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: '20px !important' }}>
          {renderEventForm()}
        </DialogContent>
      </Dialog>

      {/* --- NUEVO Diálogo para Dividir Lote --- */}
      <Dialog open={openSplitBatchDialog} onClose={handleCloseSplitBatchDialog} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: '#2d3748', color: '#e2e8f0', borderRadius: 2 } }}
      >
        <DialogTitle sx={{ bgcolor: '#3a506b', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {DIALOG_TITLES.SPLIT_BATCH} {batchToSplit?.name}
          <IconButton onClick={handleCloseSplitBatchDialog} sx={{ color: '#e2e8f0' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <form onSubmit={handleSplitBatch}>
          <DialogContent sx={{ pt: '20px !important' }}>
            <Typography variant="body1" sx={{ mb: 2, color: '#e2e8f0' }}>
              Unidades actuales del lote: {batchToSplit?.current_units || 0}
            </Typography>
            <TextField
              label="Cantity to split"  
              type="number"
              value={splitQuantity}
              onChange={e => setSplitQuantity(e.target.value)}
              fullWidth
              required
              inputProps={{ min: 1, max: batchToSplit?.current_units - 1 }} // No puede ser 0 ni el total
              sx={{ mt: 1, mb: 2, '& .MuiInputBase-input': { color: '#fff' }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' } }}
              disabled={splitBatchDialogLoading || isFacilityOperator}
            />
            <TextField
              label="Name the new batch"
              value={newSplitBatchName}
              onChange={e => setNewSplitBatchName(e.target.value)}
              fullWidth
              required
              sx={{ mb: 2, '& .MuiInputBase-input': { color: '#fff' }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' } }}
              disabled={splitBatchDialogLoading || isFacilityOperator}
            />
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel sx={{ color: '#fff' }}>Área de Cultivo de Destino</InputLabel>
              <Select
                value={splitBatchCultivationAreaId}
                onChange={e => setSplitBatchCultivationAreaId(e.target.value)}
                required
                sx={{ color: '#fff', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' }, '.MuiSvgIcon-root': { color: '#fff' } }}
                MenuProps={{ PaperProps: { sx: { bgcolor: '#004060', color: '#fff' } } }}
                disabled={splitBatchDialogLoading || isFacilityOperator}
              >
                <MenuItem value="" disabled><em>Seleccionar Área</em></MenuItem>
                {cultivationAreas.length === 0 ? (
                  <MenuItem value="" disabled><em>No hay áreas de cultivo disponibles en la instalación seleccionada</em></MenuItem>
                ) : (
                  cultivationAreas.map(area => <MenuItem key={area.id} value={area.id}>{area.name} ({area.current_stage?.name || 'Sin Etapa'})</MenuItem>)
                )}
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions sx={{ bgcolor: '#3a506b' }}>
            <Button onClick={handleCloseSplitBatchDialog} disabled={splitBatchDialogLoading || isFacilityOperator} sx={{ color: '#a0aec0' }}>{BUTTON_LABELS.CANCEL}</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={splitBatchDialogLoading || !splitQuantity || parseInt(splitQuantity, 10) <= 0 || parseInt(splitQuantity, 10) >= (batchToSplit?.current_units || 0) || !newSplitBatchName.trim() || !splitBatchCultivationAreaId || isFacilityOperator}
              sx={{
                bgcolor: '#4CAF50',
                '&:hover': { bgcolor: '#43A047' }
              }}
            >
              {splitBatchDialogLoading ? <CircularProgress size={24} /> : BUTTON_LABELS.SPLIT_BATCH}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* --- NUEVO Diálogo para Procesar Lote --- */}
      <Dialog open={openProcessBatchDialog} onClose={handleCloseProcessBatchDialog} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: '#2d3748', color: '#e2e8f0', borderRadius: 2 } }}
      >
        <DialogTitle sx={{ bgcolor: '#3a506b', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {DIALOG_TITLES.PROCESS_BATCH} {batchToProcess?.name}
          <IconButton onClick={handleCloseProcessBatchDialog} sx={{ color: '#e2e8f0' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <form onSubmit={handleProcessBatch}>
          <DialogContent sx={{ pt: '20px !important' }}>
            <Typography variant="body1" sx={{ mb: 2, color: '#e2e8f0' }}>
              Unidades actuales del lote: {batchToProcess?.current_units || 0}
            </Typography>
            <TextField
              label="Process Cantity (Final unities after processing)"
              type="number"
              value={processedQuantity}
              onChange={e => setProcessedQuantity(e.target.value)}
              fullWidth
              required
              inputProps={{ min: 0, max: batchToProcess?.current_units }} // No puede ser más que lo actual
              sx={{ mt: 1, mb: 2, '& .MuiInputBase-input': { color: '#fff' }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' } }}
              disabled={processBatchDialogLoading || isFacilityOperator}
            />
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel sx={{ color: '#fff' }}>Método de Procesamiento</InputLabel>
              <Select
                value={processMethod}
                onChange={e => setProcessMethod(e.target.value)}
                required
                sx={{ color: '#fff', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' }, '.MuiSvgIcon-root': { color: '#fff' } }}
                MenuProps={{ PaperProps: { sx: { bgcolor: '#004060', color: '#fff' } } }}
                disabled={processBatchDialogLoading || isFacilityOperator}
              >
                <MenuItem value="" disabled><em>Seleccionar Método</em></MenuItem>
                <MenuItem value="Lyophilization">Liofilización</MenuItem>
                <MenuItem value="Air Drying">Secado al Aire</MenuItem>
                <MenuItem value="Curing">Curado</MenuItem>
                <MenuItem value="Trimming">Recorte</MenuItem>
                <MenuItem value="Extraction">Extracción</MenuItem>
              </Select>
            </FormControl>
            {/* NUEVO: Campo para el nuevo tipo de producto */}
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel sx={{ color: '#fff' }}>Nuevo Tipo de Producto</InputLabel>
              <Select
                value={newProductType}
                onChange={e => setNewProductType(e.target.value)}
                required
                sx={{ color: '#fff', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' }, '.MuiSvgIcon-root': { color: '#fff' } }}
                MenuProps={{ PaperProps: { sx: { bgcolor: '#004060', color: '#fff' } } }}
                disabled={processBatchDialogLoading || isFacilityOperator}
              >
                <MenuItem value="" disabled><em>Seleccionar Nuevo Tipo de Producto</em></MenuItem>
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
              sx={{ mb: 2, '& .MuiInputBase-input': { color: '#fff' }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' } }}
              disabled={processBatchDialogLoading || isFacilityOperator}
            />
          </DialogContent>
          <DialogActions sx={{ bgcolor: '#3a506b' }}>
            <Button onClick={handleCloseProcessBatchDialog} disabled={processBatchDialogLoading || isFacilityOperator} sx={{ color: '#a0aec0' }}>{BUTTON_LABELS.CANCEL}</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={processBatchDialogLoading || processedQuantity === '' || isNaN(parseFloat(processedQuantity)) || parseFloat(processedQuantity) < 0 || parseFloat(processedQuantity) > (batchToProcess?.current_units || 0) || !processMethod.trim() || !newProductType.trim() || isFacilityOperator}
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

      {/* --- NUEVO Diálogo para Registrar Lote Externo --- */}
      <Dialog open={openExternalBatchDialog} onClose={handleCloseExternalBatchDialog} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: '#2d3748', color: '#e2e8f0', borderRadius: 2 } }}
      >
        <DialogTitle sx={{ bgcolor: '#3a506b', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {DIALOG_TITLES.REGISTER_EXTERNAL_BATCH}
          <IconButton onClick={handleCloseExternalBatchDialog} sx={{ color: '#e2e8f0' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <form onSubmit={handleSaveExternalBatch}>
          <DialogContent sx={{ pt: '20px !important' }}>
            <TextField
              label="Name extern batch"
              value={externalBatchName}
              onChange={e => setExternalBatchName(e.target.value)}
              fullWidth
              required
              sx={{ mt: 1, mb: 2, '& .MuiInputBase-input': { color: '#fff' }, '& .MuiInputLabel-root': { color: '#fff' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' } }}
              disabled={externalBatchDialogLoading || isFacilityOperator}
            />
            <TextField
              label="Units receibed"
              type="number"
              value={externalBatchUnits}
              onChange={e => setExternalBatchUnits(e.target.value)}
              fullWidth
              required
              sx={{ mb: 2, '& .MuiInputBase-input': { color: '#fff' }, '& .MuiInputLabel-root': { color: '#fff' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' } }}
              disabled={externalBatchDialogLoading || isFacilityOperator}
            />
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel sx={{ color: '#fff' }}>Tipo de Producto</InputLabel>
              <Select
                value={externalBatchProductType}
                onChange={e => setExternalBatchProductType(e.target.value)}
                required
                sx={{ color: '#fff', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' }, '.MuiSvgIcon-root': { color: '#fff' } }}
                MenuProps={{ PaperProps: { sx: { bgcolor: '#004060', color: '#fff' } } }}
                disabled={externalBatchDialogLoading || isFacilityOperator}
              >
                <MenuItem value="" disabled><em>Seleccionar Tipo de Producto</em></MenuItem>
                {HEALTH_CANADA_PRODUCT_TYPES.map(type => (
                  <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Variety"
              value={externalBatchVariety}
              onChange={e => setExternalBatchVariety(e.target.value)}
              fullWidth
              required
              sx={{ mb: 2, '& .MuiInputBase-input': { color: '#fff' }, '& .MuiInputLabel-root': { color: '#fff' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' } }}
              disabled={externalBatchDialogLoading || isFacilityOperator}
            />
            <TextField
              label={getExternalOriginDetailsLabel().label}
              placeholder={getExternalOriginDetailsLabel().placeholder}
              value={externalBatchOriginDetails}
              onChange={e => setExternalBatchOriginDetails(e.target.value)}
              fullWidth
              multiline
              rows={2}
              required
              sx={{ mb: 2, '& .MuiInputBase-input': { color: '#fff' }, '& .MuiInputLabel-root': { color: '#fff' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' } }}
              disabled={externalBatchDialogLoading || isFacilityOperator}
            />
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel sx={{ color: '#fff' }}>Área de Cultivo de Recepción</InputLabel>
              <Select
                value={externalBatchCultivationAreaId}
                onChange={e => setExternalBatchCultivationAreaId(e.target.value)}
                required
                sx={{ color: '#fff', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' }, '.MuiSvgIcon-root': { color: '#fff' } }}
                MenuProps={{ PaperProps: { sx: { bgcolor: '#004060', color: '#fff' } } }}
                disabled={externalBatchDialogLoading || isFacilityOperator}
              >
                <MenuItem value="" disabled><em>Seleccionar Área</em></MenuItem>
                {cultivationAreas.length === 0 ? (
                  <MenuItem value="" disabled><em>No hay áreas de cultivo disponibles en la instalación seleccionada</em></MenuItem>
                ) : (
                  cultivationAreas.map(area => <MenuItem key={area.id} value={area.id}>{area.name} ({area.current_stage?.name || 'Sin Etapa'})</MenuItem>)
                )}
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions sx={{ bgcolor: '#3a506b' }}>
            <Button onClick={handleCloseExternalBatchDialog} disabled={externalBatchDialogLoading || isFacilityOperator} sx={{ color: '#a0aec0' }}>{BUTTON_LABELS.CANCEL}</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={externalBatchDialogLoading || !externalBatchName.trim() || externalBatchUnits === '' || !externalBatchProductType.trim() || !externalBatchVariety.trim() || !externalBatchOriginDetails.trim() || !externalBatchCultivationAreaId || isFacilityOperator}
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


      <ConfirmationDialog
        open={confirmDialogOpen}
        title={confirmDialogData.title}
        message={confirmDialogData.message}
        onConfirm={confirmDialogData.onConfirm}
        onCancel={() => setConfirmDialogOpen(false)}
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
};

export default BatchManagementPage;
