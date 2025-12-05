# Health Canada Cannabis Compliance Manual
## Cannabis ERP System - User Guide

### Table of Contents
1. [Overview](#overview)
2. [Record Retention System](#record-retention-system)
3. [Loss/Theft Reporting](#losstheft-reporting)
4. [Inventory Reconciliation](#inventory-reconciliation)
5. [Automated Alerts](#automated-alerts)
6. [Health Canada Reporting](#health-canada-reporting)
7. [Compliance Commands](#compliance-commands)
8. [Best Practices](#best-practices)

---

## Overview

This manual covers the Health Canada compliance features implemented in your Cannabis ERP system. The system ensures full compliance with:
- **Cannabis Act** and **Cannabis Regulations**
- **Good Production Practices (GPP)** requirements
- **Cannabis Tracking and Licensing System (CTLS)** reporting
- **Form CS-FRM-011** loss/theft reporting

---

## Record Retention System

### What It Does
Automatically manages record retention per Health Canada's minimum requirements:
- **Traceability Events**: 2 years minimum
- **Batch Records**: 2 years minimum
- **Inventory Counts**: 2 years minimum
- **Regulatory Reports**: 5 years
- **Loss/Theft Reports**: 7 years

### Example: Viewing Retention Policies

```bash
# Check current retention policies
php artisan tinker
>>> App\Models\RecordRetentionPolicy::all();
```

### Example: Manual Record Archival

```bash
# Archive expired records (dry run to see what would be archived)
php artisan records:archive --dry-run

# Actually archive expired records
php artisan records:archive

# Archive for specific tenant only
php artisan records:archive --tenant=123
```

### Example Output:
```
Starting record archival process...

Processing TraceabilityEvent records...
  Found 15 TraceabilityEvent record(s) eligible for archival.
  Successfully archived 15 TraceabilityEvent record(s).

Processing Batch records...
  Found 8 Batch record(s) eligible for archival.
  Successfully archived 8 Batch record(s).

Total records archived: 23
```

---

## Loss/Theft Reporting

### Automatic Detection
The system automatically detects potential losses during inventory reconciliation:

### Example: Inventory Discrepancy Triggers Loss Report

**Scenario**: Physical count shows 95g but system shows 100g (5g shortage)

```javascript
// API Call: Justify inventory discrepancy
POST /api/inventory/reconciliation/justify-discrepancy/456
{
    "reason_id": 12,  // "Processing loss" reason
    "notes": "Material lost during trimming process"
}
```

**System Response**:
```json
{
    "message": "Discrepancia justificada exitosamente",
    "data": { /* physical count data */ },
    "loss_theft_report": {
        "id": 789,
        "report_number": "LT-2025-0001",
        "requires_hc_reporting": true,
        "message": "A loss/theft report has been automatically generated due to the nature and amount of the discrepancy."
    }
}
```

### Example: Manual Loss/Theft Report Creation

```javascript
// API Call: Create manual loss/theft report
POST /api/loss-theft-reports
{
    "incident_type": "theft",
    "incident_category": "break_and_entry",
    "incident_date": "2025-08-25",
    "discovery_date": "2025-08-26",
    "facility_id": 1,
    "specific_location": "Storage Room A",
    "batch_id": 456,
    "product_type": "cannabis_dried",
    "quantity_lost": 25.5,
    "unit": "g",
    "estimated_value": 127.50,
    "description": "Break-in discovered Monday morning, storage container forced open",
    "circumstances": "Security camera shows entry at 2:30 AM, alarm system bypassed",
    "police_notified": true,
    "police_report_number": "2025-12345"
}
```

### Health Canada Thresholds
The system automatically checks if reports meet Health Canada thresholds:

- **Dried Cannabis**: 1g minimum
- **Fresh Cannabis**: 5g minimum  
- **Cannabis Oil**: 1ml minimum
- **Cannabis Plants**: 1 plant minimum

---

## Inventory Reconciliation

### Enhanced Process with Compliance
The reconciliation process now includes automatic loss/theft detection:

### Example: Complete Reconciliation Workflow

#### Step 1: Record Physical Count
```javascript
POST /api/inventory/reconciliation/physical-count
{
    "batch_id": 456,
    "counted_quantity": 95.0,
    "count_date": "2025-08-27",
    "facility_id": 1,
    "notes": "Full physical count performed"
}
```

#### Step 2: System Detects Discrepancy
- Expected: 100g
- Counted: 95g
- Discrepancy: 5g shortage

#### Step 3: Justify Discrepancy
```javascript
POST /api/inventory/reconciliation/justify-discrepancy/456
{
    "reason_id": 15,  // "Unexplained loss"
    "notes": "No clear reason for shortage found after investigation"
}
```

#### Step 4: Automatic Loss Report Generation
Since the discrepancy exceeds 1g threshold and reason is "unexplained", the system:
1. Creates loss report automatically
2. Sends notifications to responsible persons
3. Creates traceability event
4. Updates batch inventory

---

## Automated Alerts

### Variance Alert Monitoring

```bash
# Check for inventory variance alerts
php artisan inventory:check-alerts

# Send notifications for found alerts
php artisan inventory:check-alerts --notify
```

### Example Alert Output:
```
Checking for inventory variance alerts...
Found 2 variance alert(s):

[HIGH] unjustified_discrepancy
  Batch: OG Kush Batch #123 (ID: 456)
  Expected: 100g
  Counted: 88g
  Discrepancy: 12g
  Count Date: 2025-08-25
  Days Pending: 2

[MEDIUM] unjustified_discrepancy
  Batch: Blue Dream Batch #456 (ID: 789)
  Expected: 50g
  Counted: 47g
  Discrepancy: 3g
  Count Date: 2025-08-26
  Days Pending: 1

Checking for potential theft patterns...
Found 1 suspicious pattern(s):

[HIGH] multiple_losses
  Facility ID: 1
  Loss Count: 4
  Total Amount: 45g
```

---

## Health Canada Reporting

### Generate Form CS-FRM-011 Data

```javascript
// API Call: Get Health Canada form data
GET /api/loss-theft-reports/789/health-canada-form
```

**Response**:
```json
{
    "form_data": {
        "report_number": "LT-2025-0001",
        "incident_type": "loss",
        "incident_category": "loss_unexplained",
        "incident_date": "2025-08-25",
        "discovery_date": "2025-08-26",
        "facility_name": "Cannabis Co. Production Facility",
        "facility_address": "123 Cannabis St, Vancouver, BC",
        "licence_number": "LIC-12345",
        "product_type": "cannabis_dried",
        "quantity_lost": 12.0,
        "unit": "g",
        "estimated_value": 60.00,
        "description": "Unexplained inventory discrepancy...",
        "reported_by": "John Smith",
        "reported_by_email": "john@cannabis-co.com"
    },
    "form_type": "CS-FRM-011",
    "instructions": "This data should be submitted to Health Canada using Form CS-FRM-011",
    "submission_deadline": "Within 7 days of discovery"
}
```

### Mark Report as Submitted

```javascript
// API Call: Mark as submitted to Health Canada
POST /api/loss-theft-reports/789/mark-submitted
{
    "confirmation_number": "HC-2025-567890",
    "submission_notes": "Submitted via Health Canada portal on 2025-08-27"
}
```

---

## Compliance Commands

### Essential Commands for Daily Operations

#### 1. Check System Compliance
```bash
# Check all variance alerts
php artisan inventory:check-alerts

# Check record retention status
php artisan records:archive --dry-run
```

#### 2. Weekly Compliance Check
```bash
# Archive expired records
php artisan records:archive

# Check for theft patterns
php artisan inventory:check-alerts --notify
```

#### 3. Monthly CTLS Preparation
```bash
# Generate regulatory reports (existing command)
# Ensure all reconciliations are complete
php artisan inventory:check-alerts
```

---

## Best Practices

### Daily Operations

#### ✅ **DO:**
1. **Perform physical counts regularly**
   - Use the reconciliation system
   - Justify all discrepancies promptly
   - Investigate unexplained losses

2. **Monitor alerts daily**
   ```bash
   php artisan inventory:check-alerts
   ```

3. **Document everything**
   - Use detailed notes in reconciliation
   - Provide specific reasons for discrepancies
   - Maintain investigation records

#### ❌ **DON'T:**
1. **Ignore small discrepancies** - Even 1g shortages can trigger Health Canada reporting
2. **Delay justification** - Unjustified discrepancies create compliance risks
3. **Use generic reasons** - Be specific about loss causes

### Health Canada Compliance Checklist

#### Weekly Review:
- [ ] All physical counts completed and justified
- [ ] No pending variance alerts
- [ ] Loss/theft reports reviewed and updated
- [ ] Investigation status updated

#### Monthly Review:
- [ ] CTLS data prepared and validated
- [ ] Retention policies review
- [ ] Staff training on new procedures
- [ ] Compliance documentation updated

### Emergency Procedures

#### Immediate Theft Response:
1. **Secure the area**
2. **Call police if required**
3. **Create theft report immediately**:
   ```javascript
   POST /api/loss-theft-reports
   {
     "incident_type": "theft",
     "incident_category": "break_and_entry",
     // ... other details
     "police_notified": true
   }
   ```
4. **Notify Health Canada within 24 hours**

#### Significant Loss Response:
1. **Investigate immediately**
2. **Document everything**
3. **Check if Health Canada reporting required**
4. **Submit Form CS-FRM-011 if needed**

---

## Troubleshooting

### Common Issues

#### Issue: "Loss report not generated for discrepancy"
**Solution**: Check if discrepancy meets thresholds:
- Dried cannabis: ≥1g
- Fresh cannabis: ≥5g
- Valid unexplained reason

#### Issue: "Variance alerts not showing"
**Solution**: 
```bash
# Check for unjustified discrepancies
php artisan inventory:check-alerts

# Verify physical counts exist
php artisan tinker
>>> App\Models\InventoryPhysicalCount::where('justified_at', null)->count();
```

#### Issue: "Records not archiving"
**Solution**: Check retention policies:
```bash
php artisan tinker
>>> App\Models\RecordRetentionPolicy::where('is_active', true)->get();
```

---

## API Reference Summary

### Key Endpoints

```bash
# Inventory Reconciliation
POST /api/inventory/reconciliation/physical-count
POST /api/inventory/reconciliation/justify-discrepancy/{batch_id}

# Loss/Theft Reports
GET  /api/loss-theft-reports
POST /api/loss-theft-reports
GET  /api/loss-theft-reports/{id}/health-canada-form
POST /api/loss-theft-reports/{id}/mark-submitted

# Compliance Monitoring
GET  /api/compliance/alerts
GET  /api/compliance/retention-status
```

---

## Support and Resources

### Health Canada Resources
- **Cannabis Regulations**: https://laws-lois.justice.gc.ca/
- **Form CS-FRM-011**: Available from Health Canada
- **CTLS System**: https://www.canada.ca/en/health-canada/services/drugs-medication/cannabis/tracking-system/

### System Resources
- **Audit Logs**: All compliance actions are logged in `/storage/logs/`
- **Retention Policies**: Configurable via `RecordRetentionPolicy` model
- **Notifications**: Email alerts sent to responsible persons

---

*This manual covers the essential compliance features. For advanced configuration or custom requirements, consult your system administrator.*