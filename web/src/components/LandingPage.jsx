// src/components/LandingPage.jsx
import React from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';

const LandingPage = ({ setLoginDialogOpen }) => {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        bgcolor: '#1a202c', // Fondo general oscuro
        color: '#e2e8f0', // Color de texto principal claro
        textAlign: 'center',
        p: 3,
        pt: { xs: 10, sm: 12 }, // Padding top para evitar la AppBar
      }}
    >
      <Paper
        elevation={6}
        sx={{
          p: { xs: 4, sm: 6 }, // Aumentar el padding para hacerlo más grande
          maxWidth: 800, // Aumentar el ancho máximo
          bgcolor: '#2d3748', // Color del recuadro central oscuro
          borderRadius: 3,
          boxShadow: '0 10px 20px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
        }}
      >
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, color: '#e2e8f0' }}>
        Boost your cannabis business <br />
          <Box component="span" sx={{ color: '#4CAF50' }}>to the maximum</Box> {/* Text "to the maximum" in green */}
        </Typography>
        <Typography variant="body1" sx={{ color: '#a0aec0', lineHeight: 1.6 }}>
        Control all your business operations. Reduce your labor costs and optimize your operations.
        </Typography>
        <Button
          variant="contained"
          size="large"
          sx={{
            mt: 2,
            bgcolor: '#4CAF50', // Green color for the button
            color: '#fff',
            fontWeight: 600,
            borderRadius: 2,
            px: 4,
            py: 1.5,
            '&:hover': {
              bgcolor: '#43A047', // Slightly darker green on hover
              boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
            },
          }}
          onClick={() => alert('Schedule a call! (Feature to be implemented)')} // You can change this to a real action
        >
          Schedule a Call
        </Button>
      </Paper>
    </Box>
  );
};

export default LandingPage;
