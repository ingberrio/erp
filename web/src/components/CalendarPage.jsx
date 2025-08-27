// src/components/CalendarPage.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "../App"; // Importa tu instancia de Axios configurada
import {
  Box, Typography, Button, CircularProgress, Snackbar, Alert,
  TextField, Paper, Divider, IconButton, Grid,
  Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Select, MenuItem,
  LinearProgress, Checkbox, Avatar, AvatarGroup // Importar Avatar y AvatarGroup
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import DateRangeIcon from "@mui/icons-material/DateRange";
import DescriptionIcon from "@mui/icons-material/Description";
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import GroupIcon from "@mui/icons-material/Group";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LabelIcon from "@mui/icons-material/Label"; // Icono para Etiquetas
import ChecklistIcon from "@mui/icons-material/Checklist"; // Icono para Checklist
import PersonIcon from "@mui/icons-material/Person"; // Icono para Miembros
import CommentIcon from "@mui/icons-material/Comment"; // Icono para Comentarios
import CloseIcon from "@mui/icons-material/Close"; // Icono de cerrar para el diálogo de tarjeta
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'; // Icono para checklist no completado
import CheckCircleIcon from '@mui/icons-material/CheckCircle'; // Icono para checklist completado


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
const CalendarPage = ({ tenantId, isAppReady, setParentSnack, isGlobalAdmin, user, hasPermission }) => { // Añadir user y hasPermission
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
    console.log(`CalendarPage: useEffect para sync localStorage - isGlobalAdmin: ${isGlobalAdmin}, tenantId: ${tenantId}, selectedTenantForViewing: ${selectedTenantForViewing}`);
    if (isGlobalAdmin) {
      if (selectedTenantForViewing) {
        localStorage.setItem('currentTenantId', String(selectedTenantForViewing));
        console.log(`CalendarPage: Super Admin, currentTenantId en localStorage actualizado a: ${selectedTenantForViewing}`);
      } else {
        // Si es Super Admin y no hay selectedTenantForViewing, limpiar para evitar enviar un tenantId incorrecto
        localStorage.removeItem('currentTenantId');
        console.log("CalendarPage: Super Admin, no selectedTenantForViewing. Removing currentTenantId from localStorage.");
      }
    } else if (tenantId) {
      // Para usuarios de tenant, siempre se usa su propio tenantId
      localStorage.setItem('currentTenantId', String(tenantId));
      setSelectedTenantForViewing(tenantId); // Asegurarse de que el estado local también refleje el tenantId del usuario
      console.log(`CalendarPage: Tenant user, currentTenantId en localStorage actualizado a: ${tenantId}. selectedTenantForViewing set to user's tenantId.`);
    } else {
      // Este caso es para cuando no hay contexto de inquilino (ni global admin, ni tenantId).
      localStorage.removeItem('currentTenantId');
      console.log("CalendarPage: No valid tenant context, removing currentTenantId from localStorage.");
    }
  }, [isGlobalAdmin, selectedTenantForViewing, tenantId]);


  const fetchBoards = useCallback(async () => {
    console.log(`CalendarPage: fetchBoards START. isGlobalAdmin: ${isGlobalAdmin}, selectedTenantForViewing: ${selectedTenantForViewing}, tenantId: ${tenantId}, isAppReady: ${isAppReady}`);

    // Determinar el ID de inquilino efectivo para la llamada a la API
    const effectiveTenantId = isGlobalAdmin ? selectedTenantForViewing : tenantId;

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

    // Si llegamos aquí, tenemos un effectiveTenantId válido para la llamada
    console.log(`CalendarPage: Attempting to fetch boards from API with effectiveTenantId: ${effectiveTenantId}`);
    setLoading(true);
    try {
      // La URL base es siempre /boards, el interceptor de Axios añade el X-Tenant-ID
      const response = await api.get("/boards");
      const fetchedBoards = Array.isArray(response.data) ? response.data : response.data.data || [];
      setBoards(fetchedBoards);
      console.log("CalendarPage: Boards fetched successfully. Total:", fetchedBoards.length);

      // Si se está viendo un tablero específico y ya no existe en la lista, resetear
      if (viewingBoardId && !fetchedBoards.some(b => b.id === viewingBoardId)) {
          setViewingBoardId(null);
      }

    } catch (error) {
      console.error("CalendarPage: Error fetching boards:", error.response?.data || error.message);
      showSnack("Error al cargar los tableros. Asegúrate de que el inquilino seleccionado tenga tableros o permisos.", "error"); // Mensaje más descriptivo
    } finally {
      setLoading(false);
      console.log("CalendarPage: fetchBoards END.");
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
      console.error('CalendarPage: Error fetching tenants:', error.response?.data || error.message);
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
        setSelectedTenantForViewing(tenantId); // Esto ya se hace en el useEffect de sync, pero lo reforzamos aquí.
        console.log("CalendarPage: Initializing selectedTenantForViewing with user's tenantId:", tenantId);
      }
    }
  }, [isAppReady, isGlobalAdmin, tenantId, fetchTenants]);

  // useEffect para cargar tableros cuando cambian las dependencias relevantes
  // Se ejecutará cuando selectedTenantForViewing cambie para Super Admin
  // o cuando tenantId esté disponible para usuarios de tenant
  useEffect(() => {
    // Solo llamar a fetchBoards si la aplicación está lista Y
    // (es un usuario de inquilino con tenantId O es un Super Admin con un tenant seleccionado)
    if (isAppReady && (tenantId || (isGlobalAdmin && selectedTenantForViewing))) {
        console.log("CalendarPage: Triggering fetchBoards due to dependency change (isAppReady, tenantId/selectedTenantForViewing).");
        fetchBoards();
    } else {
        console.log("CalendarPage: Skipping fetchBoards due to unmet conditions (isAppReady, tenantId/selectedTenantForViewing).");
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


  // --- Renderizado Condicional de la Vista del Tablero Específico ---
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
          tenantId={tenantId} // Usar el tenantId original del prop
          isGlobalAdmin={isGlobalAdmin} // Pasar isGlobalAdmin
          selectedTenantForViewing={selectedTenantForViewing} // Pasar selectedTenantForViewing
          setParentSnack={showSnack} // Pasar showSnack
          setParentConfirmDialog={setConfirmDialogData}
          setParentConfirmDialogOpen={setConfirmDialogOpen} // Pasa la función setConfirmDialogOpen directamente
          user={user} // Pasar el objeto de usuario
          hasPermission={hasPermission} // Pasar la función de permisos
        />
      </Box>
    );
  }

  // --- Renderizado de la Vista de Selección de Tableros (Default) ---
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

      {/* Snackbar y Diálogos Globales (renderizados una sola vez, controlados por 'open' prop) */}
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

  const randomColor = getColor(String(board.id)); // Convertir a string para consistencia

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
const BoardView = ({ board, tenantId, isGlobalAdmin, selectedTenantForViewing, setParentSnack, setParentConfirmDialog, setParentConfirmDialogOpen, user, hasPermission }) => { // Añadir user y hasPermission
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
    console.log("BoardView: fetchListsWithCards START"); // NUEVO LOG
    // Asegurarse de que el ID del tablero sea válido
    if (!board?.id) {
      console.log("BoardView: Saltando fetchListsWithCards. No hay ID de tablero.");
      setLists([]);
      setLoadingLists(false);
      return;
    }

    // Determinar el ID de inquilino efectivo para la llamada a la API
    const effectiveTenantId = isGlobalAdmin ? selectedTenantForViewing : tenantId;
    console.log(`BoardView: fetchListsWithCards - effectiveTenantId: ${effectiveTenantId}`); // NUEVO LOG

    if (!effectiveTenantId) {
      console.log("BoardView: Saltando fetchListsWithCards. No hay ID de inquilino efectivo establecido para la llamada a la API.");
      setLists([]);
      setLoadingLists(false);
      return;
    }

    // Asegurarse de que localStorage.currentTenantId esté correctamente configurado para esta búsqueda específica
    localStorage.setItem('currentTenantId', String(effectiveTenantId));
    console.log(`BoardView: Estableciendo localStorage.currentTenantId en ${effectiveTenantId} antes de buscar listas.`);


    setLoadingLists(true);
    console.log(`BoardView: Buscando listas con tarjetas para el ID de tablero: ${board.id}, ID de inquilino efectivo: ${effectiveTenantId}`);
    try {
      const listsResponse = await api.get(`/boards/${board.id}/lists`);
      // CORRECCIÓN: Asegurarse de que listsResponse.data es un objeto antes de acceder a .data
      let fetchedLists = [];
      if (listsResponse.data) { // Verificar si data existe
        fetchedLists = Array.isArray(listsResponse.data) ? listsResponse.data : listsResponse.data.data || [];
      } else {
        console.warn("BoardView: listsResponse.data is null or undefined. Setting fetchedLists to empty array.");
      }
      
      console.log("BoardView: Raw API response for lists:", listsResponse.data); // Mover este log para ver la data cruda
      console.log("BoardView: Processed fetchedLists (before mapping for cards):", fetchedLists); // NUEVO LOG


      const listsWithCardsPromises = fetchedLists.map(async (list) => {
        try {
          console.log(`BoardView: Fetching cards for list ID: ${list.id} (name: ${list.name}) with effectiveTenantId: ${effectiveTenantId}`); // NUEVO LOG
          // Incluir la relación 'members' al obtener las tarjetas
          const cardsResponse = await api.get(`/lists/${list.id}/cards?include=members`);
          console.log(`BoardView: Raw API response for cards of list ${list.id} (name: ${list.name}):`, cardsResponse.data); // NUEVO LOG
          
          // CORRECCIÓN: Usar cardsResponse.data directamente o cardsResponse.data.data si es un objeto envolvente
          let fetchedCards = [];
          if (cardsResponse.data) { // Verificar si data existe
            if (Array.isArray(cardsResponse.data)) {
              fetchedCards = cardsResponse.data;
              console.log(`BoardView: cardsResponse.data is an array for list ${list.id} (name: ${list.name}).`);
            } else if (cardsResponse.data && Array.isArray(cardsResponse.data.data)) {
              fetchedCards = cardsResponse.data.data;
              console.log(`BoardView: cardsResponse.data.data is an array for list ${list.id} (name: ${list.name}).`);
            } else {
              console.warn(`BoardView: Unexpected cards data format for list ${list.id} (name: ${list.name}):`, cardsResponse.data);
            }
          } else {
            console.warn(`BoardView: cardsResponse.data is null or undefined for list ${list.id} (name: ${list.name}). Setting fetchedCards to empty array.`);
          }
          
          console.log(`BoardView: Processed cards for list ${list.id} (name: ${list.name}):`, fetchedCards); // NUEVO LOG
          return { ...list, cards: fetchedCards.sort((a, b) => a.order - b.order) };
        } catch (cardError) {
          console.error(`Error al buscar tarjetas para la lista ${list.id} (name: ${list.name}):`, cardError.response?.data || cardError.message); // NUEVO LOG
          setParentSnack("Error al cargar tarjetas de la lista \"" + list.name + "\".", "error"); // Usar setParentSnack
          return { ...list, cards: [] };
        }
      });

      const listsWithCards = await Promise.all(listsWithCardsPromises);
      console.log("BoardView: Lists with cards (before setting state):", listsWithCards);
      setLists(listsWithCards.sort((a, b) => a.order - b.order));
      console.log("BoardView: Lists with cards fetched successfully and state updated.");
    } catch (error) {
      console.error(`BoardView: Error al buscar listas para el ID de tablero: ${board.id}`, error.response?.data || error.message); // NUEVO LOG
      setParentSnack("Error al cargar las listas del tablero.", "error"); // Usar setParentSnack
    } finally {
      setLoadingLists(false);
      console.log("BoardView: fetchListsWithCards END"); // NUEVO LOG
    }
  }, [board?.id, tenantId, isGlobalAdmin, selectedTenantForViewing, setParentSnack]);

  useEffect(() => {
    console.log("BoardView: useEffect activado. ID de tablero:", board?.id, "ID de inquilino:", tenantId, "isGlobalAdmin:", isGlobalAdmin, "selectedTenantForViewing:", selectedTenantForViewing);
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
      console.log(`BoardView: Intentando crear la lista '${listName}' para el ID de tablero: ${board.id}`);
      const response = await api.post(`/boards/${board.id}/lists`, { name: listName });
      console.log("BoardView: Respuesta de la API de creación de lista:", response.data);
      setParentSnack("Lista creada.", "success");
      handleCloseAddListDialog();
      await fetchListsWithCards(); // Volver a buscar listas después de la creación exitosa
      console.log("BoardView: Listas buscadas de nuevo después de la creación.");
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
      console.log(`BoardView: Intentando eliminar la lista '${listToDelete.name}' (ID: ${listToDelete.id})`);
      await api.delete(`/lists/${listToDelete.id}`);
      setParentSnack("Lista eliminada.", "info");
      await fetchListsWithCards();
    } catch (err) {
      console.error("BoardView: Error al eliminar lista:", err.response?.data || err.message);
      const errorMessage = err.response?.data?.message || err.message;
      setParentSnack("Error al eliminar lista: " + errorMessage, "error");
    } finally {
      setLoadingLists(false);
      setParentConfirmDialogOpen(false); // Corregido: usar setParentConfirmDialogOpen
    }
  }, [fetchListsWithCards, setParentSnack, setParentConfirmDialogOpen]); // Añadido setParentConfirmDialogOpen a las dependencias

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
      const newIndex = destinationList.cards.findIndex(card => card.id === targetCardId); // Corregido: usar targetCardId para el índice
      
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
                isGlobalAdmin={isGlobalAdmin} // Pasar isGlobalAdmin
                selectedTenantForViewing={selectedTenantForViewing} // Pasar selectedTenantForViewing
                refreshLists={fetchListsWithCards}
                handleDeleteList={handleDeleteListClick}
                setParentSnack={setParentSnack}
                setParentConfirmDialog={setParentConfirmDialog}
                setParentConfirmDialogOpen={setParentConfirmDialogOpen} // CORRECCIÓN: Pasar el prop que se recibió
                user={user} // Pasar el objeto de usuario
                hasPermission={hasPermission} // Pasar la función de permisos
              />
            ))}
          </Box>
        )}
        <Button
          variant="contained" // Cambiado a contained para un look más sólido
          startIcon={<AddIcon />}
          onClick={() => handleOpenAddListDialog(null)}
          fullWidth
          sx={{
            mt: 1,
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
const ListView = ({ list, tenantId, isGlobalAdmin, selectedTenantForViewing, refreshLists, handleDeleteList, setParentSnack, setParentConfirmDialog, setParentConfirmDialogOpen, user, hasPermission }) => {
  const [openAddCardDialog, setOpenAddCardDialog] = useState(false);
  const [originalCard, setOriginalCard] = useState(null);
  const [saveTimeout, setSaveTimeout] = useState(null);
  const [pendingChanges, setPendingChanges] = useState(false);
  const [cardTitle, setCardTitle] = useState("");
  const [cardDescription, setCardDescription] = useState("");
  const [cardDueDate, setCardDueDate] = useState(null);
  const [editingCard, setEditingCard] = useState(null); // La tarjeta que se está editando (objeto completo)

  // Nuevo estado para el checklist
  const [cardChecklist, setCardChecklist] = useState(null); // { id: 'uuid', title: 'Mi Checklist', items: [{ id: 'uuid', text: 'Tarea 1', completed: false }] }
  const [newChecklistItemText, setNewChecklistItemText] = useState('');
  const [isSaving, setIsSaving] = useState(false); // Estado para indicar si se está guardando automáticamente

  // Nuevos estados para Miembros
  const [openMembersDialog, setOpenMembersDialog] = useState(false);
  const [availableMembers, setAvailableMembers] = useState([]); // Todos los miembros del tenant
  const [selectedMembers, setSelectedMembers] = useState([]); // Miembros asignados a la tarjeta actual

  console.log("ListView Render: list prop received:", list); // NUEVO LOG
  console.log("ListView Render: list.cards prop received:", list.cards); // NUEVO LOG
  console.log("ListView Render: editingCard is", editingCard); // LOG DE DEPURACIÓN
  console.log("ListView: Props - tenantId:", tenantId, "isGlobalAdmin:", isGlobalAdmin, "selectedTenantForViewing:", selectedTenantForViewing); // NUEVO LOG

  const { setNodeRef, isOver } = useDroppable({
    id: list.id,
    data: {
        type: 'List',
        listId: list.id,
    }
  });

  const cardHasChanged = () => {
    if (!originalCard) return false;
    return (
      cardTitle !== (originalCard.title || "") ||
      cardDescription !== (originalCard.description || "") ||
      (cardDueDate ? cardDueDate.format('YYYY-MM-DD') : null) !== (originalCard.due_date || null)
    );
  };

  const handleOpenCardDialog = async (card = null) => {
    console.log("handleOpenCardDialog: Card parameter received:", card); // LOG DE DEPURACIÓN
    setOpenAddCardDialog(true);

    let cardToEdit = card;
    if (card && card.id) {
      try {
        const effectiveTenantId = isGlobalAdmin ? selectedTenantForViewing : tenantId;
        if (effectiveTenantId) {
          localStorage.setItem('currentTenantId', String(effectiveTenantId));
          console.log(`ListView: Setting localStorage.currentTenantId to ${effectiveTenantId} before fetching single card.`);
        }
        // Incluir la relación 'members' al obtener la tarjeta individual
        const response = await api.get(`/cards/${card.id}?include=members`);
        cardToEdit = response.data;
        console.log("ListView: Fetched latest card data for dialog:", cardToEdit); // LOG DE DEPURACIÓN
      } catch (error) {
        console.error("ListView: Error al cargar los detalles de la tarjeta para el diálogo:", error.response?.data || error.message);
        setParentSnack("Error al cargar los detalles de la tarjeta.", "error");
      }
    }

    setEditingCard(cardToEdit);
    setOriginalCard(cardToEdit);
    console.log("handleOpenCardDialog: After setEditingCard, current editingCard state:", cardToEdit); // LOG DE DEPURACIÓN
    setCardTitle(cardToEdit ? cardToEdit.title : "");
    setCardDescription(cardToEdit ? (cardToEdit.description || "") : "");
    setCardDueDate(cardToEdit && cardToEdit.due_date ? dayjs(cardToEdit.due_date) : null);

    let initialChecklist = null;
    if (cardToEdit && cardToEdit.checklist) {
      try {
        if (typeof cardToEdit.checklist === 'string') {
          initialChecklist = JSON.parse(cardToEdit.checklist);
          if (!initialChecklist.items) {
            initialChecklist.items = [];
          }
        } else if (typeof cardToEdit.checklist === 'object' && cardToEdit.checklist !== null) {
          initialChecklist = { ...cardToEdit.checklist, items: cardToEdit.checklist.items || [] };
        }
      } catch (e) {
        console.error("Error al analizar el checklist de la tarjeta (en apertura):", e);
        initialChecklist = null;
      }
    }
    setCardChecklist(initialChecklist);
    setNewChecklistItemText('');
    setIsSaving(false);

    // Inicializar selectedMembers con los miembros de la tarjeta
    setSelectedMembers(cardToEdit && cardToEdit.members ? cardToEdit.members : []);
  };

  const handleCloseCardDialog = () => {
    console.log("handleCloseCardDialog: Closing dialog."); // LOG DE DEPURACIÓN
    setOpenAddCardDialog(false);
    setEditingCard(null);
    setCardTitle("");
    setCardDescription("");
    setCardDueDate(null);
    setCardChecklist(null); // Limpiar checklist al cerrar
    setNewChecklistItemText('');
    setIsSaving(false);
    setSelectedMembers([]); // Limpiar miembros seleccionados al cerrar
    refreshLists();
  };

  // Función para guardar los cambios de la tarjeta (usada para autosave)
  const saveCardChanges = useCallback(async () => {
    if (!editingCard || !editingCard.id) {
      console.log("saveCardChanges: No editingCard or ID. Skipping autosave."); // LOG DE DEPURACIÓN
      return;
    }

    const effectiveTenantId = isGlobalAdmin ? selectedTenantForViewing : tenantId;
    if (!effectiveTenantId) {
      console.error("ListView: No se pueden guardar los cambios de la tarjeta. No hay ID de inquilino efectivo establecido para la llamada a la API.");
      setParentSnack("Error: No se pudo determinar el inquilino para guardar.", "error");
      setIsSaving(false);
      return;
    }
    localStorage.setItem('currentTenantId', String(effectiveTenantId));
    console.log(`ListView: Estableciendo localStorage.currentTenantId en ${effectiveTenantId} antes de guardar la tarjeta.`);

    setIsSaving(true);
    try {
      const cardData = {
        title: cardTitle,
        description: cardDescription,
        due_date: cardDueDate ? cardDueDate.format('YYYY-MM-DD') : null,
        list_id: list.id,
        status: 'todo',
      };

      console.log("ListView: Autoguardando tarjeta (campos de texto) con datos:", cardData); // LOG DE DEPURACIÓN
      const response = await api.put(`/cards/${editingCard.id}`, cardData);
      setParentSnack("Cambios guardados automáticamente.", "success");
      setEditingCard(response.data);
      console.log("ListView: Autosave successful. Updated editingCard to:", response.data); // LOG DE DEPURACIÓN
    } catch (err) {
      console.error("ListView: Error al guardar automáticamente la tarjeta:", err.response?.data || err.message);
      const errorMessage = err.response?.data?.message || err.message;
      setParentSnack("Error al guardar automáticamente: " + errorMessage, "error");
    } finally {
      setIsSaving(false);
    }
  }, [editingCard, cardTitle, cardDescription, cardDueDate, list.id, setParentSnack, isGlobalAdmin, selectedTenantForViewing, tenantId]);


  // Función para guardar cambios del checklist inmediatamente
  const saveChecklistChangesImmediately = useCallback(async (currentCardId, currentChecklistData) => {
    if (!currentCardId) return;

    setIsSaving(true);
    try {
      const cardData = {
        checklist: currentChecklistData ? JSON.stringify(currentChecklistData) : null,
      };
      const effectiveTenantId = isGlobalAdmin ? selectedTenantForViewing : tenantId;
      if (!effectiveTenantId) {
        console.error("ListView: No se pueden guardar los cambios del checklist. No hay ID de inquilino efectivo establecido.");
        setParentSnack("Error: No se pudo determinar el inquilino para guardar el checklist.", "error");
        setIsSaving(false);
        return;
      }
      localStorage.setItem('currentTenantId', String(effectiveTenantId));

      console.log("ListView: Guardando inmediatamente el checklist para la tarjeta:", currentCardId, "datos:", cardData);
      await api.put(`/cards/${currentCardId}`, cardData);
      setParentSnack("Checklist guardado.", "success");
      setEditingCard(prev => prev ? { ...prev, checklist: currentChecklistData ? JSON.stringify(currentChecklistData) : null } : null);
    } catch (err) {
      console.error("ListView: Error al guardar el checklist:", err.response?.data || err.message);
      const errorMessage = err.response?.data?.message || err.message;
      setParentSnack("Error al guardar checklist: " + errorMessage, "error");
    } finally {
      setIsSaving(false);
    }
  }, [isGlobalAdmin, selectedTenantForViewing, tenantId, setParentSnack, setEditingCard]);


  // Función para sincronizar miembros de la tarjeta
  const syncCardMembers = useCallback(async (cardId, memberIds) => {
    if (!cardId) return;

    setIsSaving(true); // Usar el mismo indicador de guardado
    try {
      const effectiveTenantId = isGlobalAdmin ? selectedTenantForViewing : tenantId;
      if (!effectiveTenantId) {
        console.error("ListView: No se pueden sincronizar miembros. No hay ID de inquilino efectivo establecido.");
        setParentSnack("Error: No se pudo determinar el inquilino para sincronizar miembros.", "error");
        setIsSaving(false);
        return;
      }
      localStorage.setItem('currentTenantId', String(effectiveTenantId));

      console.log(`ListView: Sincronizando miembros para la tarjeta ${cardId} con IDs:`, memberIds);
      const response = await api.post(`/cards/${cardId}/members`, { member_ids: memberIds });
      setParentSnack("Miembros actualizados.", "success");
      setEditingCard(response.data); // Actualizar la tarjeta editada con los nuevos miembros
      setSelectedMembers(response.data.members); // Actualizar el estado de miembros seleccionados
    } catch (err) {
      console.error("ListView: Error al sincronizar miembros:", err.response?.data || err.message);
      const errorMessage = err.response?.data?.message || err.message;
      setParentSnack("Error al sincronizar miembros: " + errorMessage, "error");
    } finally {
      setIsSaving(false);
    }
  }, [isGlobalAdmin, selectedTenantForViewing, tenantId, setParentSnack, setEditingCard, setSelectedMembers]);


  // Efecto para debounce el guardado automático (solo para campos de texto y fecha)
  useEffect(() => {
    if (!editingCard) {
      console.log("useEffect for autosave: No editingCard. Skipping."); // LOG DE DEPURACIÓN
      return;
    }

    if (!cardHasChanged()) return; 

    if (saveTimeout) clearTimeout(saveTimeout);
    const timeout = setTimeout(() => {
      saveCardChanges();
      setPendingChanges(false);
    }, 1000);

    return () => clearTimeout(timeout);
  }, [cardTitle, cardDescription, cardDueDate, editingCard, saveTimeout, saveCardChanges, cardHasChanged]);


  // Función para guardar una tarjeta (solo se usa para CREAR una nueva tarjeta)
  const handleSaveCard = async (e) => {
    e.preventDefault();
    // Si ya estamos editando una tarjeta, solo cerramos el diálogo, los cambios se autoguardan
    if (editingCard) {
      console.log("handleSaveCard: Editing existing card. Calling handleCloseCardDialog."); // LOG DE DEPURACIÓN
      handleCloseCardDialog();
      return;
    }

    // This block is only for CREATING a NEW card
    if (!cardTitle.trim()) {
      setParentSnack("El título de la tarjeta es obligatorio.", "warning");
      return;
    }

    setIsSaving(true);
    try {
      const cardData = {
        title: cardTitle,
        description: cardDescription,
        due_date: cardDueDate ? dayjs(cardDueDate).format('YYYY-MM-DD') : null,
        list_id: list.id,
        status: 'todo',
        checklist: cardChecklist ? JSON.stringify(cardChecklist) : null,
        member_ids: selectedMembers.map(m => m.id), // <-- Siempre enviar un array de IDs, incluso si está vacío
      };

      const effectiveTenantId = isGlobalAdmin ? selectedTenantForViewing : tenantId;
      if (!effectiveTenantId) {
        console.error("ListView: No se puede crear una nueva tarjeta. No hay ID de inquilino efectivo establecido para la llamada a la API.");
        setParentSnack("Error: No se pudo determinar el inquilino para crear la tarjeta.", "error");
        setIsSaving(false);
        return;
      }
      localStorage.setItem('currentTenantId', String(effectiveTenantId));
      console.log(`ListView: Estableciendo localStorage.currentTenantId en ${effectiveTenantId} antes de crear una nueva tarjeta.`);


      console.log("ListView: Calling API to create new card with data:", cardData); // LOG DE DEPURACIÓN
      const res = await api.post(`/lists/${list.id}/cards`, cardData);
      setParentSnack("Tarjeta creada.", "success");
      
      // CRITICAL: Update editingCard state with the newly created card's data
      // This will trigger a re-render and change the dialog's state to "editing"
      setEditingCard(res.data); 
      console.log("ListView: New card created successfully. Setting editingCard to:", res.data); // LOG DE DEPURACIÓN

      refreshLists(); // Refrescar las listas para mostrar la nueva tarjeta en la UI principal
      
      // Do NOT close the dialog here. Keep it open to allow immediate further editing/member assignment.
      // The button text will change to "Cerrar" due to editingCard being set.
      // handleCloseCardDialog(); // Removed this line
    } catch (err) {
      console.error("ListView: Error al crear tarjeta:", err.response?.data || err.message);
      const errorMessage = err.response?.data?.message || err.message;
      setParentSnack("Error al crear tarjeta: " + errorMessage, "error");
    } finally {
      setIsSaving(false);
    }
  };


  const handleDeleteCardConfirm = useCallback(async (cardToDelete) => {
    try {
      console.log(`ListView: Intentando eliminar la tarjeta '${cardToDelete.title}' (ID: ${cardToDelete.id})`);
      const effectiveTenantId = isGlobalAdmin ? selectedTenantForViewing : tenantId;
      if (!effectiveTenantId) {
        console.error("ListView: No se puede eliminar la tarjeta. No hay ID de inquilino efectivo establecido para la llamada a la API.");
        setParentSnack("Error: No se pudo determinar el inquilino para eliminar la tarjeta.", "error");
        setParentConfirmDialogOpen(false);
        return;
      }
      localStorage.setItem('currentTenantId', String(effectiveTenantId));
      console.log(`ListView: Estableciendo localStorage.currentTenantId en ${effectiveTenantId} antes de eliminar la tarjeta.`);

      await api.delete(`/cards/${cardToDelete.id}`);
      setParentSnack("Tarjeta eliminada.", "info");
      await refreshLists();
      console.log("ListView: Listas actualizadas después de la eliminación de la tarjeta.");
    } catch (err) {
      console.error("ListView: Error al eliminar tarjeta:", err.response?.data || err.message);
      const errorMessage = err.response?.data?.message || err.message;
      setParentSnack("Error al eliminar tarjeta: " + errorMessage, "error");
    } finally {
      setParentConfirmDialogOpen(false);
    }
  }, [refreshLists, setParentSnack, setParentConfirmDialogOpen, isGlobalAdmin, selectedTenantForViewing, tenantId]);

  const handleDeleteCardClick = (cardToDelete) => {
    setParentConfirmDialog({
      title: "Confirmar Eliminación de Tarjeta",
      message: `¿Eliminar la tarjeta "${cardToDelete.title}"?`,
      onConfirm: () => handleDeleteCardConfirm(cardToDelete),
    });
    setParentConfirmDialogOpen(true);
  };

  // --- Funciones para el Checklist ---
  const handleAddChecklist = () => {
    if (!editingCard) {
      setParentSnack("Por favor, crea o selecciona una tarjeta para añadir un checklist.", "warning");
      return;
    }
    if (!cardChecklist) {
      const newChecklist = {
        id: crypto.randomUUID(),
        title: 'Checklist',
        items: []
      };
      setCardChecklist(newChecklist);
      console.log("handleAddChecklist: New checklist created. Saving immediately."); // LOG DE DEPURACIÓN
      saveChecklistChangesImmediately(editingCard.id, newChecklist);
    }
  };

  const handleDeleteChecklist = () => {
    if (!editingCard) return; // No hacer nada si no hay tarjeta
    setParentConfirmDialog({
      title: "Eliminar Checklist",
      message: "¿Estás seguro de que quieres eliminar este checklist?",
      onConfirm: () => {
        setCardChecklist(null);
        setParentSnack("Checklist eliminado.", "info");
        setParentConfirmDialogOpen(false);
        console.log("handleDeleteChecklist: Checklist deleted. Saving immediately."); // LOG DE DEPURACIÓN
        saveChecklistChangesImmediately(editingCard.id, null);
      },
    });
    setParentConfirmDialogOpen(true);
  };

  const handleAddChecklistItem = () => {
    if (!editingCard || !newChecklistItemText.trim() || !cardChecklist) return;

    const newItem = {
      id: crypto.randomUUID(),
      text: newChecklistItemText.trim(),
      completed: false,
    };
    const updatedChecklist = {
      ...cardChecklist,
      items: [...(cardChecklist.items || []), newItem]
    };
    setCardChecklist(updatedChecklist);
    console.log("handleAddChecklistItem: New item added to checklist. Saving immediately."); // LOG DE DEPURACIÓN
    saveChecklistChangesImmediately(editingCard.id, updatedChecklist);
    setNewChecklistItemText('');
  };

  const handleToggleChecklistItem = (itemId) => {
    if (!editingCard || !cardChecklist) return;

    const updatedChecklist = {
      ...cardChecklist,
      items: cardChecklist.items.map(item =>
        item.id === itemId ? { ...item, completed: !item.completed } : item
      )
    };
    setCardChecklist(updatedChecklist);
    console.log("handleToggleChecklistItem: Checklist item toggled. Saving immediately."); // LOG DE DEPURACIÓN
    saveChecklistChangesImmediately(editingCard.id, updatedChecklist);
  };

  const handleDeleteChecklistItem = (itemId) => {
    if (!editingCard || !cardChecklist) return;

    const updatedChecklist = {
      ...cardChecklist,
      items: cardChecklist.items.filter(item => item.id !== itemId)
    };
    setCardChecklist(updatedChecklist);
    setParentSnack("Elemento del checklist eliminado.", "info");
    console.log("handleDeleteChecklistItem: Checklist item deleted. Saving immediately."); // LOG DE DEPURACIÓN
    saveChecklistChangesImmediately(editingCard.id, updatedChecklist);
  };

  const calculateChecklistProgress = useMemo(() => {
    // CORREGIDO: Usar cardChecklist en lugar de checklist
    if (!cardChecklist || !cardChecklist.items || cardChecklist.items.length === 0) {
      return 0;
    }
    const completedItems = cardChecklist.items.filter(item => item.completed).length;
    return (completedItems / cardChecklist.items.length) * 100;
  }, [cardChecklist]); // Dependencia correcta

  // --- Funciones para Miembros ---
  const fetchAvailableMembers = useCallback(async () => {
    const effectiveTenantId = isGlobalAdmin ? selectedTenantForViewing : tenantId;
    console.log(`fetchAvailableMembers: START - effectiveTenantId: ${effectiveTenantId}`); // LOG DE INICIO
    if (!effectiveTenantId) {
      console.error("fetchAvailableMembers: No se puede obtener la lista de miembros. No hay ID de inquilino efectivo.");
      setParentSnack("Error: No se pudo determinar el inquilino para cargar miembros.", "error");
      setAvailableMembers([]); // Asegurarse de que la lista esté vacía si no hay tenantId
      console.log("fetchAvailableMembers: END - Skipping API call due to missing effectiveTenantId."); // LOG DE FIN
      return;
    }
    localStorage.setItem('currentTenantId', String(effectiveTenantId)); // Asegurar que el tenantId esté en localStorage
    console.log(`fetchAvailableMembers: localStorage.currentTenantId set to: ${localStorage.getItem('currentTenantId')}`); // LOG

    try {
      console.log(`fetchAvailableMembers: Making API call to /tenant-members for tenant: ${effectiveTenantId}`); // NUEVO LOG
      const response = await api.get('/tenant-members'); // La nueva ruta de la API
      console.log("fetchAvailableMembers: Raw API response from /tenant-members:", response.data); // LOG
      const fetchedMembers = Array.isArray(response.data) ? response.data : response.data.data || [];
      setAvailableMembers(fetchedMembers); // Asegurar que siempre es un array
      console.log("fetchAvailableMembers: Processed available members and updated state:", fetchedMembers); // LOG
    } catch (error) {
      console.error("fetchAvailableMembers: Error fetching available members:", error.response?.data || error.message); // LOG
      setParentSnack("Error al cargar la lista de miembros.", "error");
      setAvailableMembers([]); // Limpiar la lista en caso de error
    } finally {
      console.log("fetchAvailableMembers: END - API call finished."); // LOG DE FIN
    }
  }, [tenantId, isGlobalAdmin, selectedTenantForViewing, setParentSnack]);


  const handleOpenMembersDialog = () => {
    console.log("handleOpenMembersDialog: Called. Current editingCard:", editingCard); // LOG DE DEPURACIÓN
    console.log(`handleOpenMembersDialog: User has 'assign-card-members' permission: ${hasPermission('assign-card-members')}`); // LOG DE PERMISO

    if (!editingCard) {
      setParentSnack("Por favor, crea o selecciona una tarjeta para asignar miembros.", "warning");
      console.log("handleOpenMembersDialog: Skipping member fetch because editingCard is null."); // NUEVO LOG
      setOpenMembersDialog(true); // Abrir el diálogo para que el usuario vea el mensaje, pero sin miembros
      return;
    }
    
    if (!hasPermission('assign-card-members')) {
        setParentSnack("No tienes permiso para asignar miembros.", "error");
        console.log("handleOpenMembersDialog: Skipping member fetch due to insufficient permissions."); // NUEVO LOG
        setOpenMembersDialog(true); // Abrir el diálogo para que el usuario vea el mensaje, pero sin miembros
        return;
    }
    console.log("handleOpenMembersDialog: Calling fetchAvailableMembers."); // NUEVO LOG
    fetchAvailableMembers(); // Cargar miembros cada vez que se abre el diálogo
    setOpenMembersDialog(true);
  };

  const handleCloseMembersDialog = () => {
    setOpenMembersDialog(false);
  };

  const handleMemberToggle = (memberId) => {
    if (!editingCard) return; // Asegurarse de que hay una tarjeta para editar

    const isCurrentlySelected = selectedMembers.some(member => member.id === memberId);
    let updatedMemberIds;

    if (isCurrentlySelected) {
      // Deseleccionar
      updatedMemberIds = selectedMembers.filter(member => member.id !== memberId).map(m => m.id);
    } else {
      // Seleccionar
      const memberToAdd = availableMembers.find(member => member.id === memberId);
      if (memberToAdd) {
        updatedMemberIds = [...selectedMembers.map(m => m.id), memberToAdd.id];
      } else {
        updatedMemberIds = selectedMembers.map(m => m.id); // No hay cambios si no se encuentra
      }
    }
    
    // Actualizar el estado local inmediatamente para feedback visual
    const newSelectedMembersObjects = availableMembers.filter(member => updatedMemberIds.includes(member.id));
    setSelectedMembers(newSelectedMembersObjects);
    console.log("handleMemberToggle: New selected members (local state):", newSelectedMembersObjects); // LOG DE DEPURACIÓN

    // Sincronizar con el backend
    syncCardMembers(editingCard.id, updatedMemberIds);
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
        {/* Aquí es donde se renderizan las tarjetas */}
        {list.cards && list.cards.length > 0 ? ( // Verificar que list.cards existe y no está vacío
          list.cards.map((card) => (
            <CardItem key={card.id} card={card} handleEdit={handleOpenCardDialog} handleDelete={handleDeleteCardClick} />
          ))
        ) : (
          <Typography variant="body2" sx={{ p: 2, textAlign: 'center', color: '#a0aec0' }}> {/* Texto claro */}
            No hay tarjetas en esta lista.
          </Typography>
        )}
        {list.cards.length === 0 && !isOver && ( // Mensaje adicional si no hay tarjetas y no se está arrastrando nada
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

      {/* --- Diálogo de Añadir/Editar Tarjeta (Rediseñado) --- */}
      <Dialog open={openAddCardDialog} onClose={handleCloseCardDialog} maxWidth="lg" fullWidth // Cambiado a maxWidth="lg"
        PaperProps={{ sx: { bgcolor: '#2d3748', color: '#e2e8f0', borderRadius: 2, minHeight: '80vh' } }} // Aumentar tamaño y altura mínima
      >
        <DialogTitle sx={{ bgcolor: '#3a506b', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {editingCard ? "Editar Tarjeta" : "Crear Nueva Tarjeta"}
          <IconButton onClick={handleCloseCardDialog} sx={{ color: '#e2e8f0' }}>
            <CloseIcon /> {/* Usamos CloseIcon para cerrar */}
          </IconButton>
        </DialogTitle>
        <form onSubmit={handleSaveCard}>
          <DialogContent
            sx={{
              overflowY: 'auto', // Permitir scroll si el contenido es muy largo
              pt: '20px !important',
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' }, // Columnas en móvil, fila en desktop
              gap: { xs: 3, md: 4 }, // Espacio entre secciones
            }}
          >
            {/* Sección Principal de Contenido (Izquierda) */}
            <Box sx={{ flexGrow: 1, minWidth: { md: '60%' } }}> {/* Ajustar minWidth para que la columna izquierda tenga espacio */}
              {/* Título de la Tarjeta */}
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <CheckCircleOutlineIcon sx={{ mr: 1, color: '#a0aec0' }} /> {/* Icono de círculo */}
                <TextField
                  label="Título de la Tarjeta"
                  value={cardTitle}
                  onChange={e => setCardTitle(e.target.value)}
                  fullWidth
                  required
                  variant="standard" // Estilo más sutil para el título
                  InputProps={{
                    disableUnderline: true, // Quitar la línea inferior
                    sx: {
                      fontSize: '1.5rem', // Tamaño de fuente más grande
                      fontWeight: 700,
                      color: '#e2e8f0',
                    },
                  }}
                  InputLabelProps={{
                    sx: {
                      fontSize: '1.5rem',
                      fontWeight: 700,
                      color: 'rgba(255,255,255,0.7)',
                    },
                  }}
                  sx={{
                    '& .MuiInputBase-input': { color: '#e2e8f0' },
                    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                  }}
                />
              </Box>

              {/* Sección de "Añadir" (ahora en la columna principal izquierda) */}
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#e2e8f0', mb: 1 }}>
                Añadir a la tarjeta
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
                <Button variant="contained" startIcon={<LabelIcon />} sx={{ bgcolor: '#4a5568', color: '#e2e8f0', '&:hover': { bgcolor: '#66748c' }, borderRadius: 1, textTransform: 'none', py: '8px', px: '12px' }}>
                  Etiquetas
                </Button>
                <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
                  <DatePicker
                    label="Fechas"
                    value={cardDueDate}
                    onChange={(newValue) => setCardDueDate(newValue)}
                    slotProps={{
                      textField: {
                        variant: "outlined",
                        sx: {
                          bgcolor: '#4a5568', // Fondo oscuro
                          color: '#e2e8f0', // Texto claro
                          '& .MuiInputBase-input': { color: '#e2e8f0' },
                          '& .MuiInputLabel-root': { color: '#e2e8f0' },
                          '& .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' }, // Sin borde
                          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' },
                          '& .MuiSvgIcon-root': { color: '#e2e8f0' }, // Icono del calendario
                          borderRadius: 1,
                          textTransform: 'none', // Para que el texto no sea todo mayúsculas
                          minWidth: '120px', // Ancho mínimo para el botón
                          py: '8px', // Ajustar padding vertical
                          px: '12px', // Ajustar padding horizontal
                        },
                        placeholder: "Fechas", // Para que no muestre la fecha si está vacío
                        InputProps: {
                          startAdornment: <DateRangeIcon sx={{ mr: 1, color: '#e2e8f0' }} />, // Icono al inicio
                        },
                      },
                    }}
                  />
                </LocalizationProvider>
                <Button variant="contained" startIcon={<ChecklistIcon />} sx={{ bgcolor: '#4a5568', color: '#e2e8f0', '&:hover': { bgcolor: '#66748c' }, borderRadius: 1, textTransform: 'none', py: '8px', px: '12px' }}
                  onClick={hasPermission('manage-card-checklist') ? handleAddChecklist : () => setParentSnack("No tienes permiso para añadir un checklist.", "error")} // Control de permiso
                  disabled={!editingCard || !hasPermission('manage-card-checklist')} // Deshabilitar si no hay tarjeta o no tiene permiso
                >
                  Checklist
                </Button>
                <Button variant="contained" startIcon={<PersonIcon />} sx={{ bgcolor: '#4a5568', color: '#e2e8f0', '&:hover': { bgcolor: '#66748c' }, borderRadius: 1, textTransform: 'none', py: '8px', px: '12px' }}
                  onClick={hasPermission('assign-card-members') ? handleOpenMembersDialog : () => setParentSnack("No tienes permiso para asignar miembros.", "error")} // Control de permiso
                  disabled={!editingCard || !hasPermission('assign-card-members')} // Deshabilitar si no hay tarjeta o no tiene permiso
                >
                  Miembros
                </Button>
              </Box>

              {/* Sección de Descripción */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#e2e8f0', mb: 1 }}>
                  <DescriptionIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#a0aec0' }} />
                  Descripción
                </Typography>
                <TextField
                  placeholder="Añadir una descripción más detallada..."
                  value={cardDescription}
                  onChange={e => setCardDescription(e.target.value)}
                  fullWidth
                  multiline
                  rows={4}
                  sx={{
                    bgcolor: '#3a506b', // Fondo más oscuro para el campo de descripción
                    borderRadius: 1,
                    '& .MuiInputBase-input': { color: '#e2e8f0', py: 1.5, px: 2 },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' }, // Sin borde
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' },
                  }}
                />
              </Box>

              {/* Sección de Checklist (NUEVA) */}
              {cardChecklist && (
                <Box sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#e2e8f0' }}>
                      <ChecklistIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#a0aec0' }} />
                      {cardChecklist.title}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}> {/* Contenedor para botones del checklist */}
                      {/* Botón Ocultar/Mostrar elementos marcados (funcionalidad pendiente) */}
                      <Button
                        size="small"
                        sx={{ borderRadius: 1, color: '#b0c4de', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }, textTransform: 'none' }}
                        onClick={() => setParentSnack("Funcionalidad 'Ocultar/Mostrar elementos marcados' pendiente.", "info")}
                      >
                        Ocultar elementos marcados
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        onClick={hasPermission('manage-card-checklist') ? handleDeleteChecklist : () => setParentSnack("No tienes permiso para eliminar el checklist.", "error")} // Control de permiso
                        sx={{ borderRadius: 1, color: '#fc8181', '&:hover': { bgcolor: 'rgba(252,129,129,0.1)' }, textTransform: 'none' }}
                      >
                        Eliminar
                      </Button>
                    </Box>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={calculateChecklistProgress}
                    sx={{
                      height: 8,
                      borderRadius: 5,
                      bgcolor: '#4a5568', // Fondo de la barra
                      '& .MuiLinearProgress-bar': {
                        bgcolor: '#4CAF50', // Color de progreso (verde)
                      },
                      mb: 2,
                    }}
                  />
                  <Typography variant="body2" sx={{ color: '#a0aec0', mb: 1 }}>
                    {Math.round(calculateChecklistProgress)}% completado
                  </Typography>

                  {/* Lista de elementos del checklist */}
                  <Box sx={{ mb: 2 }}>
                    {cardChecklist.items.map((item) => (
                      <Box key={item.id} sx={{ display: 'flex', alignItems: 'center', mb: 1, bgcolor: '#3a506b', p: 1, borderRadius: 1 }}>
                        <Checkbox
                          checked={item.completed}
                          onChange={hasPermission('manage-card-checklist') ? () => handleToggleChecklistItem(item.id) : undefined} // Control de permiso
                          icon={<RadioButtonUncheckedIcon sx={{ color: '#a0aec0' }} />}
                          checkedIcon={<CheckCircleIcon sx={{ color: '#4CAF50' }} />}
                          sx={{ p: 0.5 }}
                          disabled={!hasPermission('manage-card-checklist')} // Deshabilitar si no tiene permiso
                        />
                        <Typography
                          variant="body1"
                          sx={{
                            flexGrow: 1,
                            color: item.completed ? '#a0aec0' : '#e2e8f0',
                            textDecoration: item.completed ? 'line-through' : 'none',
                          }}
                        >
                          {item.text}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={hasPermission('manage-card-checklist') ? () => handleDeleteChecklistItem(item.id) : undefined} // Control de permiso
                          sx={{ color: '#aaa' }}
                          disabled={!hasPermission('manage-card-checklist')} // Deshabilitar si no tiene permiso
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    ))}
                  </Box>

                  {/* Campo para añadir nuevo elemento */}
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                      placeholder="Añade un elemento"
                      value={newChecklistItemText}
                      onChange={(e) => setNewChecklistItemText(e.target.value)}
                      fullWidth
                      variant="outlined"
                      size="small"
                      sx={{
                        bgcolor: '#3a506b',
                        borderRadius: 1,
                        '& .MuiInputBase-input': { color: '#e2e8f0', py: 1 },
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' },
                        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' },
                      }}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault(); // Evitar que el formulario se envíe
                          if (hasPermission('manage-card-checklist')) { // Control de permiso
                            handleAddChecklistItem();
                          } else {
                            setParentSnack("No tienes permiso para añadir elementos al checklist.", "error");
                          }
                        }
                      }}
                      disabled={!hasPermission('manage-card-checklist')} // Deshabilitar si no tiene permiso
                    />
                    <Button
                      variant="contained"
                      onClick={hasPermission('manage-card-checklist') ? handleAddChecklistItem : () => setParentSnack("No tienes permiso para añadir elementos al checklist.", "error")} // Control de permiso
                      disabled={!newChecklistItemText.trim() || !hasPermission('manage-card-checklist')} // Deshabilitar si no tiene permiso
                      sx={{ bgcolor: '#4CAF50', '&:hover': { bgcolor: '#43A047' }, borderRadius: 1, textTransform: 'none' }}
                    >
                      Añadir
                    </Button>
                  </Box>
                </Box>
              )}
            </Box>

            {/* Sección de Acciones y Actividad (Derecha - Sidebar) */}
            <Box sx={{ width: { md: '300px' }, flexShrink: 0, ml: { md: 4 } }}> {/* Ancho fijo para la barra lateral en escritorio y margen izquierdo */}
              {/* Sección de Comentarios y Actividad (permanece en la barra lateral) */}
              <Box>
                {/* Contenedor flex para alinear el título y el botón */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#e2e8f0' }}>
                    <CommentIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#a0aec0' }} />
                    Comentarios y Actividad
                  </Typography>
                  <Button size="small" sx={{ color: '#b0c4de', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}>
                    Mostrar detalles
                  </Button>
                </Box>
                <TextField
                  placeholder="Escribe un comentario..."
                  fullWidth
                  multiline
                  rows={2}
                  sx={{
                    bgcolor: '#3a506b', // Fondo más oscuro para el campo de comentario
                    borderRadius: 1,
                    mb: 2,
                    '& .MuiInputBase-input': { color: '#e2e8f0', py: 1.5, px: 2 },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' }, // Sin borde
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' },
                  }}
                />
                {/* Placeholder para actividad */}
                <Box sx={{ bgcolor: '#3a506b', p: 2, borderRadius: 1 }}>
                  <Typography variant="body2" sx={{ color: '#a0aec0' }}>
                    <Box component="span" sx={{ fontWeight: 600, color: '#e2e8f0' }}>Eduard Berrio</Box> ha añadido esta tarjeta a Pendmndiente <br />
                    <Typography variant="caption" component="span" sx={{ color: '#a0aec0' }}>17 de dic de 2024, 12:37</Typography>
                  </Typography>
                </Box>
              </Box>
            </Box>
          </DialogContent>
          <DialogActions sx={{ bgcolor: '#3a506b', p: 2, justifyContent: 'flex-end' }}> {/* Estilo oscuro y justificado a la derecha */}
            {isSaving ? (
              <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
                <CircularProgress size={20} sx={{ color: '#a0aec0' }} />
                <Typography variant="body2" sx={{ ml: 1, color: '#a0aec0' }}>Guardando...</Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
                <CheckCircleOutlineIcon sx={{ color: '#90ee90', fontSize: 20 }} />
                <Typography variant="body2" sx={{ ml: 1, color: '#a0aec0', opacity: 0.8 }}>
                  Todos los cambios guardados
                </Typography>
              </Box>
            )}
            <Button onClick={handleCloseCardDialog} sx={{ color: '#a0aec0' }}>
              {editingCard ? "Cerrar" : "Cancelar"} {/* Cambiar texto del botón si es edición */}
            </Button>
            {!editingCard && ( // Mostrar botón "Crear Tarjeta" solo para nuevas tarjetas
              <Button type="submit" variant="contained" disabled={isSaving || !cardTitle.trim()}
                sx={{ bgcolor: '#4CAF50', '&:hover': { bgcolor: '#43A047' } }}
              >
                {isSaving ? <CircularProgress size={24} /> : "Crear Tarjeta"}
              </Button>
            )}
          </DialogActions>
        </form>
      </Dialog>

      {/* --- Diálogo de Miembros --- */}
      <Dialog open={openMembersDialog} onClose={handleCloseMembersDialog} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: '#2d3748', color: '#e2e8f0', borderRadius: 2 } }}
      >
        <DialogTitle sx={{ bgcolor: '#3a506b', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Miembros
          <IconButton onClick={handleCloseMembersDialog} sx={{ color: '#e2e8f0' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: '20px !important' }}>
          <TextField
            placeholder="Buscar miembros"
            fullWidth
            variant="outlined"
            size="small"
            sx={{
              mb: 2,
              bgcolor: '#3a506b',
              borderRadius: 1,
              '& .MuiInputBase-input': { color: '#e2e8f0', py: 1 },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' },
            }}
          />
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#a0aec0', mb: 1 }}>
            Miembros del tablero
          </Typography>
          <Box>
            {availableMembers.length === 0 ? (
              <Typography variant="body2" sx={{ color: '#a0aec0' }}>No hay miembros disponibles.</Typography>
            ) : (
              availableMembers.map((member) => (
                <Box
                  key={member.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    p: 1,
                    mb: 0.5,
                    borderRadius: 1,
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                    cursor: 'pointer',
                  }}
                  onClick={() => hasPermission('assign-card-members') ? handleMemberToggle(member.id) : setParentSnack("No tienes permiso para asignar miembros.", "error")} // Control de permiso
                >
                  <Avatar sx={{ bgcolor: '#4CAF50', width: 32, height: 32, fontSize: 14, mr: 1 }}>
                    {member.name ? member.name.charAt(0).toUpperCase() : ''}
                  </Avatar>
                  <Typography variant="body1" sx={{ flexGrow: 1, color: '#e2e8f0' }}>
                    {member.name}
                  </Typography>
                  <Checkbox
                    checked={selectedMembers.some(sm => sm.id === member.id)}
                    sx={{ color: '#a0aec0', '&.Mui-checked': { color: '#4CAF50' } }}
                    disabled={!hasPermission('assign-card-members')} // Deshabilitar si no tiene permiso
                  />
                </Box>
              ))
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#3a506b' }}>
          <Button onClick={handleCloseMembersDialog} sx={{ color: '#a0aec0' }}>Cerrar</Button>
        </DialogActions>
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

  console.log("CardItem: Rendering card:", card.title, "ID:", card.id); // NUEVO LOG
  console.log("CardItem: Card data:", card); // NUEVO LOG

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <CardContent card={card} handleEdit={handleEdit} handleDelete={handleDelete} />
    </div>
  );
};


// --- Componente: CardContent (Solo el contenido visual de la tarjeta) ---
const CardContent = ({ card, handleEdit, handleDelete }) => {
  console.log("CardContent: Rendering card. Title:", card?.title, "Full card object:", card); // NUEVO LOG CRÍTICO

  // Parsear el checklist si existe
  const checklist = useMemo(() => {
    try {
      // Asegurarse de que card.checklist es un string antes de intentar parsear
      return card.checklist && typeof card.checklist === 'string' ? JSON.parse(card.checklist) : null;
    } catch (e) {
      console.error("Error al analizar el checklist:", e);
      return null;
    }
  }, [card.checklist]);

  const checklistProgress = useMemo(() => {
    if (!checklist || !checklist.items || checklist.items.length === 0) {
      return 0;
    }
    const completedItems = checklist.items.filter(item => item.completed).length;
    return (completedItems / checklist.items.length) * 100;
  }, [checklist]);


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

      {/* Mostrar miembros asignados */}
      {card.members && card.members.length > 0 && (
        <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          <AvatarGroup max={4}>
            {card.members.map(member => (
              <Avatar key={member.id} sx={{ bgcolor: '#4CAF50', width: 24, height: 24, fontSize: 12 }}>
                {member.name ? member.name.charAt(0).toUpperCase() : ''}
              </Avatar>
            ))}
          </AvatarGroup>
        </Box>
      )}

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
      {/* Mostrar progreso del checklist en la tarjeta si existe */}
      {checklist && checklist.items && checklist.items.length > 0 && (
        <Box sx={{ mt: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
            <ChecklistIcon sx={{ fontSize: 16, mr: 0.5, color: '#b0c4de' }} />
            <Typography variant="body2" sx={{ fontSize: 13, color: '#b0c4de', fontWeight: 500 }}>
              {Math.round(checklistProgress)}% Checklist
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={checklistProgress}
            sx={{
              height: 4,
              borderRadius: 2,
              bgcolor: '#4a5568',
              '& .MuiLinearProgress-bar': {
                bgcolor: '#4CAF50',
              },
            }}
          />
        </Box>
      )}
    </Box>
  );
};

// Exporta CalendarPage como componente principal
export default CalendarPage;
