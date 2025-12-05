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
      setError("Please select a reason.");
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
      <DialogTitle>Justify Discrepancy</DialogTitle>
      <DialogContent>
        <Typography variant="subtitle1" sx={{ mb: 2 }}>
          <b>Batch:</b> {discrepancy?.batch_name || "-"}<br />
          <b>Difference:</b>{" "}
          {discrepancy?.logical_quantity} {discrepancy?.unit} (logical) &rarr;{" "}
          {discrepancy?.physical_quantity} {discrepancy?.unit} (physical)
        </Typography>

        <FormControl fullWidth sx={{ mt: 2 }}>
          <InputLabel id="reason-label">Reason*</InputLabel>
          <Select
            labelId="reason-label"
            value={reasonId}
            label="Reason*"
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
          label="Notes (optional)"
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
          Cancel
        </Button>
        <Button
          onClick={handleJustify}
          variant="contained"
          disabled={!reasonId || loading}
        >
          {loading ? <CircularProgress size={24} /> : "Justify"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
