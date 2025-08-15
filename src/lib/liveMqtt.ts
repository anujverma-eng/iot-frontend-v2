// src/lib/liveMqtt.ts
import { pubsub } from './amplify';
import { ensureIotPolicyAttached } from './iotPolicy';

// Call this once when user toggles "Live ON" (pass full IDs like "gw_81978fa4")
export async function startLive(gatewayIds: string[]) {
  if (!gatewayIds?.length) throw new Error('No gatewayIds provided');

  // 1) Make sure the IoT policy is attached (idempotent)
  await ensureIotPolicyAttached();

  // 2) Build topics
  const dataTopics = gatewayIds.map(id => `${id}/data`);
  const presenceTopics = gatewayIds.map(id => `$aws/events/presence/+/${id}`);
  const topics = [...dataTopics, ...presenceTopics];

  console.log('[MQTT] Subscribing to topics:', topics);

  // 3) Subscribe
  const sub = pubsub.subscribe({ topics }).subscribe({
    next: (msg) => {
      // Amplify delivers: { topic: string, message: any }
      console.log('[MQTT] message', msg);
    },
    error: (err) => {
      console.error('[MQTT] error', err);
    },
    complete: () => {
      console.log('[MQTT] completed');
    },
  });

  // Return an unsubscribe function for when user toggles "Live OFF"
  return () => {
    try { 
      sub.unsubscribe(); 
      console.log('[MQTT] Unsubscribed from topics:', topics);
    } catch (err) {
      console.error('[MQTT] Error unsubscribing:', err);
    }
  };
}

// Optional: publish a command from UI (e.g. a test ping)
// Example usage: await publishCommand('gw_81978fa4', { type: 'ping', ts: Date.now() })
export async function publishCommand(gatewayId: string, payload: unknown) {
  const topic = `${gatewayId}/command`;
  const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
  await pubsub.publish({ topics: [topic], message: { payload: message } });
  console.log('[MQTT] published', { topic, message });
}
