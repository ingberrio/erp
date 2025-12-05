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

  // Columnas adaptadas para tus datos reales con headerClassName para estilos
  const columns = [
    { field: 'id', headerName: 'ID', width: 70, headerClassName: 'super-app-theme--header' },
    { field: 'batch_id', headerName: 'Batch', width: 90, headerClassName: 'super-app-theme--header' },
    { field: 'area_id', headerName: 'Area', width: 90, headerClassName: 'super-app-theme--header' },
    { field: 'event_type', headerName: 'Event Type', width: 120, headerClassName: 'super-app-theme--header' },
    { field: 'method', headerName: 'Method', width: 120, headerClassName: 'super-app-theme--header' },
    { field: 'from_location', headerName: 'Origin', width: 120, headerClassName: 'super-app-theme--header' },
    { field: 'to_location', headerName: 'Destination', width: 120, headerClassName: 'super-app-theme--header' },
    { field: 'quantity', headerName: 'Quantity', width: 100, headerClassName: 'super-app-theme--header' },
    { field: 'unit', headerName: 'Unit', width: 80, headerClassName: 'super-app-theme--header' },
    { field: 'description', headerName: 'Description', flex: 1, minWidth: 200, headerClassName: 'super-app-theme--header' },
    { field: 'created_at', headerName: 'Date/Time', width: 180, headerClassName: 'super-app-theme--header' },
    { field: 'user_name', headerName: 'Recorded by', width: 100, headerClassName: 'super-app-theme--header' },
  ];

  return (
    <Box sx={{ width: '100%', flexShrink: 0 }}>
      <Typography variant="h6" sx={{ mb: 2, color: '#1976d2', fontWeight: 500, display: 'flex', alignItems: 'center' }}>
        <HistoryIcon sx={{ mr: 1, color: '#1976d2' }} />
        Traceability Batch
      </Typography>

      {/* Batch filter for traceability */}
      <FormControl fullWidth size="small" sx={{ mb: 2 }}>
        <InputLabel>See events</InputLabel>
        <Select
          value={selectedBatchForTraceability}
          onChange={(e) => setSelectedBatchForTraceability(e.target.value)}
                    label="See Events For"
          sx={{
            color: '#1a202c',
            '.MuiOutlinedInput-notchedOutline': { borderColor: '#e0e0e0' },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#1976d2' },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1976d2' },
          }}
        >
          <MenuItem value="all">All batches</MenuItem>
          {batchesInCurrentArea?.map(batch => (
            <MenuItem key={batch.id} value={batch.id}>{batch.name}</MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* DataGrid for traceability events */}
      <Box sx={{ 
        height: 400, 
        width: '100%', 
        bgcolor: '#fff', 
        borderRadius: 2, 
        border: '1px solid #e0e0e0',
        '& .super-app-theme--header': {
          backgroundColor: '#1976d2',
          color: '#fff',
          fontWeight: 600,
        },
      }}>
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
            '& .MuiDataGrid-cell': {
              color: '#1a202c',
              borderBottom: '1px solid #e2e8f0',
            },
            '& .MuiDataGrid-columnHeader': {
              backgroundColor: '#1976d2 !important',
              color: '#fff !important',
            },
            '& .MuiDataGrid-columnHeaderTitle': {
              fontWeight: 600,
              color: '#fff !important',
            },
            '& .MuiDataGrid-columnSeparator': {
              color: 'rgba(255,255,255,0.3)',
            },
            '& .MuiDataGrid-sortIcon': {
              color: '#fff !important',
            },
            '& .MuiDataGrid-iconButtonContainer': {
              '& .MuiSvgIcon-root': {
                color: '#fff !important',
              },
            },
            '& .MuiDataGrid-footerContainer': {
              backgroundColor: '#f8fafc',
              color: '#1a202c',
              borderTop: '1px solid #e0e0e0',
            },
            '& .MuiTablePagination-root': {
              color: '#1a202c',
            },
            '& .MuiTablePagination-selectIcon': {
              color: '#64748b',
            },
            '& .MuiDataGrid-footerContainer .MuiIconButton-root': {
              color: '#64748b',
            },
            '& .MuiDataGrid-row:hover': {
              backgroundColor: '#f8fafc',
            },
            '& .Mui-selected': {
              backgroundColor: '#e3f2fd !important',
            },
          }}
          slots={{
            noRowsOverlay: () => (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
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
