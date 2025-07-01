// src/components/CultivationPage.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { api } from '../App';
import {
  Box, Typography, Button, CircularProgress, Snackbar, Alert,
  TextField, Paper, Divider, IconButton, Grid,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Select, MenuItem, FormControl, InputLabel
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import GrassIcon from '@mui/icons-material/Grass';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
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

// --- Componente de Diálogo de Confirmación Genérico ---
const ConfirmationDialog = ({ open, title, message, onConfirm, onCancel }) => {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">{title}</DialogTitle>
      <DialogContent>
        <Typography id="alert-dialog-description">
          {message}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} color="primary">
          Cancelar
        </Button>
        <Button onClick={onConfirm} color="error" autoFocus>
          Confirmar
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

// --- Componente principal del Módulo de Cultivo ---
const CultivationPage = ({ tenantId, isAppReady, userFacilityId }) => {
  const [facilities, setFacilities] = useState([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState('');
  const [stages, setStages] = useState([]);
  const [rawAreas, setRawAreas] = useState([]);
  const [cultivationAreas, setCultivationAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });
  const [openStageDialog, setOpenStageDialog] = useState(false);
  const [stageName, setStageName] = useState('');
  const [editingStage, setEditingStage] = useState(null);
  const [stageDialogLoading, setStageDialogLoading] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmDialogData, setConfirmDialogData] = useState({ title: '', message: '', onConfirm: () => {} });
  const [activeDraggableId, setActiveDraggableId] = useState(null);

  // New states for Facility Dialog
  const [openFacilityDialog, setOpenFacilityDialog] = useState(false);
  const [newFacilityName, setNewFacilityName] = useState('');
  const [facilityDialogLoading, setFacilityDialogLoading] = useState(false);

  // Check if the current user is a facility operator (simulated)
  const isFacilityOperator = !!userFacilityId;

  // Utility to handle notifications
  const showSnack = useCallback((message, severity = 'success') => {
    setSnack({ open: true, message, severity });
  }, []);

  // Memoize organized areas based on stages and rawAreas
  const organizedAreas = useMemo(() => {
    console.log("CultivationPage: Recalculando organizedAreas. Stages count:", stages.length, "Raw Areas count:", rawAreas.length);
    return stages.length > 0
      ? stages.map(stage => ({
          ...stage,
          cultivationAreas: rawAreas
            .filter(area => area.current_stage_id === stage.id)
            .sort((a, b) => a.order - b.order || 0),
        }))
      : [];
  }, [stages, rawAreas]);

  // Update cultivationAreas state when organizedAreas changes
  useEffect(() => {
    console.log("CultivationPage: organizedAreas changed. Updating cultivationAreas state.");
    setCultivationAreas(organizedAreas);
  }, [organizedAreas]);

  // Fetchers for data
  const fetchFacilities = useCallback(async () => {
    console.log('CultivationPage: fetchFacilities iniciado.');
    try {
      const response = await api.get('/facilities');
      let fetchedFacilities = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.data)
        ? response.data.data
        : [];

      // --- OPERATOR SIMULATION: Filter facilities if userFacilityId is present ---
      if (isFacilityOperator && userFacilityId) {
        fetchedFacilities = fetchedFacilities.filter(f => f.id === userFacilityId);
        console.log("CultivationPage: Operador de instalación detectado. Filtrando instalaciones a:", fetchedFacilities);
      }
      // --- END OPERATOR SIMULATION ---

      setFacilities(fetchedFacilities);

      // Logic to set or adjust selectedFacilityId
      // IMPORTANT: This part directly updates selectedFacilityId,
      // but selectedFacilityId is NOT in fetchFacilities's useCallback dependencies
      // to prevent infinite loops.
      if (fetchedFacilities.length > 0) {
        const currentFacilityExists = fetchedFacilities.some(f => f.id === selectedFacilityId);
        if (!selectedFacilityId || !currentFacilityExists) {
          setSelectedFacilityId(fetchedFacilities[0].id); // Default to the first facility
          console.log("CultivationPage: Defaulting selected facility to:", fetchedFacilities[0].id);
        } else {
          console.log("CultivationPage: Selected facility remains:", selectedFacilityId);
        }
      } else {
        setSelectedFacilityId(''); // Clear if no facilities are available
        console.log("CultivationPage: No facilities available. Clearing selectedFacilityId.");
      }
    } catch (error) {
      console.error('CultivationPage: Error fetching facilities:', error);
      showSnack('Error loading facilities.', 'error');
    }
  }, [showSnack, isFacilityOperator, userFacilityId]); // Removed selectedFacilityId from dependencies

  const fetchStages = useCallback(async () => {
    console.log('CultivationPage: fetchStages iniciado.');
    try {
      const response = await api.get('/stages');
      const fetchedStages = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.data)
        ? response.data.data
        : [];
      setStages(fetchedStages.sort((a, b) => a.order - b.order));
      console.log('CultivationPage: Etapas cargadas:', fetchedStages.length);
    } catch (error) {
      console.error('CultivationPage: Error fetching stages:', error);
      showSnack('Error loading stages.', 'error');
    }
  }, [showSnack]);

  const fetchCultivationAreas = useCallback(async () => {
    if (!tenantId || !isAppReady) {
      console.log("CultivationPage: Skipping fetchCultivationAreas due to tenantId/isAppReady. Tenant ID:", tenantId, "App Ready:", isAppReady);
      setLoading(false);
      return;
    }

    // Only fetch areas if a facility is selected, or if there are no facilities at all
    if (facilities.length > 0 && !selectedFacilityId) {
      console.log("CultivationPage: Waiting for facility selection to fetch areas.");
      setLoading(false);
      return;
    }
    
    console.log("CultivationPage: fetchCultivationAreas initiated for facility:", selectedFacilityId || "All");
    setLoading(true);
    try {
      let url = '/cultivation-areas';
      if (selectedFacilityId) {
        url = `/facilities/${selectedFacilityId}/cultivation-areas`;
      }
      const response = await api.get(url);
      const fetchedAreas = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.data)
        ? response.data.data
        : [];
      setRawAreas(fetchedAreas);
      console.log("CultivationPage: Cultivation areas loaded for facility:", selectedFacilityId || "All", "Count:", fetchedAreas.length);
    } catch (error) {
      console.error('CultivationPage: Error fetching cultivation areas:', error);
      showSnack('Error loading cultivation areas.', 'error');
    } finally {
      setLoading(false);
      console.log('CultivationPage: setLoading(false) called in fetchCultivationAreas.');
    }
  }, [tenantId, isAppReady, selectedFacilityId, facilities.length, showSnack]);

  // Effect for initial data load (facilities and stages)
  useEffect(() => {
    const loadInitialData = async () => {
      if (!tenantId || !isAppReady) {
        setLoading(false);
        return;
      }

      console.log('CultivationPage: Initiating initial data load (facilities and stages).');
      setLoading(true);
      try {
        await fetchFacilities();
        await fetchStages();
      } catch (error) {
        console.error('CultivationPage: Error in initial data load:', error);
        showSnack('Error loading initial data.', 'error');
        setLoading(false);
      }
    };

    loadInitialData();
  }, [tenantId, isAppReady, fetchFacilities, fetchStages, showSnack]);

  // Effect to load cultivation areas when selectedFacilityId or stages change
  useEffect(() => {
    if (tenantId && isAppReady) {
        console.log("CultivationPage: Triggering fetchCultivationAreas due to change in selectedFacilityId or stages.");
        fetchCultivationAreas();
    }
  }, [selectedFacilityId, stages, tenantId, isAppReady, fetchCultivationAreas]);

  // Handlers for Stage UI and Dialogs
  const handleOpenStageDialog = (stage = null) => {
    setEditingStage(stage);
    setStageName(stage ? stage.name : '');
    setOpenStageDialog(true);
    setStageDialogLoading(false);
    console.log('CultivationPage: Stage dialog opened. Editing:', !!stage);
  };

  const handleCloseStageDialog = () => {
    setOpenStageDialog(false);
    setEditingStage(null);
    setStageName('');
    setStageDialogLoading(false);
    console.log('CultivationPage: Stage dialog closed.');
  };

  const handleSaveStage = async (e) => {
    e.preventDefault();
    if (!stageName.trim()) {
      showSnack('Stage name is required.', 'warning');
      return;
    }
    if (stageName.length > 100) {
      showSnack('Stage name cannot exceed 100 characters.', 'warning');
      return;
    }
    if (/[<>{}]/.test(stageName)) {
      showSnack('Name cannot contain special characters like <, >, or {}.', 'warning');
      return;
    }
    setStageDialogLoading(true);
    console.log('CultivationPage: Attempting to save stage:', stageName);
    try {
      const stageData = { name: stageName };
      if (editingStage) {
        await api.put(`/stages/${editingStage.id}`, stageData);
        showSnack('Stage updated.', 'success');
      } else {
        await api.post('/stages', stageData);
        showSnack('Stage created.', 'success');
      }
      await fetchStages();
      handleCloseStageDialog();
    } catch (err) {
      console.error('CultivationPage: Error saving stage:', err);
      const errorMessage = err.response?.data?.message || err.message;
      if (err.response?.status === 400) {
        showSnack(`Invalid data: ${errorMessage}`, 'error');
      } else if (err.response?.status === 403) {
        showSnack('You do not have permission to perform this action.', 'error');
      } else {
        showSnack(`Error saving stage: ${errorMessage}`, 'error');
      }
    } finally {
      setStageDialogLoading(false);
      console.log('CultivationPage: setStageDialogLoading(false) called in handleSaveStage.');
    }
  };

  const handleDeleteStageConfirm = useCallback(async (stageToDelete) => {
    setLoading(true);
    console.log('CultivationPage: Confirming stage deletion:', stageToDelete.name);
    try {
      await api.delete(`/stages/${stageToDelete.id}`);
      showSnack('Stage deleted.', 'info');
      await fetchStages();
    } catch (err) {
      console.error('CultivationPage: Error deleting stage:', err);
      const errorMessage = err.response?.data?.message || err.message;
      if (err.response?.status === 400) {
        showSnack(`Invalid data: ${errorMessage}`, 'error');
      } else if (err.response?.status === 403) {
        showSnack('You do not have permission to perform this action.', 'error');
      } else {
        showSnack(`Error deleting stage: ${errorMessage}`, 'error');
      }
    } finally {
      setLoading(false);
      setConfirmDialogOpen(false);
      console.log('CultivationPage: setLoading(false) called in handleDeleteStageConfirm.');
    }
  }, [fetchStages, showSnack]);

  const handleDeleteStageClick = (stageToDelete) => {
    setConfirmDialogData({
      title: 'Confirm Stage Deletion',
      message: `Are you sure you want to delete stage "${stageToDelete.name}"? This will fail if it has associated cultivation areas.`,
      onConfirm: () => handleDeleteStageConfirm(stageToDelete),
    });
    setConfirmDialogOpen(true);
    console.log('CultivationPage: Stage deletion confirmation dialog opened.');
  };

  // Handlers for Facility Dialog
  const handleOpenFacilityDialog = () => {
    setNewFacilityName('');
    setOpenFacilityDialog(true);
    setFacilityDialogLoading(false);
  };

  const handleCloseFacilityDialog = () => {
    setOpenFacilityDialog(false);
    setNewFacilityName('');
    setFacilityDialogLoading(false);
  };

  const handleSaveFacility = async (e) => {
    e.preventDefault();
    if (!newFacilityName.trim()) {
      showSnack('Facility name is required.', 'warning');
      return;
    }
    if (newFacilityName.length > 100) {
      showSnack('Facility name cannot exceed 100 characters.', 'warning');
      return;
    }
    if (/[<>{}]/.test(newFacilityName)) {
      showSnack('Name cannot contain special characters like <, >, or {}.', 'warning');
      return;
    }
    setFacilityDialogLoading(true);
    try {
      await api.post('/facilities', { name: newFacilityName });
      showSnack('Facility created successfully.', 'success');
      await fetchFacilities();
      handleCloseFacilityDialog();
    } catch (err) {
      console.error('Error creating facility:', err);
      const errorMessage = err.response?.data?.message || err.message;
      if (err.response?.status === 400) {
        showSnack(`Invalid data: ${errorMessage}`, 'error');
      } else if (err.response?.status === 403) {
        showSnack('You do not have permission to perform this action.', 'error');
      } else {
        showSnack(`Error creating facility: ${errorMessage}`, 'error');
      }
    } finally {
      setFacilityDialogLoading(false);
    }
  };


  // Dnd-Kit Handlers
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event) => {
    setActiveDraggableId(event.active.id);
  };

  const findDraggedArea = (areas, activeId) => {
    for (let i = 0; i < areas.length; i++) {
      const stage = areas[i];
      const areaIndex = stage.cultivationAreas.findIndex(area => area.id === activeId);
      if (areaIndex !== -1) {
        return { draggedArea: stage.cultivationAreas[areaIndex], sourceStage: stage, sourceAreaIndex: areaIndex };
      }
    }
    return { draggedArea: null, sourceStage: null, sourceAreaIndex: -1 };
  };

  const parseDragDestination = (over) => {
    let targetStageId = over.id;
    let targetAreaId = null;
    if (over.data.current?.type === 'CultivationArea') {
      targetStageId = over.data.current.cultivationArea.current_stage_id;
      targetAreaId = over.id;
    }
    return { targetStageId, targetAreaId };
  };

  const handleSameStageDrag = async (sourceStage, destinationStage, sourceAreaIndex, targetAreaId, newState) => {
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
  };

  const handleCrossStageDrag = async (draggedArea, sourceStage, destinationStage, sourceAreaIndex, targetAreaId, newState) => {
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

    await api.put(`/cultivation-areas/${draggedArea.id}`, {
      current_stage_id: destinationStage.id,
      order: targetIndex,
      name: draggedArea.name,
      description: draggedArea.description,
      capacity_units: draggedArea.capacity_units,
      capacity_unit_type: draggedArea.capacity_unit_type,
      facility_id: draggedArea.facility_id,
    });
    await api.put(`/stages/${sourceStage.id}/cultivation-areas/reorder`, {
      area_ids: sourceStage.cultivationAreas.map(area => area.id),
    });
    await api.put(`/stages/${destinationStage.id}/cultivation-areas/reorder`, {
      area_ids: destinationStage.cultivationAreas.map(area => area.id),
    });
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveDraggableId(null);
    if (!over || active.id === over.id) {
      console.log('CultivationPage: Drag ended over no droppable area or same item.');
      return;
    }

    // --- OPERATOR SIMULATION: Prevent drag if user is operator ---
    if (isFacilityOperator) {
      showSnack('No tienes permiso para mover áreas como Operador de Instalación.', 'error');
      return;
    }
    // --- END OPERATOR SIMULATION ---

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

    setLoading(true);
    try {
      if (sourceStage.id === destinationStage.id) {
        await handleSameStageDrag(sourceStage, destinationStage, sourceAreaIndex, targetAreaId, newCultivationAreasState);
      } else {
        await handleCrossStageDrag(draggedArea, sourceStage, destinationStage, sourceAreaIndex, targetAreaId, newCultivationAreasState);
      }
      setCultivationAreas(newCultivationAreasState);
      showSnack('Cultivation area moved.', 'success');
    } catch (error) {
      console.error('CultivationPage: Error in drag operation:', error);
      showSnack('Error dragging. Reloading data...', 'error');
    } finally {
      await fetchCultivationAreas();
      console.log('CultivationPage: setLoading(false) called in handleDragEnd.');
    }
  };

  const getActiveCultivationArea = useCallback(() => {
    if (!activeDraggableId) return null;
    for (const stage of cultivationAreas) {
      const area = stage.cultivationAreas.find(a => a.id === activeDraggableId);
      if (area) return area;
    }
    return null;
  }, [activeDraggableId, cultivationAreas]);

  // Render
  return (
    <Box sx={{
      p: { xs: 2, sm: 3 },
      minHeight: 'calc(100vh - 64px)',
      bgcolor: '#004d80',
      color: '#fff',
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <GrassIcon sx={{ fontSize: 32, color: '#fff', mr: 1 }} />
        <Typography variant="h5" sx={{ fontWeight: 600, color: '#fff' }}>
          Gestión de Cultivo
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <FormControl sx={{ minWidth: 200, mr: 1 }}>
          <InputLabel id="facility-select-label" sx={{ color: '#fff' }}>Instalación</InputLabel>
          <Select
            labelId="facility-select-label"
            value={selectedFacilityId}
            label="Instalación"
            onChange={(e) => {
                console.log("CultivationPage: Cambio de instalación detectado:", e.target.value);
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
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={handleOpenFacilityDialog}
          disabled={loading || isFacilityOperator}
          sx={{
            borderRadius: 2,
            borderColor: '#b0c4de',
            color: '#b0c4de',
            '&:hover': {
              bgcolor: 'rgba(255,255,255,0.1)',
              borderColor: '#fff',
            },
          }}
        >
          Añadir Instalación
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
          Añadir Etapa
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', color: '#fff' }}>
          <CircularProgress color="inherit" />
          <Typography variant="body1" sx={{ ml: 2, color: '#fff' }}>Cargando datos de cultivo...</Typography>
        </Box>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <Box
            sx={{
              display: 'flex',
              overflowX: 'auto',
              gap: 2,
              pb: 2,
              alignItems: 'flex-start',
              minHeight: '200px',
            }}
          >
            {stages.length === 0 ? (
              <Typography variant="h6" sx={{ color: '#aaa', textAlign: 'center', width: '100%', mt: 5 }}>
                No hay etapas de cultivo. ¡Añade una para empezar!
              </Typography>
            ) : (
              stages.map((stage) => (
                <StageView
                  key={stage.id}
                  stage={stage}
                  cultivationAreas={cultivationAreas.find(s => s.id === stage.id)?.cultivationAreas || []}
                  tenantId={tenantId}
                  refreshCultivationAreas={fetchCultivationAreas}
                  handleDeleteStage={handleDeleteStageClick}
                  setParentSnack={showSnack}
                  setParentConfirmDialog={setConfirmDialogData}
                  setParentConfirmDialogOpen={setConfirmDialogOpen}
                  selectedFacilityId={selectedFacilityId}
                  facilities={facilities}
                  isFacilityOperator={isFacilityOperator}
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
                <CultivationAreaContent area={getActiveCultivationArea()} />
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

      <Dialog open={openStageDialog} onClose={handleCloseStageDialog} maxWidth="xs" fullWidth>
        <DialogTitle>{editingStage ? 'Editar Etapa' : 'Crear Nueva Etapa'}</DialogTitle>
        <form onSubmit={handleSaveStage}>
          <DialogContent>
            <TextField
              label="Nombre de la Etapa"
              value={stageName}
              onChange={e => setStageName(e.target.value)}
              fullWidth
              required
              sx={{ mt: 1, mb: 2 }}
              disabled={stageDialogLoading}
              helperText={!stageName.trim() && openStageDialog ? 'El nombre de la etapa es obligatorio.' : ''}
              error={!stageName.trim() && openStageDialog}
              inputProps={{ maxLength: 100 }}
              aria-label="Nombre de la etapa"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseStageDialog} disabled={stageDialogLoading}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={stageDialogLoading || !stageName.trim()}>
              {stageDialogLoading ? <CircularProgress size={24} /> : (editingStage ? 'Guardar Cambios' : 'Crear Etapa')}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* New Facility Dialog */}
      <Dialog open={openFacilityDialog} onClose={handleCloseFacilityDialog} maxWidth="xs" fullWidth>
        <DialogTitle>Crear Nueva Instalación</DialogTitle>
        <form onSubmit={handleSaveFacility}>
          <DialogContent>
            <TextField
              label="Nombre de la Instalación"
              value={newFacilityName}
              onChange={e => setNewFacilityName(e.target.value)}
              fullWidth
              required
              sx={{ mt: 1, mb: 2 }}
              disabled={facilityDialogLoading}
              inputProps={{ maxLength: 100 }}
              aria-label="Nombre de la instalación"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseFacilityDialog} disabled={facilityDialogLoading}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={facilityDialogLoading || !newFacilityName.trim()}>
              {facilityDialogLoading ? <CircularProgress size={24} /> : 'Crear Instalación'}
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

CultivationPage.propTypes = {
  tenantId: PropTypes.string.isRequired,
  isAppReady: PropTypes.bool.isRequired,
  userFacilityId: PropTypes.string,
};

// --- Componente: StageView ---
const StageView = React.memo(({ stage, cultivationAreas, tenantId, refreshCultivationAreas, handleDeleteStage, setParentSnack, setParentConfirmDialog, setParentConfirmDialogOpen, selectedFacilityId, facilities, isFacilityOperator }) => {
  const [openAddAreaDialog, setOpenAddAreaDialog] = useState(false);
  const [areaName, setAreaName] = useState('');
  const [areaDescription, setAreaDescription] = useState('');
  const [areaCapacityUnits, setAreaCapacityUnits] = useState('');
  const [areaCapacityUnitType, setAreaCapacityUnitType] = useState('');
  const [areaFacilityId, setAreaFacilityId] = useState(selectedFacilityId);
  const [editingArea, setEditingArea] = useState(null);
  const [areaDialogLoading, setAreaDialogLoading] = useState(false);

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


  const handleOpenAddAreaDialog = (area = null) => {
    setEditingArea(area);
    setAreaName(area ? area.name : '');
    setAreaDescription(area ? (area.description || '') : '');
    setAreaCapacityUnits(area ? (area.capacity_units || '') : '');
    setAreaCapacityUnitType(area ? (area.capacity_unit_type || '') : '');
    setAreaFacilityId(area ? (area.facility_id || selectedFacilityId) : selectedFacilityId);
    setOpenAddAreaDialog(true);
    setAreaDialogLoading(false);
  };

  const handleCloseAddAreaDialog = () => {
    setOpenAddAreaDialog(false);
    setEditingArea(null);
    setAreaName('');
    setAreaDescription('');
    setAreaCapacityUnits('');
    setAreaCapacityUnitType('');
    setAreaFacilityId(selectedFacilityId);
    setAreaDialogLoading(false);
  };

  const handleSaveArea = async (e) => {
    e.preventDefault();
    if (!areaName.trim()) {
      setParentSnack('El nombre del área de cultivo es obligatorio.', 'warning');
      return;
    }
    if (areaName.length > 100) {
      setParentSnack('El nombre del área no puede exceder los 100 caracteres.', 'warning');
      return;
    }
    if (/[<>{}]/.test(areaName)) {
      setParentSnack('El nombre no puede contener caracteres especiales como <, >, o {}.', 'warning');
      return;
    }
    if (!areaFacilityId) {
      setParentSnack('Debe seleccionar una instalación para el área.', 'warning');
      return;
    }
    setAreaDialogLoading(true);
    try {
      const areaData = {
        name: areaName,
        description: areaDescription,
        capacity_units: areaCapacityUnits === '' ? null : parseInt(areaCapacityUnits, 10),
        capacity_unit_type: areaCapacityUnitType,
        facility_id: areaFacilityId,
        current_stage_id: stage.id,
      };
      if (editingArea) {
        await api.put(`/cultivation-areas/${editingArea.id}`, areaData);
        setParentSnack('Área de cultivo actualizada.', 'success');
      } else {
        await api.post('/cultivation-areas', areaData);
        setParentSnack('Área de cultivo creada.', 'success');
      }
      await refreshCultivationAreas();
      handleCloseAddAreaDialog();
    } catch (err) {
      console.error('Error al guardar área de cultivo:', err);
      const errorMessage = err.response?.data?.message || err.message;
      if (err.response?.status === 400) {
        setParentSnack(`Datos inválidos: ${errorMessage}`, 'error');
      } else if (err.response?.status === 403) {
        setParentSnack('No tienes permisos para realizar esta acción.', 'error');
      } else {
        setParentSnack(`Error al guardar área: ${errorMessage}`, 'error');
      }
    } finally {
      setAreaDialogLoading(false);
    }
  };

  const handleDeleteAreaConfirm = useCallback(async (areaToDelete) => {
    setAreaDialogLoading(true);
    try {
      await api.delete(`/cultivation-areas/${areaToDelete.id}`);
      setParentSnack('Área de cultivo eliminada.', 'info');
      await refreshCultivationAreas();
    } catch (err) {
      console.error('Error al eliminar área de cultivo:', err);
      const errorMessage = err.response?.data?.message || err.message;
      if (err.response?.status === 400) {
        setParentSnack(`Datos inválidos: ${errorMessage}`, 'error');
      } else if (err.response?.status === 403) {
        setParentSnack('No tienes permisos para realizar esta acción.', 'error');
      } else {
        setParentSnack(`Error al eliminar área: ${errorMessage}`, 'error');
      }
    } finally {
      setParentConfirmDialogOpen(false);
      setAreaDialogLoading(false);
    }
  }, [refreshCultivationAreas, setParentSnack, setParentConfirmDialogOpen]);

  const handleDeleteAreaClick = (areaToDelete) => {
    setParentConfirmDialog({
      title: 'Confirmar Eliminación de Área de Cultivo',
      message: `¿Eliminar el área de cultivo "${areaToDelete.name}"? Esto fallará si tiene lotes asociados.`,
      onConfirm: () => handleDeleteAreaConfirm(areaToDelete),
    });
    setParentConfirmDialogOpen(true);
  };

  return (
    <Paper
      sx={{
        bgcolor: '#283e51',
        borderRadius: 2,
        p: 1.5,
        minWidth: 280,
        maxWidth: 280,
        flexShrink: 0,
        boxShadow: '0 1px 0 rgba(9,30,66,.25)',
        color: '#fff',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, color: '#fff', flexGrow: 1 }}>
          {stage.name}
        </Typography>
        <IconButton
          size="small"
          onClick={() => handleDeleteStage(stage)}
          aria-label={`Eliminar etapa ${stage.name}`}
          disabled={isFacilityOperator}
        >
          <DeleteIcon sx={{ fontSize: 18, color: isFacilityOperator ? '#666' : '#aaa' }} />
        </IconButton>
      </Box>
      <Divider sx={{ mb: 1.5, bgcolor: 'rgba(255,255,255,0.2)' }} />
      <Box
        ref={setNodeRef}
        sx={{
          maxHeight: 'calc(100vh - 250px)',
          overflowY: 'auto',
          pr: 1,
          bgcolor: isOver ? 'rgba(255,255,255,0.1)' : 'transparent',
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
          />
        ))}
        {cultivationAreas.length === 0 && !isOver && (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center', color: '#aaa' }}>
            Arrastra áreas aquí o añade una nueva.
          </Typography>
        )}
      </Box>
      <Button
        variant="text"
        startIcon={<AddIcon />}
        onClick={() => handleOpenAddAreaDialog(null)}
        fullWidth
        disabled={isFacilityOperator}
        sx={{ mt: 1, color: isFacilityOperator ? '#666' : '#b0c4de', '&:hover': { bgcolor: isFacilityOperator ? 'transparent' : 'rgba(255,255,255,0.1)' } }}
      >
        Añadir un Área de Cultivo
      </Button>

      <Dialog open={openAddAreaDialog} onClose={handleCloseAddAreaDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingArea ? 'Editar Área de Cultivo' : 'Crear Nueva Área de Cultivo'}</DialogTitle>
        <form onSubmit={handleSaveArea}>
          <DialogContent>
            <TextField
              label="Nombre del Área"
              value={areaName}
              onChange={e => setAreaName(e.target.value)}
              fullWidth
              required
              sx={{ mt: 1, mb: 2 }}
              disabled={areaDialogLoading || isFacilityOperator}
              inputProps={{ maxLength: 100 }}
              aria-label="Nombre del área de cultivo"
            />
            <TextField
              label="Descripción"
              value={areaDescription}
              onChange={e => setAreaDescription(e.target.value)}
              fullWidth
              multiline
              rows={3}
              sx={{ mb: 2 }}
              disabled={areaDialogLoading || isFacilityOperator}
              aria-label="Descripción del área de cultivo"
            />
            <TextField
              label="Unidades de Capacidad"
              value={areaCapacityUnits}
              onChange={e => setAreaCapacityUnits(e.target.value)}
              type="number"
              fullWidth
              sx={{ mb: 2 }}
              disabled={areaDialogLoading || isFacilityOperator}
              aria-label="Unidades de capacidad"
            />
            <TextField
              label="Tipo de Unidad de Capacidad"
              value={areaCapacityUnitType}
              onChange={e => setAreaCapacityUnitType(e.target.value)}
              fullWidth
              sx={{ mb: 2 }}
              disabled={areaDialogLoading || isFacilityOperator}
              aria-label="Tipo de unidad de capacidad"
            />
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel id="area-facility-select-label">Instalación Asignada</InputLabel>
              <Select
                labelId="area-facility-select-label"
                value={areaFacilityId}
                label="Instalación Asignada"
                onChange={(e) => setAreaFacilityId(e.target.value)}
                required
                disabled={areaDialogLoading || isFacilityOperator}
                aria-label="Seleccionar instalación asignada"
              >
                {facilities.length === 0 ? (
                  <MenuItem value="">
                    <em>No hay instalaciones disponibles</em>
                  </MenuItem>
                ) : (
                  facilities.map((f) => (
                    <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>
                  ))
                )}
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseAddAreaDialog} disabled={areaDialogLoading || isFacilityOperator}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={areaDialogLoading || !areaName.trim() || isFacilityOperator}>
              {areaDialogLoading ? <CircularProgress size={24} /> : (editingArea ? 'Guardar Cambios' : 'Crear Área')}
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
  tenantId: PropTypes.string.isRequired,
  refreshCultivationAreas: PropTypes.func.isRequired,
  handleDeleteStage: PropTypes.func.isRequired,
  setParentSnack: PropTypes.func.isRequired,
  setParentConfirmDialog: PropTypes.func.isRequired,
  setParentConfirmDialogOpen: PropTypes.func.isRequired,
  selectedFacilityId: PropTypes.string.isRequired,
  facilities: PropTypes.array.isRequired,
  isFacilityOperator: PropTypes.bool.isRequired,
};

// --- Componente: CultivationAreaItem ---
const CultivationAreaItem = React.memo(({ area, handleEdit, handleDelete, setParentSnack, isFacilityOperator }) => {
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
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    backgroundColor: 'white',
    padding: '12px',
    cursor: isFacilityOperator ? 'default' : (isDragging ? 'grabbing' : 'grab'),
  };

  const [openAreaDetailDialog, setOpenAreaDetailDialog] = useState(false);

  const handleOpenAreaDetail = () => {
    setOpenAreaDetailDialog(true);
  };

  const handleCloseAreaDetail = () => {
    setOpenAreaDetailDialog(false);
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} onClick={handleOpenAreaDetail}>
      <CultivationAreaContent area={area} handleEdit={handleEdit} handleDelete={handleDelete} isFacilityOperator={isFacilityOperator} />
      <Dialog open={openAreaDetailDialog} onClose={handleCloseAreaDetail} maxWidth="md" fullWidth>
        <DialogTitle>Detalle del Área: {area.name}</DialogTitle>
        <DialogContent>
          <Typography variant="subtitle1" sx={{ mt: 1, mb: 1 }}>
            Descripción: {area.description || 'N/A'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Capacidad: {area.capacity_units} {area.capacity_unit_type}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Etapa Actual: {area.current_stage?.name || 'Cargando...'}
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Typography variant="h6" sx={{ mb: 2 }}>Lotes en esta Área:</Typography>
          {area.batches && area.batches.length > 0 ? (
            area.batches.map(batch => (
              <BatchItem key={batch.id} batch={batch} setParentSnack={setParentSnack} isFacilityOperator={isFacilityOperator} />
            ))
          ) : (
            <Typography variant="body2" color="text.secondary">
              No hay lotes en esta área.
            </Typography>
          )}
          <Button variant="contained" startIcon={<AddIcon />} sx={{ mt: 2 }} disabled={isFacilityOperator}>
            Añadir Nuevo Lote
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAreaDetail}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
});

CultivationAreaItem.propTypes = {
  area: PropTypes.object.isRequired,
  handleEdit: PropTypes.func.isRequired,
  handleDelete: PropTypes.func.isRequired,
  setParentSnack: PropTypes.func.isRequired,
  isFacilityOperator: PropTypes.bool.isRequired,
};

// --- Componente: CultivationAreaContent ---
const CultivationAreaContent = ({ area, handleEdit, handleDelete, isFacilityOperator }) => {
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Typography variant="body1" sx={{ fontWeight: 500, color: '#333', flexGrow: 1, pr: 1 }}>
          <LocationOnIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
          {area.name}
        </Typography>
        <Box>
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); handleEdit(area); }}
            sx={{ p: 0.5 }}
            aria-label={`Editar área ${area.name}`}
            disabled={isFacilityOperator}
          >
            <EditIcon sx={{ fontSize: 16, color: isFacilityOperator ? '#666' : '#004d80' }} />
          </IconButton>
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); handleDelete(area); }}
            sx={{ p: 0.5 }}
            aria-label={`Eliminar área ${area.name}`}
            disabled={isFacilityOperator}
          >
            <DeleteIcon sx={{ fontSize: 16, color: isFacilityOperator ? '#666' : '#004d80' }} />
          </IconButton>
        </Box>
      </Box>
      {area.description && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontSize: 13 }}>
          {area.description.length > 70 ? `${area.description.substring(0, 70)}...` : area.description}
        </Typography>
      )}
      {area.capacity_units && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontSize: 13 }}>
          Capacidad: {area.capacity_units} {area.capacity_unit_type || 'unidades'}
        </Typography>
      )}
      {area.batches && area.batches.length > 0 && (
        <Typography variant="body2" sx={{ mt: 0.5, fontSize: 13, fontWeight: 500 }}>
          Lotes: {area.batches.length}
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
};

// --- Componente: BatchItem ---
const BatchItem = ({ batch, setParentSnack, isFacilityOperator }) => {
  const handleAdvanceStage = () => setParentSnack(`Avanzar etapa del lote: ${batch.name}`, 'info');
  const handleCreateSample = () => setParentSnack(`Crear muestra del lote: ${batch.name}`, 'info');

  return (
    <Paper elevation={1} sx={{ p: 1.5, mb: 1, bgcolor: '#e8f5e9', borderRadius: 1 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#2e7d32' }}>
        Lote: {batch.name}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Unidades: {batch.current_units}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Variedad: {batch.variety}
      </Typography>
      {batch.advance_to_harvesting_on && (
        <Typography variant="body2" color="text.secondary">
          Cosecha: {new Date(batch.advance_to_harvesting_on).toLocaleDateString()}
        </Typography>
      )}
      <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        <Button size="small" variant="outlined" onClick={handleAdvanceStage} disabled={isFacilityOperator}>Avanzar Etapa</Button>
        <Button size="small" variant="outlined" onClick={handleCreateSample} disabled={isFacilityOperator}>Crear Muestra</Button>
      </Box>
    </Paper>
  );
};

BatchItem.propTypes = {
  batch: PropTypes.object.isRequired,
  setParentSnack: PropTypes.func.isRequired,
  isFacilityOperator: PropTypes.bool.isRequired,
};

export default CultivationPage;
