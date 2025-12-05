<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Traits\BelongsToTenant;

class RecordRetentionPolicy extends Model
{
    use HasFactory, BelongsToTenant;

    protected $fillable = [
        'record_type',
        'description',
        'retention_period_months',
        'is_active',
        'retention_rules',
        'tenant_id',
    ];

    protected $casts = [
        'retention_rules' => 'array',
        'is_active' => 'boolean',
    ];

    /**
     * Health Canada minimum retention periods by record type
     */
    public const HEALTH_CANADA_MINIMUMS = [
        'traceability_events' => 24, // 2 years minimum
        'batches' => 24,
        'inventory_counts' => 24,
        'regulatory_reports' => 60, // 5 years for regulatory submissions
        'loss_theft_reports' => 84, // 7 years for loss/theft documentation
    ];

    /**
     * Default retention policies for Health Canada compliance
     */
    public static function getDefaultPolicies(): array
    {
        return [
            [
                'record_type' => 'traceability_events',
                'description' => 'Traceability events must be retained for minimum 2 years per Health Canada requirements',
                'retention_period_months' => 24,
                'is_active' => true,
                'retention_rules' => [
                    'auto_archive' => true,
                    'immutable_after_days' => 30,
                    'requires_approval_to_delete' => true,
                ]
            ],
            [
                'record_type' => 'batches',
                'description' => 'Batch records including all cultivation and processing data',
                'retention_period_months' => 24,
                'is_active' => true,
                'retention_rules' => [
                    'auto_archive' => true,
                    'immutable_after_days' => 7,
                    'requires_approval_to_delete' => true,
                ]
            ],
            [
                'record_type' => 'inventory_counts',
                'description' => 'Physical inventory counts and reconciliation records',
                'retention_period_months' => 24,
                'is_active' => true,
                'retention_rules' => [
                    'auto_archive' => true,
                    'immutable_after_days' => 1,
                    'requires_approval_to_delete' => true,
                ]
            ],
        ];
    }

    /**
     * Scope for active policies
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Get policy for specific record type
     */
    public static function getPolicyForRecordType(string $recordType, ?int $tenantId = null)
    {
        $query = static::where('record_type', $recordType)
            ->where('is_active', true);
            
        if ($tenantId) {
            $query->where('tenant_id', $tenantId);
        } else {
            $query->whereNull('tenant_id');
        }
        
        return $query->first();
    }

    /**
     * Calculate retention expiration date
     */
    public function calculateRetentionExpiration(\DateTime $recordDate): \DateTime
    {
        return (clone $recordDate)->modify("+{$this->retention_period_months} months");
    }

    /**
     * Check if record can be archived
     */
    public function canArchiveRecord(\DateTime $recordDate): bool
    {
        $expirationDate = $this->calculateRetentionExpiration($recordDate);
        return now() >= $expirationDate;
    }

    /**
     * Relationship with tenant
     */
    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }
}
