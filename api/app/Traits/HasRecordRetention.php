<?php

namespace App\Traits;

use App\Models\RecordRetentionPolicy;
use Carbon\Carbon;

trait HasRecordRetention
{
    /**
     * Boot the trait
     */
    protected static function bootHasRecordRetention()
    {
        static::creating(function ($model) {
            $model->setRetentionExpiration();
        });
    }

    /**
     * Set the retention expiration date based on policy
     */
    public function setRetentionExpiration()
    {
        $recordType = $this->getRecordType();
        $policy = RecordRetentionPolicy::getPolicyForRecordType($recordType, $this->tenant_id ?? null);
        
        if ($policy) {
            $this->retention_expires_at = $policy->calculateRetentionExpiration(
                $this->created_at ?? now()
            );
        } else {
            // Fallback to Health Canada minimum (24 months)
            $this->retention_expires_at = now()->addMonths(24);
        }
    }

    /**
     * Get the record type for retention policy lookup
     */
    protected function getRecordType(): string
    {
        $className = class_basename($this);
        
        return match($className) {
            'TraceabilityEvent' => 'traceability_events',
            'Batch' => 'batches',
            'InventoryPhysicalCount' => 'inventory_counts',
            default => strtolower(str_replace('\\', '_', $className))
        };
    }

    /**
     * Check if record is eligible for archival
     */
    public function isEligibleForArchival(): bool
    {
        return !$this->is_archived && 
               $this->retention_expires_at && 
               now() >= $this->retention_expires_at;
    }

    /**
     * Archive the record
     */
    public function archive(string $reason = 'Automatic archival per retention policy'): bool
    {
        if (!$this->isEligibleForArchival()) {
            return false;
        }

        $this->update([
            'is_archived' => true,
            'archived_at' => now(),
            'archive_reason' => $reason,
        ]);

        return true;
    }

    /**
     * Scope for non-archived records
     */
    public function scopeNotArchived($query)
    {
        return $query->where('is_archived', false);
    }

    /**
     * Scope for archived records
     */
    public function scopeArchived($query)
    {
        return $query->where('is_archived', true);
    }

    /**
     * Scope for records eligible for archival
     */
    public function scopeEligibleForArchival($query)
    {
        return $query->where('is_archived', false)
                    ->where('retention_expires_at', '<=', now());
    }

    /**
     * Get the retention policy for this record
     */
    public function getRetentionPolicy()
    {
        return RecordRetentionPolicy::getPolicyForRecordType(
            $this->getRecordType(),
            $this->tenant_id ?? null
        );
    }

    /**
     * Check if record is immutable (cannot be modified)
     */
    public function isImmutable(): bool
    {
        $policy = $this->getRetentionPolicy();
        
        if (!$policy || !isset($policy->retention_rules['immutable_after_days'])) {
            return false;
        }

        $immutableDate = $this->created_at->addDays($policy->retention_rules['immutable_after_days']);
        
        return now() >= $immutableDate;
    }

    /**
     * Check if record deletion requires approval
     */
    public function requiresApprovalToDelete(): bool
    {
        $policy = $this->getRetentionPolicy();
        
        return $policy && 
               isset($policy->retention_rules['requires_approval_to_delete']) && 
               $policy->retention_rules['requires_approval_to_delete'];
    }
}