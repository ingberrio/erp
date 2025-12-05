// src/components/TraceabilityEventsGrid.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  Box, Typography, FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import HistoryIcon from '@mui/icons-material/History';
import { api } from '../App';

const TraceabilityEventsGrid = ({
  currentAreaDetail,
  batchesInCurrentArea,
  setParentSnack,
  tenantId,
  isGlobalAdmin,
  selectedFacilityId,
  facilities,
}) => {
  const [traceabilityEvents, setTraceabilityEvents] = useState([]);
  const [selectedBatchForTraceability, setSelectedBatchForTraceability] = useState('all');

  // LOG: Área y batch seleccionados
  console.log('[TraceabilityEventsGrid] Área seleccionada:', currentAreaDetail?.id);
  console.log('[TraceabilityEventsGrid] Batch seleccionado:', selectedBatchForTraceability);

  // Function to fetch traceability events
  const fetchTraceabilityEvents = useCallback(async (areaId, batchId = 'all') => {
    const headers = {};
    let effectiveTenantId = null;

    if (isGlobalAdmin) {
      if (selectedFacilityId) {
        const selectedFac = facilities.find(f => f.id === selectedFacilityId);
        if (selectedFac && selectedFac.tenant_id) {
          effectiveTenantId = String(selectedFac.tenant_id);
        } else {
          setParentSnack('Error: Como Super Admin, la instalación seleccionada no tiene un Tenant ID válido para cargar eventos.', 'error');
          return [];
        }
      } else {
        setParentSnack('Error: Como Super Admin, debe seleccionar una instalación para cargar eventos.', 'error');
        return [];
      }
    } else if (tenantId) {
      effectiveTenantId = String(tenantId);
    } else {
      setParentSnack('Error: No se pudo determinar el Tenant ID para cargar eventos.', 'error');
      return [];
    }

    if (effectiveTenantId) {
      headers['X-Tenant-ID'] = effectiveTenantId;
    }

    const params = { area_id: areaId };
    if (batchId !== 'all') {
      params.batch_id = batchId;
    }

    // LOG: Parámetros enviados al backend
    console.log('[TraceabilityEventsGrid] Petición a backend:', { params, headers });

    try {
      const response = await api.get(`/traceability-events`, { params, headers });
      // LOG: Respuesta cruda del backend
      console.log('[TraceabilityEventsGrid] Respuesta bruta del backend:', response.data);

      const sortedEvents = response.data.sort((a, b) => {
        const dateA = new Date(a.created_at || a.date || a.timestamp);
        const dateB = new Date(b.created_at || b.date || b.timestamp);
        return dateB.getTime() - dateA.getTime();
      });
      return sortedEvents;
    } catch (error) {
      setParentSnack('Error al cargar eventos de trazabilidad.', 'error');
      return [];
    }
  }, [setParentSnack, tenantId, isGlobalAdmin, selectedFacilityId, facilities]);

  useEffect(() => {
    if (currentAreaDetail?.id) {
      fetchTraceabilityEvents(currentAreaDetail.id, selectedBatchForTraceability)
        .then(setTraceabilityEvents)
        .catch(console.error);
    } else {
      setTraceabilityEvents([]);
    }
  }, [currentAreaDetail, selectedBatchForTraceability, fetchTraceabilityEvents]);

  // Prepara filas con id robusto
  const rows = useMemo(() => traceabilityEvents.map((ev, idx) => ({
    ...ev,
    id: (ev.id !== null && ev.id !== undefined && ev.id !== '') 
      ? ev.id 
      : `${ev.batch_id || 'NA'}-${ev.event_type || 'NA'}-${ev.created_at || 'NA'}-${idx}`,
  })), [traceabilityEvents]);

  // LOG: Filas enviadas al DataGrid
  console.log('[TraceabilityEventsGrid] Filas para DataGrid:', rows);

  // Columnas adaptadas para tus datos reales
  const columns = [
    { field: 'id', headerName: 'ID', width: 70 },
    { field: 'batch_id', headerName: 'Batch', width: 90 },
    { field: 'area_id', headerName: 'Area', width: 90 },
    { field: 'event_type', headerName: 'Event Type', width: 120 },
    { field: 'method', headerName: 'Method', width: 120 },
    { field: 'from_location', headerName: 'Origin', width: 120 }, // Nueva columna para origen
    { field: 'to_location', headerName: 'Destination', width: 120 },   // Nueva columna para destino
    { field: 'quantity', headerName: 'Quantity', width: 100 },     // Cantidad del evento
    { field: 'unit', headerName: 'Unit', width: 80 },            // Unidad de la cantidad
    { field: 'description', headerName: 'Description', flex: 1, minWidth: 200 }, // Descripción del evento
    { field: 'created_at', headerName: 'Date/Time', width: 180 },
    { field: 'user_name', headerName: 'Recorded by', width: 100 }, // Cambiado a user_id si el backend no devuelve user_name
  ];

  return (
    <Box sx={{ width: '100%', flexShrink: 0 }}>
      <Typography variant="h6" sx={{ mb: 2, color: '#e2e8f0', display: 'flex', alignItems: 'center' }}>
        <HistoryIcon sx={{ mr: 1, color: '#a0aec0' }} />
        Traceability Batch
      </Typography>

      {/* Batch filter for traceability */}
      <FormControl fullWidth size="small" sx={{ mb: 2 }}>
        <InputLabel sx={{ color: '#fff' }}>See events</InputLabel>
        <Select
          value={selectedBatchForTraceability}
          onChange={(e) => setSelectedBatchForTraceability(e.target.value)}
                    label="See Events For"
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
          <MenuItem value="all">All batches</MenuItem>
          {batchesInCurrentArea?.map(batch => (
            <MenuItem key={batch.id} value={batch.id}>{batch.name}</MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* DataGrid for traceability events */}
      <Box sx={{ height: 400, width: '100%', bgcolor: '#2d3748', borderRadius: 2 }}>
        <DataGrid
          rows={rows}
          columns={columns}
          pageSizeOptions={[5, 10, 25]}
          initialState={{
            pagination: {
              paginationModel: { pageSize: 5 },
            },
          }}
          getRowId={(row) => row.id}
          disableColumnMenu
          disableColumnSelector
          sx={{
            border: 'none',
            '& .MuiDataGrid-root': { border: 'none' },
            '& .MuiDataGrid-cell': {
              color: '#e2e8f0',
              borderBottom: '1px solid #4a5568',
              backgroundColor: '#2d3748',
            },
            '& .MuiDataGrid-columnHeaders div[role="row"]': {
              backgroundColor: '#3a506b !important',
              color: '#fff !important', // Asegura que el texto de la cabecera sea blanco
              borderBottom: '1px solid #4a5568',
            },
            '& .MuiDataGrid-columnHeaderTitle': {
              fontWeight: 'bold',
              color: '#4f5155', // Color del texto de la cabecera
            },
            '& .MuiDataGrid-footerContainer': {
              backgroundColor: '#3a506b',
              color: '#fff',
              borderTop: '1px solid #4a5568',
            },
            '& .MuiTablePagination-root': {
              color: '#e2e8f0',
            },
            '& .MuiSvgIcon-root': {
              color: '#4f5155', // Iconos de paginación
            },
            '& .MuiDataGrid-virtualScrollerContent': {
              backgroundColor: '#2d3748',
            },
            '& .MuiDataGrid-overlay': {
              backgroundColor: '#2d3748',
            },
            '& .MuiDataGrid-row:hover': {
              backgroundColor: '#3a506b',
            },
            '& .Mui-selected': {
              backgroundColor: '#4a5568 !important',
            },
          }}
          slots={{
            noRowsOverlay: () => (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#a0aec0' }}>
                <Typography variant="h6">No hay eventos de trazabilidad registrados.</Typography>
                <Typography variant="body2">Registra un evento para ver su historial aquí.</Typography>
              </Box>
            ),
          }}
        />
      </Box>
    </Box>
  );
};

TraceabilityEventsGrid.propTypes = {
  currentAreaDetail: PropTypes.object,
  batchesInCurrentArea: PropTypes.array.isRequired,
  setParentSnack: PropTypes.func.isRequired,
  tenantId: PropTypes.number,
  isGlobalAdmin: PropTypes.bool.isRequired,
  selectedFacilityId: PropTypes.number,
  facilities: PropTypes.array.isRequired,
};

export default TraceabilityEventsGrid;
