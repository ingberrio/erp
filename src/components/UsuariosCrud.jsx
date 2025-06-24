import React, { useState, useEffect } from "react";
import {
  Box, Paper, Typography, Tabs, Tab, Button, TextField,
  Table, TableHead, TableRow, TableCell, TableBody,
  Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, InputAdornment, Tooltip, CircularProgress
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SecurityIcon from "@mui/icons-material/Security";
import ShieldIcon from "@mui/icons-material/Shield";
import PeopleIcon from "@mui/icons-material/People";
import SearchIcon from "@mui/icons-material/Search";

const API_ROLES = "http://127.0.0.1:8000/api/roles";

export default function UsuariosCrud({ token, tenantId }) {
  const [tab, setTab] = useState(0);

  // Roles data
  const [roles, setRoles] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [isAppReady, setIsAppReady] = useState(false);

  // Modal crear/editar rol
  const [openDialog, setOpenDialog] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleName, setRoleName] = useState("");
  const [roleDesc, setRoleDesc] = useState("");

  // --- Cargar roles ---
  const fetchRoles = async () => {
    setLoading(true);
    try {
      const res = await fetch(API_ROLES, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Tenant-ID": tenantId
        }
      });
      const data = await res.json();
      // Ajusta según tu backend: data.data si es paginado, data si es lista directa
      setRoles(Array.isArray(data) ? data : data.data || []);
    } catch (err) {
      setRoles([]);
    }
    setLoading(false);
  };

  useEffect(() => { if (token) fetchRoles(); }, [token]);

  // --- Filtrado de roles por búsqueda ---
  const filteredRoles = roles.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  // --- Crear/editar rol ---
  const handleSaveRole = async (e) => {
    e.preventDefault();
    setLoading(true);
    const method = editingRole ? "PUT" : "POST";
    const url = editingRole ? `${API_ROLES}/${editingRole.id}` : API_ROLES;
    await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Tenant-ID": tenantId
      },
      body: JSON.stringify({ name: roleName, description: roleDesc })
    });
    setOpenDialog(false);
    setRoleName("");
    setRoleDesc("");
    setEditingRole(null);
    fetchRoles();
    setLoading(false);
  };

  // --- Eliminar rol ---
  const handleDeleteRole = async (role) => {
    if (!window.confirm(`¿Eliminar rol "${role.name}"?`)) return;
    setLoading(true);
    await fetch(`${API_ROLES}/${role.id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Tenant-ID": tenantId
      }
    });
    fetchRoles();
    setLoading(false);
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", mt: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" sx={{ mb: 1, display: "flex", alignItems: "center" }}>
          <PeopleIcon sx={{ fontSize: 38, mr: 1, color: "#222" }} />
          Usuarios, Roles & Permisos
        </Typography>
        <Tabs
          value={tab}
          onChange={(_, t) => setTab(t)}
          sx={{
            mb: 3,
            "& .MuiTab-root": { fontWeight: 700, fontSize: 16 },
          }}
        >
          <Tab icon={<ShieldIcon sx={{ mr: 1 }} />} label="ROLES" />
          <Tab icon={<SecurityIcon sx={{ mr: 1 }} />} label="PERMISOS" />
          <Tab icon={<PeopleIcon sx={{ mr: 1 }} />} label="USUARIOS" />
        </Tabs>
        {/* --- SOLO TAB ROLES por ahora --- */}
        {tab === 0 && (
          <Box>
            <Box sx={{ display: "flex", mb: 2, alignItems: "center" }}>
              <TextField
                placeholder="Buscar..."
                size="small"
                variant="outlined"
                sx={{ width: 300, mr: 2 }}
                value={search}
                onChange={e => setSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  )
                }}
              />
              <Box sx={{ flexGrow: 1 }} />
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                color="primary"
                onClick={() => { setOpenDialog(true); setEditingRole(null); setRoleName(""); setRoleDesc(""); }}
              >
                Nuevo Rol
              </Button>
            </Box>

            {/* Tabla de roles */}
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Nombre</TableCell>
                  <TableCell>Descripción</TableCell>
                  <TableCell>Permisos</TableCell>
                  <TableCell>Usuarios</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <CircularProgress size={28} />
                    </TableCell>
                  </TableRow>
                )}
                {filteredRoles.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ color: "#bbb" }}>
                      No hay roles encontrados.
                    </TableCell>
                  </TableRow>
                )}
                {filteredRoles.map(role => (
                  <TableRow key={role.id}>
                    <TableCell>
                      <b>{role.name}</b>
                    </TableCell>
                    <TableCell>
                      {role.description || <span style={{ color: "#aaa" }}>-</span>}
                    </TableCell>
                    <TableCell>
                      {role.permissions?.length ? (
                        <Tooltip title={role.permissions.map(p => p.name).join(", ")}>
                          <span style={{ color: "#555" }}>
                            {role.permissions.length}
                          </span>
                        </Tooltip>
                      ) : "0"}
                    </TableCell>
                    <TableCell>
                      {role.users_count ?? 0}
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        onClick={() => {
                          setOpenDialog(true);
                          setEditingRole(role);
                          setRoleName(role.name);
                          setRoleDesc(role.description || "");
                        }}
                        color="primary"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        onClick={() => handleDeleteRole(role)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}

        {/* MODAL CREAR/EDITAR ROL */}
        <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
          <DialogTitle>{editingRole ? "Editar rol" : "Nuevo rol"}</DialogTitle>
          <form onSubmit={handleSaveRole}>
            <DialogContent>
              <TextField
                label="Nombre"
                value={roleName}
                onChange={e => setRoleName(e.target.value)}
                fullWidth
                required
                sx={{ mt: 1 }}
              />
              <TextField
                label="Descripción"
                value={roleDesc}
                onChange={e => setRoleDesc(e.target.value)}
                fullWidth
                sx={{ mt: 2 }}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpenDialog(false)}>Cancelar</Button>
              <Button type="submit" variant="contained" color="primary" disabled={loading || !roleName}>
                {editingRole ? "Guardar" : "Crear"}
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      </Paper>
    </Box>
  );
}
