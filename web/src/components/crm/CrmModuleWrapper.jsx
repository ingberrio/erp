// src/components/crm/CrmModuleWrapper.jsx
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Box, Tabs, Tab } from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import AnalyticsIcon from '@mui/icons-material/Analytics';

import CrmAccountsPage from './CrmAccountsPage';
import CrmOrdersPage from './CrmOrdersPage';

// Tab Panel Component
function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`crm-tabpanel-${index}`}
      aria-labelledby={`crm-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

TabPanel.propTypes = {
  children: PropTypes.node,
  index: PropTypes.number.isRequired,
  value: PropTypes.number.isRequired,
};

function a11yProps(index) {
  return {
    id: `crm-tab-${index}`,
    'aria-controls': `crm-tabpanel-${index}`,
  };
}

const CrmModuleWrapper = ({ tenantId, isAppReady, isGlobalAdmin, setParentSnack }) => {
  const [activeTab, setActiveTab] = useState(0);

  const handleChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const tabStyle = {
    color: 'text.secondary',
    textTransform: 'none',
    fontSize: '0.9rem',
    fontWeight: 500,
    minHeight: 48,
    px: 2,
    '&.Mui-selected': {
      color: 'primary.main',
    },
    '&.Mui-disabled': {
      color: 'text.disabled',
    },
  };

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100%' }}>
      {/* Tabs Navigation - Clean horizontal tabs */}
      <Box sx={{ 
        borderBottom: 1, 
        borderColor: 'divider',
        bgcolor: 'background.paper',
        px: 2,
      }}>
        <Tabs
          value={activeTab}
          onChange={handleChange}
          aria-label="CRM Navigation"
          sx={{
            minHeight: 48,
            '& .MuiTabs-indicator': {
              backgroundColor: '#4CAF50',
              height: 3,
            },
          }}
        >
          <Tab 
            icon={<BusinessIcon sx={{ fontSize: 18, mr: 0.5 }} />} 
            iconPosition="start" 
            label="Accounts" 
            sx={tabStyle}
            {...a11yProps(0)} 
          />
          <Tab 
            icon={<ShoppingCartIcon sx={{ fontSize: 18, mr: 0.5 }} />} 
            iconPosition="start" 
            label="Orders" 
            sx={tabStyle}
            {...a11yProps(1)} 
          />
          <Tab 
            icon={<LocalShippingIcon sx={{ fontSize: 18, mr: 0.5 }} />} 
            iconPosition="start" 
            label="Shipments" 
            sx={tabStyle}
            disabled
            {...a11yProps(2)} 
          />
          <Tab 
            icon={<AnalyticsIcon sx={{ fontSize: 18, mr: 0.5 }} />} 
            iconPosition="start" 
            label="Analytics" 
            sx={tabStyle}
            disabled
            {...a11yProps(3)} 
          />
        </Tabs>
      </Box>

      {/* Tab Content */}
      <Box sx={{ p: 2 }}>
        <TabPanel value={activeTab} index={0}>
          <CrmAccountsPage 
            tenantId={tenantId} 
            isAppReady={isAppReady}
            isGlobalAdmin={isGlobalAdmin}
            setParentSnack={setParentSnack}
          />
        </TabPanel>
        
        <TabPanel value={activeTab} index={1}>
          <CrmOrdersPage 
            tenantId={tenantId} 
            isAppReady={isAppReady}
            isGlobalAdmin={isGlobalAdmin}
            setParentSnack={setParentSnack}
          />
        </TabPanel>
        
        <TabPanel value={activeTab} index={2}>
          <Box sx={{ 
            p: 6, 
            textAlign: 'center', 
            color: 'text.secondary',
            bgcolor: 'background.paper',
            borderRadius: 2,
          }}>
            <LocalShippingIcon sx={{ fontSize: 48, mb: 2 }} />
            <Box sx={{ fontSize: '1.1rem', fontWeight: 500 }}>Shipments Module</Box>
            <Box sx={{ fontSize: '0.875rem', mt: 1 }}>Coming soon...</Box>
          </Box>
        </TabPanel>
        
        <TabPanel value={activeTab} index={3}>
          <Box sx={{ 
            p: 6, 
            textAlign: 'center', 
            color: 'text.secondary',
            bgcolor: 'background.paper',
            borderRadius: 2,
          }}>
            <AnalyticsIcon sx={{ fontSize: 48, mb: 2 }} />
            <Box sx={{ fontSize: '1.1rem', fontWeight: 500 }}>Analytics Module</Box>
            <Box sx={{ fontSize: '0.875rem', mt: 1 }}>Coming soon...</Box>
          </Box>
        </TabPanel>
      </Box>
    </Box>
  );
};

CrmModuleWrapper.propTypes = {
  tenantId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  isAppReady: PropTypes.bool,
  isGlobalAdmin: PropTypes.bool,
  setParentSnack: PropTypes.func,
};

export default CrmModuleWrapper;
