// src/components/CalendarPage.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "../App"; // Importa tu instancia de Axios configurada
import {
  Box, Typography, Button, CircularProgress, Snackbar, Alert,
  TextField, Paper, Divider, IconButton, Grid,
  Dialog, DialogTitle, DialogContent, DialogActions
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


// --- Componente principal del Módulo de Calendario ---
const CalendarPage = ({ tenantId, isAppReady }) => {
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


  const fetchBoards = useCallback(async () => {
    if (!tenantId || !isAppReady) {
      console.log("CalendarPage: Skipping fetchBoards. tenantId:", tenantId, "isAppReady:", isAppReady);
      return;
    }

    setLoading(true);
    console.log("CalendarPage: Fetching boards for tenant:", tenantId);
    try {
      const response = await api.get("/boards");
      const fetchedBoards = Array.isArray(response.data) ? response.data : response.data.data || [];
      setBoards(fetchedBoards);
      console.log("CalendarPage: Boards fetched successfully. Total:", fetchedBoards.length);

      if (fetchedBoards.length === 0 && viewingBoardId) {
          setViewingBoardId(null);
      } else if (viewingBoardId && !fetchedBoards.some(b => b.id === viewingBoardId)) {
          setViewingBoardId(null);
      }

    } catch (error) {
      console.error("CalendarPage: Error fetching boards:", error);
      setSnack({ open: true, message: "Error al cargar los tableros.", severity: "error" });
    } finally {
      setLoading(false);
    }
  }, [tenantId, isAppReady, viewingBoardId]);

  useEffect(() => {
    console.log("CalendarPage: Initial useEffect running. Boards count:", boards.length, "Is app ready:", isAppReady);
    if (tenantId && isAppReady) {
      fetchBoards();
    }
  }, [fetchBoards, tenantId, isAppReady]);


  const handleOpenBoardDialog = (board = null) => {
    setEditingBoard(board);
    setBoardName(board ? board.name : "");
    setBoardDescription(board ? (board.description || "") : "");
    setOpenBoardDialog(true);
  };

  const handleCloseBoardDialog = () => {
    setOpenBoardDialog(false);
    setEditingBoard(null);
    setBoardName("");
    setBoardDescription("");
  };

  const handleSaveBoard = async (e) => {
    e.preventDefault();

    if (!boardName.trim()) {
      setSnack({ open: true, message: "El nombre del tablero es obligatorio.", severity: "warning" });
      return;
    }

    setLoading(true);
    try {
      const boardData = {
        name: boardName,
        description: boardDescription,
      };

      let res;
      if (editingBoard) {
        res = await api.put(`/boards/${editingBoard.id}`, boardData);
        setSnack({ open: true, message: "Tablero actualizado.", severity: "success" });
      } else {
        res = await api.post("/boards", boardData);
        setSnack({ open: true, message: "Tablero creado.", severity: "success" });
        setViewingBoardId(res.data.id);
      }
      await fetchBoards();
      handleCloseBoardDialog();
    } catch (err) {
      console.error("CalendarPage: Error al guardar tablero:", err.response?.data || err.message);
      const errorMessage = err.response?.data?.message || err.message;
      setSnack({ open: true, message: "Error al guardar tablero: " + errorMessage, severity: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBoardConfirm = useCallback(async (boardToDelete) => {
    setLoading(true);
    try {
      await api.delete(`/boards/${boardToDelete.id}`);
      setSnack({ open: true, message: "Tablero eliminado.", severity: "info" });
      setViewingBoardId(null);
      await fetchBoards();
    } catch (err) {
      console.error("CalendarPage: Error al eliminar tablero:", err.response?.data || err.message);
      const errorMessage = err.response?.data?.message || err.message;
      setSnack({ open: true, message: "Error al eliminar tablero: " + errorMessage, severity: "error" });
    } finally {
      setLoading(false);
      setConfirmDialogOpen(false);
    }
  }, [fetchBoards]);

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
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
            <IconButton onClick={handleBackToBoardSelection} sx={{ mr: 1, color: '#333' }}>
                <ArrowBackIcon />
            </IconButton>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 600, color: '#333' }}>
            {selectedBoard.name}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ ml: { sm: 2 } }}>
            {selectedBoard.description || "Sin descripción."}
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => handleOpenBoardDialog(selectedBoard)}
            sx={{ borderRadius: 2 }}
          >
            Editar Tablero
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => handleDeleteBoardClick(selectedBoard)}
            sx={{ borderRadius: 2 }}
          >
            Eliminar Tablero
          </Button>
        </Box>
        <BoardView
          board={selectedBoard}
          tenantId={tenantId}
          setParentSnack={setSnack}
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

        <Dialog open={openBoardDialog} onClose={handleCloseBoardDialog} maxWidth="sm" fullWidth>
            <DialogTitle>{editingBoard ? "Editar Tablero" : "Crear Nuevo Tablero"}</DialogTitle>
            <form onSubmit={handleSaveBoard}>
                <DialogContent>
                    <TextField
                        label="Nombre del Tablero"
                        value={boardName}
                        onChange={e => setBoardName(e.target.value)}
                        fullWidth
                        required
                        sx={{ mt: 1, mb: 2 }}
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
                        sx={{ mb: 2 }}
                        disabled={loading}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseBoardDialog} disabled={loading}>Cancelar</Button>
                    <Button type="submit" variant="contained" disabled={loading || !boardName.trim()}>
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
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
        <GroupIcon sx={{ fontSize: 32, color: '#333', mr: 1 }} />
        <Typography variant="h5" sx={{ fontWeight: 600, color: '#333' }}>
          Tus tableros
        </Typography>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {boards.map((board) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={board.id}>
              <BoardCard board={board} onClick={() => handleBoardCardClick(board.id)} />
            </Grid>
          ))}
          <Grid item xs={12} sm={6} md={4} lg={3}>
            <CreateBoardCard onClick={() => handleOpenBoardDialog(null)} />
          </Grid>
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

      <Dialog open={openBoardDialog} onClose={handleCloseBoardDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingBoard ? "Editar Tablero" : "Crear Nuevo Tablero"}</DialogTitle>
        <form onSubmit={handleSaveBoard}>
          <DialogContent>
            <TextField
              label="Nombre del Tablero"
              value={boardName}
              onChange={e => setBoardName(e.target.value)}
              fullWidth
              required
              sx={{ mt: 1, mb: 2 }}
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
              sx={{ mb: 2 }}
              disabled={loading}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseBoardDialog} disabled={loading}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={loading || !boardName.trim()}>
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
        backgroundColor: randomColor,
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        p: 2,
        cursor: 'pointer',
        color: '#fff',
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
        backgroundColor: '#f0f0f0',
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        p: 2,
        cursor: 'pointer',
        color: '#666',
        fontWeight: 600,
        border: '2px dashed #ccc',
        boxShadow: 'none',
        transition: 'transform 0.2s, background-color 0.2s',
        '&:hover': {
          backgroundColor: '#e0e0e0',
          transform: 'translateY(-2px)',
        },
      }}
    >
      <AddIcon sx={{ fontSize: 40, mb: 1, color: '#666' }} />
      <Typography variant="subtitle1" sx={{ color: '#666' }}>
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
    if (!board?.id || !tenantId) {
      console.log("BoardView: Skipping fetchListsWithCards. Board ID:", board?.id, "Tenant ID:", tenantId);
      return;
    }

    setLoadingLists(true);
    console.log(`BoardView: Fetching lists with cards for board ID: ${board.id}`);
    try {
      const listsResponse = await api.get(`/boards/${board.id}/lists`);
      let fetchedLists = Array.isArray(listsResponse.data) ? listsResponse.data : listsResponse.data.data || [];

      const listsWithCardsPromises = fetchedLists.map(async (list) => {
        try {
          const cardsResponse = await api.get(`/lists/${list.id}/cards`);
          const fetchedCards = Array.isArray(cardsResponse.data) ? cardsResponse.data : cardsResponse.data.data || [];
          return { ...list, cards: fetchedCards.sort((a, b) => a.order - b.order) };
        } catch (cardError) {
          console.error(`Error fetching cards for list ${list.id}:`, cardError);
          setParentSnack({ open: true, message: `Error al cargar tarjetas de la lista "${list.name}".`, severity: "error" });
          return { ...list, cards: [] };
        }
      });

      const listsWithCards = await Promise.all(listsWithCardsPromises);
      setLists(listsWithCards.sort((a, b) => a.order - b.order));
      console.log("BoardView: Lists with cards fetched successfully.");
    } catch (error) {
      console.error(`BoardView: Error fetching lists for board ID: ${board.id}`, error);
      setParentSnack({ open: true, message: "Error al cargar las listas del tablero.", severity: "error" });
    } finally {
      setLoadingLists(false);
    }
  }, [board?.id, tenantId, setParentSnack]);

  useEffect(() => {
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
    setLoadingLists(true);
    try {
      await api.post(`/boards/${board.id}/lists`, { name: listName });
      setParentSnack({ open: true, message: "Lista creada.", severity: "success" });
      handleCloseAddListDialog();
      await fetchListsWithCards();
    } catch (err) {
      console.error("Error al crear lista:", err.response?.data || err.message);
      const errorMessage = err.response?.data?.message || err.message;
      setParentSnack({ open: true, message: "Error al crear lista: " + errorMessage, severity: "error" });
    } finally {
      setLoadingLists(false);
    }
  };

  const handleDeleteListConfirm = useCallback(async (listToDelete) => {
    setLoadingLists(true);
    try {
      await api.delete(`/lists/${listToDelete.id}`);
      setParentSnack({ open: true, message: "Lista eliminada.", severity: "info" });
      await fetchListsWithCards();
    } catch (err) {
      console.error("Error al eliminar lista:", err.response?.data || err.message);
      const errorMessage = err.response?.data?.message || err.message;
      setParentSnack({ open: true, message: "Error al eliminar lista: " + errorMessage, severity: "error" });
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
          setParentSnack({ open: true, message: "Tarjeta reordenada.", severity: "success" });
        } catch (error) {
          console.error("Error al reordenar tarjeta:", error.response?.data || error.message);
          setParentSnack({ open: true, message: "Error al reordenar la tarjeta. Recargando datos...", severity: "error" });
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

        setParentSnack({ open: true, message: "Tarjeta movida de lista.", severity: "success" });
      } catch (error) {
        console.error("Error al mover tarjeta entre listas:", error.response?.data || error.message);
        setParentSnack({ open: true, message: "Error al mover la tarjeta. Recargando datos...", severity: "error" });
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
          <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%', py: 2 }}>
            <CircularProgress size={24} />
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
            bgcolor: '#e0e0e0',
            color: '#444',
            '&:hover': { bgcolor: '#d0d0d0' },
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
              bgcolor: '#fff',
              borderRadius: 1.5,
              boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
              cursor: 'grabbing',
              width: '280px',
              opacity: 0.8,
            }}
          >
            <CardContent card={getActiveCard()} />
          </Paper>
        ) : null}
      </DragOverlay>

      <Dialog open={openAddListDialog} onClose={handleCloseAddListDialog} maxWidth="xs" fullWidth>
        <DialogTitle>Añadir Nueva Lista</DialogTitle>
        <form onSubmit={handleAddList}>
          <DialogContent>
            <TextField
              label="Nombre de la Lista"
              value={listName}
              onChange={e => setListName(e.target.value)}
              fullWidth
              required
              sx={{ mt: 1, mb: 2 }}
              disabled={loadingLists}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseAddListDialog} disabled={loadingLists}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={loadingLists || !listName.trim()}>
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
      setParentSnack({ open: true, message: "El título de la tarjeta es obligatorio.", severity: "warning" });
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

      let res;
      if (editingCard) {
        res = await api.put(`/cards/${editingCard.id}`, cardData);
        setParentSnack({ open: true, message: "Tarjeta actualizada.", severity: "success" });
      } else {
        res = await api.post(`/lists/${list.id}/cards`, cardData);
        setParentSnack({ open: true, message: "Tarjeta creada.", severity: "success" });
      }
      await refreshLists();
      handleCloseCardDialog();
    } catch (err) {
      console.error("Error al guardar tarjeta:", err.response?.data || err.message);
      const errorMessage = err.response?.data?.message || err.message;
      setParentSnack({ open: true, message: "Error al guardar tarjeta: " + errorMessage, severity: "error" });
    }
  };

  const handleDeleteCardConfirm = useCallback(async (cardToDelete) => {
    try {
      await api.delete(`/cards/${cardToDelete.id}`);
      setParentSnack({ open: true, message: "Tarjeta eliminada.", severity: "info" });
      await refreshLists();
    } catch (err) {
      console.error("Error al eliminar tarjeta:", err.response?.data || err.message);
      const errorMessage = err.response?.data?.message || err.message;
      setParentSnack({ open: true, message: "Error al eliminar tarjeta: " + errorMessage, severity: "error" });
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
        bgcolor: '#f4f5f7',
        borderRadius: 2,
        p: 1.5,
        minWidth: 280,
        maxWidth: 280,
        flexShrink: 0,
        boxShadow: '0 1px 0 rgba(9,30,66,.25)',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, color: '#172b4d', flexGrow: 1 }}>
          {list.name}
        </Typography>
        <IconButton size="small" onClick={() => handleDeleteList(list)}>
            <DeleteIcon sx={{ fontSize: 18, color: '#666' }} />
        </IconButton>
      </Box>
      <Divider sx={{ mb: 1.5 }} />
      <Box
        ref={setNodeRef}
        sx={{
          maxHeight: 'calc(100vh - 250px)',
          overflowY: 'auto',
          pr: 1,
          bgcolor: isOver ? '#e0f2f7' : 'transparent',
          minHeight: list.cards.length === 0 ? '80px' : 'auto',
          transition: 'background-color 0.2s ease',
          pb: 1,
        }}
      >
        {list.cards.map((card) => (
          <CardItem key={card.id} card={card} handleEdit={handleOpenCardDialog} handleDelete={handleDeleteCardClick} />
        ))}
        {list.cards.length === 0 && !isOver && (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
            Arrastra tarjetas aquí o añade una nueva.
          </Typography>
        )}
      </Box>
      <Button
        variant="text"
        startIcon={<AddIcon />}
        onClick={() => handleOpenCardDialog(null)}
        fullWidth
        sx={{ mt: 1, color: '#5e6c84', '&:hover': { bgcolor: '#e0e0e0' } }}
      >
        Añadir una tarjeta
      </Button>

      <Dialog open={openAddCardDialog} onClose={handleCloseCardDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingCard ? "Editar Tarjeta" : "Crear Nueva Tarjeta"}</DialogTitle>
        <form onSubmit={handleSaveCard}>
          <DialogContent
            sx={{ overflow: 'visible' }}
          >
            <TextField
              label="Título de la Tarjeta"
              value={cardTitle}
              onChange={e => setCardTitle(e.target.value)}
              fullWidth
              required
              sx={{ mt: 1, mb: 2 }}
              disabled={false}
            />
            <TextField
              label="Descripción"
              value={cardDescription}
              onChange={e => setCardDescription(e.target.value)}
              fullWidth
              multiline
              rows={3}
              sx={{ mb: 2 }}
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
                        sx: { mb: 2 },
                        disabled: false,
                    }
                }}
              />
            </LocalizationProvider>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseCardDialog} disabled={false}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={false || !cardTitle.trim()}>
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
    backgroundColor: 'white',
    padding: '12px',
    cursor: isDragging ? 'grabbing' : 'grab',
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
        <Typography variant="body1" sx={{ fontWeight: 500, color: '#333', flexGrow: 1, pr: 1 }}>
          {card.title}
        </Typography>
        <Box>
            <IconButton size="small" onClick={() => handleEdit(card)} sx={{ p: 0.5 }}>
                <EditIcon sx={{ fontSize: 16, color: '#666' }} />
            </IconButton>
            <IconButton size="small" onClick={() => handleDelete(card)} sx={{ p: 0.5 }}>
                <DeleteIcon sx={{ fontSize: 16, color: '#666' }} />
            </IconButton>
        </Box>
      </Box>

      {card.description && (
        <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, color: '#555' }}>
          <DescriptionIcon sx={{ fontSize: 16, mr: 0.5 }} />
          <Typography variant="body2" sx={{ fontSize: 13 }}>
            {card.description.length > 50 ? `${card.description.substring(0, 50)}...` : card.description}
          </Typography>
        </Box>
      )}
      {card.due_date && (
        <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, color: '#555' }}>
          <DateRangeIcon sx={{ fontSize: 16, mr: 0.5 }} />
          <Typography variant="body2" sx={{ fontSize: 13 }}>
            Vence: {new Date(card.due_date).toLocaleDateString()}
          </Typography>
        </Box>
      )}
      {card.status === 'done' && (
        <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, color: 'green.700' }}>
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
