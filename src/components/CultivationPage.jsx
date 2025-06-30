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
const CultivationPage = ({ tenantId, isAppReady }) => {
  const [facilities, setFacilities] = useState([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState('');
  const [stages, setStages] = useState([]);
  const [rawAreas, setRawAreas] = useState([]); // New state for raw fetched areas
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

  // Utilidad para manejar notificaciones
  const showSnack = useCallback((message, severity = 'success') => {
    setSnack({ open: true, message, severity });
  }, []);

  // Memoize organized areas
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

  // Update cultivationAreas when organizedAreas changes
  useEffect(() => {
    setCultivationAreas(organizedAreas);
  }, [organizedAreas]);

  // Fetchers de datos
  const fetchFacilities = useCallback(async () => {
    console.log('CultivationPage: fetchFacilities iniciado.');
    try {
      const response = await api.get('/facilities');
      const fetchedFacilities = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.data)
        ? response.data.data
        : [];
      setFacilities(fetchedFacilities);
      if (fetchedFacilities.length > 0 && !selectedFacilityId) {
        setSelectedFacilityId(fetchedFacilities[0].id);
        console.log('CultivationPage: Instalación seleccionada por defecto:', fetchedFacilities[0].id);
      } else {
        setSelectedFacilityId('');
        console.log('CultivationPage: No hay instalaciones disponibles.');
      }
    } catch (error) {
      console.error('CultivationPage: Error fetching facilities:', error);
      showSnack('Error al cargar instalaciones.', 'error');
    }
  }, [selectedFacilityId, showSnack]);

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
      showSnack('Error al cargar etapas.', 'error');
    }
  }, [showSnack]);

  const fetchCultivationAreas = useCallback(async () => {
    if (!tenantId || !isAppReady) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const url = selectedFacilityId
        ? `/facilities/${selectedFacilityId}/cultivation-areas`
        : '/cultivation-areas';
      const response = await api.get(url);
      const fetchedAreas = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.data)
        ? response.data.data
        : [];
      setRawAreas(fetchedAreas); // <-- Updates rawAreas
    } catch (error) {
      console.error('CultivationPage: Error fetching cultivation areas:', error);
      showSnack('Error al cargar áreas de cultivo.', 'error');
    } finally {
      setLoading(false);
    }
  }, [tenantId, isAppReady, selectedFacilityId, showSnack]);

  // Efecto para la carga inicial de todos los datos
  useEffect(() => {
    const loadAllInitialData = async () => {
      if (!tenantId || !isAppReady) {
        setLoading(false);
        return;
      }

      console.log('CultivationPage: Iniciando carga inicial de todos los datos.');
      setLoading(true); // Activar loading para la carga inicial
      try {
        await fetchFacilities();
        await fetchStages();
        await fetchCultivationAreas(); // Llama a fetchCultivationAreas después de stages y facilities
      } catch (error) {
        console.error('CultivationPage: Error en carga inicial de todos los datos:', error);
        showSnack('Error al cargar datos iniciales.', 'error');
      } finally {
        setLoading(false); // Desactivar loading al finalizar la carga inicial
        console.log('CultivationPage: Carga inicial completa. setLoading(false).');
      }
    };

    loadAllInitialData();
  }, [tenantId, isAppReady, fetchFacilities, fetchStages, fetchCultivationAreas, showSnack]); // Dependencies for this effect

  // Handlers de UI y Diálogos
  const handleOpenStageDialog = (stage = null) => {
    setEditingStage(stage);
    setStageName(stage ? stage.name : '');
    setOpenStageDialog(true);
    setStageDialogLoading(false);
    console.log('CultivationPage: Diálogo de etapa abierto. Editando:', !!stage);
  };

  const handleCloseStageDialog = () => {
    setOpenStageDialog(false);
    setEditingStage(null);
    setStageName('');
    setStageDialogLoading(false);
    console.log('CultivationPage: Diálogo de etapa cerrado.');
  };

  const handleSaveStage = async (e) => {
    e.preventDefault();
    if (!stageName.trim()) {
      showSnack('El nombre de la etapa es obligatorio.', 'warning');
      return;
    }
    if (stageName.length > 100) {
      showSnack('El nombre de la etapa no puede exceder los 100 caracteres.', 'warning');
      return;
    }
    if (/[<>{}]/.test(stageName)) {
      showSnack('El nombre no puede contener caracteres especiales como <, >, o {}.', 'warning');
      return;
    }
    setStageDialogLoading(true);
    console.log('CultivationPage: Intentando guardar etapa:', stageName);
    try {
      const stageData = { name: stageName };
      if (editingStage) {
        await api.put(`/stages/${editingStage.id}`, stageData);
        showSnack('Etapa actualizada.', 'success');
      } else {
        await api.post('/stages', stageData);
        showSnack('Etapa creada.', 'success');
      }
      await fetchStages(); // Refresca las etapas
      await fetchCultivationAreas(); // Refresca las áreas de cultivo (importante si la nueva etapa afecta la organización)
      handleCloseStageDialog();
    } catch (err) {
      console.error('CultivationPage: Error al guardar etapa:', err);
      const errorMessage = err.response?.data?.message || err.message;
      if (err.response?.status === 400) {
        showSnack(`Datos inválidos: ${errorMessage}`, 'error');
      } else if (err.response?.status === 403) {
        showSnack('No tienes permisos para realizar esta acción.', 'error');
      } else {
        showSnack(`Error al guardar etapa: ${errorMessage}`, 'error');
      }
    } finally {
      setStageDialogLoading(false);
      console.log('CultivationPage: setStageDialogLoading(false) llamado en handleSaveStage.');
    }
  };

  const handleDeleteStageConfirm = useCallback(async (stageToDelete) => {
    setLoading(true);
    console.log('CultivationPage: Confirmando eliminación de etapa:', stageToDelete.name);
    try {
      await api.delete(`/stages/${stageToDelete.id}`);
      showSnack('Etapa eliminada.', 'info');
      await fetchStages(); // Refresca las etapas
      await fetchCultivationAreas(); // Refresca las áreas de cultivo
    } catch (err) {
      console.error('CultivationPage: Error al eliminar etapa:', err);
      const errorMessage = err.response?.data?.message || err.message;
      if (err.response?.status === 400) {
        showSnack(`Datos inválidos: ${errorMessage}`, 'error');
      } else if (err.response?.status === 403) {
        showSnack('No tienes permisos para realizar esta acción.', 'error');
      } else {
        showSnack(`Error al eliminar etapa: ${errorMessage}`, 'error');
      }
    } finally {
      setLoading(false);
      setConfirmDialogOpen(false);
      console.log('CultivationPage: setLoading(false) llamado en handleDeleteStageConfirm.');
    }
  }, [fetchStages, fetchCultivationAreas, showSnack]);

  const handleDeleteStageClick = (stageToDelete) => {
    setConfirmDialogData({
      title: 'Confirmar Eliminación de Etapa',
      message: `¿Estás seguro de eliminar la etapa "${stageToDelete.name}"? Esto fallará si tiene áreas de cultivo asociadas.`,
      onConfirm: () => handleDeleteStageConfirm(stageToDelete),
    });
    setConfirmDialogOpen(true);
    console.log('CultivationPage: Diálogo de confirmación de eliminación de etapa abierto.');
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
    let targetStageId = over.id; // Corrected: over.id is the droppable ID
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

    const newCultivationAreasState = JSON.parse(JSON.stringify(cultivationAreas));
    const { draggedArea, sourceStage, sourceAreaIndex } = findDraggedArea(newCultivationAreasState, active.id);
    if (!draggedArea || !sourceStage) {
      console.error('CultivationPage: No se encontró el área arrastrada o la etapa de origen.');
      return;
    }

    const { targetStageId, targetAreaId } = parseDragDestination(over);
    const destinationStage = newCultivationAreasState.find(stage => stage.id === targetStageId);
    if (!destinationStage) {
      console.error('CultivationPage: No se pudo encontrar la etapa de destino.');
      return;
    }

    setLoading(true);
    try {
      if (sourceStage.id === destinationStage.id) {
        await handleSameStageDrag(sourceStage, destinationStage, sourceAreaIndex, targetAreaId, newCultivationAreasState);
      } else {
        await handleCrossStageDrag(draggedArea, sourceStage, destinationStage, sourceAreaIndex, targetAreaId, newCultivationAreasState);
      }
      setCultivationAreas(newCultivationAreasState); // Update local state immediately for visual feedback
      showSnack('Área de cultivo movida.', 'success');
    } catch (error) {
      console.error('CultivationPage: Error en operación de arrastre:', error);
      showSnack('Error al arrastrar. Recargando datos...', 'error');
    } finally {
      await fetchCultivationAreas(); // Recargar datos para reflejar cambios y desactivar loading
      console.log('CultivationPage: setLoading(false) llamado en handleDragEnd.');
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

  // Renderizado
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
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel id="facility-select-label" sx={{ color: '#fff' }}>Instalación</InputLabel>
          <Select
            labelId="facility-select-label"
            value={selectedFacilityId}
            label="Instalación"
            onChange={(e) => setSelectedFacilityId(e.target.value)}
            disabled={loading || facilities.length === 0}
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
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenStageDialog(null)}
          disabled={loading}
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

// --- Componente: StageView ---
const StageView = React.memo(({ stage, cultivationAreas, tenantId, refreshCultivationAreas, handleDeleteStage, setParentSnack, setParentConfirmDialog, setParentConfirmDialogOpen, selectedFacilityId, facilities }) => {
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
    setAreaFacilityId(facilities.length > 0 ? selectedFacilityId : '');
  }, [selectedFacilityId, facilities]);

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
    setAreaFacilityId(facilities.length > 0 ? selectedFacilityId : '');
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
        >
          <DeleteIcon sx={{ fontSize: 18, color: '#aaa' }} />
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
        sx={{ mt: 1, color: '#b0c4de', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
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
              disabled={areaDialogLoading}
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
              disabled={areaDialogLoading}
              aria-label="Descripción del área de cultivo"
            />
            <TextField
              label="Unidades de Capacidad"
              value={areaCapacityUnits}
              onChange={e => setAreaCapacityUnits(e.target.value)}
              type="number"
              fullWidth
              sx={{ mb: 2 }}
              disabled={areaDialogLoading}
              aria-label="Unidades de capacidad"
            />
            <TextField
              label="Tipo de Unidad de Capacidad"
              value={areaCapacityUnitType}
              onChange={e => setAreaCapacityUnitType(e.target.value)}
              fullWidth
              sx={{ mb: 2 }}
              disabled={areaDialogLoading}
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
                disabled={areaDialogLoading}
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
            <Button onClick={handleCloseAddAreaDialog} disabled={areaDialogLoading}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={areaDialogLoading || !areaName.trim()}>
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
};

// --- Componente: CultivationAreaItem ---
const CultivationAreaItem = React.memo(({ area, handleEdit, handleDelete, setParentSnack }) => {
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
    cursor: isDragging ? 'grabbing' : 'grab',
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
      <CultivationAreaContent area={area} handleEdit={handleEdit} handleDelete={handleDelete} />
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
              <BatchItem key={batch.id} batch={batch} setParentSnack={setParentSnack} />
            ))
          ) : (
            <Typography variant="body2" color="text.secondary">
              No hay lotes en esta área.
            </Typography>
          )}
          <Button variant="contained" startIcon={<AddIcon />} sx={{ mt: 2 }}>
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
};

// --- Componente: CultivationAreaContent ---
const CultivationAreaContent = ({ area, handleEdit, handleDelete }) => {
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
          >
            <EditIcon sx={{ fontSize: 16, color: '#004d80' }} />
          </IconButton>
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); handleDelete(area); }}
            sx={{ p: 0.5 }}
            aria-label={`Eliminar área ${area.name}`}
          >
            <DeleteIcon sx={{ fontSize: 16, color: '#004d80' }} />
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
};

// --- Componente: BatchItem ---
const BatchItem = ({ batch, setParentSnack }) => {
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
        <Button size="small" variant="outlined" onClick={handleAdvanceStage}>Avanzar Etapa</Button>
        <Button size="small" variant="outlined" onClick={handleCreateSample}>Crear Muestra</Button>
      </Box>
    </Paper>
  );
};

BatchItem.propTypes = {
  batch: PropTypes.object.isRequired,
  setParentSnack: PropTypes.func.isRequired,
};

CultivationPage.propTypes = {
  tenantId: PropTypes.string.isRequired,
  isAppReady: PropTypes.bool.isRequired,
};

export default CultivationPage;
