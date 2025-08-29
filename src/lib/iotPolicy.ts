import http from '../api/http';

export async function ensureIotPolicyAttached() {
  try {
    const response = await http.post('/realtime/attach-policy');
    return response.data;
  } catch (error) {

    throw new Error(`attach-policy failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
