// src/api/types.ts
export interface ApiResponse<T> {
  status: number;
  success: boolean;
  message: string;
  data: T | null;
  from: 'iot-backend';
  error: unknown | null;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * Unwraps the backend's enveloped response format
 * @param response The enveloped API response
 * @returns The unwrapped data if successful
 * @throws Error if the response indicates failure
 */
export function unwrapApiResponse<T>(response: ApiResponse<T>): T {
  if (response.success && response.data !== null) {
    return response.data;
  }
  
  // Determine the best error message to throw
  const errorMessage = response.message || 
                      (response.error ? String(response.error) : 'API request failed');
  throw new Error(errorMessage);
}
