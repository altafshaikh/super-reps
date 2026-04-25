# SuperReps API Specifications
*RESTful API Documentation for Backend Services*

## Table of Contents

1. [API Overview](#1-api-overview)
2. [Authentication](#2-authentication)
3. [AI Routine Generation APIs](#3-ai-routine-generation-apis)
4. [Workout Logging APIs](#4-workout-logging-apis)
5. [Exercise Database APIs](#5-exercise-database-apis)
6. [User Profile APIs](#6-user-profile-apis)
7. [Progress Analytics APIs](#7-progress-analytics-apis)
8. [Health Integration APIs](#8-health-integration-apis)
9. [Subscription Management APIs](#9-subscription-management-apis)
10. [Error Handling](#10-error-handling)

---

## 1. API Overview

### Base Configuration
- **Base URL**: `https://api.superreps.com/v1`
- **Protocol**: HTTPS only
- **Content Type**: `application/json`
- **Authentication**: Bearer JWT tokens
- **Rate Limiting**: 1000 requests per hour for free tier, 10000 for Pro
- **Timeout**: 30 seconds for AI generation, 10 seconds for standard requests

### API Principles
- **RESTful Design**: Standard HTTP methods (GET, POST, PUT, DELETE)
- **Consistent Response Format**: All responses follow unified structure
- **Offline-First Support**: Optimistic updates with conflict resolution
- **Streaming Support**: Server-sent events for AI routine generation
- **Versioning**: Path-based versioning (v1, v2, etc.)

### Standard Response Format
```json
{
  "success": true,
  "data": {}, // Response payload
  "message": "Operation completed successfully",
  "timestamp": "2026-03-24T18:30:00Z",
  "version": "1.0.0"
}
```

### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "field": "email",
      "reason": "Invalid email format"
    }
  },
  "timestamp": "2026-03-24T18:30:00Z"
}
```

---

## 2. Authentication

### 2.1 User Registration

**Endpoint**: `POST /auth/register`

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "profile": {
    "name": "Alex Johnson",
    "experience_level": "intermediate",
    "primary_goals": ["muscle_building", "strength"],
    "available_equipment": ["barbell", "dumbbells", "machines"],
    "workout_frequency": 4
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "user_id": "66f1a2b3c4d5e6f7a8b9c0d1",
    "email": "user@example.com",
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "dGhpc19pc19hX3JlZnJlc2hfdG9rZW4...",
    "expires_in": 86400,
    "profile": {
      "name": "Alex Johnson",
      "experience_level": "intermediate",
      "subscription_tier": "free"
    }
  },
  "message": "User registered successfully"
}
```

### 2.2 User Login

**Endpoint**: `POST /auth/login`

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

### 2.3 Social Authentication

**Endpoint**: `POST /auth/social`

**Request Body**:
```json
{
  "provider": "apple", // "apple", "google"
  "id_token": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjhGNkY2...",
  "profile": {
    "name": "Alex Johnson",
    "email": "user@example.com"
  }
}
```

### 2.4 Token Refresh

**Endpoint**: `POST /auth/refresh`

**Request Body**:
```json
{
  "refresh_token": "dGhpc19pc19hX3JlZnJlc2hfdG9rZW4..."
}
```

---

## 3. AI Routine Generation APIs

### 3.1 Generate Routine (Streaming)

**Endpoint**: `POST /ai/routines/generate`

**Headers**:
```
Authorization: Bearer <access_token>
Accept: text/event-stream
```

**Request Body**:
```json
{
  "prompt": "chest and triceps workout for intermediate",
  "constraints": {
    "duration_minutes": 60,
    "equipment": ["barbell", "dumbbells", "cable_machine"],
    "experience_level": "intermediate",
    "workout_type": "strength"
  },
  "user_context": {
    "recent_workouts": ["pull", "legs"],
    "current_split": "push_pull_legs",
    "preferences": {
      "rep_ranges": {
        "strength": "3-6",
        "hypertrophy": "8-12"
      }
    }
  }
}
```

**Server-Sent Events Response**:
```
event: progress
data: {"step": "analyzing_prompt", "progress": 20}

event: progress  
data: {"step": "searching_exercises", "progress": 50}

event: progress
data: {"step": "building_routine", "progress": 80}

event: complete
data: {
  "routine_id": "66f1a2b3c4d5e6f7a8b9c0d2",
  "name": "AI Chest & Triceps Power",
  "description": "Intermediate strength-focused routine targeting chest and triceps",
  "exercises": [
    {
      "exercise_id": "66f1a2b3c4d5e6f7a8b9c0d3",
      "name": "Barbell Bench Press",
      "order": 1,
      "sets": 4,
      "reps": "5-6",
      "rest_seconds": 180,
      "notes": "Focus on controlled eccentric, pause at chest"
    },
    {
      "exercise_id": "66f1a2b3c4d5e6f7a8b9c0d4", 
      "name": "Incline Dumbbell Press",
      "order": 2,
      "sets": 3,
      "reps": "8-10",
      "rest_seconds": 120,
      "notes": "45-degree incline, full range of motion"
    }
  ],
  "estimated_duration": 65,
  "difficulty": "intermediate",
  "ai_confidence": 0.92
}
```

### 3.2 Save Generated Routine

**Endpoint**: `POST /ai/routines/save`

**Request Body**:
```json
{
  "routine_id": "66f1a2b3c4d5e6f7a8b9c0d2",
  "name": "My Chest & Triceps Routine",
  "modifications": [
    {
      "exercise_id": "66f1a2b3c4d5e6f7a8b9c0d3",
      "sets": 5, // Modified from 4 to 5
      "reps": "4-5" // Modified from 5-6 to 4-5
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "routine_id": "66f1a2b3c4d5e6f7a8b9c0d2",
    "saved_routine_id": "66f1a2b3c4d5e6f7a8b9c0d5",
    "message": "Routine saved to your library"
  }
}
```

### 3.3 Get Routine Suggestions

**Endpoint**: `GET /ai/routines/suggestions`

**Query Parameters**:
- `limit`: Number of suggestions (default: 5)
- `category`: Routine category (strength, hypertrophy, endurance)

**Response**:
```json
{
  "success": true,
  "data": {
    "suggestions": [
      {
        "prompt": "beginner full body workout",
        "description": "Perfect for new lifters, 3x per week",
        "category": "beginner",
        "estimated_duration": 45
      },
      {
        "prompt": "upper body strength focus",
        "description": "Heavy compound movements for strength",
        "category": "strength", 
        "estimated_duration": 60
      }
    ]
  }
}
```

---

## 4. Workout Logging APIs

### 4.1 Start Workout Session

**Endpoint**: `POST /workouts/sessions`

**Request Body**:
```json
{
  "routine_id": "66f1a2b3c4d5e6f7a8b9c0d2", // Optional: null for quick workout
  "started_at": "2026-03-24T18:30:00Z",
  "planned_exercises": [
    {
      "exercise_id": "66f1a2b3c4d5e6f7a8b9c0d3",
      "planned_sets": 4,
      "planned_reps": "5-6",
      "planned_weight": 185
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "session_id": "66f1a2b3c4d5e6f7a8b9c0d6",
    "started_at": "2026-03-24T18:30:00Z",
    "status": "active"
  }
}
```

### 4.2 Log Exercise Set

**Endpoint**: `POST /workouts/sessions/{session_id}/sets`

**Request Body**:
```json
{
  "exercise_id": "66f1a2b3c4d5e6f7a8b9c0d3",
  "set_number": 1,
  "set_type": "working", // "warmup", "working", "drop", "failure"
  "weight": 185,
  "reps": 6,
  "completed_at": "2026-03-24T18:35:00Z",
  "notes": "Felt strong, could do more",
  "rpe": 7 // Rate of Perceived Exertion (1-10)
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "set_id": "66f1a2b3c4d5e6f7a8b9c0d7",
    "estimated_1rm": 220,
    "volume_contribution": 1110, // weight * reps
    "rest_recommendation": 180 // seconds
  }
}
```

### 4.3 Complete Exercise

**Endpoint**: `PUT /workouts/sessions/{session_id}/exercises/{exercise_id}/complete`

**Request Body**:
```json
{
  "completed_at": "2026-03-24T18:50:00Z",
  "total_sets": 4,
  "notes": "Great session, hit all target reps"
}
```

### 4.4 Complete Workout Session

**Endpoint**: `PUT /workouts/sessions/{session_id}/complete`

**Request Body**:
```json
{
  "completed_at": "2026-03-24T19:35:00Z",
  "session_notes": "Excellent workout, felt strong throughout",
  "rating": 9, // 1-10 session rating
  "health_data": {
    "calories_burned": 320,
    "average_heart_rate": 145,
    "max_heart_rate": 175,
    "total_distance_meters": 0 // For cardio workouts
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "session_id": "66f1a2b3c4d5e6f7a8b9c0d6",
    "summary": {
      "duration_minutes": 65,
      "total_volume": 15750,
      "exercises_completed": 6,
      "sets_completed": 24,
      "calories_burned": 320,
      "personal_records": [
        {
          "exercise": "Barbell Bench Press",
          "type": "volume_pr",
          "previous": 4440,
          "new": 4810
        }
      ]
    },
    "health_kit_workout_id": "HK_ABC123", // If synced to Apple Health
    "next_recommendations": {
      "rest_days": 1,
      "next_workout_type": "pull",
      "progression_suggestions": [
        {
          "exercise": "Barbell Bench Press", 
          "suggestion": "Increase weight to 190 lbs next session"
        }
      ]
    }
  }
}
```

### 4.5 Sync Offline Workouts

**Endpoint**: `POST /workouts/sync`

**Request Body**:
```json
{
  "workouts": [
    {
      "local_id": "local_workout_123",
      "session_data": {
        // Complete workout session object
      },
      "created_at": "2026-03-24T18:30:00Z"
    }
  ],
  "client_timestamp": "2026-03-24T20:00:00Z"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "synced_workouts": [
      {
        "local_id": "local_workout_123",
        "server_id": "66f1a2b3c4d5e6f7a8b9c0d8",
        "status": "synced"
      }
    ],
    "conflicts": [], // Any data conflicts to resolve
    "server_timestamp": "2026-03-24T20:00:05Z"
  }
}
```

---

## 5. Exercise Database APIs

### 5.1 Search Exercises

**Endpoint**: `GET /exercises/search`

**Query Parameters**:
- `q`: Search query (exercise name, muscle group)
- `muscle_groups`: Filter by muscle groups (comma-separated)
- `equipment`: Filter by equipment (comma-separated)
- `difficulty`: Filter by difficulty (beginner, intermediate, advanced)
- `limit`: Number of results (default: 20, max: 100)
- `offset`: Pagination offset

**Example Request**:
```
GET /exercises/search?q=chest&equipment=barbell,dumbbells&limit=10
```

**Response**:
```json
{
  "success": true,
  "data": {
    "exercises": [
      {
        "exercise_id": "66f1a2b3c4d5e6f7a8b9c0d3",
        "name": "Barbell Bench Press",
        "muscle_groups": ["chest", "triceps", "front_delts"],
        "equipment": ["barbell", "bench"],
        "difficulty": "intermediate",
        "instructions": [
          "Lie flat on bench with feet on floor",
          "Grip bar slightly wider than shoulder-width",
          "Lower bar to chest with control",
          "Press bar up explosively"
        ],
        "video_url": "https://cdn.superreps.com/videos/bench_press.mp4",
        "alternatives": [
          {
            "exercise_id": "66f1a2b3c4d5e6f7a8b9c0d9",
            "name": "Dumbbell Bench Press",
            "reason": "Same movement pattern, different equipment"
          }
        ],
        "popularity_score": 0.95
      }
    ],
    "total_count": 42,
    "has_more": true
  }
}
```

### 5.2 Get Exercise Details

**Endpoint**: `GET /exercises/{exercise_id}`

**Response**:
```json
{
  "success": true,
  "data": {
    "exercise_id": "66f1a2b3c4d5e6f7a8b9c0d3",
    "name": "Barbell Bench Press",
    "muscle_groups": ["chest", "triceps", "front_delts"],
    "equipment": ["barbell", "bench"],
    "difficulty": "intermediate",
    "instructions": ["..."],
    "video_url": "https://cdn.superreps.com/videos/bench_press.mp4",
    "form_cues": [
      "Keep shoulder blades retracted",
      "Drive feet into ground",
      "Maintain arch in lower back"
    ],
    "common_mistakes": [
      "Bouncing bar off chest",
      "Flaring elbows too wide",
      "Not using leg drive"
    ],
    "progressions": [
      "Push-ups → Incline Bench → Flat Bench",
      "Dumbbell Press → Barbell Bench Press"
    ],
    "variations": [
      {
        "name": "Close-Grip Bench Press",
        "focus": "More triceps emphasis"
      },
      {
        "name": "Incline Bench Press", 
        "focus": "Upper chest emphasis"
      }
    ]
  }
}
```

### 5.3 Get Popular Exercises

**Endpoint**: `GET /exercises/popular`

**Query Parameters**:
- `muscle_group`: Filter by specific muscle group
- `time_period`: Popularity period (week, month, all_time)

---

## 6. User Profile APIs

### 6.1 Get User Profile

**Endpoint**: `GET /users/profile`

**Response**:
```json
{
  "success": true,
  "data": {
    "user_id": "66f1a2b3c4d5e6f7a8b9c0d1",
    "email": "user@example.com",
    "profile": {
      "name": "Alex Johnson",
      "experience_level": "intermediate",
      "primary_goals": ["muscle_building", "strength"],
      "available_equipment": ["barbell", "dumbbells", "machines"],
      "workout_frequency": 4,
      "preferred_session_duration": 60,
      "body_stats": {
        "height_cm": 175,
        "weight_kg": 80,
        "body_fat_percentage": 15.2
      }
    },
    "subscription": {
      "tier": "pro",
      "expires_at": "2026-12-31T23:59:59Z",
      "features": [
        "unlimited_routines",
        "unlimited_history", 
        "progressive_overload_ai",
        "advanced_analytics"
      ]
    },
    "preferences": {
      "units": "metric", // "metric" or "imperial"
      "rest_timer_duration": 120,
      "notifications": {
        "workout_reminders": true,
        "progress_updates": true,
        "ai_recommendations": true
      }
    },
    "stats": {
      "total_workouts": 89,
      "total_volume": 425750,
      "current_streak": 12,
      "longest_streak": 23,
      "favorite_exercises": [
        "Barbell Bench Press",
        "Deadlift",
        "Squat"
      ]
    }
  }
}
```

### 6.2 Update Profile

**Endpoint**: `PUT /users/profile`

**Request Body**:
```json
{
  "profile": {
    "name": "Alex Johnson",
    "experience_level": "advanced", // Updated
    "primary_goals": ["strength"], // Updated
    "available_equipment": ["barbell", "dumbbells", "machines", "cables"]
  },
  "preferences": {
    "rest_timer_duration": 150 // Updated
  }
}
```

### 6.3 Update Body Stats

**Endpoint**: `PUT /users/profile/body-stats`

**Request Body**:
```json
{
  "weight_kg": 82.5,
  "body_fat_percentage": 14.8,
  "recorded_at": "2026-03-24T08:00:00Z",
  "source": "apple_health" // "manual", "apple_health", "smart_scale"
}
```

---

## 7. Progress Analytics APIs

### 7.1 Get Workout Statistics

**Endpoint**: `GET /analytics/workouts`

**Query Parameters**:
- `period`: Time period (week, month, quarter, year, all_time)
- `exercise_id`: Filter by specific exercise (optional)
- `muscle_group`: Filter by muscle group (optional)

**Response**:
```json
{
  "success": true,
  "data": {
    "period": "month",
    "summary": {
      "total_workouts": 16,
      "total_volume": 67500,
      "average_duration": 58,
      "consistency_score": 0.85,
      "volume_trend": "increasing", // "increasing", "decreasing", "stable"
      "strength_trend": "increasing"
    },
    "volume_by_week": [
      {"week": "2026-03-01", "volume": 15750},
      {"week": "2026-03-08", "volume": 16250},
      {"week": "2026-03-15", "volume": 17250},
      {"week": "2026-03-22", "volume": 18250}
    ],
    "exercise_performance": [
      {
        "exercise_id": "66f1a2b3c4d5e6f7a8b9c0d3",
        "exercise_name": "Barbell Bench Press",
        "sessions_performed": 8,
        "volume_trend": 0.12, // 12% increase
        "estimated_1rm_start": 200,
        "estimated_1rm_current": 220,
        "improvement_percentage": 10.0
      }
    ]
  }
}
```

### 7.2 Get Strength Progression

**Endpoint**: `GET /analytics/strength/{exercise_id}`

**Query Parameters**:
- `period`: Time period for data (3months, 6months, year, all_time)

**Response**:
```json
{
  "success": true,
  "data": {
    "exercise_id": "66f1a2b3c4d5e6f7a8b9c0d3",
    "exercise_name": "Barbell Bench Press",
    "progression_data": [
      {
        "date": "2026-01-15",
        "estimated_1rm": 185,
        "max_weight": 165,
        "max_reps": 8,
        "total_volume": 4125
      },
      {
        "date": "2026-02-15", 
        "estimated_1rm": 200,
        "max_weight": 175,
        "max_reps": 6,
        "total_volume": 4550
      },
      {
        "date": "2026-03-15",
        "estimated_1rm": 220,
        "max_weight": 185,
        "max_reps": 6,
        "total_volume": 4810
      }
    ],
    "personal_records": [
      {
        "type": "1rm_estimate",
        "value": 220,
        "date": "2026-03-15",
        "improvement_from_start": 35
      },
      {
        "type": "volume_pr",
        "value": 4810,
        "date": "2026-03-15"
      }
    ],
    "projections": {
      "next_month_1rm": 235,
      "confidence": 0.78,
      "recommended_weight": 190
    }
  }
}
```

### 7.3 Get Achievement Progress

**Endpoint**: `GET /analytics/achievements`

**Response**:
```json
{
  "success": true,
  "data": {
    "unlocked_achievements": [
      {
        "achievement_id": "consistency_week",
        "name": "Consistency Champion",
        "description": "Complete 7 workouts in a row",
        "unlocked_at": "2026-03-20T10:30:00Z",
        "tier": "bronze"
      }
    ],
    "in_progress": [
      {
        "achievement_id": "volume_milestone_100k",
        "name": "Volume Master",
        "description": "Log 100,000 lbs total volume",
        "progress": 67500,
        "target": 100000,
        "progress_percentage": 67.5,
        "tier": "gold"
      }
    ],
    "next_unlockable": [
      {
        "achievement_id": "strength_milestone_bench_200",
        "name": "Bench Press Master",
        "description": "Bench press 200 lbs",
        "current_max": 185,
        "target": 200,
        "progress_percentage": 92.5
      }
    ]
  }
}
```

---

## 8. Health Integration APIs

### 8.1 Sync Health Data

**Endpoint**: `POST /health/sync`

**Request Body**:
```json
{
  "health_data": [
    {
      "type": "workout",
      "source": "apple_health",
      "health_kit_id": "HK_ABC123",
      "workout_type": "strength_training",
      "start_date": "2026-03-24T18:30:00Z",
      "end_date": "2026-03-24T19:35:00Z",
      "calories_burned": 320,
      "total_distance": 0
    },
    {
      "type": "body_weight",
      "source": "apple_health", 
      "value": 82.5,
      "unit": "kg",
      "recorded_at": "2026-03-24T08:00:00Z"
    },
    {
      "type": "heart_rate",
      "source": "apple_health",
      "samples": [
        {"timestamp": "2026-03-24T18:30:00Z", "value": 145},
        {"timestamp": "2026-03-24T18:35:00Z", "value": 155}
      ]
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "processed_records": 12,
    "new_records": 8,
    "updated_records": 4,
    "last_sync": "2026-03-24T20:00:00Z"
  }
}
```

### 8.2 Get Health Permissions

**Endpoint**: `GET /health/permissions`

**Response**:
```json
{
  "success": true,
  "data": {
    "permissions": {
      "workout_write": true,
      "body_weight_read": true, 
      "heart_rate_read": false,
      "sleep_data_read": false
    },
    "last_updated": "2026-03-24T10:00:00Z"
  }
}
```

---

## 9. Subscription Management APIs

### 9.1 Get Subscription Status

**Endpoint**: `GET /subscription/status`

**Response**:
```json
{
  "success": true,
  "data": {
    "subscription_id": "sub_abc123",
    "tier": "pro",
    "status": "active", // "active", "trial", "expired", "cancelled"
    "expires_at": "2026-12-31T23:59:59Z",
    "auto_renewal": true,
    "features": [
      "unlimited_routines",
      "unlimited_history",
      "progressive_overload_ai", 
      "advanced_analytics",
      "priority_ai_processing",
      "weekly_digest"
    ],
    "usage": {
      "ai_generations_this_month": 45,
      "ai_generation_limit": null, // Unlimited for pro
      "storage_used_mb": 125.5,
      "storage_limit_mb": null // Unlimited for pro
    }
  }
}
```

### 9.2 Upgrade Subscription

**Endpoint**: `POST /subscription/upgrade`

**Request Body**:
```json
{
  "tier": "pro",
  "billing_cycle": "annual", // "monthly", "annual"
  "app_store_receipt": "base64_encoded_receipt_data"
}
```

### 9.3 Get Feature Limits

**Endpoint**: `GET /subscription/limits`

**Response**:
```json
{
  "success": true,
  "data": {
    "current_tier": "free",
    "limits": {
      "ai_generations_per_month": 50,
      "workout_history_months": 12,
      "advanced_analytics": false,
      "progressive_overload_ai": false
    },
    "usage": {
      "ai_generations_used": 23,
      "ai_generations_remaining": 27
    },
    "upgrade_benefits": {
      "pro": {
        "ai_generations_per_month": "unlimited",
        "workout_history_months": "unlimited",
        "advanced_analytics": true,
        "progressive_overload_ai": true,
        "price_monthly": 9.99,
        "price_annual": 79.99
      }
    }
  }
}
```

---

## 10. Error Handling

### Error Codes

| Code | HTTP Status | Description | Resolution |
|------|-------------|-------------|------------|
| `INVALID_TOKEN` | 401 | JWT token is invalid or expired | Refresh token or re-authenticate |
| `INSUFFICIENT_PERMISSIONS` | 403 | User lacks required permissions | Upgrade subscription or request permissions |
| `RATE_LIMIT_EXCEEDED` | 429 | API rate limit exceeded | Wait and retry, or upgrade plan |
| `VALIDATION_ERROR` | 400 | Request validation failed | Fix request parameters |
| `AI_GENERATION_FAILED` | 500 | AI service unavailable | Retry request or use manual creation |
| `EXERCISE_NOT_FOUND` | 404 | Exercise ID doesn't exist | Verify exercise ID or search for alternatives |
| `WORKOUT_SESSION_CONFLICT` | 409 | Conflicting workout session data | Resolve conflicts or create new session |
| `HEALTH_SYNC_ERROR` | 500 | Health data sync failed | Check health permissions and retry |
| `SUBSCRIPTION_EXPIRED` | 402 | Subscription has expired | Renew subscription |
| `SERVER_ERROR` | 500 | Internal server error | Contact support if persistent |

### Retry Logic

**Recommended Retry Strategy**:
- **AI Generation**: 3 retries with exponential backoff (2s, 4s, 8s)
- **Data Sync**: 5 retries with exponential backoff (1s, 2s, 4s, 8s, 16s)
- **Standard API**: 3 retries with linear backoff (1s, 2s, 3s)
- **Health Integration**: 3 retries with 5s intervals

### Offline Handling

**Offline Strategy**:
- **Workout Logging**: Always store locally first, sync when online
- **Routine Generation**: Cache successful responses, show offline message
- **Profile Updates**: Queue updates, apply optimistically
- **Analytics**: Show cached data with offline indicator

---

## Implementation Guidelines

### Authentication Flow
1. Store JWT in secure storage (iOS Keychain, Android Keystore)
2. Include Authorization header in all authenticated requests
3. Implement automatic token refresh 5 minutes before expiry
4. Handle 401 responses by attempting token refresh once

### Caching Strategy
- **Exercise Data**: Cache for 7 days (rarely changes)
- **User Profile**: Cache for 1 hour (moderate changes)
- **Workout History**: Cache for 15 minutes (frequently updated)
- **AI Responses**: Cache successful generations for 24 hours

### Performance Optimization
- **Pagination**: Use cursor-based pagination for workout history
- **Compression**: Enable gzip compression for all responses
- **CDN**: Serve exercise videos and images from CDN
- **Prefetching**: Preload next page of workout history

### Security Considerations
- **HTTPS Only**: All API communication must use HTTPS
- **Rate Limiting**: Implement per-user rate limits
- **Input Validation**: Validate all inputs server-side
- **SQL Injection**: Use parameterized queries for database operations
- **CORS**: Configure appropriate CORS headers for web clients

*This API specification serves as the contract between the SuperReps mobile app and backend services.*