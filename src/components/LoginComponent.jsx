// src/components/LoginComponent.jsx
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Box, TextField, Button, Typography, Paper, CircularProgress, Snackbar, Alert
} from '@mui/material';

const LoginComponent = ({ onLogin, loading, error, setParentSnack }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [internalError, setInternalError] = useState(null); // Para errores internos del componente

  const handleSubmit = async (event) => {
    event.preventDefault();
    setInternalError(null); // Limpiar errores internos
    if (!email || !password) {
      setInternalError("Por favor, introduce tu correo y contraseña.");
      return;
    }
    
    // Llama a la función onLogin pasada como prop desde App.jsx
    // Esta es la función que maneja la lógica de autenticación con el backend.
    try {
      await onLogin(email, password);
    } catch (e) {
      // onLogin ya maneja los errores y muestra el snackbar,
      // pero si por alguna razón un error no se propaga bien,
      // puedes manejarlo aquí también.
      console.error("Error al llamar a onLogin:", e);
      setInternalError("Ocurrió un error inesperado al intentar iniciar sesión.");
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        bgcolor: '#1a202c',
        p: 2,
      }}
    >
      <Paper
        elevation={6}
        sx={{
          p: 4,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          width: '100%',
          maxWidth: 400,
          borderRadius: 2,
          bgcolor: '#2d3748', // Color de fondo del Paper
          color: '#e2e8f0', // Color del texto
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
        }}
      >
        <Typography variant="h5" component="h1" align="center" sx={{ mb: 2, color: '#e2e8f0' }}>
          Iniciar Sesión
        </Typography>
        <form onSubmit={handleSubmit}>
          <TextField
            label="Correo Electrónico"
            type="email"
            fullWidth
            margin="normal"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            variant="outlined"
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: '#4a5568' },
                '&:hover fieldset': { borderColor: '#63b3ed' },
                '&.Mui-focused fieldset': { borderColor: '#4299e1' },
                color: '#e2e8f0',
              },
              '& .MuiInputLabel-root': { color: '#a0aec0' },
            }}
            InputProps={{
              style: { color: '#e2e8f0' } // Color del texto de entrada
            }}
            InputLabelProps={{
              style: { color: '#a0aec0' } // Color de la etiqueta
            }}
          />
          <TextField
            label="Contraseña"
            type="password"
            fullWidth
            margin="normal"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            variant="outlined"
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: '#4a5568' },
                '&:hover fieldset': { borderColor: '#63b3ed' },
                '&.Mui-focused fieldset': { borderColor: '#4299e1' },
                color: '#e2e8f0',
              },
              '& .MuiInputLabel-root': { color: '#a0aec0' },
            }}
            InputProps={{
              style: { color: '#e2e8f0' }
            }}
            InputLabelProps={{
              style: { color: '#a0aec0' }
            }}
          />
          {(error || internalError) && (
            <Alert severity="error" sx={{ mt: 2, mb: 1, width: '100%' }}>
              {error || internalError}
            </Alert>
          )}
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{
              mt: 3,
              py: 1.5,
              bgcolor: '#4299e1', // Color de fondo del botón
              '&:hover': { bgcolor: '#3182ce' }, // Color de fondo al pasar el ratón
              color: '#fff', // Color del texto del botón
              borderRadius: 1,
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
            }}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : 'ENTRAR'}
          </Button>
        </form>
      </Paper>
    </Box>
  );
};

LoginComponent.propTypes = {
  onLogin: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired,
  error: PropTypes.string,
  setParentSnack: PropTypes.func.isRequired,
};

export default LoginComponent;
