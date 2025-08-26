// src/components/RegulatoryReportsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { api } from '../App'; // Ensure this import is correct
import useFacilityOperator from '../hooks/useFacilityOperator';
import {
  Box, Typography, Button, CircularProgress, Snackbar, Alert,
  TextField, Paper, FormControl, InputLabel, Select, MenuItem,
  Grid
} from '@mui/material';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload'; // Icon for regulatory reports
import DateRangeIcon from '@mui/icons-material/DateRange'; // Icon for dates

// --- Constants for UI Text and Labels ---
const BUTTON_LABELS = {
  GENERATE_REPORT: "Generate Report",
  CANCEL: "Cancel",
};

const DIALOG_TITLES = {
  REGULATORY_REPORTS: "Health Canada Regulatory Reports",
};

const ALERT_MESSAGES = {
  REPORT_TYPE_REQUIRED: "Report type is required.",
  FACILITY_REQUIRED: "Facility selection is required.",
  START_DATE_REQUIRED: "Start date is required.",
  END_DATE_REQUIRED: "End date is required.",
  ERROR_FETCHING_FACILITIES: "Error fetching facilities:",
  ERROR_GENERATING_REPORT: "Error generating report:",
  PERMISSION_DENIED: "You do not have permission to generate regulatory reports.",
  UNEXPECTED_RESPONSE: "Unexpected response from server. Could not download report.",
};

const SUCCESS_MESSAGES = {
  REPORT_GENERATION_STARTED: "Report generation started. Your download should begin shortly.",
  REPORT_DOWNLOAD_SUCCESS: "Report downloaded successfully!",
};

// Regulatory Report Types for Health Canada CTLS
const REGULATORY_REPORT_TYPES = [
  { value: 'monthly_inventory', label: 'Monthly Inventory Report' },
  { value: 'production', label: 'Production Report' },
  { value: 'disposition', label: 'Disposition Report' },
  // Add other Health Canada report types as needed based on CTLS specifications
];

// Helper to format date to YYYY-MM-DD
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const RegulatoryReportsPage = ({ tenantId, isAppReady, userFacilityId, isGlobalAdmin, setParentSnack, hasPermission }) => {
  const [loading, setLoading] = useState(true);
  const isFacilityOperator = useFacilityOperator(hasPermission);

  const [facilities, setFacilities] = useState([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState(''); // Initialize as empty string
  const [selectedReportType, setSelectedReportType] = useState('');
  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");
  const [regulatoryReportLoading, setRegulatoryReportLoading] = useState(false);

  // Helper to show snackbar messages
  const showSnack = useCallback((message, severity = 'success') => {
    if (typeof setParentSnack === 'function') {
      setParentSnack(message, severity);
    }
  }, [setParentSnack]);

  // Fetch Facilities
  const fetchFacilities = useCallback(async () => {
    // Corrected condition: Allow fetching if app is ready AND (there's a tenantId OR it's a global admin)
    if (!isAppReady || (!tenantId && !isGlobalAdmin)) {
      console.log("Skipping fetchFacilities: App not ready or no tenant context for non-global admin.");
      setLoading(false); // Ensure loading is false if skipped
      return;
    }
    setLoading(true);
    try {
      const response = await api.get('/facilities');
      let fetchedFacilities = Array.isArray(response.data) ? response.data : response.data.data || [];

      // Filter facilities if user is a facility operator
      if (isFacilityOperator && userFacilityId) {
        fetchedFacilities = fetchedFacilities.filter(f => f.id === userFacilityId);
      }
      
      setFacilities(fetchedFacilities);

      // Logic to set default selected facility
      if (userFacilityId && fetchedFacilities.some(f => f.id === userFacilityId)) {
        // If user has a specific facility and it's in the list, select it
        setSelectedFacilityId(userFacilityId);
      } else if (isGlobalAdmin && fetchedFacilities.length > 0) {
        // If it's a Global Admin and facilities are available, select the first one
        setSelectedFacilityId(fetchedFacilities[0].id);
      } else if (fetchedFacilities.length > 0) {
        // For other cases (e.g., non-global admin without specific userFacilityId), select the first one
        setSelectedFacilityId(fetchedFacilities[0].id);
      } else {
        setSelectedFacilityId(''); // No facilities available
      }

    } catch (error) {
      console.error(ALERT_MESSAGES.ERROR_FETCHING_FACILITIES, error.response?.data || error.message);
      showSnack(ALERT_MESSAGES.ERROR_FETCHING_FACILITIES + " " + (error.response?.data?.message || error.message), "error");
    } finally {
      setLoading(false);
    }
  }, [isAppReady, tenantId, userFacilityId, isGlobalAdmin, showSnack, isFacilityOperator]);

  useEffect(() => {
    fetchFacilities();
  }, [fetchFacilities]);

  // Handle report generation
  const handleGenerateReport = async () => {
    // The hasPermission check for Super Admin is handled in App.jsx, but good to keep here for clarity.
    if (!hasPermission('generate-regulatory-reports')) {
      showSnack(ALERT_MESSAGES.PERMISSION_DENIED, "error");
      return;
    }

    if (!selectedReportType) {
      showSnack(ALERT_MESSAGES.REPORT_TYPE_REQUIRED, "warning");
      return;
    }
    if (!selectedFacilityId) {
      showSnack(ALERT_MESSAGES.FACILITY_REQUIRED, "warning");
      return;
    }
    if (!reportStartDate) {
      showSnack(ALERT_MESSAGES.START_DATE_REQUIRED, "warning");
      return;
    }
    if (!reportEndDate) {
      showSnack(ALERT_MESSAGES.END_DATE_REQUIRED, "warning");
      return;
    }

    setRegulatoryReportLoading(true);
    try {
      showSnack(SUCCESS_MESSAGES.REPORT_GENERATION_STARTED, "info");

      // Make API call to backend for report generation
      const response = await api.post(
        '/reports/generate-ctls', // <-- CORREGIDO: Ruta completa para que coincida con routes/api.php
        {
          reportType: selectedReportType,
          facilityId: selectedFacilityId,
          startDate: reportStartDate,
          endDate: reportEndDate,
        },
        {
          responseType: 'blob', // Important: tells Axios to expect a binary response (file)
        }
      );

      // Check if the response is a file
      if (response.data) {
        // Create a URL for the blob
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;

        // Get filename from Content-Disposition header, or use a default
        const contentDisposition = response.headers['content-disposition'];
        let filename = 'regulatory_report.csv'; // Default filename
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
          if (filenameMatch && filenameMatch[1]) {
            filename = filenameMatch[1];
          }
        }
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url); // Clean up the URL object

        showSnack(SUCCESS_MESSAGES.REPORT_DOWNLOAD_SUCCESS, "success");
      } else {
        showSnack(ALERT_MESSAGES.UNEXPECTED_RESPONSE, "error");
      }

    } catch (error) {
      console.error(ALERT_MESSAGES.ERROR_GENERATING_REPORT, error.response?.data || error.message);
      // Try to read error message from blob if available
      if (error.response && error.response.data instanceof Blob) {
        const reader = new FileReader();
        reader.onload = function() {
          try {
            const errorData = JSON.parse(reader.result);
            showSnack(ALERT_MESSAGES.ERROR_GENERATING_REPORT + " " + (errorData.message || error.message), "error");
          } catch (e) {
            showSnack(ALERT_MESSAGES.ERROR_GENERATING_REPORT + " " + error.message, "error");
          }
        };
        reader.readAsText(error.response.data);
      } else {
        showSnack(ALERT_MESSAGES.ERROR_GENERATING_REPORT + " " + (error.response?.data?.message || error.message), "error");
      }
    } finally {
      setRegulatoryReportLoading(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, bgcolor: '#1a202c', minHeight: 'calc(100vh - 64px)', color: '#fff' }}>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 600, mb: 4, color: '#fff' }}>
        <CloudDownloadIcon sx={{ mr: 1, fontSize: 'inherit', verticalAlign: 'bottom' }} />
        {DIALOG_TITLES.REGULATORY_REPORTS}
      </Typography>

      <Paper sx={{ p: { xs: 2, sm: 3 }, bgcolor: '#2d3748', borderRadius: 2, mb: 4 }}>
        <Typography variant="h6" sx={{ mb: 2, color: '#e2e8f0' }}>
          Report Parameters
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth sx={{ mb: 2, minWidth: 200 }}> {/* Added minWidth */}
              <InputLabel id="report-type-label" sx={{ color: 'rgba(255,255,255,0.7)' }}>Report Type</InputLabel>
              <Select
                labelId="report-type-label"
                value={selectedReportType}
                label="Report Type"
                onChange={(e) => setSelectedReportType(e.target.value)}
                disabled={regulatoryReportLoading || loading}
                sx={{
                  color: '#fff',
                  '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.8)' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
                  '.MuiSvgIcon-root': { color: '#fff' },
                }}
                MenuProps={{
                  PaperProps: {
                    sx: { bgcolor: '#004060', color: '#fff' },
                  },
                }}
              >
                <MenuItem value="">
                  <em>Select Report Type</em>
                </MenuItem>
                {REGULATORY_REPORT_TYPES.map((type) => (
                  <MenuItem key={type.value} value={type.value}>
                    {type.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth sx={{ mb: 2, minWidth: 200 }}> {/* Added minWidth for consistency */}
              <InputLabel id="facility-select-label" sx={{ color: 'rgba(255,255,255,0.7)' }}>Facility</InputLabel>
              <Select
                labelId="facility-select-label"
                value={selectedFacilityId}
                label="Facility"
                onChange={(e) => setSelectedFacilityId(e.target.value)}
                disabled={regulatoryReportLoading || loading}
                sx={{
                  color: '#fff',
                  '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.8)' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
                  '.MuiSvgIcon-root': { color: '#fff' },
                }}
                MenuProps={{
                  PaperProps: {
                    sx: { bgcolor: '#004060', color: '#fff' },
                  },
                }}
              >
                <MenuItem value="">
                  <em>Select Facility</em>
                </MenuItem>
                {facilities.map((facility) => (
                  <MenuItem key={facility.id} value={facility.id}>
                    {facility.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Start Date"
              type="date"
              value={reportStartDate}
              onChange={(e) => setReportStartDate(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
              sx={{
                mb: 2,
                '& .MuiInputBase-input': { color: '#fff' },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.8)' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
                '& .MuiSvgIcon-root': { color: '#fff' }, // Icon color
              }}
              InputProps={{
                startAdornment: <DateRangeIcon sx={{ mr: 1, color: 'rgba(255,255,255,0.7)' }} />,
              }}
              disabled={regulatoryReportLoading}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="End Date"
              type="date"
              value={reportEndDate}
              onChange={(e) => setReportEndDate(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
              sx={{
                mb: 2,
                '& .MuiInputBase-input': { color: '#fff' },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.8)' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
                '& .MuiSvgIcon-root': { color: '#fff' }, // Icon color
              }}
              InputProps={{
                startAdornment: <DateRangeIcon sx={{ mr: 1, color: 'rgba(255,255,255,0.7)' }} />,
              }}
              disabled={regulatoryReportLoading}
            />
          </Grid>
        </Grid>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
          <Button
            onClick={handleGenerateReport}
            variant="contained"
            startIcon={regulatoryReportLoading ? <CircularProgress size={20} color="inherit" /> : <CloudDownloadIcon />}
            disabled={regulatoryReportLoading || !selectedReportType || !selectedFacilityId || !reportStartDate || !reportEndDate || !hasPermission('generate-regulatory-reports')}
            sx={{
              bgcolor: '#007bff',
              '&:hover': { bgcolor: '#0056b3' },
              color: '#fff',
              borderRadius: 2,
              px: 3,
              py: 1.5,
              fontSize: '1rem',
              fontWeight: 600,
            }}
          >
            {BUTTON_LABELS.GENERATE_REPORT}
          </Button>
        </Box>
      </Paper>

      
    </Box>
  );
};

RegulatoryReportsPage.propTypes = {
  tenantId: PropTypes.number,
  isAppReady: PropTypes.bool.isRequired,
  userFacilityId: PropTypes.number,
  isGlobalAdmin: PropTypes.bool.isRequired,
  setParentSnack: PropTypes.func.isRequired,
  hasPermission: PropTypes.func.isRequired,
};

export default RegulatoryReportsPage;
