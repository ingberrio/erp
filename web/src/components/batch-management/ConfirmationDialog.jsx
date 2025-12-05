import React from 'react';
import {
  Button,
  Dialog, DialogTitle, DialogContent, DialogActions, Typography
} from '@mui/material';
import { DIALOG_STYLES } from './batchManagement.constants';
import { BUTTON_LABELS } from './batchManagement.constants';

const ConfirmationDialog = ({ open, title, message, onConfirm, onCancel }) => (
    <Dialog open={open} onClose={onCancel} PaperProps={{ sx: { bgcolor: '#fff', color: '#1a202c', borderRadius: 2 } }}>
      <DialogTitle sx={{ bgcolor: '#fff', color: '#1a202c', borderBottom: '1px solid #e0e0e0' }}>{title}</DialogTitle>
      <DialogContent sx={{ pt: '20px !important' }}><Typography sx={{ color: '#4a5568' }}>{message}</Typography></DialogContent>
      <DialogActions sx={{ bgcolor: '#f8fafc', borderTop: '1px solid #e0e0e0' }}>
        <Button onClick={onCancel}>{BUTTON_LABELS.CANCEL}</Button>
        <Button onClick={onConfirm} color="error" variant="contained" autoFocus>{BUTTON_LABELS.CONFIRM}</Button>
      </DialogActions>
    </Dialog>
);

export default ConfirmationDialog;
