// src/components/ListsManagement.jsx
import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

const ListsManagement = ({ tenantId, isAppReady }) => {
  // Here will be the logic for Lists CRUD:
  // - List all lists (maybe with filters by board)
  // - Create, edit, delete lists
  // - Could be a table similar to users/roles/permissions.

  if (!isAppReady || !tenantId) {
    return <Typography>Loading lists management...</Typography>;
  }

  return (
    <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
      <Typography variant="h5" mb={2}>Lists Management</Typography>
      <Typography variant="body1" color="text.secondary">
        Here you can view and manage all the lists (columns) from your calendar boards.
        (Coming soon: Lists table, create/edit/delete buttons, filters.)
      </Typography>
      <Box sx={{ mt: 3, p: 2, border: '1px dashed #ccc', borderRadius: 1 }}>
        <Typography variant="body2" color="text.disabled">
          Tenant ID: {tenantId} | App Ready: {isAppReady ? 'Yes' : 'No'}
        </Typography>
      </Box>
    </Paper>
  );
};

export default ListsManagement;
