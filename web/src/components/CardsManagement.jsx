// src/components/CardsManagement.jsx
import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

const CardsManagement = ({ tenantId, isAppReady }) => {
  // Here will be the logic for Cards CRUD:
  // - List all cards (maybe with filters by board/list, date, assignee)
  // - Create, edit, delete cards
  // - Could be a table with search and pagination.

  if (!isAppReady || !tenantId) {
    return <Typography>Loading cards management...</Typography>;
  }

  return (
    <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
      <Typography variant="h5" mb={2}>Cards Management</Typography>
      <Typography variant="body1" color="text.secondary">
        Here you can view and manage all the cards (tasks) from your calendar boards.
        (Coming soon: Cards table, create/edit/delete buttons, advanced filters.)
      </Typography>
      <Box sx={{ mt: 3, p: 2, border: '1px dashed #ccc', borderRadius: 1 }}>
        <Typography variant="body2" color="text.disabled">
          Tenant ID: {tenantId} | App Ready: {isAppReady ? 'Yes' : 'No'}
        </Typography>
      </Box>
    </Paper>
  );
};

export default CardsManagement;
