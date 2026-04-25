# SuperReps Technical Diagrams
*Architecture and User Flow Visualizations*

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [User Flow Diagrams](#2-user-flow-diagrams)
3. [Data Flow Diagrams](#3-data-flow-diagrams)
4. [Database Schema Relationships](#4-database-schema-relationships)

---

## 1. System Architecture

### 1.1 High-Level System Architecture

```mermaid
graph TB
    subgraph client [Flutter Mobile App]
        UI[User Interface Layer]
        BL[Business Logic Layer]
        DA[Data Access Layer]
        LocalDB[(SQLite Local Storage)]
        HealthKit[Apple Health Integration]
    end
    
    subgraph gateway [API Gateway]
        Auth[Authentication Service]
        RateLimit[Rate Limiting]
        LoadBalancer[Load Balancer]
    end
    
    subgraph backend [Backend Services]
        API[REST API Server]
        AIService[AI Routine Generation Service]
        AnalyticsService[Analytics Service]
        NotificationService[Notification Service]
    end
    
    subgraph storage [Data Storage]
        MongoDB[(MongoDB Atlas)]
        Qdrant[(Qdrant Vector DB)]
        Redis[(Redis Cache)]
    end
    
    subgraph external [External Services]
        Claude[Claude API]
        Apple[Apple Health]
        AppStore[App Store Connect]
        EmailService[Email Service]
    end
    
    UI --> BL
    BL --> DA
    DA --> LocalDB
    BL --> Auth
    
    Auth --> RateLimit
    RateLimit --> LoadBalancer
    LoadBalancer --> API
    
    API --> AIService
    API --> AnalyticsService
    API --> NotificationService
    
    AIService --> MongoDB
    AIService --> Qdrant
    AIService --> Claude
    API --> Redis
    
    HealthKit --> Apple
    Auth --> AppStore
    NotificationService --> EmailService
    
    LocalDB -.->|Sync when online| API
    
    classDef frontend fill:#e3f2fd
    classDef gateway fill:#fff3e0
    classDef backend fill:#e8f5e8
    classDef storage fill:#f3e5f5
    classDef external fill:#fce4ec
    
    class UI,BL,DA,LocalDB,HealthKit frontend
    class Auth,RateLimit,LoadBalancer gateway
    class API,AIService,AnalyticsService,NotificationService backend
    class MongoDB,Qdrant,Redis storage
    class Claude,Apple,AppStore,EmailService external
```

### 1.2 Mobile App Architecture

```mermaid
graph TB
    subgraph presentation [Presentation Layer]
        HomeScreen[Home Screen]
        RoutineGenScreen[Routine Generation]
        WorkoutScreen[Active Workout]
        ProgressScreen[Progress Analytics]
        SettingsScreen[Settings]
    end
    
    subgraph business [Business Logic Layer]
        RoutineManager[Routine Manager]
        WorkoutManager[Workout Manager]
        AIManager[AI Service Manager]
        HealthManager[Health Kit Manager]
        SyncManager[Data Sync Manager]
    end
    
    subgraph data [Data Layer]
        LocalRepository[Local Repository]
        RemoteRepository[Remote Repository]
        CacheManager[Cache Manager]
    end
    
    subgraph storage [Storage Layer]
        SQLite[(SQLite DB)]
        SharedPrefs[Shared Preferences]
        SecureStorage[Secure Storage]
    end
    
    HomeScreen --> RoutineManager
    RoutineGenScreen --> AIManager
    WorkoutScreen --> WorkoutManager
    ProgressScreen --> RoutineManager
    SettingsScreen --> HealthManager
    
    RoutineManager --> LocalRepository
    WorkoutManager --> LocalRepository
    AIManager --> RemoteRepository
    HealthManager --> LocalRepository
    SyncManager --> LocalRepository
    SyncManager --> RemoteRepository
    
    LocalRepository --> SQLite
    LocalRepository --> CacheManager
    RemoteRepository --> CacheManager
    CacheManager --> SharedPrefs
    
    HealthManager --> SecureStorage
    
    classDef ui fill:#e1f5fe
    classDef logic fill:#e8f5e8
    classDef data fill:#fff3e0
    classDef persist fill:#f3e5f5
    
    class HomeScreen,RoutineGenScreen,WorkoutScreen,ProgressScreen,SettingsScreen ui
    class RoutineManager,WorkoutManager,AIManager,HealthManager,SyncManager logic
    class LocalRepository,RemoteRepository,CacheManager data
    class SQLite,SharedPrefs,SecureStorage persist
```

### 1.3 AI Service Architecture

```mermaid
graph TB
    subgraph input [Input Processing]
        UserPrompt[User Prompt]
        PromptParser[Prompt Parser]
        ContextBuilder[Context Builder]
    end
    
    subgraph ai [AI Processing]
        Claude[Claude API]
        PromptTemplate[Prompt Template Engine]
        ResponseParser[Response Parser]
    end
    
    subgraph search [Exercise Search]
        VectorSearch[Vector Search Engine]
        Qdrant[(Qdrant Vector DB)]
        ExerciseFilter[Exercise Filter]
    end
    
    subgraph assembly [Routine Assembly]
        RoutineBuilder[Routine Builder]
        Validator[Safety Validator]
        Formatter[Response Formatter]
    end
    
    subgraph storage [Storage & Cache]
        MongoDB[(MongoDB)]
        RedisCache[(Redis Cache)]
        ExerciseDB[Exercise Database]
    end
    
    UserPrompt --> PromptParser
    PromptParser --> ContextBuilder
    ContextBuilder --> PromptTemplate
    
    PromptTemplate --> Claude
    Claude --> ResponseParser
    ResponseParser --> VectorSearch
    
    VectorSearch --> Qdrant
    Qdrant --> ExerciseFilter
    ExerciseFilter --> ExerciseDB
    
    ExerciseFilter --> RoutineBuilder
    ResponseParser --> RoutineBuilder
    RoutineBuilder --> Validator
    Validator --> Formatter
    
    ContextBuilder --> MongoDB
    RoutineBuilder --> MongoDB
    VectorSearch --> RedisCache
    
    classDef input fill:#e3f2fd
    classDef ai fill:#e8f5e8
    classDef search fill:#fff3e0
    classDef assembly fill:#f3e5f5
    classDef storage fill:#fce4ec
    
    class UserPrompt,PromptParser,ContextBuilder input
    class Claude,PromptTemplate,ResponseParser ai
    class VectorSearch,Qdrant,ExerciseFilter search
    class RoutineBuilder,Validator,Formatter assembly
    class MongoDB,RedisCache,ExerciseDB storage
```

---

## 2. User Flow Diagrams

### 2.1 AI Routine Generation Flow

```mermaid
flowchart TD
    Start([User Opens App]) --> CheckAuth{Authenticated?}
    CheckAuth -->|No| Login[Login/Register]
    CheckAuth -->|Yes| Home[Home Screen]
    Login --> Home
    
    Home --> Generate[Tap Generate Routine]
    Generate --> PromptScreen[Routine Generation Screen]
    
    PromptScreen --> InputMethod{Input Method}
    InputMethod -->|Voice| VoiceInput[Voice Input]
    InputMethod -->|Text| TextInput[Text Input]  
    InputMethod -->|Suggestions| ChipSelect[Select Suggestion Chip]
    
    VoiceInput --> ProcessPrompt[Process Prompt]
    TextInput --> ProcessPrompt
    ChipSelect --> ProcessPrompt
    
    ProcessPrompt --> ShowLoading[Show AI Generating...]
    ShowLoading --> AICall[Call AI Service]
    
    AICall --> Success{AI Success?}
    Success -->|No| ErrorScreen[Show Error + Retry]
    Success -->|Yes| ShowRoutine[Display Generated Routine]
    
    ErrorScreen --> PromptScreen
    
    ShowRoutine --> UserAction{User Action}
    UserAction -->|Save As-Is| SaveRoutine[Save Routine]
    UserAction -->|Modify| EditRoutine[Edit Routine Screen]
    UserAction -->|Regenerate| RegeneratePrompt[Modify Prompt]
    UserAction -->|Start Workout| StartWorkout[Begin Workout Session]
    
    EditRoutine --> SaveRoutine
    RegeneratePrompt --> ProcessPrompt
    SaveRoutine --> Home
    StartWorkout --> WorkoutSession[Active Workout]
    
    classDef start fill:#e8f5e8
    classDef process fill:#e3f2fd
    classDef decision fill:#fff3e0
    classDef end fill:#f3e5f5
    
    class Start,Home start
    class PromptScreen,ProcessPrompt,AICall,ShowRoutine,EditRoutine process
    class CheckAuth,InputMethod,Success,UserAction decision
    class SaveRoutine,StartWorkout,WorkoutSession end
```

### 2.2 Workout Logging Flow

```mermaid
flowchart TD
    Start([Start Workout]) --> SelectRoutine{Has Saved Routine?}
    SelectRoutine -->|Yes| ChooseRoutine[Select from Saved]
    SelectRoutine -->|No| CreateQuick[Quick Routine Creation]
    
    ChooseRoutine --> BeginWorkout[Begin Workout Session]
    CreateQuick --> BeginWorkout
    
    BeginWorkout --> WorkoutScreen[Active Workout Screen]
    WorkoutScreen --> ExerciseLoop{More Exercises?}
    
    ExerciseLoop -->|Yes| CurrentExercise[Current Exercise View]
    CurrentExercise --> SetEntry[Enter Set Data]
    
    SetEntry --> SetType{Set Type?}
    SetType -->|Warmup| WarmupSet[Log Warmup Set]
    SetType -->|Working| WorkingSet[Log Working Set]
    SetType -->|Drop| DropSet[Log Drop Set]
    SetType -->|Failure| FailureSet[Log Failure Set]
    
    WarmupSet --> RestTimer[Start Rest Timer]
    WorkingSet --> RestTimer
    DropSet --> RestTimer
    FailureSet --> RestTimer
    
    RestTimer --> MoreSets{More Sets?}
    MoreSets -->|Yes| SetEntry
    MoreSets -->|No| ExerciseComplete[Mark Exercise Complete]
    
    ExerciseComplete --> ExerciseLoop
    ExerciseLoop -->|No| WorkoutSummary[Workout Summary]
    
    WorkoutSummary --> UserChoice{User Action}
    UserChoice -->|Save & Sync| SaveWorkout[Save to Local DB]
    UserChoice -->|Discard| DiscardWorkout[Discard Session]
    UserChoice -->|Save Offline| SaveOffline[Save Local Only]
    
    SaveWorkout --> HealthSync[Sync to Apple Health]
    SaveOffline --> LocalSave[Store Locally]
    DiscardWorkout --> Home[Return to Home]
    
    HealthSync --> CloudSync{Online?}
    LocalSave --> CloudSync
    CloudSync -->|Yes| UploadData[Upload to Cloud]
    CloudSync -->|No| QueueSync[Queue for Later Sync]
    
    UploadData --> Home
    QueueSync --> Home
    
    classDef start fill:#e8f5e8
    classDef process fill:#e3f2fd
    classDef decision fill:#fff3e0
    classDef storage fill:#f3e5f5
    classDef end fill:#fce4ec
    
    class Start,BeginWorkout,CurrentExercise start
    class WorkoutScreen,SetEntry,RestTimer,WorkoutSummary process
    class SelectRoutine,ExerciseLoop,SetType,MoreSets,UserChoice,CloudSync decision
    class SaveWorkout,SaveOffline,LocalSave,UploadData,QueueSync storage
    class Home,DiscardWorkout end
```

### 2.3 User Onboarding Flow

```mermaid
flowchart TD
    AppLaunch([App First Launch]) --> Welcome[Welcome Screen]
    Welcome --> CreateAccount[Create Account]
    
    CreateAccount --> AuthMethod{Auth Method}
    AuthMethod -->|Email| EmailSignup[Email Registration]
    AuthMethod -->|Apple| AppleSignIn[Sign in with Apple]
    AuthMethod -->|Google| GoogleSignIn[Sign in with Google]
    
    EmailSignup --> ProfileSetup[Profile Setup]
    AppleSignIn --> ProfileSetup
    GoogleSignIn --> ProfileSetup
    
    ProfileSetup --> ExperienceLevel[Select Experience Level]
    ExperienceLevel --> Goals[Select Primary Goals]
    Goals --> Equipment[Available Equipment]
    Equipment --> Schedule[Workout Schedule Preferences]
    
    Schedule --> HealthPermission[Request Health Permissions]
    HealthPermission --> GrantHealth{Grant Permissions?}
    
    GrantHealth -->|Yes| HealthSetup[Setup Health Integration]
    GrantHealth -->|No| SkipHealth[Skip Health Setup]
    
    HealthSetup --> FirstPrompt[Generate First Routine]
    SkipHealth --> FirstPrompt
    
    FirstPrompt --> PromptSuggestions[Show Prompt Suggestions]
    PromptSuggestions --> SelectPrompt[User Selects Prompt]
    SelectPrompt --> GenerateDemo[Generate Demo Routine]
    
    GenerateDemo --> ShowResult[Show Generated Routine]
    ShowResult --> OnboardingComplete[Onboarding Complete]
    OnboardingComplete --> MainApp[Enter Main App]
    
    classDef start fill:#e8f5e8
    classDef auth fill:#e3f2fd
    classDef setup fill:#fff3e0
    classDef demo fill:#f3e5f5
    classDef end fill:#fce4ec
    
    class AppLaunch,Welcome start
    class CreateAccount,EmailSignup,AppleSignIn,GoogleSignIn auth
    class ProfileSetup,ExperienceLevel,Goals,Equipment,Schedule,HealthSetup setup
    class FirstPrompt,GenerateDemo,ShowResult demo
    class OnboardingComplete,MainApp end
```

---

## 3. Data Flow Diagrams

### 3.1 AI Routine Generation Data Flow

```mermaid
sequenceDiagram
    participant User
    participant App
    participant AIService
    participant Claude
    participant Qdrant
    participant MongoDB
    participant Cache
    
    User->>App: Enter workout prompt
    App->>AIService: Generate routine request
    
    AIService->>MongoDB: Fetch user profile & history
    MongoDB-->>AIService: User context data
    
    AIService->>Claude: Send enriched prompt
    Note over Claude: Process goals, experience,<br/>equipment constraints
    
    Claude-->>AIService: Exercise requirements
    AIService->>Qdrant: Vector search for exercises
    Qdrant-->>AIService: Matching exercises
    
    AIService->>Claude: Generate structured routine
    Claude-->>AIService: Complete routine JSON
    
    AIService->>MongoDB: Save generated routine
    AIService->>Cache: Cache routine for quick access
    
    AIService-->>App: Return routine data
    App-->>User: Display generated routine
    
    User->>App: Save routine
    App->>MongoDB: Persist user's saved routine
```

### 3.2 Workout Logging Data Flow

```mermaid
sequenceDiagram
    participant User
    participant App
    participant LocalDB
    participant HealthKit
    participant CloudAPI
    participant MongoDB
    
    User->>App: Start workout session
    App->>LocalDB: Create workout session
    
    loop For each exercise
        User->>App: Log set data
        App->>LocalDB: Store set immediately
        Note over LocalDB: Offline-first storage
        
        User->>App: Start rest timer
        App->>App: Count down rest period
    end
    
    User->>App: Complete workout
    App->>LocalDB: Finalize workout session
    
    App->>HealthKit: Write HKWorkout
    HealthKit-->>App: Confirm write success
    
    alt Online mode
        App->>CloudAPI: Sync workout data
        CloudAPI->>MongoDB: Store workout in cloud
        MongoDB-->>CloudAPI: Confirm storage
        CloudAPI-->>App: Sync complete
        App->>LocalDB: Mark as synced
    else Offline mode
        App->>LocalDB: Queue for later sync
        Note over LocalDB: Will sync when online
    end
    
    App-->>User: Show workout summary
```

### 3.3 Progressive Overload Analysis Data Flow

```mermaid
sequenceDiagram
    participant System
    participant AnalyticsService
    participant MongoDB
    participant AIService
    participant Claude
    participant User
    
    Note over System: Daily/Weekly Analysis Trigger
    
    System->>AnalyticsService: Trigger overload analysis
    AnalyticsService->>MongoDB: Fetch user workout history
    MongoDB-->>AnalyticsService: Historical workout data
    
    AnalyticsService->>AnalyticsService: Calculate volume trends
    AnalyticsService->>AnalyticsService: Analyze strength progression
    AnalyticsService->>AnalyticsService: Detect performance patterns
    
    AnalyticsService->>AIService: Send analysis data
    AIService->>Claude: Generate recommendations
    Note over Claude: Analyze patterns,<br/>suggest progressions
    
    Claude-->>AIService: Overload recommendations
    AIService->>MongoDB: Store recommendations
    
    AnalyticsService->>User: Push notification (if enabled)
    Note over User: "Ready to increase<br/>bench press weight!"
    
    alt User opens app
        User->>AnalyticsService: View recommendations
        AnalyticsService-->>User: Display AI suggestions
        User->>AnalyticsService: Accept/modify suggestions
        AnalyticsService->>MongoDB: Update user preferences
    end
```

---

## 4. Database Schema Relationships

### 4.1 MongoDB Collections Relationship

```mermaid
erDiagram
    Users {
        ObjectId _id PK
        string email UK
        object profile
        object subscription
        object preferences
        datetime created_at
        datetime updated_at
    }
    
    Exercises {
        ObjectId _id PK
        string name UK
        array muscle_groups
        array equipment
        string difficulty
        array instructions
        string video_url
        array alternatives
        string vector_id FK
        float popularity_score
        datetime created_at
    }
    
    Routines {
        ObjectId _id PK
        ObjectId user_id FK
        string name
        string description
        boolean ai_generated
        string generation_prompt
        array exercises
        int estimated_duration
        string difficulty
        datetime created_at
    }
    
    WorkoutSessions {
        ObjectId _id PK
        ObjectId user_id FK
        ObjectId routine_id FK
        datetime started_at
        datetime completed_at
        array exercises
        int total_volume
        int duration_minutes
        string health_kit_workout_id
        boolean synced
    }
    
    AIRecommendations {
        ObjectId _id PK
        ObjectId user_id FK
        string type
        object recommendation_data
        boolean applied
        datetime created_at
        datetime expires_at
    }
    
    Achievements {
        ObjectId _id PK
        ObjectId user_id FK
        string achievement_type
        object metadata
        datetime unlocked_at
    }
    
    Users ||--o{ Routines : creates
    Users ||--o{ WorkoutSessions : performs
    Users ||--o{ AIRecommendations : receives
    Users ||--o{ Achievements : earns
    
    Routines ||--o{ WorkoutSessions : guides
    Exercises }o--o{ Routines : contains
    Exercises }o--o{ WorkoutSessions : performed_in
```

### 4.2 Local SQLite Schema

```mermaid
erDiagram
    LocalUsers {
        INTEGER id PK
        TEXT mongodb_id UK
        TEXT email
        TEXT profile_json
        INTEGER last_sync_timestamp
    }
    
    LocalRoutines {
        INTEGER id PK
        TEXT mongodb_id UK
        INTEGER user_id FK
        TEXT name
        TEXT exercises_json
        INTEGER created_at
        BOOLEAN synced
    }
    
    LocalWorkoutSessions {
        INTEGER id PK
        TEXT mongodb_id UK
        INTEGER user_id FK
        INTEGER routine_id FK
        INTEGER started_at
        INTEGER completed_at
        TEXT exercises_json
        INTEGER total_volume
        BOOLEAN synced
    }
    
    LocalExercises {
        INTEGER id PK
        TEXT mongodb_id UK
        TEXT name
        TEXT muscle_groups_json
        TEXT equipment_json
        TEXT instructions_json
        INTEGER last_updated
    }
    
    SyncQueue {
        INTEGER id PK
        TEXT table_name
        TEXT record_id
        TEXT action
        TEXT data_json
        INTEGER created_at
        INTEGER retry_count
    }
    
    LocalUsers ||--o{ LocalRoutines : owns
    LocalUsers ||--o{ LocalWorkoutSessions : performs
    LocalRoutines ||--o{ LocalWorkoutSessions : guides
    LocalExercises }o--o{ LocalRoutines : contains
```

### 4.3 Qdrant Vector Collections

```mermaid
graph TB
    subgraph qdrant [Qdrant Vector Database]
        ExerciseVectors[Exercise Vectors Collection]
        UserPreferenceVectors[User Preference Vectors Collection]
        RoutineVectors[Routine Vectors Collection]
    end
    
    subgraph metadata [Vector Metadata]
        ExerciseMeta[Exercise Metadata<br/>- muscle_groups<br/>- equipment<br/>- difficulty<br/>- popularity]
        
        UserMeta[User Preference Metadata<br/>- preferred_exercises<br/>- avoided_movements<br/>- equipment_access]
        
        RoutineMeta[Routine Metadata<br/>- goal_type<br/>- duration<br/>- experience_level]
    end
    
    ExerciseVectors --> ExerciseMeta
    UserPreferenceVectors --> UserMeta
    RoutineVectors --> RoutineMeta
    
    classDef collection fill:#e3f2fd
    classDef metadata fill:#fff3e0
    
    class ExerciseVectors,UserPreferenceVectors,RoutineVectors collection
    class ExerciseMeta,UserMeta,RoutineMeta metadata
```

---

## Implementation Notes

### Performance Considerations
- **Vector Search**: Qdrant indexes optimized for sub-100ms exercise matching
- **Caching Strategy**: Redis caches frequent AI responses and user preferences
- **Database Indexing**: MongoDB compound indexes on user_id + created_at for fast queries
- **Offline Sync**: SQLite WAL mode for concurrent read/write operations

### Security Considerations  
- **API Authentication**: JWT tokens with 24-hour expiration
- **Data Encryption**: AES-256 encryption for sensitive local storage
- **Health Data**: Separate encrypted keychain storage for health permissions
- **Vector Security**: Qdrant API keys rotated monthly

### Monitoring & Observability
- **Performance Metrics**: AI generation time, database query performance
- **Error Tracking**: Comprehensive logging for AI failures and sync issues  
- **User Analytics**: Funnel tracking for onboarding and feature adoption
- **Health Monitoring**: Automated alerts for service degradation

*These diagrams provide the technical foundation for SuperReps implementation and should be referenced throughout development.*