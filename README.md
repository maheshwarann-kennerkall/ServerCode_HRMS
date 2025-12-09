# HRMS Service - Deduction Templates Implementation

## Overview
This HRMS Service implementation provides comprehensive deduction template management functionality, following the BranchService architecture pattern.

## Service Structure
```
backend/HrmsService/
├── config/
│   └── database.js          # Database connection configuration
├── package.json             # Node.js dependencies and scripts
├── server.js               # Main Express server
├── router.js               # API routes for deduction templates
├── .env                    # Environment variables
└── .env.example           # Environment variables template
```

## Data Structure Analysis

### Deduction Template System Components

#### 1. **deduction_templates** (Main Template Table)
```sql
- id: UUID (Primary Key)
- template_name: VARCHAR(100) - Human readable name
- employee_type: VARCHAR(20) - teacher/staff/driver
- description: TEXT - Optional description
- is_active: BOOLEAN - Soft delete flag
- created_by: UUID - FK to users table
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### 2. **deduction_template_items** (Template Components)
```sql
- id: UUID (Primary Key)
- template_id: UUID - FK to deduction_templates
- deduction_type_id: UUID - FK to deduction_types
- calculation_type: VARCHAR(20) - percentage/fixed_amount
- calculation_value: DECIMAL(10,2) - The percentage or fixed amount
- is_mandatory: BOOLEAN - Whether this deduction is required
- created_at: TIMESTAMP
- UNIQUE(template_id, deduction_type_id) - No duplicates
```

#### 3. **deduction_types** (Master Deduction Types)
```sql
- id: UUID (Primary Key)
- name: VARCHAR - PF, ESI, Professional Tax, etc.
- code: VARCHAR - Short code for each type
- description: TEXT
- is_active: BOOLEAN
```

#### 4. **employee_deduction_templates** (Employee Assignments)
```sql
- id: UUID (Primary Key)
- employee_id: UUID - FK to users
- template_id: UUID - FK to deduction_templates
- assigned_date: DATE - When assigned
- is_active: BOOLEAN
- assigned_by: UUID - FK to users
- created_at: TIMESTAMP
- UNIQUE(employee_id) - One active template per employee
```

#### 5. **employee_deduction_overrides** (Individual Customizations)
```sql
- id: UUID (Primary Key)
- employee_id: UUID - FK to users
- deduction_type_id: UUID - FK to deduction_types
- override_type: VARCHAR(20) - percentage/fixed_amount
- override_value: DECIMAL(10,2) - Custom value
- effective_from: DATE
- effective_to: DATE - Optional end date
- reason: TEXT - Why overridden
- created_by: UUID - FK to users
- created_at: TIMESTAMP
```

## Implementation Features

### 1. Authentication & Authorization
- JWT token validation middleware
- Role-based access control (admin, hr, teacher, staff)
- User context preservation

### 2. API Endpoints

#### GET `/api/deduction-types`
- Fetches all active deduction types
- Required role: authenticated user
- Returns: Array of deduction type objects

#### GET `/api/deduction-templates`
- Fetches all active deduction templates with items
- Required role: admin, hr, teacher, staff
- Returns: Array of template objects with nested deduction items

#### POST `/api/deduction-templates`
- Creates new deduction template with items
- Required role: admin, hr
- Body: template_name, employee_type, description, deductions array
- Uses database transaction for consistency

#### GET `/api/deduction-templates/:id`
- Fetches specific template by ID
- Required role: admin, hr, teacher, staff
- Returns: Single template object with deduction items

#### PUT `/api/deduction-templates/:id`
- Updates existing template and items
- Required role: admin, hr
- Replaces all existing deduction items with new ones
- Uses database transaction

#### DELETE `/api/deduction-templates/:id`
- Soft deletes template (sets is_active = false)
- Required role: admin, hr
- Maintains referential integrity

### 3. Database Operations

#### Transaction Management
- All template creation/updates use database transactions
- Automatic rollback on failure
- Audit logging integration

#### Complex Queries
- JSON aggregation for nested deduction items
- JOIN operations for related data
- Efficient indexing for performance

#### Data Integrity
- Foreign key constraints
- Unique constraints where appropriate
- Soft deletes to preserve history

### 4. Error Handling & Logging
- Comprehensive error messages
- Database error handling
- Audit event logging (when table exists)
- Console logging for debugging

### 5. Security Features
- JWT token validation
- Role-based endpoint protection
- SQL injection prevention through parameterized queries
- Input validation

## Key Implementation Details

### Template Creation Flow
1. Validate input fields and user permissions
2. Start database transaction
3. Insert main template record
4. Insert all deduction template items
5. Log audit event
6. Commit transaction
7. Return success response

### Data Relationships
- Templates → Items (1:Many)
- Templates → Deduction Types (Many:Many through items)
- Templates → Created By User (Many:1)
- Templates → Employee Assignments (1:Many)

### Performance Optimizations
- Indexed columns for common queries
- JSON aggregation for efficient data retrieval
- Connection pooling for database efficiency

## Integration Points

### Frontend Integration
- RESTful API endpoints
- JSON response format
- Consistent error response structure
- JWT authentication header

### Database Integration
- Direct PostgreSQL connection (no ORM)
- Parameterized queries for security
- Transaction support for data integrity
- Audit logging capability

### System Integration
- Compatible with existing BranchService structure
- Uses same authentication patterns
- Consistent error handling approach
- Similar logging patterns

## Environment Configuration
- Database connection parameters
- JWT secret for token validation
- Port configuration
- Environment-specific settings

## Dependencies
- `express` - Web framework
- `pg` - PostgreSQL driver
- `jsonwebtoken` - JWT handling
- `bcryptjs` - Password hashing (for future auth features)
- `cors` - Cross-origin resource sharing
- `dotenv` - Environment variable management

This implementation provides a robust, scalable foundation for deduction template management in the HRMS system, following enterprise-grade patterns for database operations, security, and error handling.