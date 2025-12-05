<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Traits\BelongsToTenant;
use App\Traits\HasRecordRetention;
use Carbon\Carbon;

class LossTheftReport extends Model
{
    use HasFactory, BelongsToTenant, HasRecordRetention;

    protected $fillable = [
        'report_number',
        'incident_type',
        'incident_category',
        'incident_date',
        'discovery_date',
        'reported_to_hc_at',
        'facility_id',
        'specific_location',
        'sub_location',
        'batch_id',
        'product_type',
        'quantity_lost',
        'unit',
        'estimated_value',
        'description',
        'circumstances',
        'police_notified',
        'police_report_number',
        'police_notification_date',
        'investigation_status',
        'investigation_findings',
        'corrective_actions',
        'hc_report_status',
        'hc_confirmation_number',
        'reported_by_user_id',
        'tenant_id',
        'is_archived',
        'archived_at',
        'retention_expires_at',
    ];

    protected $casts = [
        'incident_date' => 'date',
        'discovery_date' => 'date',
        'police_notification_date' => 'date',
        'reported_to_hc_at' => 'datetime',
        'archived_at' => 'datetime',
        'retention_expires_at' => 'datetime',
        'quantity_lost' => 'decimal:3',
        'estimated_value' => 'decimal:2',
        'police_notified' => 'boolean',
        'is_archived' => 'boolean',
    ];

    /**
     * Health Canada thresholds for mandatory reporting
     */
    public const HC_REPORTING_THRESHOLDS = [
        'cannabis_dried' => 1.0, // 1g minimum
        'cannabis_oil' => 1.0,   // 1ml minimum  
        'cannabis_fresh' => 5.0, // 5g minimum
        'cannabis_plants' => 1,  // 1 plant minimum
    ];

    /**
     * Boot the model
     */
    protected static function booted()
    {
        static::creating(function ($report) {
            // Generate unique report number
            if (empty($report->report_number)) {
                $report->report_number = static::generateReportNumber();
            }
            
            // Set default discovery date if not provided
            if (empty($report->discovery_date)) {
                $report->discovery_date = now()->toDateString();
            }
            
            // Auto-assign tenant if in tenant context
            if (empty($report->tenant_id) && function_exists('tenant') && tenant()) {
                $report->tenant_id = tenant()->id;
            }
            
            // Set retention period to 7 years for loss/theft reports
            $report->retention_expires_at = now()->addYears(7);
        });
    }

    /**
     * Generate unique report number
     */
    public static function generateReportNumber(): string
    {
        $prefix = 'LT-' . date('Y');
        $sequence = str_pad(
            static::whereYear('created_at', date('Y'))->count() + 1,
            4,
            '0',
            STR_PAD_LEFT
        );
        
        return $prefix . '-' . $sequence;
    }

    /**
     * Check if quantity meets Health Canada reporting threshold
     */
    public function meetsReportingThreshold(): bool
    {
        $threshold = static::HC_REPORTING_THRESHOLDS[$this->product_type] ?? 0;
        return $this->quantity_lost >= $threshold;
    }

    /**
     * Check if report must be submitted to Health Canada
     */
    public function requiresHealthCanadaReporting(): bool
    {
        return $this->meetsReportingThreshold() || 
               in_array($this->incident_category, ['theft_in_transit', 'armed_robbery', 'break_and_entry']);
    }

    /**
     * Mark as reported to Health Canada
     */
    public function markReportedToHealthCanada(string $confirmationNumber = null)
    {
        $this->update([
            'reported_to_hc_at' => now(),
            'hc_report_status' => 'submitted',
            'hc_confirmation_number' => $confirmationNumber,
        ]);
    }

    /**
     * Auto-detect potential loss from inventory discrepancies
     */
    public static function detectFromInventoryDiscrepancy(
        $batch,
        float $discrepancyAmount,
        string $reason = null
    ): ?self {
        // Only create loss report for significant unexplained discrepancies
        if ($discrepancyAmount <= 0 || 
            ($reason && in_array(strtolower($reason), ['sampling', 'testing', 'processing loss']))) {
            return null;
        }

        // Check if discrepancy meets reporting threshold
        $productTypeMapping = [
            'dried' => 'cannabis_dried',
            'fresh' => 'cannabis_fresh', 
            'oil' => 'cannabis_oil',
            'plants' => 'cannabis_plants'
        ];
        
        $productType = $productTypeMapping[$batch->product_type] ?? 'cannabis_dried';
        $threshold = static::HC_REPORTING_THRESHOLDS[$productType] ?? 1.0;
        
        if ($discrepancyAmount < $threshold) {
            return null;
        }

        return static::create([
            'incident_type' => 'loss',
            'incident_category' => 'loss_unexplained',
            'facility_id' => $batch->facility_id,
            'batch_id' => $batch->id,
            'product_type' => $productType,
            'quantity_lost' => $discrepancyAmount,
            'unit' => $batch->units ?? 'g',
            'description' => "Unexplained inventory discrepancy detected for batch {$batch->name}",
            'circumstances' => $reason ? "Reported reason: {$reason}" : 'No specific reason provided',
            'reported_by_user_id' => auth()->id() ?? 1, // System user fallback
            'tenant_id' => $batch->tenant_id,
        ]);
    }

    /**
     * Relationships
     */
    public function facility()
    {
        return $this->belongsTo(Facility::class);
    }

    public function batch()
    {
        return $this->belongsTo(Batch::class);
    }

    public function reportedBy()
    {
        return $this->belongsTo(User::class, 'reported_by_user_id');
    }

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    /**
     * Scopes
     */
    public function scopePendingHealthCanadaReport($query)
    {
        return $query->where('hc_report_status', 'pending')
                    ->where(function($q) {
                        $q->whereColumn('quantity_lost', '>=', 
                            \DB::raw('CASE 
                                WHEN product_type = "cannabis_dried" THEN 1.0
                                WHEN product_type = "cannabis_oil" THEN 1.0
                                WHEN product_type = "cannabis_fresh" THEN 5.0
                                WHEN product_type = "cannabis_plants" THEN 1
                                ELSE 1.0
                            END')
                        );
                    });
    }

    public function scopeTheft($query)
    {
        return $query->where('incident_type', 'theft');
    }

    public function scopeLoss($query)
    {
        return $query->where('incident_type', 'loss');
    }

    /**
     * Override record type for retention
     */
    protected function getRecordType(): string
    {
        return 'loss_theft_reports';
    }
}
