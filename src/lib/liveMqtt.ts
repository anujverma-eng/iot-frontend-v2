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

console.log('[LiveMQTT] Module initialized');

// Enhanced startLive function with proper error handling and connection management
export async function startLive(
  gatewayIds: string[], 
  callbacks: LiveCallbacks
): Promise<() => void> {
  
  console.log('[LiveMQTT] startLive called with gatewayIds:', gatewayIds);
  console.log('[LiveMQTT] Current connection state - isConnecting:', isConnecting, 'hasSubscription:', !!currentSubscription);
  
  // Prevent duplicate connections
  if (isConnecting) {
    console.warn('[LiveMQTT] Connection already in progress, ignoring duplicate request');
    return () => {};
  }

  // If already connected, unsubscribe first
  if (currentSubscription) {
    console.log('[LiveMQTT] Cleaning up existing connection before starting new one');
    stopLive();
  }

  if (!gatewayIds?.length) {
    const error = new Error('No gatewayIds provided');
    console.error('[LiveMQTT] Error - no gateway IDs provided');
    callbacks.onError(error);
    throw error;
  }

  isConnecting = true;
  connectionCallbacks = callbacks;
  callbacks.onConnectionChange('connecting');
  console.log('[LiveMQTT] Connection state changed to: connecting');

  try {
    console.log('[LiveMQTT] Starting live connection for gateways:', gatewayIds);

    // 1) Ensure IoT policy is attached
    console.log('[LiveMQTT] Ensuring IoT policy is attached...');
    await ensureIotPolicyAttached();
    console.log('[LiveMQTT] IoT policy attachment completed');

    // 2) Build topics for data and presence
    const dataTopics = gatewayIds.map(id => `${id}/data`);
    const presenceTopics = gatewayIds.map(id => `$aws/events/presence/+/${id}`);
    const topics = [...dataTopics, ...presenceTopics];

    console.log('[LiveMQTT] Subscribing to topics:', topics);
    console.log('[LiveMQTT] Data topics:', dataTopics);
    console.log('[LiveMQTT] Presence topics:', presenceTopics);

    // 3) Subscribe with enhanced error handling
    console.log('[LiveMQTT] Creating pubsub subscription...');
    currentSubscription = pubsub.subscribe({ topics }).subscribe({
      next: (msg: any) => {
        try {
          console.log('[LiveMQTT] Raw message received:', JSON.stringify(msg, null, 2));
          
          // Check if this is already a parsed sensor data message
          if (msg.sensors && Array.isArray(msg.sensors)) {
            console.log('[LiveMQTT] Direct sensor data message received');
            const enhancedData: LiveDataMessage = {
              sensors: msg.sensors.map((sensor: any) => ({
                ...sensor,
                timestamp: sensor.timestamp || Date.now()
              }))
            };
            console.log('[LiveMQTT] Enhanced data with timestamps:', JSON.stringify(enhancedData, null, 2));
            callbacks.onData(enhancedData);
            
            // Mark as connected after first successful message
            if (isConnecting) {
              console.log('[LiveMQTT] First message received, marking as connected');
              isConnecting = false;
              callbacks.onConnectionChange('connected');
            }
            return;
          }
          
          // Handle traditional topic-based messages
          const topic = msg.topic as string;
          const message = msg.message;
          
          console.log('[LiveMQTT] Processing message - Topic:', topic, 'Message type:', typeof message);
          
          if (!topic) {
            console.warn('[LiveMQTT] Message received without topic, treating as direct data');
            const data = parseDataMessage(msg);
            if (data) {
              console.log('[LiveMQTT] Parsed topicless message successfully:', JSON.stringify(data, null, 2));
              const enhancedData: LiveDataMessage = {
                sensors: data.sensors.map(sensor => ({
                  ...sensor,
                  timestamp: sensor.timestamp || Date.now()
                }))
              };
              console.log('[LiveMQTT] Enhanced data with timestamps:', JSON.stringify(enhancedData, null, 2));
              callbacks.onData(enhancedData);
            }
            return;
          }
          
          // Handle different message types
          if (topic.includes('$aws/events/presence')) {
            // Presence event
            console.log('[LiveMQTT] Presence event received:', topic, message);
            callbacks.onPresence(topic, message);
          } else if (topic.endsWith('/data')) {
            // Data event - parse and validate
            console.log('[LiveMQTT] Data event received from topic:', topic);
            const data = parseDataMessage(message);
            if (data) {
              console.log('[LiveMQTT] Parsed data message successfully:', JSON.stringify(data, null, 2));
              // Add timestamps to readings if not present
              const enhancedData: LiveDataMessage = {
                sensors: data.sensors.map(sensor => ({
                  ...sensor,
                  timestamp: sensor.timestamp || Date.now()
                }))
              };
              console.log('[LiveMQTT] Enhanced data with timestamps:', JSON.stringify(enhancedData, null, 2));
              callbacks.onData(enhancedData);
            } else {
              console.warn('[LiveMQTT] Failed to parse data message');
            }
          } else {
            console.warn('[LiveMQTT] Unknown message topic:', topic);
          }

          // Mark as connected after first successful message
          if (isConnecting) {
            console.log('[LiveMQTT] First message received, marking as connected');
            isConnecting = false;
            callbacks.onConnectionChange('connected');
          }
        } catch (error) {
          console.error('[LiveMQTT] Error processing message:', error);
          callbacks.onError(error);
        }
      },
      error: (err) => {
        console.error('[LiveMQTT] Connection error:', err);
        isConnecting = false;
        callbacks.onConnectionChange('error');
        callbacks.onError(err);
        currentSubscription = null;
      },
      complete: () => {
        console.log('[LiveMQTT] Connection completed/closed');
        isConnecting = false;
        callbacks.onConnectionChange('disconnected');
        currentSubscription = null;
      },
    });

    console.log('[LiveMQTT] Subscription created successfully');

    // Simulate connection delay for more realistic UX
    setTimeout(() => {
      if (isConnecting) {
        console.log('[LiveMQTT] Connection timeout reached, marking as connected');
        isConnecting = false;
        callbacks.onConnectionChange('connected');
      }
    }, 1500);

    // Return cleanup function
    return stopLive;

  } catch (error) {
    console.error('[LiveMQTT] Failed to start live connection:', error);
    isConnecting = false;
    callbacks.onConnectionChange('error');
    callbacks.onError(error);
    throw error;
  }
}

// Clean unsubscribe function
export function stopLive(): void {
  console.log('[LiveMQTT] stopLive called');
  console.log('[LiveMQTT] Current state - hasSubscription:', !!currentSubscription, 'isConnecting:', isConnecting);
  
  if (currentSubscription) {
    try {
      currentSubscription.unsubscribe();
      console.log('[LiveMQTT] Successfully unsubscribed from MQTT topics');
    } catch (error) {
      console.error('[LiveMQTT] Error during unsubscribe:', error);
    }
    currentSubscription = null;
  }

  if (connectionCallbacks) {
    console.log('[LiveMQTT] Notifying connection change to disconnected');
    connectionCallbacks.onConnectionChange('disconnected');
    connectionCallbacks = null;
  }

  isConnecting = false;
  console.log('[LiveMQTT] stopLive completed');
}

// Parse and validate incoming data messages
function parseDataMessage(message: any): LiveDataMessage | null {
  try {
    console.log('[LiveMQTT] parseDataMessage called with:', typeof message, message);
    
    let parsed = message;
    
    // Handle string messages
    if (typeof message === 'string') {
      console.log('[LiveMQTT] Parsing string message...');
      parsed = JSON.parse(message);
    }

    // Handle wrapped payload
    if (parsed.payload && typeof parsed.payload === 'string') {
      console.log('[LiveMQTT] Found wrapped payload, parsing...');
      parsed = JSON.parse(parsed.payload);
    }

    console.log('[LiveMQTT] Parsed message:', JSON.stringify(parsed, null, 2));

    // Validate message structure
    if (parsed && parsed.sensors && Array.isArray(parsed.sensors)) {
      console.log('[LiveMQTT] Message validation successful - found', parsed.sensors.length, 'sensors');
      return parsed as LiveDataMessage;
    }

    console.warn('[LiveMQTT] Invalid data message format - missing sensors array:', parsed);
    return null;
  } catch (error) {
    console.error('[LiveMQTT] Error parsing data message:', error);
    return null;
  }
}

// Get current connection status
export function getConnectionStatus(): 'connecting' | 'connected' | 'disconnected' | 'error' {
  const status = isConnecting ? 'connecting' : (currentSubscription ? 'connected' : 'disconnected');
  console.log('[LiveMQTT] getConnectionStatus called, returning:', status);
  return status;
}

// Publish command (enhanced with error handling)
export async function publishCommand(gatewayId: string, payload: unknown): Promise<void> {
  try {
    console.log('[LiveMQTT] publishCommand called with gatewayId:', gatewayId, 'payload:', payload);
    
    const topic = `${gatewayId}/command`;
    const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
    
    console.log('[LiveMQTT] Publishing to topic:', topic, 'message:', message);
    
    await pubsub.publish({ 
      topics: [topic], 
      message: { payload: message } 
    });
    
    console.log('[LiveMQTT] Command published successfully:', { topic, payload });
  } catch (error) {
    console.error('[LiveMQTT] Failed to publish command:', error);
    throw error;
  }
}
