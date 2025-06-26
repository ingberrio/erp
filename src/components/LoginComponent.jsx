// src/components/LoginComponent.jsx

import React, { useState } from "react"; // <-- Removido useContext, ya no es necesario aquí
import {
  Box, Paper, Typography, TextField, Button,
  Snackbar, Alert, CircularProgress, InputAdornment,
} from "@mui/material";
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import PersonIcon from '@mui/icons-material/Person';
import VpnKeyIcon from '@mui/icons-material/VpnKey';

import { api } from "../App"; // Importa la instancia global de Axios

// LoginComponent ahora recibe setToken y setUser como props desde App.js
const LoginComponent = ({ setToken, setUser }) => { // <-- Asegúrate de que las props setToken y setUser están aquí
  const [email, setEmail] = useState("demo@demo.com"); // Email pre-rellenado para comodidad
  const [password, setPassword] = useState("12345678"); // Contraseña pre-rellenada para comodidad
  const [loading, setLoading] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: "", severity: "error" });

  // const { handleLogin } = useContext(AuthContext); // <-- ¡ESTA LÍNEA DEBE SER ELIMINADA!
                                                 // LoginComponent ya no usa AuthContext para la función de login.

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSnack({ ...snack, open: false });
    setLoading(true);
    try {
      const response = await api.post('/login', { email, password }); // <-- LoginComponent hace la llamada directamente
      const { user: fetchedUser, token: fetchedToken } = response.data;

      setToken(fetchedToken); // Llama a la prop setToken de App.js
      setUser(fetchedUser);   // Llama a la prop setUser de App.js

      setSnack({ open: true, message: "Inicio de sesión exitoso!", severity: "success" });

    } catch (err) {
      console.error("Error de login en LoginComponent:", err.response?.data || err.message);
      const errorMessage = err.response?.data?.message || "Error inesperado al iniciar sesión.";
      setSnack({ open: true, message: errorMessage, severity: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#1a1a1a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Paper
        elevation={6}
        sx={{
          p: { xs: 3, sm: 5 },
          borderRadius: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          bgcolor: '#212224',
          color: '#fff',
          maxWidth: 400,
          width: '90%',
        }}
      >
        <LockOutlinedIcon sx={{ fontSize: 48, mb: 2, color: '#fff' }} />
        <Typography component="h1" variant="h5" sx={{ mb: 3, fontWeight: 'bold' }}>
          Iniciar Sesión
        </Typography>
        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          <TextField
            margin="normal"
            required
            fullWidth
            id="email"
            label="Correo Electrónico"
            name="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PersonIcon sx={{ color: '#aaa' }} />
                </InputAdornment>
              ),
              style: { color: '#fff' },
            }}
            InputLabelProps={{ style: { color: '#aaa' } }}
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: '#444' },
                '&:hover fieldset': { borderColor: '#666' },
                '&.Mui-focused fieldset': { borderColor: '#fff' },
              },
            }}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="Contraseña"
            type="password"
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <VpnKeyIcon sx={{ color: '#aaa' }} />
                </InputAdornment>
              ),
              style: { color: '#fff' },
            }}
            InputLabelProps={{ style: { color: '#aaa' } }}
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: '#444' },
                '&:hover fieldset': { borderColor: '#666' },
                '&.Mui-focused fieldset': { borderColor: '#fff' },
              },
            }}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{
              mt: 3,
              mb: 2,
              py: 1.5,
              bgcolor: '#4a90e2',
              '&:hover': {
                bgcolor: '#3a7bd5',
              },
              color: '#fff',
            }}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : "ENTRAR"}
          </Button>
        </form>

        <Snackbar
          open={snack.open}
          autoHideDuration={4000}
          onClose={() => setSnack({ ...snack, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            severity={snack.severity}
            onClose={() => setSnack({ ...snack, open: false })}
            sx={{ width: '100%' }}
          >
            {snack.message}
          </Alert>
        </Snackbar>
      </Paper>
    </Box>
  );
};

export default LoginComponent;
