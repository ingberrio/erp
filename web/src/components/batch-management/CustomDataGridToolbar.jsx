import React from 'react';
import {
  Box,
} from '@mui/material';
import {
  GridToolbarContainer,
  GridToolbarColumnsButton,
  GridToolbarFilterButton,
  GridToolbarDensitySelector,
  GridToolbarExport,
  GridToolbarQuickFilter,
} from '@mui/x-data-grid';

function CustomDataGridToolbar() {
  return (
    <GridToolbarContainer sx={{
        bgcolor: '#fff !important', color: '#1a202c !important', borderBottom: '1px solid #e0e0e0',
        padding: '8px', borderRadius: '4px 4px 0 0', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', flexWrap: 'wrap', gap: '8px',
        '& .MuiButtonBase-root': { color: '#1976d2 !important', '&:hover': { bgcolor: 'rgba(25,118,210,0.08)' } },
        '& .MuiInputBase-root': {
          color: '#1a202c !important',
          '& .MuiOutlinedInput-notchedOutline': { borderColor: '#e0e0e0 !important' },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#1976d2 !important' },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1976d2 !important' },
        },
      }}
    >
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        <GridToolbarColumnsButton />
        <GridToolbarFilterButton />
        <GridToolbarDensitySelector />
        <GridToolbarExport />
      </Box>
      <GridToolbarQuickFilter sx={{ width: { xs: '100%', sm: 'auto' } }} />
    </GridToolbarContainer>
  );
}

export default CustomDataGridToolbar;
