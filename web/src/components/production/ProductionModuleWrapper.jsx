// src/components/production/ProductionModuleWrapper.jsx
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Box, Tabs, Tab, Typography } from '@mui/material';
import LocalFloristIcon from '@mui/icons-material/LocalFlorist';
import InventoryIcon from '@mui/icons-material/Inventory';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import RecyclingIcon from '@mui/icons-material/Recycling';
import CompostIcon from '@mui/icons-material/Yard';
import BugReportIcon from '@mui/icons-material/BugReport';
import CategoryIcon from '@mui/icons-material/Category';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';

import VarietiesPage from './VarietiesPage';
import SkuPage from './SkuPage';

// Tab Panel Component
function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`production-tabpanel-${index}`}
      aria-labelledby={`production-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
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
    id: `production-tab-${index}`,
    'aria-controls': `production-tabpanel-${index}`,
  };
}

// Placeholder component for coming soon tabs
const ComingSoonPlaceholder = ({ icon: IconComponent, title }) => (
  <Box sx={{ 
    p: 6, 
    textAlign: 'center', 
    color: 'text.secondary',
    bgcolor: 'background.paper',
    borderRadius: 2,
  }}>
    <IconComponent sx={{ fontSize: 48, mb: 2, color: '#9e9e9e' }} />
    <Typography sx={{ fontSize: '1.1rem', fontWeight: 500 }}>{title}</Typography>
    <Typography sx={{ fontSize: '0.875rem', mt: 1 }}>Coming soon...</Typography>
  </Box>
);

ComingSoonPlaceholder.propTypes = {
  icon: PropTypes.elementType.isRequired,
  title: PropTypes.string.isRequired,
};

const ProductionModuleWrapper = ({ tenantId, isAppReady, isGlobalAdmin, setParentSnack }) => {
  const [activeTab, setActiveTab] = useState(0);

  const handleChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const tabStyle = {
    color: 'text.secondary',
    textTransform: 'none',
    fontSize: '0.85rem',
    fontWeight: 500,
    minHeight: 48,
    px: 1.5,
    '&.Mui-selected': {
      color: 'primary.main',
    },
    '&.Mui-disabled': {
      color: 'text.disabled',
    },
  };

  const tabs = [
    { label: 'Varieties', icon: LocalFloristIcon, enabled: true },
    { label: 'SKUs', icon: InventoryIcon, enabled: true },
    { label: 'Rooms', icon: MeetingRoomIcon, enabled: false },
    { label: 'Destruction Methods', icon: DeleteForeverIcon, enabled: false },
    { label: 'Waste Types', icon: RecyclingIcon, enabled: false },
    { label: 'Compost Types', icon: CompostIcon, enabled: false },
    { label: 'Pest Types', icon: BugReportIcon, enabled: false },
    { label: 'End Types', icon: CategoryIcon, enabled: false },
    { label: 'Destruction Reasons', icon: ReportProblemIcon, enabled: false },
  ];

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
          aria-label="Production Navigation"
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            minHeight: 48,
            '& .MuiTabs-indicator': {
              backgroundColor: '#4CAF50',
              height: 3,
            },
          }}
        >
          {tabs.map((tab, index) => (
            <Tab
              key={tab.label}
              icon={<tab.icon sx={{ fontSize: 18, mr: 0.5 }} />}
              iconPosition="start"
              label={tab.label}
              sx={tabStyle}
              disabled={!tab.enabled}
              {...a11yProps(index)}
            />
          ))}
        </Tabs>
      </Box>

      {/* Tab Content */}
      <Box sx={{ p: 2 }}>
        {/* Varieties Tab */}
        <TabPanel value={activeTab} index={0}>
          <VarietiesPage
            tenantId={tenantId}
            isAppReady={isAppReady}
            isGlobalAdmin={isGlobalAdmin}
            setParentSnack={setParentSnack}
          />
        </TabPanel>

        {/* SKUs Tab */}
        <TabPanel value={activeTab} index={1}>
          <SkuPage
            tenantId={tenantId}
            isAppReady={isAppReady}
            isGlobalAdmin={isGlobalAdmin}
            setParentSnack={setParentSnack}
          />
        </TabPanel>

        {/* Rooms Tab */}
        <TabPanel value={activeTab} index={2}>
          <ComingSoonPlaceholder icon={MeetingRoomIcon} title="Rooms Module" />
        </TabPanel>

        {/* Destruction Methods Tab */}
        <TabPanel value={activeTab} index={3}>
          <ComingSoonPlaceholder icon={DeleteForeverIcon} title="Destruction Methods Module" />
        </TabPanel>

        {/* Waste Types Tab */}
        <TabPanel value={activeTab} index={4}>
          <ComingSoonPlaceholder icon={RecyclingIcon} title="Waste Types Module" />
        </TabPanel>

        {/* Compost Types Tab */}
        <TabPanel value={activeTab} index={5}>
          <ComingSoonPlaceholder icon={CompostIcon} title="Compost Types Module" />
        </TabPanel>

        {/* Pest Types Tab */}
        <TabPanel value={activeTab} index={6}>
          <ComingSoonPlaceholder icon={BugReportIcon} title="Pest Types Module" />
        </TabPanel>

        {/* End Types Tab */}
        <TabPanel value={activeTab} index={7}>
          <ComingSoonPlaceholder icon={CategoryIcon} title="End Types Module" />
        </TabPanel>

        {/* Destruction Reasons Tab */}
        <TabPanel value={activeTab} index={8}>
          <ComingSoonPlaceholder icon={ReportProblemIcon} title="Destruction Reasons Module" />
        </TabPanel>
      </Box>
    </Box>
  );
};

ProductionModuleWrapper.propTypes = {
  tenantId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  isAppReady: PropTypes.bool.isRequired,
  isGlobalAdmin: PropTypes.bool,
  setParentSnack: PropTypes.func,
};

ProductionModuleWrapper.defaultProps = {
  tenantId: null,
  isGlobalAdmin: false,
  setParentSnack: null,
};

export default ProductionModuleWrapper;
