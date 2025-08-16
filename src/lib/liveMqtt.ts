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

console.log('[LiveMQTT] Module initialized');

// Enhanced startLive function with proper error handling and connection management
export async function startLive(
  gatewayIds: string[], 
  callbacks: LiveCallbacks
): Promise<() => void> {
  
  const currentConnectionId = ++connectionId;
  console.log(`[LiveMQTT:${currentConnectionId}] startLive called with gatewayIds:`, gatewayIds);
  console.log(`[LiveMQTT:${currentConnectionId}] Current connection state - isConnecting:`, isConnecting, 'hasSubscription:', !!currentSubscription);
  
  // Prevent duplicate connections
  if (isConnecting) {
    console.warn(`[LiveMQTT:${currentConnectionId}] Connection already in progress, ignoring duplicate request`);
    return () => {};
  }

  // If already connected, unsubscribe first
  if (currentSubscription) {
    console.log(`[LiveMQTT:${currentConnectionId}] Cleaning up existing connection before starting new one`);
    stopLive();
  }

  if (!gatewayIds?.length) {
    const error = new Error('No gatewayIds provided');
    console.error(`[LiveMQTT:${currentConnectionId}] Error - no gateway IDs provided`);
    callbacks.onError(error);
    throw error;
  }

  isConnecting = true;
  connectionCallbacks = callbacks;
  callbacks.onConnectionChange('connecting');
  console.log(`[LiveMQTT:${currentConnectionId}] Connection state changed to: connecting`);

  try {
    console.log(`[LiveMQTT:${currentConnectionId}] Starting live connection for gateways:`, gatewayIds);

    // 1) Ensure IoT policy is attached
    console.log(`[LiveMQTT:${currentConnectionId}] Ensuring IoT policy is attached...`);
    try {
      await ensureIotPolicyAttached();
      console.log(`[LiveMQTT:${currentConnectionId}] IoT policy attachment completed successfully`);
    } catch (policyError: any) {
      console.error(`[LiveMQTT:${currentConnectionId}] IoT policy attachment failed:`, policyError);
      throw new Error(`IoT policy attachment failed: ${policyError.message || policyError}`);
    }

    // 2) Build topics for data and presence
    const dataTopics = gatewayIds.map(id => `${id}/data`);
    const presenceTopics = gatewayIds.map(id => `presence/state/${id}`);
    const topics = [...dataTopics, ...presenceTopics];

    console.log(`[LiveMQTT:${currentConnectionId}] Subscribing to topics:`, topics);
    console.log(`[LiveMQTT:${currentConnectionId}] Data topics:`, dataTopics);
    console.log(`[LiveMQTT:${currentConnectionId}] Presence topics:`, presenceTopics);

    // 3) Subscribe with enhanced error handling
    console.log(`[LiveMQTT:${currentConnectionId}] Creating pubsub subscription...`);
    currentSubscription = pubsub.subscribe({ topics }).subscribe({
      next: (msg: any) => {
        try {
          console.log(`[LiveMQTT:${currentConnectionId}] Raw message received:`, JSON.stringify(msg, null, 2));
          
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
          if (topic.includes('presence/state')) {
            // Presence event - handle the exact format from user's example
            console.log('[LiveMQTT] Presence event received:', topic, 'Full message object:', msg);
            
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
                console.warn('[LiveMQTT] Failed to parse presence message:', e);
                return;
              }
            }
            
            // Handle wrapped payload
            if (presenceData.payload && typeof presenceData.payload === 'string') {
              try {
                presenceData = JSON.parse(presenceData.payload);
              } catch (e) {
                console.warn('[LiveMQTT] Failed to parse presence payload:', e);
                return;
              }
            }
            
            console.log('[LiveMQTT] Parsed presence data:', presenceData);
            
            // Validate presence data has required fields
            if (presenceData && presenceData.gatewayId && typeof presenceData.isConnected === 'boolean') {
              console.log('[LiveMQTT] Valid presence data, calling onPresence callback');
              callbacks.onPresence(topic, presenceData);
            } else {
              console.warn('[LiveMQTT] Invalid presence data format:', presenceData);
            }
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
            console.log(`[LiveMQTT:${currentConnectionId}] First message received, marking as connected`);
            isConnecting = false;
            callbacks.onConnectionChange('connected');
          }
        } catch (error) {
          console.error(`[LiveMQTT:${currentConnectionId}] Error processing message:`, error);
          callbacks.onError(error);
        }
      },
      error: (err) => {
        console.error(`[LiveMQTT:${currentConnectionId}] Connection error:`, err);
        isConnecting = false;
        callbacks.onConnectionChange('error');
        callbacks.onError(err);
        currentSubscription = null;
      },
      complete: () => {
        console.log(`[LiveMQTT:${currentConnectionId}] Connection completed/closed`);
        isConnecting = false;
        callbacks.onConnectionChange('disconnected');
        currentSubscription = null;
      },
    });

    console.log(`[LiveMQTT:${currentConnectionId}] Subscription created successfully`);

    // Simulate connection delay for more realistic UX
    const timeoutId = setTimeout(() => {
      if (isConnecting) {
        console.log(`[LiveMQTT:${currentConnectionId}] Connection timeout reached, marking as connected`);
        isConnecting = false;
        callbacks.onConnectionChange('connected');
      } else {
        console.log(`[LiveMQTT:${currentConnectionId}] Connection timeout reached but already connected/disconnected`);
      }
    }, 1500);

    // Return cleanup function
    return () => {
      console.log(`[LiveMQTT:${currentConnectionId}] Cleanup function called - only clearing timeout`);
      clearTimeout(timeoutId);
      // Don't call stopLive() here to avoid immediate disconnection
      // Let the connection persist until explicitly stopped
    };

  } catch (error) {
    console.error(`[LiveMQTT:${currentConnectionId}] Failed to start live connection:`, error);
    isConnecting = false;
    callbacks.onConnectionChange('error');
    callbacks.onError(error);
    throw error;
  }
}

// Clean unsubscribe function
export function stopLive(): void {
  const stopCallId = ++connectionId;
  console.log(`[LiveMQTT:${stopCallId}] stopLive called`);
  console.log(`[LiveMQTT:${stopCallId}] Current state - hasSubscription:`, !!currentSubscription, 'isConnecting:', isConnecting);
  
  if (currentSubscription) {
    try {
      console.log(`[LiveMQTT:${stopCallId}] Unsubscribing from MQTT topics...`);
      currentSubscription.unsubscribe();
      console.log(`[LiveMQTT:${stopCallId}] Successfully unsubscribed from MQTT topics`);
    } catch (error) {
      console.error(`[LiveMQTT:${stopCallId}] Error during unsubscribe:`, error);
    }
    currentSubscription = null;
  }

  if (connectionCallbacks) {
    console.log(`[LiveMQTT:${stopCallId}] Notifying connection change to disconnected`);
    connectionCallbacks.onConnectionChange('disconnected');
    connectionCallbacks = null;
  }

  isConnecting = false;
  console.log(`[LiveMQTT:${stopCallId}] stopLive completed`);
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
