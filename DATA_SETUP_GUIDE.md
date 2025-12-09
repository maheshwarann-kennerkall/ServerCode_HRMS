# HRMS Service - Sample Data Setup Guide

## 🎯 Issue: Template Creation Needs Deduction Types First

You need to insert deduction types before creating templates since templates reference existing deduction types.

## 📋 Step-by-Step Data Insertion

### Step 1: Insert Deduction Types First
Run this SQL in your Supabase SQL Editor or PostgreSQL:

```sql
-- Insert sample deduction types
INSERT INTO branch.deduction_types (name, code, description, calculation_method, default_amount, is_tax_deductible, is_mandatory) VALUES
('Provident Fund', 'PF', 'Employee Provident Fund contribution', 'percentage', 12.00, true, true),
('Employee State Insurance', 'ESI', 'ESI contribution for employee', 'percentage', 0.75, true, true),
('Professional Tax', 'PT', 'Professional Tax deduction', 'fixed', 200.00, true, true),
('Income Tax', 'TDS', 'Tax Deducted at Source', 'percentage', 0.00, true, false),
('Loan Repayment', 'LOAN', 'Employee loan repayment deduction', 'fixed', 0.00, false, false)
ON CONFLICT (code) DO NOTHING;
```

### Step 2: Get Deduction Type IDs
After inserting, fetch the IDs for template creation:

```sql
SELECT id, name, code FROM branch.deduction_types WHERE is_active = true ORDER BY name;
```

**Expected Response:**
```json
{
  "data": [
    {
      "id": "pf-uuid-here",
      "name": "Provident Fund",
      "code": "PF"
    },
    {
      "id": "esi-uuid-here", 
      "name": "Employee State Insurance",
      "code": "ESI"
    },
    {
      "id": "pt-uuid-here",
      "name": "Professional Tax", 
      "code": "PT"
    }
  ]
}
```

## 🧪 Now Test Template Creation

### Create Your First Template
Use the IDs from Step 2 in this Postman request:

```
POST http://localhost:8003/api/deduction-templates
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "template_name": "My First Teacher Template",
  "employee_type": "teacher",
  "description": "Test template for teachers",
  "deductions": [
    {
      "deduction_type_id": "pf-uuid-here",
      "calculation_type": "percentage", 
      "calculation_value": 12.00,
      "is_mandatory": true
    },
    {
      "deduction_type_id": "esi-uuid-here",
      "calculation_type": "percentage",
      "calculation_value": 0.75,
      "is_mandatory": true
    },
    {
      "deduction_type_id": "pt-uuid-here", 
      "calculation_type": "fixed_amount",
      "calculation_value": 200.00,
      "is_mandatory": true
    }
  ]
}
```

## 🔧 Alternative: Use Default Templates
If you ran the full SQL file, default templates already exist:

```sql
-- Check if default templates exist
SELECT id, template_name, employee_type FROM branch.deduction_templates WHERE is_active = true;
```

## ⚠️ Common Errors & Solutions

### Error: "deduction_type_id does not exist"
**Solution:** Insert deduction types first (Step 1 above)

### Error: "violates foreign key constraint"  
**Solution:** Ensure deduction types are inserted in branch schema

### Error: "relation branch.deduction_types does not exist"
**Solution:** Run the create_deduction_templates_schema.sql file first

## 📝 Quick Testing Flow

1. **Insert Deduction Types** (30 seconds)
2. **Get Type IDs** (10 seconds)  
3. **Create Template** (use IDs from step 2)
4. **Verify Template** (GET request to see created template)

The template creation should work perfectly once you have deduction types in the database!