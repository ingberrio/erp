
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import EcoIcon from '@mui/icons-material/Agriculture';
import HarvestIcon from '@mui/icons-material/LocalFlorist';
import ScienceIcon from '@mui/icons-material/Science';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import TransformIcon from '@mui/icons-material/Transform';
import AddBoxIcon from '@mui/icons-material/AddBox';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';

export const SNACK_MESSAGES = {
  FACILITIES_ERROR: 'Error loading facilities.',
  BATCHES_ERROR: 'Error loading batches.',
  STAGES_ERROR: 'Error loading stages.',
  CULTIVATION_AREAS_ERROR: 'Error loading cultivation areas.',
  USERS_ERROR: "Error fetching users.",
  TRACEABILITY_EVENTS_ERROR: 'Error loading traceability events.',
  TENANT_ID_MISSING: 'Could not determine Tenant ID.',
  PERMISSION_DENIED: 'You do not have permission to perform this action.',
  VALIDATION_ERROR: 'Validation error:',
  INVALID_DATA: 'Invalid data:',
  EVENT_REGISTERED_SUCCESS: 'Traceability event successfully registered.',
  BATCH_CREATED: 'Batch created successfully.',
  BATCH_UPDATED: 'Batch updated successfully.',
  BATCH_DELETED: 'Batch deleted successfully.',
  BATCH_SPLIT_SUCCESS: 'Batch successfully split.',
  BATCH_SPLIT_ERROR: 'Error splitting the batch.',
  BATCH_NAME_REQUIRED: 'Batch name is required.',
  BATCH_UNITS_REQUIRED: 'Current batch units are required.',
  BATCH_END_TYPE_REQUIRED: 'Batch end type is required.',
  BATCH_VARIETY_REQUIRED: 'Batch variety is required.',
  BATCH_AREA_REQUIRED: 'You must select a cultivation area for the batch.',
  CANNOT_DELETE_BATCH_WITH_EVENTS: 'Cannot delete batch: It has associated traceability events.',
  SPLIT_QUANTITY_INVALID: 'The split quantity must be greater than 0 and less than the current batch units.',
  NEW_BATCH_NAME_REQUIRED: 'New batch name is required.',
  DESTINATION_AREA_REQUIRED: 'You must select a destination cultivation area for the new batch.',
  BATCH_ORIGIN_TYPE_REQUIRED: 'Batch origin type is required.',
  BATCH_PRODUCT_TYPE_REQUIRED: 'Batch product type is required.',
  BATCH_PROCESSED_SUCCESS: 'Batch processed successfully.',
  BATCH_PROCESSED_ERROR: 'Error processing the batch.',
  PROCESSED_QUANTITY_INVALID: 'Processed quantity must be a valid number, greater than 0, and not greater than current units.',
  PROCESS_METHOD_REQUIRED: 'Processing method is required.',
  NEW_PRODUCT_TYPE_REQUIRED: 'New product type is required.',
  EXTERNAL_BATCH_CREATED: 'External batch successfully registered.',
  EXTERNAL_BATCH_ERROR: 'Error registering external batch.',
  EXTERNAL_ORIGIN_DETAILS_REQUIRED: 'External origin details are required.',
  LOSS_THEFT_QUANTITY_REQUIRED: 'Loss/theft quantity is required.',
  LOSS_THEFT_UNIT_REQUIRED: 'Loss/theft unit is required.',
  LOSS_THEFT_REASON_REQUIRED: 'Loss/theft reason is required.',
  EVENT_TYPE_REQUIRED: "Event type is required.",
  EVENT_DATE_REQUIRED: "Event date is required.",
  EVENT_BATCH_REQUIRED: "Batch for event is required.",
  EVENT_RESPONSIBLE_USER_REQUIRED: "Responsible user is required.",
  EVENT_NEW_LOCATION_REQUIRED: "New location is required for movement event.",
  EVENT_HARVEST_QUANTITY_REQUIRED: "Harvest quantity is required.",
  EVENT_SAMPLING_QUANTITY_REQUIRED: "Sampling quantity is required.",
  EVENT_DESTRUCTION_QUANTITY_REQUIRED: "Destruction quantity is required.",
  BATCH_UNIT_REQUIRED: "Batch unit of measure is required.",
  INVENTORY_ADJUSTMENT_SUCCESS: "Inventory adjustment registered successfully.",
  INVENTORY_ADJUSTMENT_ERROR: "Error registering inventory adjustment.",
  INVENTORY_ADJUSTMENT_REQUIRED: "All adjustment fields are required.",
  NO_BATCHES_FOR_FACILITY: "No batches available for this facility.",
  GLOBAL_ADMIN_NO_FACILITY: "As Super Admin, please select a facility with a valid Tenant ID to view batches.",
  GLOBAL_ADMIN_NO_FACILITIES_EXIST: "As Super Admin, no facilities are registered in the system. Please create a facility first.",
  LOADING_BATCHES: "Loading batches...",
  // Security-related messages
  SECURITY_INPUT_SANITIZED: 'Input has been automatically sanitized for security.',
  SECURITY_RATE_LIMIT_EXCEEDED: 'Too many requests. Please wait before trying again.',
  SECURITY_INVALID_CHARACTERS: 'Input contains invalid or potentially unsafe characters.',
  SECURITY_SESSION_EXPIRED: 'Your session has expired. Please log in again.',
  SECURITY_UNAUTHORIZED_ACTION: 'This action is not authorized for your role.',
  SECURITY_DATA_INTEGRITY_ERROR: 'Data integrity check failed.',
  // Stage transition events
  AREA_STAGE_TRANSITION_SUCCESS: 'Area stage transition traceability event registered successfully.',
  AREA_STAGE_TRANSITION_ERROR: 'Error registering area stage transition event.',
};

export const DIALOG_TITLES = {
  ADD_BATCH: 'Add New Batch',
  EDIT_BATCH: 'Edit Batch',
  BATCH_DETAIL: 'Batch Details',
  REGISTER_EVENT: 'Register Traceability Event',
  CONFIRM_BATCH_DELETION: 'Confirm Batch Deletion',
  SPLIT_BATCH: 'Split Batch',
  PROCESS_BATCH: 'Process Batch',
  REGISTER_EXTERNAL_BATCH: 'Register External Batch',
  INVENTORY_ADJUSTMENT: 'Inventory Adjustment',
};

export const BUTTON_LABELS = {
  CANCEL: 'Cancel',
  CONFIRM: 'Confirm',
  SAVE_CHANGES: 'Save Changes',
  CREATE_BATCH: 'Create Batch',
  ADD_NEW_BATCH: 'Add New Batch',
  CLOSE: 'Close',
  REGISTER: 'Register',
  VIEW_DETAILS: 'View Details',
  DELETE: 'Delete',
  EDIT: 'Edit',
  SPLIT_BATCH: 'Split Batch',
  PROCESS: 'Process',
  REGISTER_EXTERNAL_BATCH: 'Register External Batch',
  REGISTER_ADJUSTMENT: 'Register Adjustment',
};

export const HEALTH_CANADA_PRODUCT_TYPES = [
  { value: 'Vegetative cannabis plants', label: 'Vegetative Cannabis Plants' },
  { value: 'Fresh cannabis', label: 'Fresh Cannabis' },
  { value: 'Dried cannabis', label: 'Dried Cannabis' },
  { value: 'Seeds', label: 'Seeds' },
  { value: 'Pure Intermediates', label: 'Pure Intermediates' },
  { value: 'Edibles - Solids', label: 'Edibles - Solids' },
  { value: 'Edibles - Non-solids', label: 'Edibles - Non-solids' },
  { value: 'Extracts - Inhaled', label: 'Extracts - Inhaled' },
  { value: 'Extracts - Ingested', label: 'Extracts - Ingested' },
  { value: 'Extracts - Other', label: 'Extracts - Other' },
  { value: 'Topicals', label: 'Topicals' },
  { value: 'Other', label: 'Other' },
];

export const UNIT_OPTIONS = ['g', 'kg', 'units', 'ml', 'L'];

export const EVENT_TYPES = [
  { value: 'movement', label: 'Movement', icon: TrendingUpIcon },
  { value: 'cultivation', label: 'Cultivation', icon: EcoIcon },
  { value: 'harvest', label: 'Harvest', icon: HarvestIcon },
  { value: 'sampling', label: 'Sampling', icon: ScienceIcon },
  { value: 'destruction', label: 'Destruction', icon: DeleteForeverIcon },
  { value: 'loss_theft', label: 'Loss/Theft', icon: RemoveCircleOutlineIcon },
  { value: 'processing', label: 'Processing', icon: TransformIcon },
  { value: 'inventory_adjustment', label: 'Inventory Adjustment', icon: AddBoxIcon },
  { value: 'area_stage_transition', label: 'Area Stage Transition', icon: SwapHorizIcon },
];

export const DIALOG_STYLES = {
  paper: { sx: { bgcolor: '#2d3748', color: '#e2e8f0', borderRadius: 2 } },
  title: { sx: { bgcolor: '#3a506b', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
  content: { sx: { pt: '20px !important' } },
  actions: { sx: { bgcolor: '#3a506b' } },
  closeButton: { sx: { color: '#e2e8f0' } },
  input: {
    sx: { 
      mb: 2, 
      '& .MuiInputBase-input': { color: '#fff' }, 
      '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' }, 
      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' } 
    }
  },
  select: {
    sx: {
      color: '#fff',
      '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
      '.MuiSvgIcon-root': { color: '#fff' }
    },
    menu: { PaperProps: { sx: { bgcolor: '#004060', color: '#fff' } } }
  }
};

// Security and validation constants
export const SECURITY_RULES = {
  BATCH_NAME_MAX_LENGTH: 100,
  VARIETY_MAX_LENGTH: 50,
  DESCRIPTION_MAX_LENGTH: 1000,
  REASON_MAX_LENGTH: 500,
  METHOD_MAX_LENGTH: 100,
  ORIGIN_DETAILS_MAX_LENGTH: 500,
  MIN_QUANTITY: 0.01,
  MAX_QUANTITY: 1000000,
  RATE_LIMIT_REQUESTS: 10,
  RATE_LIMIT_WINDOW_MS: 60000,
  // Input validation patterns
  BATCH_NAME_PATTERN: /^[a-zA-Z0-9\s\-_.]+$/,
  VARIETY_PATTERN: /^[a-zA-Z0-9\s\-_]+$/,
  LOCATION_PATTERN: /^[a-zA-Z0-9\s\-_.]+$/,
  // Allowed file upload types (if implemented)
  ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'application/pdf'],
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
};

export const AUDIT_ACTIONS = {
  BATCH_CREATED: 'batch_created',
  BATCH_UPDATED: 'batch_updated',
  BATCH_DELETED: 'batch_deleted',
  BATCH_SPLIT: 'batch_split',
  BATCH_PROCESSED: 'batch_processed',
  EVENT_REGISTERED: 'event_registered',
  INVENTORY_ADJUSTED: 'inventory_adjusted',
  AREA_STAGE_TRANSITION: 'area_stage_transition',
  UNAUTHORIZED_ACCESS: 'unauthorized_access',
  VALIDATION_FAILED: 'validation_failed',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
};
