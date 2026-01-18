/**
 * 🚨 Generic Error Utilities
 * 
 * Provides comprehensive error handling utilities for extracting
 * user-friendly error messages from various error structures.
 */

/**
 * Error codes and their user-friendly messages
 */
export const ERROR_CODE_MESSAGES: Record<string, string> = {
  // Membership errors
  'MEMBERSHIP_EXISTS': '👤 Already a Member: This user is already part of your organization.',
  'USER_ALREADY_MEMBER': '👤 Already a Member: This user is already part of your organization.',
  'ALREADY_MEMBER': '👤 Already a Member: You are already a member of this organization.',
  
  // Invite errors
  'INVITE_ALREADY_EXISTS': '📧 Invitation Pending: An invitation has already been sent to this email address.',
  'INVITE_NOT_FOUND': '🔍 Invitation Not Found: This invitation link is invalid or has been removed.',
  'INVITE_REVOKED': '❌ Invitation Revoked: This invitation has been cancelled by the organization admin.',
  'INVITE_ALREADY_REVOKED': '❌ Already Revoked: This invitation has already been cancelled.',
  'INVITE_EXPIRED': '⏰ Invitation Expired: This invitation has passed its expiry date.',
  'INVITE_ALREADY_ACCEPTED': '✅ Already Accepted: This invitation has already been accepted.',
  'INVITE_ALREADY_DECLINED': '❌ Already Declined: This invitation has already been declined.',
  
  // Validation errors
  'INVALID_EMAIL': '📧 Invalid Email: Please enter a valid email address.',
  'VALIDATION_ERROR': '⚠️ Validation Error: Please check your input and try again.',
  
  // Organization errors
  'ORGANIZATION_NOT_FOUND': '🏢 Organization Error: The organization could not be found.',
  'ORG_NOT_FOUND': '🏢 Organization Error: The organization could not be found.',
  'ORG_NAME_EXISTS': 'An organization with this name already exists. Please choose a different name.',
  'INVALID_ORG_NAME': 'Please enter a valid organization name (2-50 characters).',
  'USER_LIMIT_EXCEEDED': 'You have reached the maximum number of organizations allowed.',
  
  // Permission errors
  'INSUFFICIENT_PERMISSIONS': '🚫 Permission Denied: You do not have permission to perform this action.',
  'FORBIDDEN': '🚫 Permission Denied: You do not have permission to perform this action.',
  'ACCESS_DENIED': '🚫 Access Denied: You do not have access to this resource.',
  
  // Authentication errors
  'UNAUTHORIZED': '🔐 Unauthorized: Please sign in to continue.',
  'SESSION_EXPIRED': '🔐 Session Expired: Please sign in again.',
  'EMAIL_MISMATCH': '📧 Email Mismatch: The signed-in email does not match the invitation.',
  
  // Email update errors
  'EMAIL_ALREADY_IN_USE': 'This email address is already in use by another account.',
  'EMAIL_ALREADY_VERIFIED': 'This email address is already verified for your account.',
  
  // General errors
  'NOT_FOUND': '🔍 Not Found: The requested resource could not be found.',
  'CONFLICT': '⚠️ Conflict: This action conflicts with existing data.',
  'RATE_LIMIT_EXCEEDED': '⏱️ Too Many Requests: Please wait a moment before trying again.',
  'SERVER_ERROR': '🔧 Server Error: Something went wrong on our end. Please try again later.',
};

/**
 * Structure of a backend error
 */
interface BackendErrorMessage {
  status?: number;
  code?: string;
  message?: string;
}

/**
 * Structure of Redux rejected error (from rejectWithValue)
 */
interface ReduxRejectedError {
  message?: string | BackendErrorMessage;
  status?: number;
}

/**
 * Extract a user-friendly error message from various error structures.
 * 
 * Handles:
 * 1. Redux rejectWithValue errors: { message: {...object...}, status: number }
 * 2. Axios errors: { response: { data: { message: string | object } } }
 * 3. Standard errors: { message: string }
 * 4. String errors
 * 
 * @param error - The error to extract message from
 * @param fallbackMessage - Default message if extraction fails
 * @returns A user-friendly error message string
 */
export function extractErrorMessage(
  error: unknown,
  fallbackMessage: string = 'An unexpected error occurred. Please try again.'
): string {
  if (!error) {
    return fallbackMessage;
  }

  // Handle string errors
  if (typeof error === 'string') {
    return error;
  }

  // Handle non-object errors
  if (typeof error !== 'object') {
    return fallbackMessage;
  }

  const err = error as Record<string, any>;

  // 1. Handle Redux rejectWithValue structure: { message: {...}, status: number }
  if (err.message !== undefined) {
    const message = err.message;
    
    // If message is an object with code and message (backend structured error)
    if (typeof message === 'object' && message !== null) {
      const backendError = message as BackendErrorMessage;
      
      // Check for error code first
      if (backendError.code && ERROR_CODE_MESSAGES[backendError.code]) {
        return ERROR_CODE_MESSAGES[backendError.code];
      }
      
      // Use the message from backend error object
      if (backendError.message && typeof backendError.message === 'string') {
        return backendError.message;
      }
    }
    
    // If message is a string
    if (typeof message === 'string') {
      return message;
    }
  }

  // 2. Handle Axios error structure: { response: { data: { message: ... } } }
  if (err.response?.data?.message) {
    const backendMessage = err.response.data.message;
    
    // If it's a structured error object
    if (typeof backendMessage === 'object' && backendMessage !== null) {
      const backendError = backendMessage as BackendErrorMessage;
      
      // Check for error code first
      if (backendError.code && ERROR_CODE_MESSAGES[backendError.code]) {
        return ERROR_CODE_MESSAGES[backendError.code];
      }
      
      // Use the message from backend error object
      if (backendError.message && typeof backendError.message === 'string') {
        return backendError.message;
      }
    }
    
    // If it's a string
    if (typeof backendMessage === 'string') {
      return backendMessage;
    }
  }

  // 3. Check for status-based default messages
  const status = err.status || err.response?.status;
  if (status) {
    if (status === 401) return ERROR_CODE_MESSAGES['UNAUTHORIZED'];
    if (status === 403) return ERROR_CODE_MESSAGES['FORBIDDEN'];
    if (status === 404) return ERROR_CODE_MESSAGES['NOT_FOUND'];
    if (status === 409) return ERROR_CODE_MESSAGES['CONFLICT'];
    if (status === 429) return ERROR_CODE_MESSAGES['RATE_LIMIT_EXCEEDED'];
    if (status >= 500) return ERROR_CODE_MESSAGES['SERVER_ERROR'];
  }

  return fallbackMessage;
}

/**
 * Extract error code from various error structures
 * 
 * @param error - The error to extract code from
 * @returns The error code string or null if not found
 */
export function extractErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const err = error as Record<string, any>;

  // Check Redux rejectWithValue structure
  if (err.message && typeof err.message === 'object') {
    const backendError = err.message as BackendErrorMessage;
    if (backendError.code) {
      return backendError.code;
    }
  }

  // Check Axios error structure
  if (err.response?.data?.message && typeof err.response.data.message === 'object') {
    const backendError = err.response.data.message as BackendErrorMessage;
    if (backendError.code) {
      return backendError.code;
    }
  }

  // Check direct code property
  if (err.code && typeof err.code === 'string') {
    return err.code;
  }

  return null;
}

/**
 * Extract HTTP status code from various error structures
 * 
 * @param error - The error to extract status from
 * @returns The HTTP status code or null if not found
 */
export function extractErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const err = error as Record<string, any>;

  // Check direct status property (from rejectWithValue)
  if (typeof err.status === 'number') {
    return err.status;
  }

  // Check Axios response status
  if (typeof err.response?.status === 'number') {
    return err.response.status;
  }

  // Check nested message status
  if (err.message && typeof err.message === 'object') {
    const backendError = err.message as BackendErrorMessage;
    if (typeof backendError.status === 'number') {
      return backendError.status;
    }
  }

  return null;
}

/**
 * Check if an error is of a specific type based on code
 * 
 * @param error - The error to check
 * @param codes - Array of error codes to check against
 * @returns true if the error matches any of the codes
 */
export function isErrorCode(error: unknown, codes: string | string[]): boolean {
  const errorCode = extractErrorCode(error);
  if (!errorCode) return false;
  
  const codeArray = Array.isArray(codes) ? codes : [codes];
  return codeArray.includes(errorCode);
}

/**
 * Check if an error is of a specific HTTP status
 * 
 * @param error - The error to check
 * @param statuses - Array of status codes to check against
 * @returns true if the error matches any of the statuses
 */
export function isErrorStatus(error: unknown, statuses: number | number[]): boolean {
  const errorStatus = extractErrorStatus(error);
  if (!errorStatus) return false;
  
  const statusArray = Array.isArray(statuses) ? statuses : [statuses];
  return statusArray.includes(errorStatus);
}
