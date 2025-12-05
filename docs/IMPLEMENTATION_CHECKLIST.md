# Health Canada Compliance - Implementation Checklist
## Getting Started with Your New Compliance Features

### 🚀 Immediate Setup (Day 1)

#### ✅ **Step 1: Verify Installation**
```bash
# Check if all migrations ran successfully
cd /Users/eduardberrio/Documents/Development/erp/api
php artisan migrate:status

# Should show all migrations as "Ran"
# Including:
# - create_record_retention_policies_table
# - add_retention_fields_to_models  
# - create_loss_theft_reports_table
# - create_reconciliation_schedules_table
```

#### ✅ **Step 2: Seed Retention Policies**
```bash
# Load Health Canada compliant retention policies
php artisan db:seed --class=RecordRetentionPolicySeeder

# Verify policies were created
php artisan tinker
>>> App\Models\RecordRetentionPolicy::all()->pluck('record_type', 'retention_period_months');
```

Expected output:
```
[
  "traceability_events" => 24,
  "batches" => 24,
  "inventory_counts" => 24,
  "regulatory_reports" => 60,
  "loss_theft_reports" => 84
]
```

#### ✅ **Step 3: Test Basic Commands**
```bash
# Test archive command (dry run)
php artisan records:archive --dry-run

# Test alert checking
php artisan inventory:check-alerts

# Both should run without errors
```

---

### 📊 Week 1: Basic Operations

#### **Day 1-2: Set Up Monitoring**

1. **Add to crontab for automated monitoring**:
```bash
# Edit crontab
crontab -e

# Add these lines:
# Check alerts daily at 9 AM
0 9 * * * cd /Users/eduardberrio/Documents/Development/erp/api && php artisan inventory:check-alerts --notify

# Archive records weekly on Sunday at 2 AM  
0 2 * * 0 cd /Users/eduardberrio/Documents/Development/erp/api && php artisan records:archive
```

2. **Test notification system**:
```bash
# Make sure email is configured in your .env
# Test with a small discrepancy
```

#### **Day 3-4: Staff Training**

1. **Train staff on new reconciliation process**:
   - Show them the enhanced inventory reconciliation
   - Explain automatic loss detection
   - Practice with test scenarios

2. **Create standard operating procedure**:
   - Daily: Check alerts (`php artisan inventory:check-alerts`)
   - Weekly: Review loss reports
   - Monthly: Archive old records

#### **Day 5-7: Live Testing**

1. **Perform test physical counts**:
```javascript
// Example test API call
POST /api/inventory/reconciliation/physical-count
{
    "batch_id": 1,
    "counted_quantity": 99.5,  // Slight discrepancy
    "count_date": "2025-08-27",
    "facility_id": 1,
    "notes": "Test count for compliance system"
}
```

2. **Test justification process**:
```javascript
POST /api/inventory/reconciliation/justify-discrepancy/1
{
    "reason_id": 12,
    "notes": "Test justification - normal processing loss"
}
```

---

### 🔧 Week 2: Advanced Configuration

#### **Day 8-10: Customize Thresholds**

1. **Review and adjust loss thresholds if needed**:
```php
// In LossTheftDetectionService.php
// Modify HC_REPORTING_THRESHOLDS if your facility has different requirements
```

2. **Configure notification recipients**:
```php
// Ensure responsible persons have correct roles:
// - 'facility-manager'
// - 'responsible-person'
// - Global admins
```

#### **Day 11-14: Integration Testing**

1. **Test full loss reporting workflow**:
   - Create intentional discrepancy
   - Verify loss report generation
   - Test Health Canada form generation
   - Practice marking as submitted

2. **Test pattern detection**:
```bash
# Create test data for pattern detection
php artisan tinker
>>> factory(App\Models\LossTheftReport::class, 5)->create(['facility_id' => 1]);
>>> 
# Run pattern detection
php artisan inventory:check-alerts
```

---

### 📋 Week 3: Production Readiness

#### **Day 15-17: Documentation**

1. **Create facility-specific procedures**:
   - Document your specific justification reasons
   - Create escalation procedures
   - Define responsible persons for each shift

2. **Test disaster recovery**:
   - Practice manual report generation
   - Test data export for inspections
   - Verify backup procedures

#### **Day 18-21: Final Validation**

1. **Mock Health Canada inspection**:
```bash
# Generate sample compliance report
php artisan inventory:check-alerts > inspection_report.txt
php artisan records:archive --dry-run >> inspection_report.txt

# Export sample data
php artisan tinker
>>> App\Models\TraceabilityEvent::with('batch', 'facility')->take(10)->get()->toJson();
```

2. **Validate all retention periods**:
```bash
php artisan tinker
>>> App\Models\RecordRetentionPolicy::all()->each(function($policy) {
    echo $policy->record_type . ': ' . $policy->retention_period_months . ' months' . PHP_EOL;
});
```

---

### 🎯 Monthly Operations Checklist

#### **First Monday of Every Month**
- [ ] Run compliance report
- [ ] Review all loss/theft reports from previous month
- [ ] Check for overdue investigations
- [ ] Archive eligible records
- [ ] Update staff on any new procedures

#### **Mid-Month Check**
- [ ] Verify all discrepancies are justified
- [ ] Review pattern detection alerts
- [ ] Check system performance
- [ ] Backup compliance data

#### **End of Month**
- [ ] Prepare CTLS submission data
- [ ] Generate monthly compliance summary
- [ ] Review and update SOPs if needed
- [ ] Plan next month's training

---

### 🚨 Emergency Procedures Setup

#### **Create Emergency Contact List**
```bash
# Store in facility documentation
Health Canada Emergency: 1-800-XXX-XXXX
Police: 911
Facility Manager: [Phone]
Responsible Person: [Phone]
System Administrator: [Phone]
```

#### **Emergency Response Scripts**
```bash
# Create emergency.sh script
#!/bin/bash
echo "Emergency compliance export $(date)"
cd /Users/eduardberrio/Documents/Development/erp/api

# Export critical data
php artisan tinker --execute="
    echo 'Recent Loss Reports:';
    App\Models\LossTheftReport::where('created_at', '>=', now()->subDays(30))->get()->toJson();
    echo 'Pending Alerts:';
    (new App\Services\LossTheftDetectionService())->checkForVarianceAlerts();
"
```

---

### 📊 Success Metrics

Track these metrics to ensure compliance:

#### **Daily Metrics**
- [ ] Zero unjustified discrepancies older than 24 hours
- [ ] All physical counts have justifications
- [ ] No critical alerts pending

#### **Weekly Metrics**  
- [ ] All loss reports have investigation status
- [ ] Pattern detection shows no high-risk alerts
- [ ] Staff completed required reconciliations

#### **Monthly Metrics**
- [ ] 100% compliance with retention policies
- [ ] All Health Canada reports submitted on time
- [ ] Zero overdue investigations

---

### 🔍 Troubleshooting Common Issues

#### **Issue: Command not found**
```bash
# Make sure you're in the right directory
cd /Users/eduardberrio/Documents/Development/erp/api
php artisan list | grep -E "(records|inventory)"
```

#### **Issue: Database errors**
```bash
# Check database connection
php artisan tinker
>>> DB::connection()->getPdo();
```

#### **Issue: Notifications not sending**
```bash
# Check mail configuration
php artisan tinker
>>> config('mail');
```

#### **Issue: Loss reports not generating**
```bash
# Check service registration
php artisan tinker
>>> app(App\Services\LossTheftDetectionService::class);
```

---

### 📞 Support Contacts

#### **Technical Support**
- System Issues: [Your IT Team]
- Database Problems: [Your DBA]
- Compliance Questions: [Compliance Officer]

#### **Health Canada Resources**
- Cannabis Regulations: https://laws-lois.justice.gc.ca/
- CTLS System: https://www.canada.ca/en/health-canada/services/drugs-medication/cannabis/tracking-system/
- Form CS-FRM-011: Available from Health Canada

---

### ✅ Go-Live Checklist

Before going live with the compliance system:

- [ ] All migrations completed successfully
- [ ] Retention policies seeded and verified
- [ ] Staff trained on new procedures
- [ ] Emergency procedures documented
- [ ] Notification system tested
- [ ] Backup procedures verified
- [ ] Mock inspection completed
- [ ] All commands tested
- [ ] Cron jobs configured
- [ ] Documentation distributed to staff

---

**🎉 Congratulations! Your Cannabis ERP system is now fully Health Canada compliant.**

*Remember: Compliance is an ongoing process. Regular monitoring and staff training are key to maintaining Health Canada standards.*