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
        bgcolor: '#3a506b !important', color: '#e2e8f0 !important', borderBottom: '1px solid #4a5568',
        padding: '8px', borderRadius: '4px 4px 0 0', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', flexWrap: 'wrap', gap: '8px',
        '& .MuiButtonBase-root': { color: '#e2e8f0 !important', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } },
        '& .MuiInputBase-root': {
          color: '#e2e8f0 !important',
          '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5) !important' },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.8) !important' },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#fff !important' },
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
