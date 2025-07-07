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
        Boostez votre entreprise de cannabis <br />
          <Box component="span" sx={{ color: '#4CAF50' }}>au maximum</Box> {/* Texto "al máximo" en verde */}
        </Typography>
        <Typography variant="body1" sx={{ color: '#a0aec0', lineHeight: 1.6 }}>
        Contrôlez toutes vos opérations commerciales. Réduisez vos coûts de main-d'œuvre et optimisez vos opérations.
        </Typography>
        <Button
          variant="contained"
          size="large"
          sx={{
            mt: 2,
            bgcolor: '#4CAF50', // Color verde para el botón
            color: '#fff',
            fontWeight: 600,
            borderRadius: 2,
            px: 4,
            py: 1.5,
            '&:hover': {
              bgcolor: '#43A047', // Un verde un poco más oscuro al pasar el ratón
              boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
            },
          }}
          onClick={() => alert('¡Agendar una llamada! (Funcionalidad por implementar)')} // Puedes cambiar esto por una acción real
        >
          planifier un appel
        </Button>
      </Paper>
    </Box>
  );
};

export default LandingPage;
