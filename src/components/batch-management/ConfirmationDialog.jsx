import React from 'react';
import {
  Button,
  Dialog, DialogTitle, DialogContent, DialogActions, Typography
} from '@mui/material';
import { DIALOG_STYLES } from './batchManagement.constants';
import { BUTTON_LABELS } from './batchManagement.constants';

const ConfirmationDialog = ({ open, title, message, onConfirm, onCancel }) => (
    <Dialog open={open} onClose={onCancel} PaperProps={DIALOG_STYLES.paper}>
      <DialogTitle sx={DIALOG_STYLES.title.sx}>{title}</DialogTitle>
      <DialogContent><Typography sx={{ color: '#a0aec0' }}>{message}</Typography></DialogContent>
      <DialogActions sx={DIALOG_STYLES.actions.sx}>
        <Button onClick={onCancel} sx={{ color: '#a0aec0' }}>{BUTTON_LABELS.CANCEL}</Button>
        <Button onClick={onConfirm} color="error" autoFocus sx={{ color: '#fc8181' }}>{BUTTON_LABELS.CONFIRM}</Button>
      </DialogActions>
    </Dialog>
);

export default ConfirmationDialog;
