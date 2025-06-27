// src/components/CalendarPage.jsx
import React, { useState, useEffect, useCallback } from "react";
import { api } from "../App"; // Importa tu instancia de Axios configurada
import {
  Box, Typography, Button, CircularProgress, Snackbar, Alert,
  TextField, Paper, Divider, IconButton, Grid,
  Dialog, DialogTitle, DialogContent, DialogActions
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import DateRangeIcon from '@mui/icons-material/DateRange';
import DescriptionIcon from '@mui/icons-material/Description';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import GroupIcon from '@mui/icons-material/Group'; // Icono para "Tus tableros"
import ArrowBackIcon from '@mui/icons-material/ArrowBack'; // Icono para volver

// --- Importaciones para MUI X Date Pickers ---
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import 'dayjs/locale/es'; // Importar la localización para español (opcional, pero recomendado)


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

  // Estados para el diálogo de confirmación
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmDialogData, setConfirmDialogData] = useState({ title: '', message: '', onConfirm: () => {} });


  // --- Fetch Boards ---
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


  // --- Dialogo para Crear/Editar Board ---
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

  // Función para manejar la confirmación de eliminación de tablero
  const handleDeleteBoardConfirm = useCallback(async (boardToDelete) => {
    setLoading(true);
    try {
      await api.delete(`/boards/${boardToDelete.id}`);
      setSnack({ open: true, message: "Tablero eliminado.", severity: "info" });
      setViewingBoardId(null); // Volver a la selección de tableros
      await fetchBoards();
    } catch (err) {
      console.error("CalendarPage: Error al eliminar tablero:", err.response?.data || err.message);
      const errorMessage = err.response?.data?.message || err.message;
      setSnack({ open: true, message: "Error al eliminar tablero: " + errorMessage, severity: "error" });
    } finally {
      setLoading(false);
      setConfirmDialogOpen(false); // Cerrar el diálogo de confirmación
    }
  }, [fetchBoards]);

  // Handler para abrir el diálogo de confirmación para eliminar un tablero
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

  const [openAddListDialog, setOpenAddListDialog] = useState(false);
  const [listName, setListName] = useState("");

  const fetchLists = useCallback(async () => {
    if (!board?.id || !tenantId) return;

    setLoadingLists(true);
    console.log(`BoardView: Fetching lists for board ID: ${board.id}`);
    try {
      const response = await api.get(`/boards/${board.id}/lists`);
      const fetchedLists = Array.isArray(response.data) ? response.data : response.data.data || [];
      setLists(fetchedLists.sort((a, b) => a.order - b.order));
      console.log(`BoardView: Lists fetched successfully for board ID: ${board.id}`);
    } catch (error) {
      console.error(`BoardView: Error fetching lists for board ID: ${board.id}`, error);
      setParentSnack({ open: true, message: "Error al cargar las listas.", severity: "error" });
    } finally {
      setLoadingLists(false);
    }
  }, [board?.id, tenantId, setParentSnack]);

  useEffect(() => {
    console.log("BoardView: useEffect running. Board ID:", board?.id);
    fetchLists();
  }, [fetchLists]);

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
      await fetchLists();
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
      await fetchLists();
    } catch (err) {
      console.error("Error al eliminar lista:", err.response?.data || err.message);
      const errorMessage = err.response?.data?.message || err.message;
      setParentSnack({ open: true, message: "Error al eliminar lista: " + errorMessage, severity: "error" });
    } finally {
      setLoadingLists(false);
      setParentConfirmDialogOpen(false);
    }
  }, [fetchLists, setParentSnack, setParentConfirmDialogOpen]);

  const handleDeleteListClick = (listToDelete) => {
    setParentConfirmDialog({
      title: "Confirmar Eliminación de Lista",
      message: `¿Eliminar la lista "${listToDelete.name}" y todas sus tarjetas?`,
      onConfirm: () => handleDeleteListConfirm(listToDelete),
    });
    setParentConfirmDialogOpen(true);
  };


  if (!board) return null;

  return (
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
        <>
          {lists.map((list) => (
            <ListView
              key={list.id}
              list={list}
              tenantId={tenantId}
              refreshLists={fetchLists}
              handleDeleteList={handleDeleteListClick}
              setParentSnack={setParentSnack}
              setParentConfirmDialog={setParentConfirmDialog}
              setParentConfirmDialogOpen={setParentConfirmDialogOpen}
            />
          ))}
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
        </>
      )}

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
    </Box>
  );
};


// --- Componente: ListView (Representa una lista de Trello) ---
const ListView = ({ list, tenantId, refreshLists, handleDeleteList, setParentSnack, setParentConfirmDialog, setParentConfirmDialogOpen }) => {
  const [cards, setCards] = useState([]);
  const [loadingCards, setLoadingCards] = useState(false);

  const [openAddCardDialog, setOpenAddCardDialog] = useState(false);
  const [cardTitle, setCardTitle] = useState("");
  const [cardDescription, setCardDescription] = useState("");
  // Estado para la fecha de vencimiento, ahora como objeto dayjs o null
  const [cardDueDate, setCardDueDate] = useState(null);
  const [editingCard, setEditingCard] = useState(null);

  const fetchCards = useCallback(async () => {
    if (!list?.id || !tenantId) return;

    setLoadingCards(true);
    console.log(`ListView: Fetching cards for list ID: ${list.id}`);
    try {
      const response = await api.get(`/lists/${list.id}/cards`);
      const fetchedCards = Array.isArray(response.data) ? response.data : response.data.data || [];
      setCards(fetchedCards.sort((a, b) => a.order - b.order));
      console.log(`ListView: Cards fetched successfully for list ID: ${list.id}`);
    } catch (error) {
      console.error(`ListView: Error fetching cards for list ID: ${list.id}`, error);
      setParentSnack({ open: true, message: "Error al cargar las tarjetas.", severity: "error" });
    } finally {
      setLoadingCards(false);
    }
  }, [list?.id, tenantId, setParentSnack]);

  useEffect(() => {
    console.log("ListView: useEffect running. List ID:", list?.id);
    fetchCards();
  }, [fetchCards]);

  const handleOpenCardDialog = (card = null) => {
    setEditingCard(card);
    setCardTitle(card ? card.title : "");
    setCardDescription(card ? (card.description || "") : "");
    // Si hay una fecha, convertirla a un objeto dayjs
    setCardDueDate(card && card.due_date ? dayjs(card.due_date) : null);
    setOpenAddCardDialog(true);
  };

  const handleCloseCardDialog = () => {
    setOpenAddCardDialog(false);
    setEditingCard(null);
    setCardTitle("");
    setCardDescription("");
    setCardDueDate(null); // Restablecer a null para el DatePicker
  };

  const handleSaveCard = async (e) => {
    e.preventDefault();
    if (!cardTitle.trim()) {
      setParentSnack({ open: true, message: "El título de la tarjeta es obligatorio.", severity: "warning" });
      return;
    }

    setLoadingCards(true);
    try {
      const cardData = {
        title: cardTitle,
        description: cardDescription,
        // Convertir el objeto dayjs a formato ISO 8601 string para el backend
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
      await fetchCards();
      handleCloseCardDialog();
    } catch (err) {
      console.error("Error al guardar tarjeta:", err.response?.data || err.message);
      const errorMessage = err.response?.data?.message || err.message;
      setParentSnack({ open: true, message: "Error al guardar tarjeta: " + errorMessage, severity: "error" });
    } finally {
      setLoadingCards(false);
    }
  };

  const handleDeleteCardConfirm = useCallback(async (cardToDelete) => {
    setLoadingCards(true);
    try {
      await api.delete(`/cards/${cardToDelete.id}`);
      setParentSnack({ open: true, message: "Tarjeta eliminada.", severity: "info" });
      await fetchCards();
    } catch (err) {
      console.error("Error al eliminar tarjeta:", err.response?.data || err.message);
      const errorMessage = err.response?.data?.message || err.message;
      setParentSnack({ open: true, message: "Error al eliminar tarjeta: " + errorMessage, severity: "error" });
    } finally {
      setLoadingCards(false);
      setParentConfirmDialogOpen(false);
    }
  }, [fetchCards, setParentSnack, setParentConfirmDialogOpen]);

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
      <Box sx={{ maxHeight: 'calc(100vh - 250px)', overflowY: 'auto', pr: 1 }}>
        {loadingCards ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          cards.map(card => (
            <CardView
              key={card.id}
              card={card}
              handleEdit={handleOpenCardDialog}
              handleDelete={handleDeleteCardClick}
            />
          ))
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

      {/* Dialogo para Crear/Editar Tarjeta */}
      <Dialog open={openAddCardDialog} onClose={handleCloseCardDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingCard ? "Editar Tarjeta" : "Crear Nueva Tarjeta"}</DialogTitle>
        <form onSubmit={handleSaveCard}>
          <DialogContent
            // El overflow visible es especialmente útil para MUI X DatePicker si se renderiza en un portal o superposición
            sx={{ overflow: 'visible' }}
          >
            <TextField
              label="Título de la Tarjeta"
              value={cardTitle}
              onChange={e => setCardTitle(e.target.value)}
              fullWidth
              required
              sx={{ mt: 1, mb: 2 }}
              disabled={loadingCards}
            />
            <TextField
              label="Descripción"
              value={cardDescription}
              onChange={e => setCardDescription(e.target.value)}
              fullWidth
              multiline
              rows={3}
              sx={{ mb: 2 }}
              disabled={loadingCards}
            />
            {/* --- Integración de DatePicker de MUI X --- */}
            <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
              <DatePicker
                label="Fecha de Vencimiento"
                value={cardDueDate} // cardDueDate ahora es un objeto dayjs o null
                onChange={(newValue) => {
                  setCardDueDate(newValue); // newValue es un objeto dayjs o null
                }}
                slotProps={{
                    textField: {
                        fullWidth: true,
                        sx: { mb: 2 },
                        disabled: loadingCards,
                    }
                }}
              />
            </LocalizationProvider>
            {/* --- Fin Integración de DatePicker de MUI X --- */}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseCardDialog} disabled={loadingCards}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={loadingCards || !cardTitle.trim()}>
              {loadingCards ? <CircularProgress size={24} /> : (editingCard ? "Guardar Cambios" : "Crear Tarjeta")}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Paper>
  );
};


// --- Componente: CardView (Representa una tarjeta/tarea) ---
const CardView = ({ card, handleEdit, handleDelete }) => {
  return (
    <Paper
      sx={{
        p: 1.5,
        mb: 1.5,
        bgcolor: '#fff',
        borderRadius: 1.5,
        boxShadow: '0 1px 0 rgba(9,30,66,.25)',
        cursor: 'pointer',
        '&:hover': { bgcolor: '#f0f0f0' },
        position: 'relative'
      }}
    >
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
    </Paper>
  );
};

export default CalendarPage;
