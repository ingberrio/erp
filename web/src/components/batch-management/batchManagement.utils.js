// Helper to format date to YYYY-MM-DD
export const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toISOString().split('T')[0];
};

// Security utility functions
export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  // Remove potentially dangerous characters
  return input
    .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove script tags
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/data:/gi, '') // Remove data: protocol
    .replace(/vbscript:/gi, '') // Remove vbscript: protocol
    .trim();
};

// Validate numeric input with bounds checking
export const validateNumericInput = (value, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const num = parseFloat(value);
  if (isNaN(num)) return { isValid: false, error: 'Invalid number format' };
  if (num < min) return { isValid: false, error: `Value must be at least ${min}` };
  if (num > max) return { isValid: false, error: `Value must be at most ${max}` };
  return { isValid: true, value: num };
};

// Validate string input with length and pattern checking
export const validateStringInput = (value, minLength = 1, maxLength = 255, pattern = null) => {
  if (typeof value !== 'string') return { isValid: false, error: 'Input must be a string' };
  
  const sanitized = sanitizeInput(value);
  
  if (sanitized.length < minLength) {
    return { isValid: false, error: `Input must be at least ${minLength} characters long` };
  }
  
  if (sanitized.length > maxLength) {
    return { isValid: false, error: `Input must be at most ${maxLength} characters long` };
  }
  
  if (pattern && !pattern.test(sanitized)) {
    return { isValid: false, error: 'Input contains invalid characters' };
  }
  
  return { isValid: true, value: sanitized };
};

// Rate limiting helper for API calls
export const createRateLimiter = (maxCalls = 10, windowMs = 60000) => {
  const calls = [];
  
  return () => {
    const now = Date.now();
    // Remove calls outside the window
    while (calls.length > 0 && calls[0] <= now - windowMs) {
      calls.shift();
    }
    
    if (calls.length >= maxCalls) {
      return { allowed: false, retryAfter: calls[0] + windowMs - now };
    }
    
    calls.push(now);
    return { allowed: true };
  };
};

// Validate batch data integrity
export const validateBatchData = (batchData) => {
  const errors = [];
  
  // Validate name
  const nameValidation = validateStringInput(batchData.name, 1, 100, /^[a-zA-Z0-9\s\-_]+$/);
  if (!nameValidation.isValid) errors.push(`Name: ${nameValidation.error}`);
  
  // Validate numeric fields
  const unitsValidation = validateNumericInput(batchData.current_units, 0.01, 1000000);
  if (!unitsValidation.isValid) errors.push(`Units: ${unitsValidation.error}`);
  
  // Validate variety
  const varietyValidation = validateStringInput(batchData.variety, 1, 50, /^[a-zA-Z0-9\s\-_]+$/);
  if (!varietyValidation.isValid) errors.push(`Variety: ${varietyValidation.error}`);
  
  // Validate origin details if provided
  if (batchData.origin_details) {
    const originValidation = validateStringInput(batchData.origin_details, 1, 500);
    if (!originValidation.isValid) errors.push(`Origin details: ${originValidation.error}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData: {
      ...batchData,
      name: nameValidation.isValid ? nameValidation.value : batchData.name,
      variety: varietyValidation.isValid ? varietyValidation.value : batchData.variety,
      origin_details: batchData.origin_details ? sanitizeInput(batchData.origin_details) : null
    }
  };
};

// Validate traceability event data
export const validateEventData = (eventData) => {
  const errors = [];
  
  // Validate description/notes
  if (eventData.description) {
    const descValidation = validateStringInput(eventData.description, 0, 1000);
    if (!descValidation.isValid) errors.push(`Description: ${descValidation.error}`);
  }
  
  // Validate reason
  if (eventData.reason) {
    const reasonValidation = validateStringInput(eventData.reason, 1, 500);
    if (!reasonValidation.isValid) errors.push(`Reason: ${reasonValidation.error}`);
  }
  
  // Validate method
  if (eventData.method) {
    const methodValidation = validateStringInput(eventData.method, 1, 100);
    if (!methodValidation.isValid) errors.push(`Method: ${methodValidation.error}`);
  }
  
  // Validate quantities
  if (eventData.quantity !== null && eventData.quantity !== undefined) {
    const quantityValidation = validateNumericInput(eventData.quantity, 0.01, 1000000);
    if (!quantityValidation.isValid) errors.push(`Quantity: ${quantityValidation.error}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData: {
      ...eventData,
      description: eventData.description ? sanitizeInput(eventData.description) : null,
      reason: eventData.reason ? sanitizeInput(eventData.reason) : null,
      method: eventData.method ? sanitizeInput(eventData.method) : null,
      from_location: eventData.from_location ? sanitizeInput(eventData.from_location) : null,
      to_location: eventData.to_location ? sanitizeInput(eventData.to_location) : null
    }
  };
};

// Audit log helper
export const createAuditLog = (action, entity, entityId, userId, details = {}) => {
  return {
    timestamp: new Date().toISOString(),
    action: sanitizeInput(action),
    entity: sanitizeInput(entity),
    entityId: parseInt(entityId) || null,
    userId: parseInt(userId) || null,
    details: Object.fromEntries(
      Object.entries(details).map(([key, value]) => [
        sanitizeInput(key),
        typeof value === 'string' ? sanitizeInput(value) : value
      ])
    ),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    ipAddress: null // This should be set by the server
  };
};
