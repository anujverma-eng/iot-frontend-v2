// src/lib/amplify.ts
import { Amplify } from 'aws-amplify';
import { Hub } from 'aws-amplify/utils';
import { PubSub } from '@aws-amplify/pubsub';

// 1) Tell Amplify about your existing Cognito pools (you already use your own UI)
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_COGNITO_APP_CLIENT_ID,
      identityPoolId: import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID,
      // no need to configure OAuth here if you're not using Amplify's Hosted UI
    },
  },
});

// 2) Create ONE PubSub instance pointed at your IoT Core WSS endpoint
export const pubsub = new PubSub({
  region: import.meta.env.VITE_COGNITO_REGION, // us-east-1
  endpoint: 'wss://a2r71vab5hezzm-ats.iot.us-east-1.amazonaws.com/mqtt',
});

// 3) Add Hub listener for connection state debugging
Hub.listen('pubsub', (data: any) => {
  const { payload } = data;
  console.log('[MQTT Hub] Event received:', payload.event, 'Data:', payload.data);
  
  if (payload.event === 'connected') {
    console.log('[MQTT Hub] Connected to IoT Core');
  } else if (payload.event === 'disconnected') {
    console.log('[MQTT Hub] Disconnected from IoT Core');
  } else if (payload.event === 'connection_failed') {
    console.error('[MQTT Hub] Connection failed:', payload.data);
  } else {
    console.log('[MQTT Hub] Unknown event:', payload.event);
  }
});
