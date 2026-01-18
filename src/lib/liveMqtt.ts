// src/lib/liveMqtt.ts
import { pubsub } from './amplify';
import { ensureIotPolicyAttached } from './iotPolicy';

export interface LiveSensorReading {
  name: string;
  mac: string;
  type: string;
  unit: string;
  value: number;
  timestamp: number; // Added timestamp
  battery?: number; // Battery percentage (0-100), optional
}

export interface LiveDataMessage {
  sensors: LiveSensorReading[];
}

export interface LiveCallbacks {
  onData: (data: LiveDataMessage) => void;
  onPresence: (topic: string, message: any) => void;
  onError: (error: any) => void;
  onConnectionChange: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void;
}

// Global state for connection management
let currentSubscription: any = null;
let isConnecting = false;
let connectionCallbacks: LiveCallbacks | null = null;
let connectionId = 0; // Add unique connection tracking

// Enhanced startLive function with proper error handling and connection management
export async function startLive(
  gatewayIds: string[], 
  callbacks: LiveCallbacks
): Promise<() => void> {
  
  const currentConnectionId = ++connectionId;

  // Prevent duplicate connections
  if (isConnecting) {

    return () => {};
  }

  // If already connected, unsubscribe first
  if (currentSubscription) {

    stopLive();
  }

  if (!gatewayIds?.length) {
    const error = new Error('No gatewayIds provided');

    callbacks.onError(error);
    throw error;
  }

  isConnecting = true;
  connectionCallbacks = callbacks;
  callbacks.onConnectionChange('connecting');

  try {

    // 1) Ensure IoT policy is attached

    try {
      await ensureIotPolicyAttached();

    } catch (policyError: any) {

      throw new Error(`IoT policy attachment failed: ${policyError.message || policyError}`);
    }

    // 2) Build topics for data and presence
    const dataTopics = gatewayIds.map(id => `${id}/data`);
    const presenceTopics = gatewayIds.map(id => `presence/state/${id}`);
    const topics = [...dataTopics, ...presenceTopics];

    // 3) Subscribe with enhanced error handling

    currentSubscription = pubsub.subscribe({ topics }).subscribe({
      next: (msg: any) => {
        try {
          console.log('[MQTT] Raw message received:', JSON.stringify(msg, null, 2));

          // Check if this is already a parsed sensor data message
          if (msg.sensors && Array.isArray(msg.sensors)) {
            console.log('[MQTT] Parsed sensor data:', JSON.stringify(msg.sensors, null, 2));

            const enhancedData: LiveDataMessage = {
              sensors: msg.sensors.map((sensor: any) => ({
                ...sensor,
                timestamp: sensor.timestamp || Date.now()
              }))
            };

            callbacks.onData(enhancedData);
            
            // Mark as connected after first successful message
            if (isConnecting) {

              isConnecting = false;
              callbacks.onConnectionChange('connected');
            }
            return;
          }
          
          // Handle traditional topic-based messages
          // Try to get topic from multiple possible locations
          let topic = msg.topic as string;
          
          // Check if topic is in Symbol(topic) - AWS IoT sometimes uses symbols
          if (!topic && msg[Symbol.for('topic')]) {
            topic = msg[Symbol.for('topic')] as string;
          }
          
          // Check all symbol properties for topic
          if (!topic) {
            const topicSymbol = Object.getOwnPropertySymbols(msg).find(sym => 
              sym.toString().includes('topic')
            );
            if (topicSymbol) {
              topic = msg[topicSymbol] as string;
            }
          }
          
          const message = msg.message || msg;

          if (!topic) {

            const data = parseDataMessage(msg);
            if (data) {

              const enhancedData: LiveDataMessage = {
                sensors: data.sensors.map(sensor => ({
                  ...sensor,
                  timestamp: sensor.timestamp || Date.now()
                }))
              };

              callbacks.onData(enhancedData);
            }
            return;
          }
          
          // Handle different message types
          if (topic.includes('presence/state')) {
            // Presence event - handle the exact format from user's example

            // For presence messages, the data might be directly in the msg object
            // rather than in a nested message property
            let presenceData = message;
            
            // If message is the same as msg, then the presence data is in the root
            if (message === msg || !message) {
              presenceData = msg;
              // Remove Symbol properties before processing
              const cleanPresenceData = { ...presenceData };
              Object.getOwnPropertySymbols(cleanPresenceData).forEach(sym => {
                delete cleanPresenceData[sym];
              });
              presenceData = cleanPresenceData;
            }
            
            // Parse the presence message if it's a string
            if (typeof presenceData === 'string') {
              try {
                presenceData = JSON.parse(presenceData);
              } catch (e) {

                return;
              }
            }
            
            // Handle wrapped payload
            if (presenceData.payload && typeof presenceData.payload === 'string') {
              try {
                presenceData = JSON.parse(presenceData.payload);
              } catch (e) {

                return;
              }
            }

            // Validate presence data has required fields
            if (presenceData && presenceData.gatewayId && typeof presenceData.isConnected === 'boolean') {

              callbacks.onPresence(topic, presenceData);
            } else {

            }
          } else if (topic.endsWith('/data')) {
            // Data event - parse and validate

            const data = parseDataMessage(message);
            if (data) {

              // Add timestamps to readings if not present
              const enhancedData: LiveDataMessage = {
                sensors: data.sensors.map(sensor => ({
                  ...sensor,
                  timestamp: sensor.timestamp || Date.now()
                }))
              };

              callbacks.onData(enhancedData);
            } else {

            }
          } else {

          }

          // Mark as connected after first successful message
          if (isConnecting) {

            isConnecting = false;
            callbacks.onConnectionChange('connected');
          }
        } catch (error) {

          callbacks.onError(error);
        }
      },
      error: (err) => {

        isConnecting = false;
        callbacks.onConnectionChange('error');
        callbacks.onError(err);
        currentSubscription = null;
      },
      complete: () => {

        isConnecting = false;
        callbacks.onConnectionChange('disconnected');
        currentSubscription = null;
      },
    });

    // Simulate connection delay for more realistic UX
    const timeoutId = setTimeout(() => {
      if (isConnecting) {

        isConnecting = false;
        callbacks.onConnectionChange('connected');
      } else {

      }
    }, 1500);

    // Return cleanup function
    return () => {

      clearTimeout(timeoutId);
      // Don't call stopLive() here to avoid immediate disconnection
      // Let the connection persist until explicitly stopped
    };

  } catch (error) {

    isConnecting = false;
    callbacks.onConnectionChange('error');
    callbacks.onError(error);
    throw error;
  }
}

// Clean unsubscribe function
export function stopLive(): void {
  const stopCallId = ++connectionId;

  if (currentSubscription) {
    try {

      currentSubscription.unsubscribe();

    } catch (error) {

    }
    currentSubscription = null;
  }

  if (connectionCallbacks) {

    connectionCallbacks.onConnectionChange('disconnected');
    connectionCallbacks = null;
  }

  isConnecting = false;

}

// Parse and validate incoming data messages
function parseDataMessage(message: any): LiveDataMessage | null {
  try {

    let parsed = message;
    
    // Handle string messages
    if (typeof message === 'string') {

      parsed = JSON.parse(message);
    }

    // Handle wrapped payload
    if (parsed.payload && typeof parsed.payload === 'string') {

      parsed = JSON.parse(parsed.payload);
    }

    // Validate message structure
    if (parsed && parsed.sensors && Array.isArray(parsed.sensors)) {
      console.log('[MQTT] Parsed data received:', JSON.stringify(parsed, null, 2));
      return parsed as LiveDataMessage;
    }

    return null;
  } catch (error) {

    return null;
  }
}

// Get current connection status
export function getConnectionStatus(): 'connecting' | 'connected' | 'disconnected' | 'error' {
  const status = isConnecting ? 'connecting' : (currentSubscription ? 'connected' : 'disconnected');

  return status;
}

// Publish command (enhanced with error handling)
export async function publishCommand(gatewayId: string, payload: unknown): Promise<void> {
  try {

    const topic = `${gatewayId}/command`;
    const message = typeof payload === 'string' ? payload : JSON.stringify(payload);

    await pubsub.publish({ 
      topics: [topic], 
      message: { payload: message } 
    });

  } catch (error) {

    throw error;
  }
}
