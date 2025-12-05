# Health Canada Compliance - Quick Reference Guide
## Daily Operations Examples

### 🚨 Quick Emergency Procedures

#### **THEFT DISCOVERED**
```bash
# 1. Immediate response
curl -X POST http://localhost:8000/api/loss-theft-reports \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "incident_type": "theft",
    "incident_category": "break_and_entry",
    "incident_date": "2025-08-27",
    "discovery_date": "2025-08-27",
    "facility_id": 1,
    "product_type": "cannabis_dried",
    "quantity_lost": 50.0,
    "unit": "g",
    "description": "Break-in discovered this morning",
    "police_notified": true
  }'

# 2. Check if Health Canada reporting required
# Response will include: "requires_hc_reporting": true/false
```

---

### 📊 Daily Compliance Checks

#### **Morning Routine (5 minutes)**
```bash
# 1. Check for alerts
php artisan inventory:check-alerts

# 2. Review pending discrepancies
curl -X GET "http://localhost:8000/api/inventory/reconciliation?facility_id=1" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### **Evening Routine (10 minutes)**
```bash
# 1. Archive expired records if any
php artisan records:archive --dry-run

# 2. Check theft patterns
php artisan inventory:check-alerts --notify
```

---

### 🔍 Common Scenarios with Examples

#### **Scenario 1: Physical Count Shows Shortage**

**Situation**: Counted 95g but system shows 100g

```javascript
// Step 1: Record physical count
fetch('/api/inventory/reconciliation/physical-count', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: JSON.stringify({
    batch_id: 456,
    counted_quantity: 95.0,
    count_date: '2025-08-27',
    facility_id: 1,
    notes: 'Full inventory count performed'
  })
});

// Step 2: Justify the discrepancy
fetch('/api/inventory/reconciliation/justify-discrepancy/456', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: JSON.stringify({
    reason_id: 12, // Processing loss
    notes: 'Lost during trimming process, within normal parameters'
  })
});
```

**Expected Result**:
- ✅ If loss is explainable: No loss report generated
- ⚠️ If loss is unexplained: Automatic loss report created

---

#### **Scenario 2: Investigating a Loss Report**

```bash
# 1. Get all pending loss reports
curl -X GET "http://localhost:8000/api/loss-theft-reports?status=pending" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 2. Update investigation status
curl -X PUT "http://localhost:8000/api/loss-theft-reports/789" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "investigation_status": "completed",
    "investigation_findings": "Security camera review shows no unauthorized access. Likely processing loss during extraction.",
    "corrective_actions": "Enhanced monitoring of extraction process implemented."
  }'
```

---

#### **Scenario 3: Health Canada Submission Required**

```bash
# 1. Check if report requires Health Canada submission
curl -X GET "http://localhost:8000/api/loss-theft-reports/789/health-canada-form" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 2. If required, get form data and submit to Health Canada
# (Form data returned in standardized format)

# 3. Mark as submitted after Health Canada confirmation
curl -X POST "http://localhost:8000/api/loss-theft-reports/789/mark-submitted" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "confirmation_number": "HC-2025-567890",
    "submission_notes": "Submitted via Health Canada portal"
  }'
```

---

### 📋 Weekly Compliance Checklist

#### **Monday: Review & Clean Up**
```bash
# Archive old records
php artisan records:archive

# Check compliance status
php artisan inventory:check-alerts > weekly_report.txt
```

#### **Wednesday: Mid-Week Check**
```bash
# Quick variance check
php artisan inventory:check-alerts

# Review any new loss reports
curl -X GET "http://localhost:8000/api/loss-theft-reports?created_since=7_days_ago" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### **Friday: Week End Preparation**
```bash
# Full compliance review
php artisan inventory:check-alerts --notify

# Prepare weekend report
echo "Week $(date +%V) Compliance Report" > compliance_report.txt
php artisan inventory:check-alerts >> compliance_report.txt
```

---

### 🎯 Health Canada Threshold Quick Reference

| Product Type | Minimum Reportable | Example |
|--------------|-------------------|---------|
| Dried Cannabis | 1.0g | ✅ 2g loss = Report required |
| Fresh Cannabis | 5.0g | ❌ 3g loss = No report needed |
| Cannabis Oil | 1.0ml | ✅ 1.5ml loss = Report required |
| Cannabis Plants | 1 plant | ✅ Any plant loss = Report required |

### 🔧 Troubleshooting Quick Fixes

#### **Issue**: Physical count not updating batch
```bash
# Check if batch exists and is active
curl -X GET "http://localhost:8000/api/batches/456" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### **Issue**: Loss report not generating automatically
```javascript
// Check discrepancy amount and reason
console.log('Discrepancy:', expectedQuantity - actualQuantity);
console.log('Reason:', justificationReason);
console.log('Meets threshold:', discrepancy >= 1.0);
```

#### **Issue**: Alerts not showing up
```bash
# Manual check for unjustified discrepancies
php artisan tinker
>>> \App\Models\InventoryPhysicalCount::whereNull('justified_at')->with('batch')->get();
```

---

### 📞 Emergency Contact Procedure

#### **Critical Loss/Theft (>100g or high-value)**
1. **Call police immediately**
2. **Create theft report in system**
3. **Contact Health Canada within 24 hours**
4. **Notify insurance company**
5. **Document everything**

#### **System Issues During Inspection**
1. **Export data manually**:
   ```bash
   php artisan tinker
   >>> \App\Models\TraceabilityEvent::with('batch','facility')->get()->toJson();
   ```
2. **Generate compliance report**:
   ```bash
   php artisan inventory:check-alerts > inspection_report.txt
   ```

---

### 💡 Pro Tips

#### **Best Practices**
- ✅ Perform counts during consistent times
- ✅ Use detailed notes for all discrepancies
- ✅ Train multiple staff on procedures
- ✅ Review alerts daily, not weekly

#### **Avoid These Mistakes**
- ❌ Ignoring small discrepancies (even 1g matters)
- ❌ Using generic justification reasons
- ❌ Delaying discrepancy justification
- ❌ Not documenting investigation steps

#### **Efficiency Tips**
```bash
# Create aliases for common commands
alias check-compliance='php artisan inventory:check-alerts'
alias archive-records='php artisan records:archive'

# Daily one-liner
check-compliance && echo "✅ No compliance issues found"
```

---

### 📱 Mobile-Friendly Quick Commands

For tablet/mobile access during physical counts:

```javascript
// Simple physical count submission
const submitCount = async (batchId, quantity) => {
  const response = await fetch('/api/inventory/reconciliation/physical-count', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: JSON.stringify({
      batch_id: batchId,
      counted_quantity: quantity,
      count_date: new Date().toISOString().split('T')[0],
      facility_id: getCurrentFacilityId()
    })
  });
  return response.json();
};
```

---

*Keep this guide handy for daily operations. For detailed explanations, refer to the full Health Canada Compliance Manual.*