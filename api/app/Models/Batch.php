<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Traits\HasRecordRetention;

class Batch extends Model
{
    use HasFactory, HasRecordRetention;
    
    protected $fillable = [
        'name',
        'advance_to_harvesting_on',
        'current_units',
        'end_type',
        'variety',
        'projected_yield',
        'cultivation_area_id',
        'tenant_id',
        'facility_id',
        'parent_batch_id',
        'product_type',
        'is_packaged',
        'units',
        'sub_location',
        'retention_expires_at',
        'is_archived',
        'archived_at',
        'archive_reason',
        'is_recalled',
        'recalled_at',
        'recall_reason',
        'recalled_by_user_id',
        'status',
        'status_changed_at',
        'status_change_reason',
        'status_changed_by_user_id',
    ];
    
    /**
     * Valid batch statuses for Health Canada compliance
     */
    public const STATUSES = [
        'active' => 'Active',
        'on_hold' => 'On Hold',
        'quarantine' => 'Quarantine',
        'released' => 'Released',
        'in_transit' => 'In Transit',
        'destroyed' => 'Destroyed',
        'sold' => 'Sold',
        'archived' => 'Archived',
    ];
    
    /**
     * Status colors for UI display
     */
    public const STATUS_COLORS = [
        'active' => '#4CAF50',      // Green
        'on_hold' => '#ff9800',     // Orange
        'quarantine' => '#f44336',  // Red
        'released' => '#2196F3',    // Blue
        'in_transit' => '#9c27b0',  // Purple
        'destroyed' => '#616161',   // Gray
        'sold' => '#00bcd4',        // Cyan
        'archived' => '#9e9e9e',    // Light Gray
    ];
    
    protected $casts = [
        'advance_to_harvesting_on' => 'date',
        'projected_yield' => 'decimal:2',
        'is_packaged' => 'boolean',
        'current_units' => 'decimal:2',  // AÑADIDO: Casteo para current_units como decimal
        'retention_expires_at' => 'datetime',
        'archived_at' => 'datetime',
        'is_archived' => 'boolean',
        'is_recalled' => 'boolean',
        'recalled_at' => 'datetime',
        'status_changed_at' => 'datetime',
        // NOTA: 'units' no debe estar casteado como numérico, es una cadena de texto
    ];
    
    /**
     * The "booted" method of the model.
     *
     * @return void
     */
    protected static function booted()
    {
        static::creating(function ($batch) {
            // Assign tenant_id automatically if not present and tenant context exists.
            if (empty($batch->tenant_id) && function_exists('tenant') && tenant()) {
                $batch->tenant_id = tenant()->id;
            }
            // Assign facility_id automatically if not present and user's facility exists (if applicable)
            if (empty($batch->facility_id) && auth()->check() && auth()->user()->facility_id) {
                $batch->facility_id = auth()->user()->facility_id;
            }
        });
    }
    
    // Relation with the Tenant
    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }
    
    // Relation with the CultivationArea
    public function cultivationArea()
    {
        return $this->belongsTo(CultivationArea::class);
    }
    
    // Relation with the Facility
    public function facility()
    {
        return $this->belongsTo(Facility::class);
    }
    
    // Relation with the parent batch (if this batch was split from another)
    public function parentBatch()
    {
        return $this->belongsTo(Batch::class, 'parent_batch_id');
    }
    
    // Relation with child batches (if this batch was split into others)
    public function childBatches()
    {
        return $this->hasMany(Batch::class, 'parent_batch_id');
    }
    
    // Relation with traceability events
    public function traceabilityEvents()
    {
        return $this->hasMany(TraceabilityEvent::class, 'batch_id');
    }
    
    // Relation with loss/theft reports
    public function lossTheftReports()
    {
        return $this->hasMany(LossTheftReport::class, 'batch_id');
    }
    
    // Relation with the user who recalled the batch
    public function recalledBy()
    {
        return $this->belongsTo(User::class, 'recalled_by_user_id');
    }
    
    /**
     * Check if the batch is available for orders/sales
     * A batch is not available if it's archived or recalled
     */
    public function isAvailableForOrders(): bool
    {
        return !$this->is_archived && !$this->is_recalled;
    }
    
    /**
     * Scope to get only non-recalled batches
     */
    public function scopeNotRecalled($query)
    {
        return $query->where('is_recalled', false);
    }
    
    /**
     * Scope to get only recalled batches
     */
    public function scopeRecalled($query)
    {
        return $query->where('is_recalled', true);
    }
    
    /**
     * Scope to get only active batches (not archived and not recalled)
     */
    public function scopeActive($query)
    {
        return $query->where('is_archived', false)->where('is_recalled', false);
    }
    
    /**
     * Relation with the user who changed the status
     */
    public function statusChangedBy()
    {
        return $this->belongsTo(User::class, 'status_changed_by_user_id');
    }
    
    /**
     * Get the status label for display
     */
    public function getStatusLabelAttribute(): string
    {
        return self::STATUSES[$this->status] ?? ucfirst($this->status);
    }
    
    /**
     * Get the status color for UI
     */
    public function getStatusColorAttribute(): string
    {
        return self::STATUS_COLORS[$this->status] ?? '#9e9e9e';
    }
    
    /**
     * Check if the batch can have its status changed to the given status
     */
    public function canChangeStatusTo(string $newStatus): bool
    {
        // Cannot change from destroyed or sold
        if (in_array($this->status, ['destroyed', 'sold'])) {
            return false;
        }
        
        // Cannot change to the same status
        if ($this->status === $newStatus) {
            return false;
        }
        
        return array_key_exists($newStatus, self::STATUSES);
    }
    
    /**
     * Change the batch status with tracking
     */
    public function changeStatus(string $newStatus, ?string $reason = null, ?int $userId = null): bool
    {
        if (!$this->canChangeStatusTo($newStatus)) {
            return false;
        }
        
        $this->status = $newStatus;
        $this->status_changed_at = now();
        $this->status_change_reason = $reason;
        $this->status_changed_by_user_id = $userId ?? auth()->id();
        
        return $this->save();
    }
    
    /**
     * Scope to filter by status
     */
    public function scopeWithStatus($query, string|array $status)
    {
        if (is_array($status)) {
            return $query->whereIn('status', $status);
        }
        return $query->where('status', $status);
    }
    
    /**
     * Scope to exclude certain statuses
     */
    public function scopeExcludeStatus($query, string|array $status)
    {
        if (is_array($status)) {
            return $query->whereNotIn('status', $status);
        }
        return $query->where('status', '!=', $status);
    }
    
    /**
     * Scope to get only batches available for operations
     * (excludes destroyed, sold, and archived)
     */
    public function scopeAvailableForOperations($query)
    {
        return $query->whereNotIn('status', ['destroyed', 'sold', 'archived']);
    }
}