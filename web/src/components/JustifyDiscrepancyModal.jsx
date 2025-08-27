import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Typography,
  CircularProgress,
} from "@mui/material";

export default function JustifyDiscrepancyModal({
  open,
  onClose,
  discrepancy,
  reasons,
  onSubmit,
  loading,
}) {
  const [reasonId, setReasonId] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  // Limpia el modal al cerrar o abrir
  React.useEffect(() => {
    if (!open) {
      setReasonId("");
      setNotes("");
      setError("");
    }
  }, [open]);

  const handleJustify = () => {
    if (!reasonId) {
      setError("Por favor seleccione un motivo.");
      return;
    }
    onSubmit({
      reason_id: reasonId,
      notes: notes,
      discrepancy_id: discrepancy?.id,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Justificar Discrepancia</DialogTitle>
      <DialogContent>
        <Typography variant="subtitle1" sx={{ mb: 2 }}>
          <b>Lote:</b> {discrepancy?.batch_name || "-"}<br />
          <b>Diferencia:</b>{" "}
          {discrepancy?.logical_quantity} {discrepancy?.unit} (lógico) &rarr;{" "}
          {discrepancy?.physical_quantity} {discrepancy?.unit} (físico)
        </Typography>

        <FormControl fullWidth sx={{ mt: 2 }}>
          <InputLabel id="reason-label">Motivo*</InputLabel>
          <Select
            labelId="reason-label"
            value={reasonId}
            label="Motivo*"
            onChange={(e) => setReasonId(e.target.value)}
            required
          >
            {reasons.map((reason) => (
              <MenuItem key={reason.id} value={reason.id}>
                {reason.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          sx={{ mt: 2 }}
          label="Notas (opcional)"
          fullWidth
          multiline
          minRows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {error && (
          <Typography color="error" sx={{ mt: 2 }}>
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="outlined">
          Cancelar
        </Button>
        <Button
          onClick={handleJustify}
          variant="contained"
          disabled={!reasonId || loading}
        >
          {loading ? <CircularProgress size={24} /> : "Justificar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
