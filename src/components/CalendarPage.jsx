// src/components/CalendarPage.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "../App"; // Importa tu instancia de Axios configurada
import {
  Box, Typography, Button, CircularProgress, Snackbar, Alert,
  TextField, Paper, Divider, IconButton, Grid,
  Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Select, MenuItem
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import DateRangeIcon from "@mui/icons-material/DateRange";
import DescriptionIcon from "@mui/icons-material/Description";
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import GroupIcon from '@mui/icons-material/Group';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

// --- Importaciones para MUI X Date Pickers ---
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import 'dayjs/locale/es';

// --- Importaciones para dnd-kit ---
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
      PaperProps={{ sx: { bgcolor: '#2d3748', color: '#e2e8f0', borderRadius: 2 } }} // Estilo oscuro
    >
      <DialogTitle id="alert-dialog-title" sx={{ bgcolor: '#3a506b', color: '#fff' }}>{title}</DialogTitle> {/* Estilo oscuro */}
      <DialogContent sx={{ pt: '20px !important' }}>
        <Typography id="alert-dialog-description" sx={{ color: '#a0aec0' }}> {/* Color de texto para contraste */}
          {message}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ bgcolor: '#3a506b' }}> {/* Estilo oscuro */}
        <Button onClick={onCancel} sx={{ color: '#a0aec0' }}> {/* Color de botón para contraste */}
          Cancelar
        </Button>
        <Button onClick={onConfirm} color="error" autoFocus sx={{ color: '#fc8181' }}> {/* Color de botón para contraste */}
          Confirmar
        </Button>
      </DialogActions>
    </Dialog>
  );
};


// --- Componente principal del Módulo de Calendario ---
const CalendarPage = ({ tenantId, isAppReady, setParentSnack, isGlobalAdmin }) => {
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: "", severity: "success" });

  const [openBoardDialog, setOpenBoardDialog] = useState(false);
  const [boardName, setBoardName] = useState("");
  const [boardDescription, setBoardDescription] = useState("");
  const [editingBoard, setEditingBoard] = useState(null);

  const [viewingBoardId, setViewingBoardId] = useState(null);
  const selectedBoard = boards.find(board => board.id === viewingBoardId);

  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmDialogData, setConfirmDialogData] = useState({ title: '', message: '', onConfirm: () => {} });

  const [tenants, setTenants] = useState([]);
  const [selectedTenantForBoard, setSelectedTenantForBoard] = useState(''); // Para el diálogo de crear/editar
  const [selectedTenantForViewing, setSelectedTenantForViewing] = useState(''); // Para el selector de la vista principal


  // Utilidad para mostrar notificaciones
  const showSnack = useCallback((message, severity = 'success') => {
    setSnack({ open: true, message, severity });
  }, []);


  // --- Sincronizar selectedTenantForViewing con localStorage ---
  useEffect(() => {
    if (isGlobalAdmin) {
      if (selectedTenantForViewing) {
        localStorage.setItem('currentTenantId', String(selectedTenantForViewing));
        console.log(`CalendarPage: Super Admin, currentTenantId en localStorage actualizado a: ${selectedTenantForViewing}`);
      } else {
        localStorage.removeItem('currentTenantId');
        console.log("CalendarPage: Super Admin, selectedTenantForViewing es nulo, removiendo currentTenantId de localStorage.");
      }
    } else if (tenantId) {
      // Para usuarios de tenant, siempre se usa su propio tenantId
      localStorage.setItem('currentTenantId', String(tenantId));
      console.log(`CalendarPage: Tenant user, currentTenantId en localStorage actualizado a: ${tenantId}`);
    } else {
      localStorage.removeItem('currentTenantId');
      console.log("CalendarPage: Ni Super Admin ni Tenant ID válido, removiendo currentTenantId de localStorage.");
    }
  }, [isGlobalAdmin, selectedTenantForViewing, tenantId]);


  const fetchBoards = useCallback(async () => {
    // Si es Super Admin y no ha seleccionado un tenant para ver, no cargar nada
    if (isGlobalAdmin && !selectedTenantForViewing) {
      setBoards([]); // Limpiar tableros si no hay tenant seleccionado para ver
      setLoading(false);
      console.log("CalendarPage: Super Admin, no tenant selected for viewing. Skipping fetchBoards.");
      return;
    }

    // Si no es Super Admin y no hay tenantId, o la app no está lista, no cargar nada
    if (!isGlobalAdmin && !tenantId || !isAppReady) {
      setBoards([]); // Limpiar tableros si no hay tenantId y no es Super Admin
      setLoading(false);
      console.log("CalendarPage: Skipping fetchBoards. Not Global Admin and no tenantId or App not ready.");
      return;
    }

    setLoading(true);
    try {
      // La URL base es siempre /boards, el interceptor de Axios añade el X-Tenant-ID
      console.log("CalendarPage: Attempting to fetch boards from API.");
      const response = await api.get("/boards");
      const fetchedBoards = Array.isArray(response.data) ? response.data : response.data.data || [];
      setBoards(fetchedBoards);
      console.log("CalendarPage: Boards fetched successfully. Total:", fetchedBoards.length);

      // Si se está viendo un tablero específico y ya no existe en la lista, resetear
      if (viewingBoardId && !fetchedBoards.some(b => b.id === viewingBoardId)) {
          setViewingBoardId(null);
      }

    } catch (error) {
      console.error("CalendarPage: Error fetching boards:", error);
      showSnack("Error al cargar los tableros. Asegúrate de que el inquilino seleccionado tenga tableros o permisos.", "error"); // Mensaje más descriptivo
    } finally {
      setLoading(false);
    }
  }, [tenantId, isAppReady, viewingBoardId, showSnack, isGlobalAdmin, selectedTenantForViewing]);


  // Fetch de tenants para Super Admin
  const fetchTenants = useCallback(async () => {
    if (!isGlobalAdmin) {
      setTenants([]);
      return;
    }
    try {
      console.log("CalendarPage: Fetching tenants for Super Admin.");
      const response = await api.get('/tenants');
      const fetchedTenants = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.data)
        ? response.data.data
        : [];
      setTenants(fetchedTenants);
      // Inicializar selectedTenantForViewing si es Super Admin y no hay uno seleccionado
      if (fetchedTenants.length > 0 && !selectedTenantForViewing) {
        setSelectedTenantForViewing(fetchedTenants[0].id);
        console.log("CalendarPage: Initializing selectedTenantForViewing with first tenant:", fetchedTenants[0].id);
      }
    } catch (error) {
      console.error('CalendarPage: Error fetching tenants:', error);
      showSnack('Error al cargar inquilinos para la asignación de tableros.', 'error');
    }
  }, [isGlobalAdmin, showSnack, selectedTenantForViewing]);


  useEffect(() => {
    console.log("CalendarPage: Initial useEffect running. Is app ready:", isAppReady, "isGlobalAdmin:", isGlobalAdmin, "tenantId:", tenantId);
    if (isAppReady) {
      if (isGlobalAdmin) {
        fetchTenants(); // Cargar tenants si es global admin
      } else if (tenantId) {
        // Si no es global admin y tiene tenantId, inicializar selectedTenantForViewing con su propio tenantId
        setSelectedTenantForViewing(tenantId);
        console.log("CalendarPage: Initializing selectedTenantForViewing with user's tenantId:", tenantId);
      }
    }
  }, [isAppReady, isGlobalAdmin, tenantId, fetchTenants]);

  // useEffect para cargar tableros cuando cambian las dependencias relevantes
  // Se ejecutará cuando selectedTenantForViewing cambie para Super Admin
  // o cuando tenantId esté disponible para usuarios de tenant
  useEffect(() => {
    if (isAppReady && (tenantId || (isGlobalAdmin && selectedTenantForViewing))) {
        console.log("CalendarPage: Triggering fetchBoards due to dependency change.");
        fetchBoards();
    }
  }, [isAppReady, tenantId, isGlobalAdmin, selectedTenantForViewing, fetchBoards]);


  const handleOpenBoardDialog = (board = null) => {
    setEditingBoard(board);
    setBoardName(board ? board.name : "");
    setBoardDescription(board ? (board.description || "") : "");
    // Si es Super Admin y edita, preselecciona el tenant del tablero
    if (isGlobalAdmin && board && board.tenant_id) {
      setSelectedTenantForBoard(board.tenant_id);
    } else if (isGlobalAdmin && tenants.length > 0) {
      // Si es Super Admin y crea, preselecciona el primer tenant o el seleccionado para ver
      setSelectedTenantForBoard(selectedTenantForViewing || tenants[0].id);
    } else if (!isGlobalAdmin && tenantId) {
      // Para usuarios de tenant, preselecciona su propio tenantId
      setSelectedTenantForBoard(tenantId);
    } else {
      setSelectedTenantForBoard(''); // Si no hay un tenant válido
    }
    setOpenBoardDialog(true);
  };

  const handleCloseBoardDialog = () => {
    setOpenBoardDialog(false);
    setEditingBoard(null);
    setBoardName("");
    setBoardDescription("");
    setSelectedTenantForBoard(''); // Limpiar al cerrar
  };

  const handleSaveBoard = async (e) => {
    e.preventDefault();

    if (!boardName.trim()) {
      showSnack("El nombre del tablero es obligatorio.", "warning");
      return;
    }

    // Validación para Super Admin: debe seleccionar un tenant
    if (isGlobalAdmin && !selectedTenantForBoard) {
      showSnack("Como Super Admin, debes seleccionar un inquilino para el tablero.", "error");
      return;
    }

    setLoading(true);
    try {
      const boardData = {
        name: boardName,
        description: boardDescription,
      };

      // Asignar tenant_id para el payload
      // Esta parte es para el payload, el X-Tenant-ID se maneja en el useEffect de sincronización.
      if (isGlobalAdmin) {
        boardData.tenant_id = parseInt(selectedTenantForBoard, 10);
      } else if (tenantId) {
        boardData.tenant_id = parseInt(tenantId, 10);
      } else {
        showSnack("No se pudo determinar el Tenant ID para el tablero.", "error");
        setLoading(false);
        return;
      }

      console.log("CalendarPage: Saving board with data:", boardData);
      let res;
      if (editingBoard) {
        res = await api.put(`/boards/${editingBoard.id}`, boardData);
        showSnack("Tablero actualizado.", "success");
      } else {
        res = await api.post("/boards", boardData);
        showSnack("Tablero creado.", "success");
        setViewingBoardId(res.data.id);
      }
      console.log("CalendarPage: Board saved. Response:", res.data);
      await fetchBoards(); // Vuelve a cargar los tableros después de guardar
      handleCloseBoardDialog();
    } catch (err) {
      console.error("CalendarPage: Error al guardar tablero:", err.response?.data || err.message);
      const errorMessage = err.response?.data?.message || err.message;
      setSnack("Error al guardar tablero: " + errorMessage, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBoardConfirm = useCallback(async (boardToDelete) => {
    setLoading(true);
    try {
      await api.delete(`/boards/${boardToDelete.id}`);
      showSnack("Tablero eliminado.", "info");
      setViewingBoardId(null);
      await fetchBoards();
    }
    catch (err) {
      console.error("CalendarPage: Error al eliminar tablero:", err.response?.data || err.message);
      const errorMessage = err.response?.data?.message || err.message;
      showSnack("Error al eliminar tablero: " + errorMessage, "error");
    } finally {
      setLoading(false);
      setConfirmDialogOpen(false);
    }
  }, [fetchBoards, showSnack]);

  const handleDeleteBoardClick = (boardToDelete) => {
    setConfirmDialogData({
      title: "Confirmar Eliminación",
      message: `¿Estás seguro de eliminar el tablero "${boardToDelete.name}"? Esto también eliminará todas sus listas y tarjetas.`,
      onConfirm: () => handleDeleteBoardConfirm(boardToDelete),
    });
    setConfirmDialogOpen(true);
  };


  const handleBoardCardClick = (boardId) => {
      setViewingBoardId(boardId);
  };

  const handleBackToBoardSelection = () => {
      setViewingBoardId(null);
  };


  if (viewingBoardId && selectedBoard) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 }, bgcolor: '#1a202c', minHeight: 'calc(100vh - 64px)', color: '#fff' }}> {/* Fondo oscuro */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
            <IconButton onClick={handleBackToBoardSelection} sx={{ mr: 1, color: '#fff' }}> {/* Color blanco para el icono */}
                <ArrowBackIcon />
            </IconButton>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 600, color: '#fff' }}> {/* Color blanco para el título */}
            {selectedBoard.name}
          </Typography>
          <Typography variant="body1" sx={{ ml: { sm: 2 }, color: '#a0aec0' }}> {/* Color de texto para contraste */}
            {selectedBoard.description || "Sin descripción."}
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => handleOpenBoardDialog(selectedBoard)}
            sx={{ borderRadius: 2, borderColor: '#b0c4de', color: '#b0c4de', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)', borderColor: '#fff' } }}
          >
            Editar Tablero
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => handleDeleteBoardClick(selectedBoard)}
            sx={{ borderRadius: 2, borderColor: '#fc8181', color: '#fc8181', '&:hover': { bgcolor: 'rgba(252,129,129,0.1)', borderColor: '#ff0000' } }}
          >
            Eliminar Tablero
          </Button>
        </Box>
        <BoardView
          board={selectedBoard}
          // Pasar el tenantId correcto a BoardView
          tenantId={isGlobalAdmin ? selectedTenantForViewing : tenantId}
          setParentSnack={showSnack} // Pasar showSnack
          setParentConfirmDialog={setConfirmDialogData}
          setParentConfirmDialogOpen={setConfirmDialogOpen}
        />

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

        <Dialog open={openBoardDialog} onClose={handleCloseBoardDialog} maxWidth="sm" fullWidth
          PaperProps={{ sx: { bgcolor: '#2d3748', color: '#e2e8f0', borderRadius: 2 } }} // Estilo oscuro
        >
            <DialogTitle sx={{ bgcolor: '#3a506b', color: '#fff' }}>{editingBoard ? "Editar Tablero" : "Crear Nuevo Tablero"}</DialogTitle> {/* Estilo oscuro */}
            <form onSubmit={handleSaveBoard}>
                <DialogContent sx={{ pt: '20px !important' }}>
                    <TextField
                        label="Nombre del Tablero"
                        value={boardName}
                        onChange={e => setBoardName(e.target.value)}
                        fullWidth
                        required
                        sx={{ mt: 1, mb: 2,
                          '& .MuiInputBase-input': { color: '#fff' },
                          '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                          '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
                          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.8)' },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
                        }}
                        disabled={loading}
                        helperText={!boardName.trim() && openBoardDialog ? "El nombre del tablero es obligatorio." : ""}
                        error={!boardName.trim() && openBoardDialog}
                    />
                    <TextField
                        label="Descripción del Tablero"
                        value={boardDescription}
                        onChange={e => setBoardDescription(e.target.value)}
                        fullWidth
                        multiline
                        rows={3}
                        sx={{ mb: 2,
                          '& .MuiInputBase-input': { color: '#fff' },
                          '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                          '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
                          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.8)' },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
                        }}
                        disabled={loading}
                    />
                    {isGlobalAdmin && ( // Mostrar selector de tenant solo si es Super Admin
                      <FormControl fullWidth sx={{ mb: 2 }}>
                        <InputLabel id="tenant-select-label" sx={{ color: '#fff' }}>Asignar a Inquilino</InputLabel>
                        <Select
                          labelId="tenant-select-label"
                          value={selectedTenantForBoard}
                          label="Asignar a Inquilino"
                          onChange={(e) => setSelectedTenantForBoard(e.target.value)}
                          required
                          disabled={loading || tenants.length === 0}
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
                          {tenants.length === 0 ? (
                            <MenuItem value="" sx={{ color: '#aaa' }}>
                              <em>No hay inquilinos disponibles</em>
                            </MenuItem>
                          ) : (
                            tenants.map((tenant) => (
                              <MenuItem key={tenant.id} value={tenant.id}>
                                {tenant.name}
                              </MenuItem>
                            ))
                          )}
                        </Select>
                      </FormControl>
                    )}
                </DialogContent>
                <DialogActions sx={{ bgcolor: '#3a506b' }}> {/* Estilo oscuro */}
                    <Button onClick={handleCloseBoardDialog} disabled={loading} sx={{ color: '#a0aec0' }}>Cancelar</Button>
                    <Button type="submit" variant="contained" disabled={loading || !boardName.trim() || (isGlobalAdmin && !selectedTenantForBoard)}
                      sx={{ bgcolor: '#4CAF50', '&:hover': { bgcolor: '#43A047' } }}
                    >
                        {loading ? <CircularProgress size={24} /> : (editingBoard ? "Guardar Cambios" : "Crear Tablero")}
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
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, bgcolor: '#1a202c', minHeight: 'calc(100vh - 64px)', color: '#fff' }}> {/* Fondo oscuro general */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4, flexWrap: 'wrap', gap: 2 }}> {/* Añadir flexWrap y gap para responsive */}
        <GroupIcon sx={{ fontSize: 32, color: '#fff', mr: 1 }} /> {/* Color blanco para el icono */}
        <Typography variant="h5" sx={{ fontWeight: 600, color: '#fff' }}> {/* Color blanco para el título */}
          Tus tableros
        </Typography>
        <Box sx={{ flexGrow: 1 }} /> {/* Espaciador */}
        {isGlobalAdmin && ( // Selector de tenant para Super Admin en la vista principal
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel id="tenant-view-select-label" sx={{ color: '#fff' }}>Ver Inquilino</InputLabel>
            <Select
              labelId="tenant-view-select-label"
              value={selectedTenantForViewing}
              label="Ver Inquilino"
              onChange={(e) => setSelectedTenantForViewing(e.target.value)}
              disabled={loading || tenants.length === 0}
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
              {tenants.length === 0 ? (
                <MenuItem value="" sx={{ color: '#aaa' }}>
                  <em>No hay inquilinos disponibles</em>
                </MenuItem>
              ) : (
                tenants.map((tenant) => (
                  <MenuItem key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>
        )}
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', color: '#fff' }}> {/* Color blanco para el spinner */}
          <CircularProgress color="inherit" />
          <Typography variant="body1" sx={{ ml: 2, color: '#fff' }}>Cargando tableros...</Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {/* Mostrar mensaje si es Super Admin y no hay tenant seleccionado para ver */}
          {isGlobalAdmin && !selectedTenantForViewing && tenants.length > 0 ? (
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ color: '#a0aec0', textAlign: 'center', mt: 5 }}>
                Por favor, selecciona un inquilino para ver sus tableros.
              </Typography>
            </Grid>
          ) : (
            <>
              {boards.map((board) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={board.id}>
                  <BoardCard board={board} onClick={() => handleBoardCardClick(board.id)} />
                </Grid>
              ))}
              <Grid item xs={12} sm={6} md={4} lg={3}>
                <CreateBoardCard onClick={() => handleOpenBoardDialog(null)} />
              </Grid>
            </>
          )}
          {/* Si no hay tableros y no es Super Admin o no hay tenants disponibles */}
          {!loading && boards.length === 0 && (!isGlobalAdmin || (isGlobalAdmin && selectedTenantForViewing && tenants.length > 0)) && (
             <Grid item xs={12}>
                <Typography variant="h6" sx={{ color: '#a0aec0', textAlign: 'center', width: '100%', mt: 5 }}>
                  No hay tableros disponibles. ¡Crea uno para empezar!
                </Typography>
            </Grid>
          )}
        </Grid>
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

      <Dialog open={openBoardDialog} onClose={handleCloseBoardDialog} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: '#2d3748', color: '#e2e8f0', borderRadius: 2 } }} // Estilo oscuro
      >
        <DialogTitle sx={{ bgcolor: '#3a506b', color: '#fff' }}>{editingBoard ? "Editar Tablero" : "Crear Nuevo Tablero"}</DialogTitle> {/* Estilo oscuro */}
        <form onSubmit={handleSaveBoard}>
          <DialogContent sx={{ pt: '20px !important' }}>
            <TextField
              label="Nombre del Tablero"
              value={boardName}
              onChange={e => setBoardName(e.target.value)}
              fullWidth
              required
              sx={{ mt: 1, mb: 2,
                '& .MuiInputBase-input': { color: '#fff' },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.8)' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
              }}
              disabled={loading}
              helperText={!boardName.trim() && openBoardDialog ? "El nombre del tablero es obligatorio." : ""}
              error={!boardName.trim() && openBoardDialog}
            />
            <TextField
              label="Descripción del Tablero"
              value={boardDescription}
              onChange={e => setBoardDescription(e.target.value)}
              fullWidth
              multiline
              rows={3}
              sx={{ mb: 2,
                '& .MuiInputBase-input': { color: '#fff' },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.8)' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
              }}
              disabled={loading}
            />
            {isGlobalAdmin && ( // Mostrar selector de tenant solo si es Super Admin
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel id="tenant-select-label" sx={{ color: '#fff' }}>Asignar a Inquilino</InputLabel>
                <Select
                  labelId="tenant-select-label"
                  value={selectedTenantForBoard}
                  label="Asignar a Inquilino"
                  onChange={(e) => setSelectedTenantForBoard(e.target.value)}
                  required
                  disabled={loading || tenants.length === 0}
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
                  {tenants.length === 0 ? (
                    <MenuItem value="" sx={{ color: '#aaa' }}>
                      <em>No hay inquilinos disponibles</em>
                    </MenuItem>
                  ) : (
                    tenants.map((tenant) => (
                      <MenuItem key={tenant.id} value={tenant.id}>
                        {tenant.name}
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>
            )}
          </DialogContent>
          <DialogActions sx={{ bgcolor: '#3a506b' }}> {/* Estilo oscuro */}
            <Button onClick={handleCloseBoardDialog} disabled={loading} sx={{ color: '#a0aec0' }}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={loading || !boardName.trim() || (isGlobalAdmin && !selectedTenantForBoard)}
              sx={{ bgcolor: '#4CAF50', '&:hover': { bgcolor: '#43A047' } }}
            >
              {loading ? <CircularProgress size={24} /> : (editingBoard ? "Guardar Cambios" : "Crear Tablero")}
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


// --- Componente de Tarjeta de Tablero (Para mostrar en la selección) ---
const BoardCard = ({ board, onClick }) => {
  const getColor = (id) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    let color = '#';
    for (let i = 0; i < 3; i++) {
      let value = (hash >> (i * 8)) & 0xFF;
      color += ('00' + value.toString(16)).substr(-2);
    }
    return color;
  };

  const randomColor = getColor(board.id);

  return (
    <Paper
      onClick={onClick}
      sx={{
        height: 120,
        // Usar un color base más cercano al módulo de cultivo, manteniendo la aleatoriedad para diferenciar tableros
        backgroundColor: `color-mix(in srgb, ${randomColor} 20%, #2d3748 80%)`, // Mezcla color aleatorio con el azul oscuro base
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        p: 2,
        cursor: 'pointer',
        color: '#fff', // Asegurar que el texto sea blanco
        fontWeight: 600,
        boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-5px)',
          boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
        },
      }}
    >
      <Typography variant="h6" sx={{ color: 'white' }}>
        {board.name}
      </Typography>
    </Paper>
  );
};

// --- Componente de Tarjeta para Crear Nuevo Tablero ---
const CreateBoardCard = ({ onClick }) => {
  return (
    <Paper
      onClick={onClick}
      sx={{
        height: 120,
        backgroundColor: '#2d3748', // Fondo oscuro azulado, similar a las tarjetas de cultivo
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        p: 2,
        cursor: 'pointer',
        color: '#e2e8f0', // Texto claro
        fontWeight: 600,
        border: '2px dashed #4a5568', // Borde más oscuro para contraste
        boxShadow: 'none',
        transition: 'transform 0.2s, background-color 0.2s',
        '&:hover': {
          backgroundColor: '#3a506b', // Fondo ligeramente más oscuro al pasar el ratón
          transform: 'translateY(-2px)',
        },
      }}
    >
      <AddIcon sx={{ fontSize: 40, mb: 1, color: '#e2e8f0' }} /> {/* Icono claro */}
      <Typography variant="subtitle1" sx={{ color: '#e2e8f0' }}> {/* Texto claro */}
        Crear un tablero nuevo
      </Typography>
    </Paper>
  );
};


// --- Componente: BoardView (Representa un tablero de Trello) ---
const BoardView = ({ board, tenantId, setParentSnack, setParentConfirmDialog, setParentConfirmDialogOpen }) => {
  const [lists, setLists] = useState([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [activeDraggableId, setActiveDraggableId] = useState(null); // Estado para la tarjeta que se está arrastrando
  const [openAddListDialog, setOpenAddListDialog] = useState(false); // Estado para el diálogo de añadir lista
  const [listName, setListName] = useState(""); // Estado para el nombre de la nueva lista


  // Configuración de sensores para dnd-kit
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Función para cargar listas Y sus tarjetas anidadas
  const fetchListsWithCards = useCallback(async () => {
    // La condición ahora solo verifica board?.id, ya que tenantId se garantiza que es el correcto
    // gracias al cambio en CalendarPage y el interceptor de Axios.
    // Asegurarse de que tenantId no sea null o undefined antes de continuar
    if (!board?.id || tenantId === null || tenantId === undefined) {
      console.log("BoardView: Skipping fetchListsWithCards. Board ID:", board?.id, "Tenant ID:", tenantId);
      setLists([]); // Asegurar que las listas se limpien si no hay datos válidos
      return;
    }

    setLoadingLists(true);
    console.log(`BoardView: Fetching lists with cards for board ID: ${board.id}, Tenant ID: ${tenantId}`);
    try {
      const listsResponse = await api.get(`/boards/${board.id}/lists`);
      // CORRECCIÓN: Usar listsResponse.data en lugar de response.data
      let fetchedLists = Array.isArray(listsResponse.data) ? listsResponse.data : listsResponse.data.data || [];
      console.log("BoardView: Raw lists response:", fetchedLists);

      const listsWithCardsPromises = fetchedLists.map(async (list) => {
        try {
          const cardsResponse = await api.get(`/lists/${list.id}/cards`);
          const fetchedCards = Array.isArray(cardsResponse.data) ? cardsResponse.data : cardsResponse.data.data || [];
          console.log(`BoardView: Cards for list ${list.id}:`, fetchedCards);
          return { ...list, cards: fetchedCards.sort((a, b) => a.order - b.order) };
        } catch (cardError) {
          console.error(`Error fetching cards for list ${list.id}:`, cardError);
          setParentSnack("Error al cargar tarjetas de la lista \"" + list.name + "\".", "error"); // Usar setParentSnack
          return { ...list, cards: [] };
        }
      });

      const listsWithCards = await Promise.all(listsWithCardsPromises);
      console.log("BoardView: Lists with cards (before setting state):", listsWithCards);
      setLists(listsWithCards.sort((a, b) => a.order - b.order));
      console.log("BoardView: Lists with cards fetched successfully and state updated.");
    } catch (error) {
      console.error(`BoardView: Error fetching lists for board ID: ${board.id}`, error);
      setParentSnack("Error al cargar las listas del tablero.", "error"); // Usar setParentSnack
    } finally {
      setLoadingLists(false);
    }
  }, [board?.id, tenantId, setParentSnack]);

  useEffect(() => {
    console.log("BoardView: useEffect triggered. Board ID:", board?.id, "Tenant ID:", tenantId);
    fetchListsWithCards();
  }, [fetchListsWithCards]);

  const handleOpenAddListDialog = () => {
    setListName("");
    setOpenAddListDialog(true);
  };

  const handleCloseAddListDialog = () => {
    setOpenAddListDialog(false);
    setListName("");
  };

  const handleAddList = async (e) => {
    e.preventDefault();
    if (!listName.trim()) {
      setParentSnack("El nombre de la lista es obligatorio.", "warning");
      return;
    }

    setLoadingLists(true);
    try {
      console.log(`BoardView: Attempting to create list '${listName}' for board ID: ${board.id}`);
      const response = await api.post(`/boards/${board.id}/lists`, { name: listName });
      console.log("BoardView: List creation API response:", response.data);
      setParentSnack("Lista creada.", "success");
      handleCloseAddListDialog();
      await fetchListsWithCards(); // Re-fetch lists after successful creation
      console.log("BoardView: Lists re-fetched after creation.");
    } catch (err) {
      console.error("BoardView: Error al crear lista:", err.response?.data || err.message);
      const errorMessage = err.response?.data?.message || err.message;
      setParentSnack("Error al crear lista: " + errorMessage, "error");
    } finally {
      setLoadingLists(false);
    }
  };

  const handleDeleteListConfirm = useCallback(async (listToDelete) => {
    setLoadingLists(true);
    try {
      console.log(`BoardView: Attempting to delete list '${listToDelete.name}' (ID: ${listToDelete.id})`);
      await api.delete(`/lists/${listToDelete.id}`);
      setParentSnack("Lista eliminada.", "info");
      await fetchListsWithCards();
      console.log("BoardView: Lists re-fetched after deletion.");
    } catch (err) {
      console.error("BoardView: Error al eliminar lista:", err.response?.data || err.message);
      const errorMessage = err.response?.data?.message || err.message;
      setParentSnack("Error al eliminar lista: " + errorMessage, "error");
    } finally {
      setLoadingLists(false);
      setParentConfirmDialogOpen(false);
    }
  }, [fetchListsWithCards, setParentSnack, setParentConfirmDialogOpen]);

  const handleDeleteListClick = (listToDelete) => {
    setParentConfirmDialog({
      title: "Confirmar Eliminación de Lista",
      message: `¿Eliminar la lista "${listToDelete.name}" y todas sus tarjetas?`,
      onConfirm: () => handleDeleteListConfirm(listToDelete),
    });
    setParentConfirmDialogOpen(true);
  };

  // --- dnd-kit handlers ---
  const handleDragStart = (event) => {
    setActiveDraggableId(event.active.id);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveDraggableId(null);

    if (!over) return;
    if (active.id === over.id) return;

    // Crea una copia profunda del estado actual de las listas
    const newLists = JSON.parse(JSON.stringify(lists));

    let draggedCard = null;
    let sourceList = null;
    let destinationList = null;
    let sourceCardIndex = -1;

    // Encuentra la tarjeta arrastrada y su lista de origen
    for (let i = 0; i < newLists.length; i++) {
        const list = newLists[i];
        for (let j = 0; j < list.cards.length; j++) {
            if (list.cards[j].id === active.id) {
                draggedCard = list.cards[j];
                sourceList = list;
                sourceCardIndex = j;
                break;
            }
        }
        if (draggedCard) break;
    }

    if (!draggedCard || !sourceList) {
        console.error("onDragEnd: No se encontró la tarjeta arrastrada o la lista de origen.");
        return;
    }

    let targetListId = over.id;
    let targetCardId = null;

    // Determina si el destino es una tarjeta o una lista
    if (over.data.current && over.data.current.type === 'Card') {
        targetListId = over.data.current.card.list_id;
        targetCardId = over.id;
    } else if (over.data.current && over.data.current.type === 'List') {
        targetListId = over.id;
    } else {
        console.warn("onDragEnd: Tipo de destino no reconocido o área de soltar inválida.");
        return;
    }

    // Encuentra la lista de destino
    destinationList = newLists.find(list => list.id === targetListId);

    if (!destinationList) {
        console.error("onDragEnd: No se pudo encontrar la lista de destino.");
        return;
    }

    const isSameList = sourceList.id === destinationList.id;

    if (isSameList) {
      // Movimiento dentro de la misma lista
      const oldIndex = sourceCardIndex;
      const newIndex = destinationList.cards.findIndex(card => card.id === over.id);

      if (oldIndex !== newIndex) {
        const updatedCards = arrayMove(sourceList.cards, oldIndex, newIndex);
        sourceList.cards = updatedCards.map((card, idx) => ({ ...card, order: idx }));

        setLists(newLists); // Actualiza el estado local inmediatamente para feedback visual

        try {
          // Llama a la API para reordenar las tarjetas en la misma lista
          await api.put(`/lists/${sourceList.id}/cards/reorder`, {
            card_ids: updatedCards.map(card => card.id),
          });
          setParentSnack("Tarjeta reordenada.", "success"); // Usar setParentSnack
        } catch (error) {
          console.error("Error al reordenar tarjeta:", error.response?.data || error.message);
          setParentSnack("Error al reordenar la tarjeta. Recargando datos...", "error"); // Usar setParentSnack
          await fetchListsWithCards(); // Vuelve a cargar los datos si hay un error
        }
      }
    } else {
      // Movimiento entre diferentes listas
      // 1. Elimina la tarjeta de la lista de origen
      sourceList.cards.splice(sourceCardIndex, 1);

      // 2. Calcula la posición donde insertar la tarjeta en la lista de destino
      let targetIndexInDestination = destinationList.cards.length; // Por defecto, al final

      if (targetCardId) {
        targetIndexInDestination = destinationList.cards.findIndex(card => card.id === targetCardId);
        // Si no se encuentra la tarjeta de destino (ej. arrastró sobre el espacio vacío de la lista), añadir al final
        if (targetIndexInDestination === -1) targetIndexInDestination = destinationList.cards.length;
      } else if (destinationList.cards.length === 0 && over.data.current.type === 'List') {
        // Si arrastró sobre una lista vacía
        targetIndexInDestination = 0;
      }

      // 3. Inserta la tarjeta en la lista de destino y actualiza su list_id
      destinationList.cards.splice(targetIndexInDestination, 0, {
        ...draggedCard,
        list_id: destinationList.id,
      });

      // 4. Reasigna los órdenes para ambas listas
      sourceList.cards = sourceList.cards.map((card, idx) => ({ ...card, order: idx }));
      destinationList.cards = destinationList.cards.map((card, idx) => ({ ...card, order: idx }));

      setLists(newLists); // Actualiza el estado local inmediatamente para feedback visual

      try {
        // Llama a la API para actualizar el list_id y order de la tarjeta movida
        await api.put(`/cards/${draggedCard.id}`, {
          list_id: destinationList.id,
          order: targetIndexInDestination, // El orden final en la nueva lista
        });

        // Llama a la API para reordenar las tarjetas en la lista de origen
        await api.put(`/lists/${sourceList.id}/cards/reorder`, {
          card_ids: sourceList.cards.map(card => card.id),
        });

        // Llama a la API para reordenar las tarjetas en la lista de destino
        await api.put(`/lists/${destinationList.id}/cards/reorder`, {
          card_ids: destinationList.cards.map(card => card.id),
        });

        setParentSnack("Tarjeta movida de lista.", "success"); // Usar setParentSnack
      } catch (error) {
        console.error("Error al mover tarjeta entre listas:", error.response?.data || error.message);
        setParentSnack("Error al mover la tarjeta. Recargando datos...", "error"); // Usar setParentSnack
        await fetchListsWithCards(); // Vuelve a cargar los datos si hay un error
      }
    }
  };

  const getActiveCard = useCallback(() => {
    if (!activeDraggableId) return null;
    for (const list of lists) {
      const card = list.cards.find(c => c.id === activeDraggableId);
      if (card) return card;
    }
    return null;
  }, [activeDraggableId, lists]);


  if (!board) return null;

  return (
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
          minHeight: '200px'
        }}
      >
        {loadingLists ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%', py: 2, color: '#fff' }}> {/* Color blanco para el spinner */}
            <CircularProgress color="inherit" size={24} />
            <Typography variant="body1" sx={{ ml: 2, color: '#fff' }}>Cargando listas...</Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', gap: 2, height: '100%', alignItems: 'flex-start' }}>
            {lists.map((list) => (
              <ListView
                key={list.id}
                list={list}
                tenantId={tenantId}
                refreshLists={fetchListsWithCards}
                handleDeleteList={handleDeleteListClick}
                setParentSnack={setParentSnack}
                setParentConfirmDialog={setParentConfirmDialog}
                setParentConfirmDialogOpen={setParentConfirmDialogOpen}
              />
            ))}
          </Box>
        )}
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenAddListDialog}
          sx={{
            minWidth: 280,
            height: 50,
            flexShrink: 0,
            bgcolor: '#4CAF50', // Botón de añadir lista en verde, como "Añadir Etapa" en Cultivo
            color: '#fff', // Texto blanco
            '&:hover': { bgcolor: '#43A047' },
            borderRadius: 2
          }}
        >
          Añadir otra lista
        </Button>
      </Box>

      <DragOverlay>
        {activeDraggableId ? (
          <Paper
            sx={{
              p: 1.5,
              bgcolor: '#3a506b', // Fondo oscuro para la tarjeta arrastrada, similar a las tarjetas de cultivo
              borderRadius: 1.5,
              boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
              cursor: 'grabbing',
              width: '280px',
              opacity: 0.8,
              color: '#fff', // Texto claro
            }}
          >
            <CardContent card={getActiveCard()} />
          </Paper>
        ) : null}
      </DragOverlay>

      <Dialog open={openAddListDialog} onClose={handleCloseAddListDialog} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: '#2d3748', color: '#e2e8f0', borderRadius: 2 } }} // Estilo oscuro
      >
        <DialogTitle sx={{ bgcolor: '#3a506b', color: '#fff' }}>Añadir Nueva Lista</DialogTitle> {/* Estilo oscuro */}
        <form onSubmit={handleAddList}>
          <DialogContent sx={{ pt: '20px !important' }}>
            <TextField
              label="Nombre de la Lista"
              value={listName}
              onChange={e => setListName(e.target.value)}
              fullWidth
              required
              sx={{ mt: 1, mb: 2,
                '& .MuiInputBase-input': { color: '#fff' },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.8)' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
              }}
              disabled={loadingLists}
            />
          </DialogContent>
          <DialogActions sx={{ bgcolor: '#3a506b' }}> {/* Estilo oscuro */}
            <Button onClick={handleCloseAddListDialog} disabled={loadingLists} sx={{ color: '#a0aec0' }}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={loadingLists || !listName.trim()}
              sx={{ bgcolor: '#4CAF50', '&:hover': { bgcolor: '#43A047' } }}
            >
              {loadingLists ? <CircularProgress size={24} /> : "Crear Lista"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </DndContext>
  );
};


// --- Componente: ListView (Representa una lista de Trello) ---
const ListView = ({ list, tenantId, refreshLists, handleDeleteList, setParentSnack, setParentConfirmDialog, setParentConfirmDialogOpen }) => {
  const [openAddCardDialog, setOpenAddCardDialog] = useState(false);
  const [cardTitle, setCardTitle] = useState("");
  const [cardDescription, setCardDescription] = useState("");
  const [cardDueDate, setCardDueDate] = useState(null);
  const [editingCard, setEditingCard] = useState(null);

  const { setNodeRef, isOver } = useDroppable({
    id: list.id,
    data: {
        type: 'List',
        listId: list.id,
    }
  });


  const handleOpenCardDialog = (card = null) => {
    setEditingCard(card);
    setCardTitle(card ? card.title : "");
    setCardDescription(card ? (card.description || "") : "");
    setCardDueDate(card && card.due_date ? dayjs(card.due_date) : null);
    setOpenAddCardDialog(true);
  };

  const handleCloseCardDialog = () => {
    setOpenAddCardDialog(false);
    setEditingCard(null);
    setCardTitle("");
    setCardDescription("");
    setCardDueDate(null);
  };

  const handleSaveCard = async (e) => {
    e.preventDefault();
    if (!cardTitle.trim()) {
      setParentSnack("El título de la tarjeta es obligatorio.", "warning"); // Usar setParentSnack
      return;
    }

    try {
      const cardData = {
        title: cardTitle,
        description: cardDescription,
        due_date: cardDueDate ? cardDueDate.format('YYYY-MM-DD') : null,
        list_id: list.id,
        status: 'todo',
      };

      console.log("ListView: Saving card with data:", cardData);
      let res;
      if (editingCard) {
        res = await api.put(`/cards/${editingCard.id}`, cardData);
        setParentSnack("Tarjeta actualizada.", "success"); // Usar setParentSnack
      } else {
        res = await api.post(`/lists/${list.id}/cards`, cardData);
        setParentSnack("Tarjeta creada.", "success"); // Usar setParentSnack
      }
      console.log("ListView: Card saved. Response:", res.data);
      await refreshLists();
      handleCloseCardDialog();
      console.log("ListView: Lists refreshed after card save.");
    } catch (err) {
      console.error("ListView: Error al guardar tarjeta:", err.response?.data || err.message);
      const errorMessage = err.response?.data?.message || err.message;
      setParentSnack("Error al guardar tarjeta: " + errorMessage, "error"); // Usar setParentSnack
    }
  };

  const handleDeleteCardConfirm = useCallback(async (cardToDelete) => {
    try {
      console.log(`ListView: Attempting to delete card '${cardToDelete.title}' (ID: ${cardToDelete.id})`);
      await api.delete(`/cards/${cardToDelete.id}`);
      setParentSnack("Tarjeta eliminada.", "info"); // Usar setParentSnack
      await refreshLists();
      console.log("ListView: Lists refreshed after card deletion.");
    } catch (err) {
      console.error("ListView: Error al eliminar tarjeta:", err.response?.data || err.message);
      const errorMessage = err.response?.data?.message || err.message;
      setParentSnack("Error al eliminar tarjeta: " + errorMessage, "error"); // Usar setParentSnack
    } finally {
      setParentConfirmDialogOpen(false);
    }
  }, [refreshLists, setParentSnack, setParentConfirmDialogOpen]);

  const handleDeleteCardClick = (cardToDelete) => {
    setParentConfirmDialog({
      title: "Confirmar Eliminación de Tarjeta",
      message: `¿Eliminar la tarjeta "${cardToDelete.title}"?`,
      onConfirm: () => handleDeleteCardConfirm(cardToDelete),
    });
    setParentConfirmDialogOpen(true);
  };


  return (
    <Paper
      sx={{
        bgcolor: '#2d3748', // Fondo de la lista: Azul oscuro, similar a las tarjetas de cultivo
        borderRadius: 2,
        p: 1.5,
        minWidth: 280,
        maxWidth: 280,
        flexShrink: 0,
        boxShadow: '0 1px 0 rgba(9,30,66,.25)',
        color: '#fff', // Texto blanco por defecto
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, color: '#fff', flexGrow: 1 }}> {/* Texto blanco */}
          {list.name}
        </Typography>
        <IconButton size="small" onClick={() => handleDeleteList(list)}>
            <DeleteIcon sx={{ fontSize: 18, color: '#aaa' }} /> {/* Icono claro */}
        </IconButton>
      </Box>
      <Divider sx={{ mb: 1.5, bgcolor: 'rgba(255,255,255,0.2)' }} /> {/* Divisor claro */}
      <Box
        ref={setNodeRef}
        sx={{
          maxHeight: 'calc(100vh - 250px)',
          overflowY: 'auto',
          pr: 1,
          bgcolor: isOver ? 'rgba(255,255,255,0.1)' : 'transparent',
          minHeight: list.cards.length === 0 ? '80px' : 'auto',
          transition: 'background-color 0.2s ease',
          pb: 1,
        }}
      >
        {list.cards.map((card) => (
          <CardItem key={card.id} card={card} handleEdit={handleOpenCardDialog} handleDelete={handleDeleteCardClick} />
        ))}
        {list.cards.length === 0 && !isOver && (
          <Typography variant="body2" sx={{ p: 2, textAlign: 'center', color: '#a0aec0' }}> {/* Texto claro */}
            Arrastra tarjetas aquí o añade una nueva.
          </Typography>
        )}
      </Box>
      <Button
        variant="contained" // Cambiado a contained para un look más sólido
        startIcon={<AddIcon />}
        onClick={() => handleOpenCardDialog(null)}
        fullWidth
        sx={{
          mt: 1,
          bgcolor: '#4CAF50', // Botón de añadir tarjeta en verde
          color: '#fff',
          '&:hover': { bgcolor: '#43A047' },
          borderRadius: 2 // Añadir border-radius para uniformidad
        }}
      >
        Añadir una tarjeta
      </Button>

      <Dialog open={openAddCardDialog} onClose={handleCloseCardDialog} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: '#2d3748', color: '#e2e8f0', borderRadius: 2 } }} // Estilo oscuro
      >
        <DialogTitle sx={{ bgcolor: '#3a506b', color: '#fff' }}>{editingCard ? "Editar Tarjeta" : "Crear Nueva Tarjeta"}</DialogTitle> {/* Estilo oscuro */}
        <form onSubmit={handleSaveCard}>
          <DialogContent
            sx={{ overflow: 'visible', pt: '20px !important' }}
          >
            <TextField
              label="Título de la Tarjeta"
              value={cardTitle}
              onChange={e => setCardTitle(e.target.value)}
              fullWidth
              required
              sx={{ mt: 1, mb: 2,
                '& .MuiInputBase-input': { color: '#fff' },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.8)' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
              }}
              disabled={false}
            />
            <TextField
              label="Descripción"
              value={cardDescription}
              onChange={e => setCardDescription(e.target.value)}
              fullWidth
              multiline
              rows={3}
              sx={{ mb: 2,
                '& .MuiInputBase-input': { color: '#fff' },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.8)' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
              }}
              disabled={false}
            />
            <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
              <DatePicker
                label="Fecha de Vencimiento"
                value={cardDueDate}
                onChange={(newValue) => {
                  setCardDueDate(newValue);
                }}
                slotProps={{
                    textField: {
                        fullWidth: true,
                        sx: { mb: 2,
                          '& .MuiInputBase-input': { color: '#fff' },
                          '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                          '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
                          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.8)' },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
                        },
                        disabled: false,
                    }
                }}
              />
            </LocalizationProvider>
          </DialogContent>
          <DialogActions sx={{ bgcolor: '#3a506b' }}> {/* Estilo oscuro */}
            <Button onClick={handleCloseCardDialog} disabled={false} sx={{ color: '#a0aec0' }}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={false || !cardTitle.trim()}
              sx={{ bgcolor: '#4CAF50', '&:hover': { bgcolor: '#43A047' } }}
            >
              {false ? <CircularProgress size={24} /> : (editingCard ? "Guardar Cambios" : "Crear Tarjeta")}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Paper>
  );
};


// --- Componente CardItem (La tarjeta arrastrable y reordenable) ---
const CardItem = ({ card, handleEdit, handleDelete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: {
      type: 'Card',
      card: card,
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
    backgroundColor: '#3a506b', // Fondo oscuro azulado para la tarjeta, similar a las tarjetas de cultivo
    padding: '12px',
    cursor: isDragging ? 'grabbing' : 'grab',
    color: '#fff', // Texto claro por defecto
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <CardContent card={card} handleEdit={handleEdit} handleDelete={handleDelete} />
    </div>
  );
};


// --- Componente: CardContent (Solo el contenido visual de la tarjeta) ---
const CardContent = ({ card, handleEdit, handleDelete }) => {
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Typography variant="body1" sx={{ fontWeight: 500, color: '#fff', flexGrow: 1, pr: 1 }}> {/* Texto blanco */}
          {card.title}
        </Typography>
        <Box>
            <IconButton size="small" onClick={() => handleEdit(card)} sx={{ p: 0.5 }}>
                <EditIcon sx={{ fontSize: 16, color: '#aaa' }} /> {/* Icono claro */}
            </IconButton>
            <IconButton size="small" onClick={() => handleDelete(card)} sx={{ p: 0.5 }}>
                <DeleteIcon sx={{ fontSize: 16, color: '#aaa' }} /> {/* Icono claro */}
            </IconButton>
        </Box>
      </Box>

      {card.description && (
        <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, color: '#b0c4de' }}> {/* Color de texto para contraste */}
          <DescriptionIcon sx={{ fontSize: 16, mr: 0.5 }} />
          <Typography variant="body2" sx={{ fontSize: 13 }}>
            {card.description.length > 50 ? `${card.description.substring(0, 50)}...` : card.description}
          </Typography>
        </Box>
      )}
      {card.due_date && (
        <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, color: '#b0c4de' }}> {/* Color de texto para contraste */}
          <DateRangeIcon sx={{ fontSize: 16, mr: 0.5 }} />
          <Typography variant="body2" sx={{ fontSize: 13 }}>
            Vence: {new Date(card.due_date).toLocaleDateString()}
          </Typography>
        </Box>
      )}
      {card.status === 'done' && (
        <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, color: '#90ee90' }}> {/* Verde claro para "Completada" */}
          <CheckCircleOutlineIcon sx={{ fontSize: 16, mr: 0.5 }} />
          <Typography variant="body2" sx={{ fontSize: 13, fontWeight: 500 }}>
            Completada
          </Typography>
        </Box>
      )}
    </Box>
  );
};

// Exporta CalendarPage como componente principal
export default CalendarPage;
