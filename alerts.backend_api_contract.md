# IoT Platform - Frontend API Documentation

## Base URL
```
http://localhost:3000/api
```

## Authentication
All endpoints require JWT token in Authorization header:
```
Authorization: Bearer <JWT_TOKEN>
```

---

## Table of Contents
1. [Alert Management APIs](#alert-management-apis)
2. [Notification APIs](#notification-apis)
3. [Gateway APIs](#gateway-apis)
4. [Sensor APIs](#sensor-apis)
5. [Error Responses](#error-responses)

---

# Alert Management APIs

## 1. Create Alert Rule
**Endpoint:** `POST /:orgId/alerts`  
**Auth Required:** Yes (OrgContextGuard)  
**Description:** Create a new alert rule.

### Alert Types
- `DEVICE_ONLINE` (Gateway-based) → requires `deviceId` (gateway ID)
- `DEVICE_OFFLINE` (Gateway-based) → requires `deviceId` (gateway ID)
- `LOW_BATTERY` (Sensor-based) → requires `deviceId` (sensor MAC)
- `DEVICE_OUT_OF_TOLERANCE` (Sensor-based) → requires `deviceId` (sensor MAC) and `condition`

### Request Examples

#### DEVICE_ONLINE / DEVICE_OFFLINE (Gateway)
```json
{
  "name": "Gateway Online Alert",
  "alertType": "DEVICE_ONLINE",
  "deviceId": "GW-001",
  "channels": {
    "email": { "enabled": true, "addresses": ["ops@example.com"] },
    "sms": { "enabled": true, "phoneNumbers": ["+1234567890"] }
  },
  "throttleMinutes": 10,
  "enabled": true
}
```

#### LOW_BATTERY (Sensor)
```json
{
  "name": "Low Battery Alert",
  "alertType": "LOW_BATTERY",
  "deviceId": "sensor_mac_1",
  "condition": { "operator": "lt", "value": 20 },
  "channels": { "email": { "enabled": true, "addresses": ["team@example.com"] } },
  "throttleMinutes": 30,
  "enabled": true
}
```

#### DEVICE_OUT_OF_TOLERANCE (Sensor)
```json
{
  "name": "Temperature Out of Range",
  "alertType": "DEVICE_OUT_OF_TOLERANCE",
  "deviceId": "sensor_mac_1",
  "condition": { "operator": "between", "value": 18, "value2": 28 },
  "channels": { "sms": { "enabled": true, "phoneNumbers": ["+19876543210"] } },
  "throttleMinutes": 10,
  "enabled": true
}
```

### Success Response (201 Created)
```json
{
  "status": 201,
  "success": true,
  "message": "Operation successful",
  "from": "iot-backend",
  "error": null,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "orgId": "507f1f77bcf86cd799439001",
    "name": "Temperature Alert",
    "alertType": "DEVICE_OUT_OF_TOLERANCE",
    "deviceId": "sensor_mac_1",
    "displayName": "Room Temperature Sensor",
    "condition": {
      "operator": "gt",
      "value": 30
    },
    "channels": {
      "email": {
        "enabled": true,
        "addresses": ["alert@example.com", "team@example.com"]
      },
      "sms": {
        "enabled": true,
        "phoneNumbers": ["+1234567890", "+0987654321"]
      }
    },
    "throttleMinutes": 10,
    "enabled": true,
    "createdBy": "507f1f77bcf86cd799439021",
    "triggerCount": 0,
    "createdAt": "2025-12-19T10:30:00.000Z",
    "updatedAt": "2025-12-19T10:30:00.000Z"
  }
}
```

### Error Responses

**Missing alertType (400 Bad Request)**
```json
{
  "status": 400,
  "success": false,
  "message": "Operation failed",
  "from": "iot-backend",
  "error": {
    "statusCode": 400,
    "message": "alertType should not be empty",
    "error": "Bad Request"
  },
  "data": null
}
```

**Missing deviceId (400 Bad Request)**
```json
{
  "status": 400,
  "success": false,
  "message": "Operation failed",
  "from": "iot-backend",
  "error": {
    "statusCode": 400,
    "message": "deviceId should not be empty",
    "error": "Bad Request"
  },
  "data": null
}
```

**Gateway not found (404 Not Found)**
```json
{
  "status": 404,
  "success": false,
  "message": "Operation failed",
  "from": "iot-backend",
  "error": {
    "statusCode": 404,
    "message": "Gateway not found",
    "error": "Not Found"
  },
  "data": null
}
```

**Invalid condition (400 Bad Request)**
```json
{
  "status": 400,
  "success": false,
  "message": "Operation failed",
  "from": "iot-backend",
  "error": {
    "statusCode": 400,
    "message": "value2 is required for \"between\" operator",
    "error": "BadRequest"
  },
  "data": null
}
```

**Sensor not found (400 Bad Request)**
```json
{
  "status": 400,
  "success": false,
  "message": "Operation failed",
  "from": "iot-backend",
  "error": {
    "statusCode": 400,
    "message": "One or more sensors not found",
    "error": "BadRequest"
  },
  "data": null
}
```

**Sensor belongs to different org (403 Forbidden)**
```json
{
  "status": 403,
  "success": false,
  "message": "Operation failed",
  "from": "iot-backend",
  "error": {
    "statusCode": 403,
    "message": "One or more sensors do not belong to your organization",
    "error": "Forbidden"
  },
  "data": null
}
```

**No notification channels enabled (400 Bad Request)**
```json
{
  "status": 400,
  "success": false,
  "message": "Operation failed",
  "from": "iot-backend",
  "error": {
    "statusCode": 400,
    "message": "At least one notification channel (email or SMS) must be enabled",
    "error": "BadRequest"
  },
  "data": null
}
```

### Validation Rules
- **name**: Required string
- **deviceId**: Required string (sensor MAC or gateway ID)
- **alertType**: Required enum (`DEVICE_ONLINE`, `DEVICE_OFFLINE`, `LOW_BATTERY`, `DEVICE_OUT_OF_TOLERANCE`)
- **condition**: Required for sensor-based alerts; optional for gateway-based
- **condition.operator**: One of `gt`, `lt`, `eq`, `gte`, `lte`, `between`
- **condition.value2**: Required only if operator is `between`
- **channels.email.addresses**: Max 10 emails
- **channels.sms.phoneNumbers**: Max 5 E.164 phone numbers
- **throttleMinutes**: 5-60 (default: 10)
- **enabled**: Optional (default: true)
- **displayName**: Auto-populated from sensor.displayName or gateway.label (fallback to deviceId)

---

## 2. List Alert Rules (Paginated)
**Endpoint:** `GET /:orgId/alerts?page=1&limit=20&enabled=true&deviceId=sensor_mac`  
**Auth Required:** Yes  
**Description:** Get all alert rules for organization with pagination and filters

### Query Parameters
```
page:      number (default: 1, min: 1)
limit:     number (default: 20, min: 1, max: 100)
enabled:   boolean (optional, filter by enabled status)
deviceId:  string (optional, filter by device - sensor MAC or gateway ID)
```

### Success Response (200 OK)
```json
{
  "status": 200,
  "success": true,
  "message": "Operation successful",
  "from": "iot-backend",
  "error": null,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "orgId": "507f1f77bcf86cd799439001",
      "name": "Temperature Alert",
      "alertType": "DEVICE_OUT_OF_TOLERANCE",
      "deviceId": "sensor_mac_1",
      "displayName": "Room Temperature Sensor",
      "condition": {
        "operator": "gt",
        "value": 30
      },
      "channels": {
        "email": {
          "enabled": true,
          "addresses": ["alert@example.com"]
        }
      },
      "throttleMinutes": 10,
      "enabled": true,
      "triggerCount": 5,
      "createdAt": "2025-12-19T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

### Error Responses

**Unauthorized (401)**
```json
{
  "status": 401,
  "success": false,
  "message": "Operation failed",
  "from": "iot-backend",
  "error": {
    "statusCode": 401,
    "message": "Unauthorized",
    "error": "Unauthorized"
  },
  "data": null
}
```

**Organization not found (404)**
```json
{
  "status": 404,
  "success": false,
  "message": "Operation failed",
  "from": "iot-backend",
  "error": {
    "statusCode": 404,
    "message": "Organization not found",
    "error": "Not Found"
  },
  "data": null
}
```

---

## 3. Get Alert Statistics
**Endpoint:** `GET /:orgId/alerts/stats`  
**Auth Required:** Yes  
**Description:** Get dashboard statistics for alerts

### Success Response (200 OK)
```json
{
  "status": 200,
  "success": true,
  "message": "Operation successful",
  "from": "iot-backend",
  "error": null,
  "data": {
    "totalRules": 15,
    "activeRules": 12,
    "triggersLast24Hours": 8,
    "triggersLast7Days": 42,
    "unacknowledgedAlerts": 3
  }
}
```

### Error Responses

**Unauthorized (401)**
```json
{
  "status": 401,
  "success": false,
  "message": "Operation failed",
  "from": "iot-backend",
  "error": {
    "statusCode": 401,
    "message": "Unauthorized",
    "error": "Unauthorized"
  },
  "data": null
}
```

---

## 4. Get Alert History (Paginated)
**Endpoint:** `GET /:orgId/alerts/history?page=1&limit=20&ruleId=...&sensorId=...&acknowledged=false`  
**Auth Required:** Yes  
**Description:** Get history of triggered alerts with pagination

### Query Parameters
```
page:          number (default: 1)
limit:         number (default: 20, max: 100)
ruleId:        string (optional, filter by alert rule)
sensorId:      string (optional, filter by sensor)
acknowledged:  boolean (optional, filter by acknowledgment status)
```

### Success Response (200 OK)
```json
{
  "status": 200,
  "success": true,
  "message": "Operation successful",
  "from": "iot-backend",
  "error": null,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439012",
      "ruleId": {
        "_id": "507f1f77bcf86cd799439011",
        "name": "Temperature Alert"
      },
      "orgId": "507f1f77bcf86cd799439001",
      "alertType": "DEVICE_OUT_OF_TOLERANCE",
      "deviceId": "sensor_mac_1",
      "displayName": "Room Temperature Sensor",
      "triggerTime": "2025-12-19T10:45:00.000Z",
      "sensorValue": 32.5,
      "notifications": [
        {
          "channel": "email",
          "recipient": "alert@example.com",
          "success": true,
          "timestamp": "2025-12-19T10:45:00.100Z"
        },
        {
          "channel": "sms",
          "recipient": "+1234567890",
          "success": true,
          "timestamp": "2025-12-19T10:45:00.200Z"
        }
      ],
      "acknowledged": false,
      "acknowledgedBy": null,
      "acknowledgedAt": null,
      "createdAt": "2025-12-19T10:45:00.000Z"
    },
    {
      "_id": "507f1f77bcf86cd799439099",
      "ruleId": "507f1f77bcf86cd799439098",
      "orgId": "507f1f77bcf86cd799439001",
      "alertType": "DEVICE_OFFLINE",
      "deviceId": "GW-001",
      "displayName": "Main Gateway",
      "triggerTime": "2025-12-19T11:00:00.000Z",
      "notifications": [
        { "channel": "email", "recipient": "ops@example.com", "success": true, "timestamp": "2025-12-19T11:00:00.200Z" }
      ],
      "acknowledged": true,
      "acknowledgedBy": "507f1f77bcf86cd799439021",
      "acknowledgedAt": "2025-12-19T11:05:00.000Z",
      "createdAt": "2025-12-19T11:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 127,
    "pages": 7
  }
}
```

---

## 5. Get Single Alert Rule
**Endpoint:** `GET /:orgId/alerts/:id`  
**Auth Required:** Yes  
**Description:** Get details of a specific alert rule

### Success Response (200 OK)
```json
{
  "status": 200,
  "success": true,
  "message": "Operation successful",
  "from": "iot-backend",
  "error": null,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "orgId": "507f1f77bcf86cd799439001",
    "name": "Temperature Alert",
    "alertType": "DEVICE_OUT_OF_TOLERANCE",
    "deviceId": "sensor_mac_1",
    "displayName": "Room Temperature Sensor",
    "condition": {
      "operator": "gt",
      "value": 30
    },
    "channels": {
      "email": {
        "enabled": true,
        "addresses": ["alert@example.com"]
      },
      "sms": {
        "enabled": true,
        "phoneNumbers": ["+1234567890"]
      }
    },
    "throttleMinutes": 10,
    "enabled": true,
    "createdBy": "507f1f77bcf86cd799439021",
    "triggerCount": 5,
    "lastTriggeredAt": "2025-12-19T10:45:00.000Z",
    "createdAt": "2025-12-19T10:30:00.000Z",
    "updatedAt": "2025-12-19T10:30:00.000Z"
  }
}
```

### Error Responses

**Unauthorized (401)**
```json
{
  "status": 401,
  "success": false,
  "message": "Operation failed",
  "from": "iot-backend",
  "error": {
    "statusCode": 401,
    "message": "Unauthorized",
    "error": "Unauthorized"
  },
  "data": null
}
```

**Alert rule not found (404)**
```json
{
  "status": 404,
  "success": false,
  "message": "Operation failed",
  "from": "iot-backend",
  "error": {
    "statusCode": 404,
    "message": "Alert rule not found",
    "error": "Not Found"
  },
  "data": null
}
```

---

## 6. Update Alert Rule
**Endpoint:** `PATCH /:orgId/alerts/:id`  
**Auth Required:** Yes  
**Description:** Update an existing alert rule

### Request (All fields optional)
```json
{
  "name": "Updated Temperature Alert",
  "deviceId": "sensor_mac_1",
  "condition": {
    "operator": "gte",
    "value": 28
  },
  "channels": {
    "email": {
      "enabled": true,
      "addresses": ["newalert@example.com"]
    }
  },
  "throttleMinutes": 15,
  "enabled": true
}
```

### Success Response (200 OK)
```json
{
  "status": 200,
  "success": true,
  "message": "Operation successful",
  "from": "iot-backend",
  "error": null,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "orgId": "507f1f77bcf86cd799439001",
    "name": "Updated Temperature Alert",
    "alertType": "DEVICE_OUT_OF_TOLERANCE",
    "deviceId": "sensor_mac_1",
    "displayName": "Room Temperature Sensor",
    "condition": {
      "operator": "gte",
      "value": 28
    },
    "channels": {
      "email": {
        "enabled": true,
        "addresses": ["newalert@example.com"]
      }
    },
    "throttleMinutes": 15,
    "enabled": true,
    "createdBy": "507f1f77bcf86cd799439021",
    "triggerCount": 5,
    "createdAt": "2025-12-19T10:30:00.000Z",
    "updatedAt": "2025-12-19T11:30:00.000Z"
  }
}
```

### Error Responses

**Unauthorized (401)**
```json
{
  "status": 401,
  "success": false,
  "message": "Operation failed",
  "from": "iot-backend",
  "error": {
    "statusCode": 401,
    "message": "Unauthorized",
    "error": "Unauthorized"
  },
  "data": null
}
```

**Alert rule not found (404)**
```json
{
  "status": 404,
  "success": false,
  "message": "Operation failed",
  "from": "iot-backend",
  "error": {
    "statusCode": 404,
    "message": "Alert rule not found",
    "error": "Not Found"
  },
  "data": null
}
```

**Invalid sensor (400)**
```json
{
  "status": 400,
  "success": false,
  "message": "Operation failed",
  "from": "iot-backend",
  "error": {
    "statusCode": 400,
    "message": "One or more sensors not found",
    "error": "BadRequest"
  },
  "data": null
}

## 7. Toggle Alert Rule Status
**Endpoint:** `PATCH /:orgId/alerts/:id/toggle`  
**Auth Required:** Yes  
**Description:** Enable or disable an alert rule

### Request
```json
{
  "enabled": false
}
```

### Success Response (200 OK)
```json
{
  "status": 200,
  "success": true,
  "message": "Operation successful",
  "from": "iot-backend",
  "error": null,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "orgId": "507f1f77bcf86cd799439001",
    "name": "Temperature Alert",
    "alertType": "DEVICE_OUT_OF_TOLERANCE",
    "deviceId": "sensor_mac_1",
    "displayName": "Room Temperature Sensor",
    "condition": {
      "operator": "gt",
      "value": 30
    },
    "channels": {
      "email": { "enabled": true, "addresses": ["alert@example.com"] },
      "sms": { "enabled": true, "phoneNumbers": ["+1234567890"] }
    },
    "throttleMinutes": 10,
    "enabled": false,
    "createdBy": "507f1f77bcf86cd799439021",
    "triggerCount": 5,
    "updatedAt": "2025-12-19T11:45:00.000Z"
  }
}
```

### Error Responses

**Unauthorized (401)**
```json
{
  "status": 401,
  "success": false,
  "message": "Operation failed",
  "from": "iot-backend",
  "error": {
    "statusCode": 401,
    "message": "Unauthorized",
    "error": "Unauthorized"
  },
  "data": null
}
```

**Not found (404)**
```json
{
  "status": 404,
  "success": false,
  "message": "Operation failed",
  "from": "iot-backend",
  "error": {
    "statusCode": 404,
    "message": "Alert rule not found",
    "error": "Not Found"
  },
  "data": null
}
```

## 8. Delete Alert Rule
**Endpoint:** `DELETE /:orgId/alerts/:id`  
**Auth Required:** Yes  
**Description:** Delete an alert rule

### Success Response (204 No Content)
```json
{
  "status": 204,
  "success": true,
  "message": "Operation successful",
  "from": "iot-backend",
  "error": null,
  "data": null
}
```

### Error Responses

**Unauthorized (401)**
```json
{
  "status": 401,
  "success": false,
  "message": "Operation failed",
  "from": "iot-backend",
  "error": {
    "statusCode": 401,
    "message": "Unauthorized",
    "error": "Unauthorized"
  },
  "data": null
}
```

**Not found (404)**
```json
{
  "status": 404,
  "success": false,
  "message": "Operation failed",
  "from": "iot-backend",
  "error": {
    "statusCode": 404,
    "message": "Alert rule not found",
    "error": "Not Found"
  },
  "data": null
}
```

## 9. Acknowledge Alert History
**Endpoint:** `PATCH /:orgId/alerts/history/:historyId/acknowledge`  
**Auth Required:** Yes  
**Description:** Mark a triggered alert as acknowledged/reviewed

### Success Response (200 OK)
```json
{
  "status": 200,
  "success": true,
  "message": "Operation successful",
  "from": "iot-backend",
  "error": null,
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "ruleId": "507f1f77bcf86cd799439011",
    "orgId": "507f1f77bcf86cd799439001",
    "alertType": "DEVICE_OUT_OF_TOLERANCE",
    "sensorId": "sensor_mac_1",
    "triggerTime": "2025-12-19T10:45:00.000Z",
    "sensorValue": 32.5,
    "metric": "temperature",
    "notifications": [
      {
        "channel": "email",
        "recipient": "alert@example.com",
        "success": true,
        "timestamp": "2025-12-19T10:45:00.100Z"
      }
    ],
    "acknowledged": true,
    "acknowledgedBy": "507f1f77bcf86cd799439021",
    "acknowledgedAt": "2025-12-19T11:00:00.000Z",
    "createdAt": "2025-12-19T10:45:00.000Z"
  }
}
```

### Error Responses

**Unauthorized (401)**
```json
{
  "status": 401,
  "success": false,
  "message": "Operation failed",
  "from": "iot-backend",
  "error": {
    "statusCode": 401,
    "message": "Unauthorized",
    "error": "Unauthorized"
  },
  "data": null
}
```

**Not found (404)**
```json
{
  "status": 404,
  "success": false,
  "message": "Operation failed",
  "from": "iot-backend",
  "error": {
    "statusCode": 404,
    "message": "Alert history not found",
    "error": "Not Found"
  },
  "data": null
}
```

# Notification APIs

## 1. Get Notification History (Paginated)
**Endpoint:** `GET /:orgId/notifications/history?page=1&limit=20&read=false`  
**Auth Required:** Yes  
**Description:** Get all notifications with pagination and filters

### Query Parameters
```
page:   number (default: 1, min: 1)
limit:  number (default: 20, min: 1, max: 100)
read:   boolean (optional, filter by read status)
```

### Success Response (200 OK)
```json
{
  "status": 200,
  "success": true,
  "message": "Operation successful",
  "from": "iot-backend",
  "error": null,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439031",
      "orgId": "507f1f77bcf86cd799439001",
      "recipientUserId": {
        "_id": "507f1f77bcf86cd799439021",
        "email": "user@example.com",
        "name": "John Doe"
      },
      "kind": "quota",
      "message": "You have used 80% of your monthly quota",
      "read": false,
      "createdAt": "2025-12-19T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 85,
    "pages": 5
  }
}
```

### Error Responses

**Unauthorized (401)**
```json
{
  "status": 401,
  "success": false,
  "message": "Operation failed",
  "from": "iot-backend",
  "error": {
    "statusCode": 401,
    "message": "Unauthorized",
    "error": "Unauthorized"
  },
  "data": null
}
```

## 2. Get Recent Notifications
**Endpoint:** `GET /:orgId/notifications/recent?limit=5`  
**Auth Required:** Yes  
**Description:** Get the last N notifications (quick access for dashboard)

### Query Parameters
```
limit:  number (default: 5, min: 1, max: 50)
```

### Response (200 OK)
```json
{
  "data": [
    {
      "_id": "507f1f77bcf86cd799439031",
      "orgId": "507f1f77bcf86cd799439001",
      "recipientUserId": {
        "_id": "507f1f77bcf86cd799439021",
        "email": "user@example.com",
        "name": "John Doe"
      },
      "kind": "quota",
      "message": "You have used 80% of your monthly quota",
      "read": false,
      "createdAt": "2025-12-19T10:30:00.000Z"
    },
    {
      "_id": "507f1f77bcf86cd799439032",
      "orgId": "507f1f77bcf86cd799439001",
      "recipientUserId": {
        "_id": "507f1f77bcf86cd799439021",
        "email": "user@example.com",
        "name": "John Doe"
      },
      "kind": "system",
      "message": "Gateway GW-001 is offline",
      "read": true,
      "createdAt": "2025-12-19T09:15:00.000Z"
    }
  ],
  "count": 2
}
```

### Success Response (200 OK)
```json
{
  "status": 200,
  "success": true,
  "message": "Operation successful",
  "from": "iot-backend",
  "error": null,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439031",
      "orgId": "507f1f77bcf86cd799439001",
      "recipientUserId": {
        "_id": "507f1f77bcf86cd799439021",
        "email": "user@example.com",
        "name": "John Doe"
      },
      "kind": "quota",
      "message": "You have used 80% of your monthly quota",
      "read": false,
      "createdAt": "2025-12-19T10:30:00.000Z"
    },
    {
      "_id": "507f1f77bcf86cd799439032",
      "orgId": "507f1f77bcf86cd799439001",
      "recipientUserId": {
        "_id": "507f1f77bcf86cd799439021",
        "email": "user@example.com",
        "name": "John Doe"
      },
      "kind": "system",
      "message": "Gateway GW-001 is offline",
      "read": true,
      "createdAt": "2025-12-19T09:15:00.000Z"
    }
  ]
}
```

### Error Responses

**Unauthorized (401)**
```json
{
  "status": 401,
  "success": false,
  "message": "Operation failed",
  "from": "iot-backend",
  "error": {
    "statusCode": 401,
    "message": "Unauthorized",
    "error": "Unauthorized"
  },
  "data": null
}
```

---

## 3. Get Unread Count
**Endpoint:** `GET /:orgId/notifications/unread-count`  
**Auth Required:** Yes  
**Description:** Get count of unread notifications (for badge in UI)

## 3. Get Unread Count
**Endpoint:** `GET /:orgId/notifications/unread-count`  
**Auth Required:** Yes  
**Description:** Get count of unread notifications (for badge in UI)

### Success Response (200 OK)
```json
{
  "status": 200,
  "success": true,
  "message": "Operation successful",
  "from": "iot-backend",
  "error": null,
  "data": {
    "unreadCount": 7
  }
}
```

### Error Responses

**Unauthorized (401)**
```json
{
  "status": 401,
  "success": false,
  "message": "Operation failed",
  "from": "iot-backend",
  "error": {
    "statusCode": 401,
    "message": "Unauthorized",
    "error": "Unauthorized"
  },
  "data": null
}
```

---

## 4. Mark Notification as Read
**Endpoint:** `PATCH /:orgId/notifications/:id/read`  
**Auth Required:** Yes  
**Description:** Mark a single notification as read

### Success Response (200 OK)
```json
{
  "status": 200,
  "success": true,
  "message": "Operation successful",
  "from": "iot-backend",
  "error": null,
  "data": {
    "_id": "507f1f77bcf86cd799439031",
    "orgId": "507f1f77bcf86cd799439001",
    "recipientUserId": {
      "_id": "507f1f77bcf86cd799439021",
      "email": "user@example.com",
      "name": "John Doe"
    },
    "kind": "quota",
    "message": "You have used 80% of your monthly quota",
    "read": true,
    "createdAt": "2025-12-19T10:30:00.000Z",
    "readAt": "2025-12-19T11:45:00.000Z"
  }
}
```

### Error Responses

**Unauthorized (401)**
```json
{
  "status": 401,
  "success": false,
  "message": "Operation failed",
  "from": "iot-backend",
  "error": {
    "statusCode": 401,
    "message": "Unauthorized",
    "error": "Unauthorized"
  },
  "data": null
}
```

**Notification not found (404)**
```json
{
  "status": 404,
  "success": false,
  "message": "Operation failed",
  "from": "iot-backend",
  "error": {
    "statusCode": 404,
    "message": "Notification not found",
    "error": "Not Found"
  },
  "data": null
}
```

## 5. Mark All Notifications as Read
**Endpoint:** `POST /:orgId/notifications/mark-all-read`  
**Auth Required:** Yes  
**Description:** Mark all unread notifications as read in one call

### Success Response (200 OK)
```json
{
  "status": 200,
  "success": true,
  "message": "Operation successful",
  "from": "iot-backend",
  "error": null,
  "data": {
    "modifiedCount": 5
  }
}
```

### Error Responses

**Unauthorized (401)**
```json
{
  "status": 401,
  "success": false,
  "message": "Operation failed",
  "from": "iot-backend",
  "error": {
    "statusCode": 401,
    "message": "Unauthorized",
    "error": "Unauthorized"
  },
  "data": null
}
```

# Gateway APIs

## 1. Register Gateway
**Endpoint:** `POST /:orgId/gateways/register`  
**Auth Required:** Yes  
**Description:** Register a new BLE gateway

### Request
```json
{
  "gatewayId": "GW-001",
  "name": "Main Office Gateway",
  "location": "Building A - Floor 2"
}
```

### Success Response (201 Created)
```json
{
  "status": 201,
  "success": true,
  "message": "Operation successful",
  "from": "iot-backend",
  "error": null,
  "data": {
    "_id": "507f1f77bcf86cd799439001",
    "orgId": "507f1f77bcf86cd799439001",
    "gatewayId": "GW-001",
    "name": "Main Office Gateway",
    "location": "Building A - Floor 2",
    "status": "active",
    "lastSeen": "2025-12-19T10:30:00.000Z",
    "createdAt": "2025-12-19T10:00:00.000Z"
  }
}
```

### Error Responses

**Invalid input (400)**
```json
{
  "status": 400,
  "success": false,
  "message": "Operation failed",
  "from": "iot-backend",
  "error": {
    "statusCode": 400,
    "message": "Gateway ID already exists",
    "error": "Bad Request"
  },
  "data": null
}
```

**Unauthorized (401)**
```json
{
  "status": 401,
  "success": false,
  "message": "Operation failed",
  "from": "iot-backend",
  "error": {
    "statusCode": 401,
    "message": "Unauthorized",
    "error": "Unauthorized"
  },
  "data": null
}

## 2. List Gateways
**Endpoint:** `GET /:orgId/gateways?page=1&limit=20`  
**Auth Required:** Yes  
**Description:** Get all gateways for organization

### Query Parameters
```
page:   number (default: 1)
limit:  number (default: 20, max: 100)
```

### Success Response (200 OK)
```json
{
  "status": 200,
  "success": true,
  "message": "Operation successful",
  "from": "iot-backend",
  "error": null,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439001",
      "orgId": "507f1f77bcf86cd799439001",
      "gatewayId": "GW-001",
      "name": "Main Office Gateway",
      "location": "Building A - Floor 2",
      "status": "active",
      "lastSeen": "2025-12-19T10:30:00.000Z",
      "createdAt": "2025-12-19T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "pages": 1
  }
}
```

### Error Responses

**Unauthorized (401)**
```json
{
  "status": 401,
  "success": false,
  "message": "Operation failed",
  "from": "iot-backend",
  "error": {
    "statusCode": 401,
    "message": "Unauthorized",
    "error": "Unauthorized"
  },
  "data": null
}
      "_id": "507f1f77bcf86cd799439001",
      "orgId": "507f1f77bcf86cd799439001",
      "gatewayId": "GW-001",
      "name": "Main Office Gateway",
      "location": "Building A - Floor 2",
      "status": "active",
      "lastSeen": "2025-12-19T10:30:00.000Z",
      "createdAt": "2025-12-19T10:00:00.000Z"
    }
  ],
  "total": 15,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

---

## 3. Get Gateway Details
**Endpoint:** `GET /:orgId/gateways/:id`  
**Auth Required:** Yes  
**Description:** Get details of a specific gateway

### Success Response (200 OK)
```json
{
  "status": 200,
  "success": true,
  "message": "Operation successful",
  "from": "iot-backend",
  "error": null,
  "data": {
    "_id": "507f1f77bcf86cd799439001",
    "orgId": "507f1f77bcf86cd799439001",
    "gatewayId": "GW-001",
    "name": "Main Office Gateway",
    "location": "Building A - Floor 2",
    "status": "active",
    "lastSeen": "2025-12-19T10:30:00.000Z",
    "createdAt": "2025-12-19T10:00:00.000Z"
  }
}
```

### Error Responses

**Not found (404)**
```json
{
  "status": 404,
  "success": false,
  "message": "Operation failed",
  "from": "iot-backend",
  "error": {
    "statusCode": 404,
    "message": "Gateway not found",
    "error": "Not Found"
  },
  "data": null
}
```

## 4. Update Gateway
**Endpoint:** `PATCH /:orgId/gateways/:id`  
**Auth Required:** Yes  
**Description:** Update gateway information

### Request (All fields optional)
```json
{
  "name": "Updated Gateway Name",
  "location": "Building A - Floor 3"
}
```

### Success Response (200 OK)
```json
{
  "status": 200,
  "success": true,
  "message": "Operation successful",
  "from": "iot-backend",
  "error": null,
  "data": {
    "_id": "507f1f77bcf86cd799439001",
    "orgId": "507f1f77bcf86cd799439001",
    "gatewayId": "GW-001",
    "name": "Updated Gateway Name",
    "location": "Building A - Floor 3",
    "status": "active",
    "lastSeen": "2025-12-19T10:30:00.000Z",
    "updatedAt": "2025-12-19T11:45:00.000Z"
  }
}
```

### Error Responses

**Not found (404)**
```json
{
  "status": 404,
  "success": false,
  "message": "Operation failed",
  "from": "iot-backend",
  "error": {
    "statusCode": 404,
    "message": "Gateway not found",
    "error": "Not Found"
  },
  "data": null
}
```

## 5. Delete Gateway
**Endpoint:** `DELETE /:orgId/gateways/:id`  
**Auth Required:** Yes  
**Description:** Delete a gateway

### Success Response (204 No Content)
```json
{
  "status": 204,
  "success": true,
  "message": "Operation successful",
  "from": "iot-backend",
  "error": null,
  "data": null
}
```

### Error Responses

**Not found (404)**
```json
{
  "status": 404,
  "success": false,
  "message": "Operation failed",
  "from": "iot-backend",
  "error": {
    "statusCode": 404,
    "message": "Gateway not found",
    "error": "Not Found"
  },
  "data": null
}
```

## 6. Attach Sensors to Gateway
**Endpoint:** `PATCH /:orgId/gateways/:id/attach-sensors`  
**Auth Required:** Yes  
**Description:** Attach BLE sensors (by MAC address) to a gateway

### Request
```json
{
  "macs": ["AA:BB:CC:DD:EE:FF", "11:22:33:44:55:66"]
}
```

### Success Response (200 OK)
```json
{
  "status": 200,
  "success": true,
  "message": "Operation successful",
  "from": "iot-backend",
  "error": null,
  "data": {
    "_id": "507f1f77bcf86cd799439001",
    "orgId": "507f1f77bcf86cd799439001",
    "gatewayId": "GW-001",
    "name": "Main Office Gateway",
    "location": "Building A - Floor 2",
    "attachedSensors": 5,
    "sensorMacs": [
      "AA:BB:CC:DD:EE:FF",
      "11:22:33:44:55:66"
    ],
    "lastSeen": "2025-12-19T10:30:00.000Z",
    "updatedAt": "2025-12-19T11:50:00.000Z"
  }
}
```

### Error Responses

**Gateway not found (404)**
```json
{
  "status": 404,
  "success": false,
  "message": "Operation failed",
  "from": "iot-backend",
  "error": {
    "statusCode": 404,
    "message": "Gateway not found",
    "error": "Not Found"
  },
  "data": null
}
```

**Invalid sensor MAC (400)**
```json
{
  "status": 400,
  "success": false,
  "message": "Operation failed",
  "from": "iot-backend",
  "error": {
    "statusCode": 400,
    "message": "Invalid MAC address format",
    "error": "Bad Request"
  },
  "data": null
}

## 7. Get Gateway Statistics
**Endpoint:** `GET /:orgId/gateways/stats`  
**Auth Required:** Yes  
**Description:** Get aggregated gateway statistics

### Success Response (200 OK)
```json
{
  "status": 200,
  "success": true,
  "message": "Operation successful",
  "from": "iot-backend",
  "error": null,
  "data": {
    "totalGateways": 10,
    "activeGateways": 8,
    "inactiveGateways": 2,
    "totalSensors": 47,
    "lastActivityTime": "2025-12-19T10:45:00.000Z"
  }
}
```

### Error Responses

**Unauthorized (401)**
```json
{
  "status": 401,
  "success": false,
  "message": "Operation failed",
  "from": "iot-backend",
  "error": {
    "statusCode": 401,
    "message": "Unauthorized",
    "error": "Unauthorized"
  },
  "data": null
}

# Sensor APIs

## 1. List Sensors
**Endpoint:** `GET /:orgId/sensors?page=1&limit=20&gatewayId=GW-001`  
**Auth Required:** Yes  
**Description:** Get all sensors for organization with pagination

### Query Parameters
```
page:       number (default: 1)
limit:      number (default: 20, max: 100)
gatewayId:  string (optional, filter by gateway)
```

### Success Response (200 OK)
```json
{
  "status": 200,
  "success": true,
  "message": "Operation successful",
  "from": "iot-backend",
  "error": null,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439041",
      "orgId": "507f1f77bcf86cd799439001",
      "mac": "AA:BB:CC:DD:EE:FF",
      "name": "Room Temperature Sensor",
      "type": "BLE",
      "gatewayId": "507f1f77bcf86cd799439001",
      "lastValue": 22.5,
      "status": "online",
      "createdAt": "2025-12-19T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 47,
    "pages": 3
  }
}
```

### Error Responses

**Unauthorized (401)**
```json
{
  "status": 401,
  "success": false,
  "message": "Operation failed",
  "from": "iot-backend",
  "error": {
    "statusCode": 401,
    "message": "Unauthorized",
    "error": "Unauthorized"
  },
  "data": null
}

## 2. Get Sensor Details
**Endpoint:** `GET /:orgId/sensors/:id`  
**Auth Required:** Yes  
**Description:** Get details of a specific sensor

### Success Response (200 OK)
```json
{
  "status": 200,
  "success": true,
  "message": "Operation successful",
  "from": "iot-backend",
  "error": null,
  "data": {
    "_id": "507f1f77bcf86cd799439041",
    "orgId": "507f1f77bcf86cd799439001",
    "mac": "AA:BB:CC:DD:EE:FF",
    "name": "Room Temperature Sensor",
    "type": "BLE",
    "gatewayId": "507f1f77bcf86cd799439001",
    "lastValue": 22.5,
    "status": "online",
    "createdAt": "2025-12-19T10:00:00.000Z"
  }
}
```

### Error Responses

**Not found (404)**
```json
{
  "status": 404,
  "success": false,
  "message": "Operation failed",
  "from": "iot-backend",
  "error": {
    "statusCode": 404,
    "message": "Sensor not found",
    "error": "Not Found"
  },
  "data": null
}
```

## 3. Get Sensor Telemetry
**Endpoint:** `GET /:orgId/sensors/:id/telemetry?start=2025-12-19&end=2025-12-20&limit=100`  
**Auth Required:** Yes  
**Description:** Get telemetry history for a sensor

### Query Parameters
```
start:  ISO date string (optional, e.g., 2025-12-19T10:00:00Z)
end:    ISO date string (optional, e.g., 2025-12-19T18:00:00Z)
limit:  number (default: 100, max: 1000)
```

### Response (200 OK)
```json
{
  \"status\": 200,
  \"success\": true,
  \"message\": \"Operation successful\",
  \"from\": \"iot-backend\",
  \"error\": null,
  \"data\": [
    {
      \"_id\": \"507f1f77bcf86cd799439051\",
      \"sensorId\": \"507f1f77bcf86cd799439041\",
      \"gatewayId\": \"507f1f77bcf86cd799439001\",
      \"orgId\": \"507f1f77bcf86cd799439001\",
      "value": 22.5,
      "timestamp": "2025-12-19T10:30:00.000Z",
      \"createdAt\": \"2025-12-19T10:30:00.000Z\"
    }
  ],
  \"pagination\": {
    \"total\": 240,
    \"limit\": 100
  }
}
```

### Error Responses

**Sensor not found (404)**
```json
{
  \"status\": 404,
  \"success\": false,
  \"message\": \"Operation failed\",
  \"from\": \"iot-backend\",
  \"error\": {
    \"statusCode\": 404,
    \"message\": \"Sensor not found\",
    \"error\": \"Not Found\"
  },
  \"data\": null
}
```

**Invalid date range (400)**
```json
{
  \"status\": 400,
  \"success\": false,
  \"message\": \"Operation failed\",
  \"from\": \"iot-backend\",
  \"error\": {
    \"statusCode\": 400,
    \"message\": \"Start date must be before end date\",
    \"error\": \"Bad Request\"
  },
  \"data\": null
}
```

---

# Error Responses

## Standard Error Format
All error responses are wrapped in the same interceptor format with error details:

```json
{
  "status": 400,
  "success": false,
  "message": "Operation failed",
  "from": "iot-backend",
  "error": {
    "statusCode": 400,
    "message": "Error description",
    "error": "BadRequest"
  },
  "data": null
}
```

## Common HTTP Status Codes

| Status | Meaning | Use Case |
|--------|---------|----------|
| 200 | OK | Successful GET/PATCH request |
| 201 | Created | Successful POST request creating a resource |
| 204 | No Content | Successful DELETE request (empty response body) |
| 400 | Bad Request | Invalid parameters, validation failed, business logic error |
| 401 | Unauthorized | Missing or invalid JWT token, expired session |
| 403 | Forbidden | Access denied, org mismatch, insufficient permissions |
| 404 | Not Found | Resource not found (gateway, alert, sensor, notification) |
| 409 | Conflict | Duplicate resource, sensor belongs to another organization |
| 500 | Server Error | Internal server error, unexpected exception |

## Error Response Structure

Each error response includes:
- `status`: HTTP status code (400, 401, 404, etc.)
- `success`: Always `false` for errors
- `message`: "Operation failed" (standard message)
- `from`: "iot-backend" (source service)
- `error`: Object containing:
  - `statusCode`: HTTP status code (duplicate of outer status)
  - `message`: Specific error description
  - `error`: Error type/category (BadRequest, Unauthorized, NotFound, etc.)
- `data`: Always `null` for errors

## Common Error Scenarios

### Validation Error (400)
Occurs when request parameters don't meet validation rules (missing required fields, invalid values, etc.)

**Example:** Missing notification channels in alert creation
```json
{
  "status": 400,
  "success": false,
  "message": "Operation failed",
  "from": "iot-backend",
  "error": {
    "statusCode": 400,
    "message": "At least one notification channel (email or SMS) must be enabled",
    "error": "BadRequest"
  },
  "data": null
}
```

### Unauthorized (401)
Occurs when request lacks valid authentication or JWT token is missing/expired

```json
{
  "status": 401,
  "success": false,
  "message": "Operation failed",
  "from": "iot-backend",
  "error": {
    "statusCode": 401,
    "message": "Unauthorized",
    "error": "Unauthorized"
  },
  "data": null
}
```

### Not Found (404)
Occurs when requested resource doesn't exist (gateway, alert rule, sensor, notification, etc.)

```json
{
  "status": 404,
  "success": false,
  "message": "Operation failed",
  "from": "iot-backend",
  "error": {
    "statusCode": 404,
    "message": "Gateway not found",
    "error": "Not Found"
  },
  "data": null
}
```

### Access Forbidden (403)
Occurs when user lacks permission or resource belongs to different organization

```json
{
  "status": 403,
  "success": false,
  "message": "Operation failed",
  "from": "iot-backend",
  "error": {
    "statusCode": 403,
    "message": "One or more sensors do not belong to your organization",
    "error": "Forbidden"
  },
  "data": null
}
```

### Resource Conflict (409)
Occurs when operation creates duplicate or violates constraints

```json
{
  "status": 409,
  "success": false,
  "message": "Operation failed",
  "from": "iot-backend",
  "error": {
    "statusCode": 409,
    "message": "Gateway ID already exists in your organization",
    "error": "Conflict"
  },
  "data": null
}
```

### Not Found Error (404)
```json
{
  "statusCode": 404,
  "message": "Alert rule not found",
  "error": "NotFound"
}
```

### Unauthorized Error (401)
```json
{
  "statusCode": 401,
  "message": "User not authenticated",
  "error": "Unauthorized"
}
```

### Organization Access Error (403)
```json
{
  "statusCode": 403,
  "message": "You do not have access to this organization",
  "error": "Forbidden"
}
```

---

## Implementation Notes for Frontend

### 1. Organization Context
All endpoints require `:orgId` in the URL path. This is automatically validated by `OrgContextGuard`.

### 2. Pagination Best Practices
- Default to `page=1&limit=20`
- For lists with many items, show 20-50 items per page
- Cache pagination state in component

### 3. Throttle Configuration
- Recommend default throttle of 10 minutes for alert rules
- Minimum: 5 minutes, Maximum: 60 minutes
- Show clear UI hints: "Alert won't trigger again for X minutes after first trigger"

### 4. Phone Number Format
- Use E.164 format: `+[1-9] followed by 1-14 digits`
- Examples: `+1234567890`, `+442071838750`, `+8618612345678`
- Add input validation and format hints in UI

### 5. Email Validation
- Standard email format validation
- Max 10 addresses per rule
- Show error if duplicate emails are provided

### 6. Condition Operators
```
gt    - Greater than
lt    - Less than
eq    - Equal to
gte   - Greater than or equal to
lte   - Less than or equal to
between - Between two values (requires value2)
```

### 7. Alert Acknowledgment
- After alert is triggered, mark as acknowledged to show it's been reviewed
- Use `PATCH /:orgId/alerts/history/:historyId/acknowledge`
- Helps track which alerts have been reviewed

### 8. Notification Types
- `quota` - Usage/quota related notifications
- `system` - System status and alerts

### 9. Recent Notifications
- Use `GET /:orgId/notifications/recent?limit=5` for dashboard badges
- More efficient than full history pagination for quick display

### 10. Error Handling
- Always check for error status codes
- Display user-friendly error messages from response
- For 403 errors, inform user they don't have access to this organization
- For validation errors (400), show field-specific messages

---

## Testing the APIs

### Using cURL
```bash
# Create alert rule
curl -X POST http://localhost:3000/api/{orgId}/alerts \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Alert",
    "sensorIds": ["sensor_mac"],
    "condition": {"metric": "temperature", "operator": "gt", "value": 30},
    "channels": {"email": {"enabled": true, "addresses": ["test@example.com"]}},
    "throttleMinutes": 10
  }'

# Get recent notifications
curl http://localhost:3000/api/{orgId}/notifications/recent?limit=5 \
  -H "Authorization: Bearer {JWT_TOKEN}"

# List gateways
curl http://localhost:3000/api/{orgId}/gateways \
  -H "Authorization: Bearer {JWT_TOKEN}"
```

### Using Postman
1. Set up environment variables:
   - `base_url`: http://localhost:3000/api
   - `orgId`: Your organization ID
   - `token`: Your JWT token

2. Import the example requests above with `{{base_url}}`, `{{orgId}}`, and `{{token}}`

---

## Contact & Support
For API issues or questions, contact the Backend Team.
