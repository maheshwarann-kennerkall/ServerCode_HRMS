import express from 'express';
import jwt from 'jsonwebtoken';
import pool from './config/database.js';

const router = express.Router();

// JWT verification middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.error('JWT verification error:', err);
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    console.log('Decoded user from token:', user);
    req.user = user;
    next();
  });
};

// Role-based access check
const checkRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }
    next();
  };
};

// GET /api/deduction-types - Get all deduction types
router.get('/deduction-types', authenticateToken, async (req, res) => {
  try {
    console.log('📋 Fetching deduction types...');
    
    const result = await pool.query(`
      SELECT
        id,
        name,
        code,
        description,
        calculation_method,
        default_amount,
        is_tax_deductible,
        is_mandatory,
        is_active,
        created_at
      FROM branch.deduction_types
      WHERE is_active = true
      ORDER BY name
    `);

    console.log(`✅ Found ${result.rows.length} deduction types`);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Error fetching deduction types:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch deduction types'
    });
  }
});

// GET /api/deduction-templates - Get all deduction templates
router.get('/deduction-templates', authenticateToken, checkRole('admin', 'hr', 'teacher', 'staff'), async (req, res) => {
  try {
    console.log('📋 Fetching deduction templates...');
    
    // Filter by user's branch for branch-specific templates (superadmin sees all)
    const userBranchId = req.user.branchId;
    let query = `
      SELECT
        dt.id,
        dt.template_name,
        dt.employee_type,
        dt.description,
        dt.branch_id,
        dt.academic_year,
        dt.is_active,
        dt.created_by,
        dt.created_at,
        dt.updated_at,
        -- Get deduction items with their types
        COALESCE(json_agg(
          json_build_object(
            'id', dti.id,
            'deduction_type_id', dti.deduction_type_id,
            'calculation_type', dti.calculation_type,
            'calculation_value', dti.calculation_value,
            'is_mandatory', dti.is_mandatory,
            'deduction_types', json_build_object(
              'id', dtp.id,
              'name', dtp.name,
              'code', dtp.code,
              'calculation_method', dtp.calculation_method,
              'default_amount', dtp.default_amount,
              'is_tax_deductible', dtp.is_tax_deductible,
              'is_mandatory', dtp.is_mandatory
            )
          )
        ) FILTER (WHERE dti.id IS NOT NULL), '[]'::json) as deductions,
        -- Get creator info
        json_build_object(
          'id', creator.id,
          'name', creator.name,
          'email', creator.email
        ) as created_by_user
      FROM branch.deduction_templates dt
      LEFT JOIN branch.deduction_template_items dti ON dt.id = dti.template_id
      LEFT JOIN branch.deduction_types dtp ON dti.deduction_type_id = dtp.id
      LEFT JOIN users creator ON dt.created_by = creator.id
      WHERE dt.is_active = true
    `;
    
    // Superadmin can see all templates, others see only their branch
    if (req.user.role !== 'superadmin' && userBranchId) {
      query += ` AND dt.branch_id = $1`;
    }
    
    query += ` GROUP BY dt.id, creator.id ORDER BY dt.employee_type, dt.template_name`;
    
    const result = await pool.query(query, userBranchId ? [userBranchId] : []);

    console.log(`✅ Found ${result.rows.length} deduction templates`);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Error fetching deduction templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch deduction templates'
    });
  }
});

// POST /api/deduction-templates - Create new deduction template
router.post('/deduction-templates', authenticateToken, checkRole('admin', 'hr'), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    
    console.log('🔥 CREATING DEDUCTION TEMPLATE:', JSON.stringify(req.body, null, 2));
    console.log('🔥 REQUEST HEADERS:', req.headers);
    console.log('🔥 AUTHENTICATED USER:', req.user);

    // Validate request body
    if (!req.body || typeof req.body !== 'object') {
      throw new Error('Invalid request body');
    }

    const {
      template_name,
      employee_type,
      description,
      branch_id,
      academic_year,
      deductions
    } = req.body;

    // Validate required fields
    if (!template_name || !employee_type || !branch_id || !academic_year || !deductions || deductions.length === 0) {
      throw new Error('Missing required fields: template_name, employee_type, branch_id, academic_year, deductions');
    }

    // Validate employee type
    const validEmployeeTypes = ['teacher', 'staff', 'driver'];
    if (!validEmployeeTypes.includes(employee_type)) {
      throw new Error(`Invalid employee_type. Must be one of: ${validEmployeeTypes.join(', ')}`);
    }

    console.log('Template creation request:', {
      template_name,
      employee_type,
      description,
      deductions_count: deductions.length,
      createdBy: req.user.userId
    });

    // Insert template
    const templateInsertQuery = `
      INSERT INTO branch.deduction_templates (
        template_name,
        employee_type,
        description,
        branch_id,
        academic_year,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;

    const templateValues = [
      template_name,
      employee_type,
      description || null,
      branch_id,
      academic_year,
      req.user.userId
    ];

    const templateResult = await client.query(templateInsertQuery, templateValues);
    const templateId = templateResult.rows[0].id;

    console.log('✅ Template created with ID:', templateId);

    // Insert template items
    for (const deduction of deductions) {
      const itemInsertQuery = `
        INSERT INTO branch.deduction_template_items (
          template_id,
          deduction_type_id,
          calculation_type,
          calculation_value,
          is_mandatory
        )
        VALUES ($1, $2, $3, $4, $5)
      `;

      const itemValues = [
        templateId,
        deduction.deduction_type_id,
        deduction.calculation_type,
        deduction.calculation_value,
        deduction.is_mandatory || true
      ];

      await client.query(itemInsertQuery, itemValues);
    }

    console.log(`✅ Created ${deductions.length} deduction items for template`);

    // Log audit event
    try {
      await client.query(`
        INSERT INTO audit_logs (user_id, action, details, status, created_at)
        VALUES ($1, $2, $3, $4, NOW())
      `, [
        req.user.userId,
        'create_deduction_template',
        `Created deduction template: ${template_name} (${employee_type}) with ${deductions.length} deductions`,
        'success'
      ]);
      console.log('✅ Audit event logged successfully');
    } catch (auditError) {
      console.log('⚠️ Audit logging skipped (table may not exist)');
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Deduction template created successfully',
      data: {
        templateId,
        template_name,
        employee_type,
        deductions_count: deductions.length
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Template creation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create deduction template'
    });
  } finally {
    client.release();
  }
});

// GET /api/deduction-templates/:id - Get specific template
router.get('/deduction-templates/:id', authenticateToken, checkRole('admin', 'hr', 'teacher', 'staff'), async (req, res) => {
  try {
    console.log('📋 Fetching deduction template:', req.params.id);
    
    const { id } = req.params;

    const result = await pool.query(`
      SELECT
        dt.id,
        dt.template_name,
        dt.employee_type,
        dt.description,
        dt.is_active,
        dt.created_by,
        dt.created_at,
        dt.updated_at,
        -- Get deduction items with their types
        COALESCE(json_agg(
          json_build_object(
            'id', dti.id,
            'deduction_type_id', dti.deduction_type_id,
            'calculation_type', dti.calculation_type,
            'calculation_value', dti.calculation_value,
            'is_mandatory', dti.is_mandatory,
            'deduction_types', json_build_object(
              'id', dtp.id,
              'name', dtp.name,
              'code', dtp.code,
              'calculation_method', dtp.calculation_method,
              'default_amount', dtp.default_amount,
              'is_tax_deductible', dtp.is_tax_deductible,
              'is_mandatory', dtp.is_mandatory
            )
          )
        ) FILTER (WHERE dti.id IS NOT NULL), '[]'::json) as deductions,
        -- Get creator info
        json_build_object(
          'id', creator.id,
          'name', creator.name,
          'email', creator.email
        ) as created_by_user
      FROM branch.deduction_templates dt
      LEFT JOIN branch.deduction_template_items dti ON dt.id = dti.template_id
      LEFT JOIN branch.deduction_types dtp ON dti.deduction_type_id = dtp.id
      LEFT JOIN users creator ON dt.created_by = creator.id
      WHERE dt.id = $1 AND dt.branch_id = $2 AND dt.is_active = true
      GROUP BY dt.id, creator.id
    `, [id, req.user.branchId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Deduction template not found'
      });
    }

    console.log(`✅ Found deduction template: ${result.rows[0].template_name}`);
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Error fetching deduction template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch deduction template'
    });
  }
});

// PUT /api/deduction-templates/:id - Update template
router.put('/deduction-templates/:id', authenticateToken, checkRole('admin', 'hr'), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    
    console.log('🔄 UPDATING DEDUCTION TEMPLATE:', req.params.id);
    console.log('Update data:', JSON.stringify(req.body, null, 2));

    const { id } = req.params;
    const {
      template_name,
      employee_type,
      description,
      deductions
    } = req.body;

    // Validate required fields
    if (!template_name || !employee_type || !deductions || deductions.length === 0) {
      throw new Error('Missing required fields: template_name, employee_type, deductions');
    }

    // Check if template exists and is active
    const templateCheck = await client.query(
      'SELECT id FROM branch.deduction_templates WHERE id = $1 AND is_active = true',
      [id]
    );

    if (templateCheck.rows.length === 0) {
      throw new Error('Deduction template not found');
    }

    console.log('Template update request:', {
      template_name,
      employee_type,
      deductions_count: deductions.length
    });

    // Update template
    const updateTemplateQuery = `
      UPDATE branch.deduction_templates
      SET template_name = $1, employee_type = $2, description = $3, updated_at = NOW()
      WHERE id = $4
    `;

    await client.query(updateTemplateQuery, [
      template_name,
      employee_type,
      description || null,
      id
    ]);

    console.log('✅ Template updated');

    // Delete existing template items
    await client.query('DELETE FROM branch.deduction_template_items WHERE template_id = $1', [id]);

    // Insert new template items
    for (const deduction of deductions) {
      const itemInsertQuery = `
        INSERT INTO branch.deduction_template_items (
          template_id,
          deduction_type_id,
          calculation_type,
          calculation_value,
          is_mandatory
        )
        VALUES ($1, $2, $3, $4, $5)
      `;

      const itemValues = [
        id,
        deduction.deduction_type_id,
        deduction.calculation_type,
        deduction.calculation_value,
        deduction.is_mandatory || true
      ];

      await client.query(itemInsertQuery, itemValues);
    }

    console.log(`✅ Created ${deductions.length} new deduction items for template`);

    // Log audit event
    try {
      await client.query(`
        INSERT INTO audit_logs (user_id, action, details, status, created_at)
        VALUES ($1, $2, $3, $4, NOW())
      `, [
        req.user.userId,
        'update_deduction_template',
        `Updated deduction template: ${template_name} (${employee_type}) with ${deductions.length} deductions`,
        'success'
      ]);
      console.log('✅ Audit event logged successfully');
    } catch (auditError) {
      console.log('⚠️ Audit logging skipped (table may not exist)');
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Deduction template updated successfully',
      data: {
        templateId: id,
        template_name,
        employee_type,
        deductions_count: deductions.length
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Template update error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update deduction template'
    });
  } finally {
    client.release();
  }
});

// DELETE /api/deduction-templates/:id - Soft delete template
router.delete('/deduction-templates/:id', authenticateToken, checkRole('admin', 'hr'), async (req, res) => {
  try {
    console.log('🗑️ SOFT DELETING DEDUCTION TEMPLATE:', req.params.id);

    const { id } = req.params;

    // Check if template exists, is active, and belongs to user's branch (unless superadmin)
    let templateCheckQuery = 'SELECT template_name FROM branch.deduction_templates WHERE id = $1 AND is_active = true';
    const params = [id];
    
    if (req.user.role !== 'superadmin' && req.user.branchId) {
      templateCheckQuery += ' AND branch_id = $2';
      params.push(req.user.branchId);
    }
    
    const templateCheck = await pool.query(templateCheckQuery, params);

    if (templateCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Deduction template not found'
      });
    }

    const templateName = templateCheck.rows[0].template_name;

    // Soft delete - set is_active to false
    await pool.query(
      'UPDATE branch.deduction_templates SET is_active = false, updated_at = NOW() WHERE id = $1',
      [id]
    );

    console.log(`✅ Template "${templateName}" soft deleted successfully`);

    // Log audit event
    try {
      await pool.query(`
        INSERT INTO audit_logs (user_id, action, details, status, created_at)
        VALUES ($1, $2, $3, $4, NOW())
      `, [
        req.user.userId,
        'delete_deduction_template',
        `Soft deleted deduction template: ${templateName}`,
        'success'
      ]);
      console.log('✅ Audit event logged successfully');
    } catch (auditError) {
      console.log('⚠️ Audit logging skipped (table may not exist)');
    }

    res.json({
      success: true,
      message: 'Deduction template deleted successfully',
      data: {
        templateId: id,
        template_name: templateName
      }
    });

  } catch (error) {
    console.error('❌ Template deletion error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete deduction template'
    });
  }
});

export default router;