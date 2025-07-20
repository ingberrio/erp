<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Batch extends Model
{
    use HasFactory;

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
        'product_type', // <-- NEW: Added product_type to fillable
    ];

    protected $casts = [
        'advance_to_harvesting_on' => 'date',
        'projected_yield' => 'decimal:2',
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
            // This assumes Auth::user() is available and has a facility_id
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

    // NEW Relation with the Facility
    public function facility()
    {
        return $this->belongsTo(Facility::class);
    }

    // NEW Relation with the parent batch (if this batch was split from another)
    public function parentBatch()
    {
        return $this->belongsTo(Batch::class, 'parent_batch_id');
    }

    // NEW Relation with child batches (if this batch was split into others)
    public function childBatches()
    {
        return $this->hasMany(Batch::class, 'parent_batch_id');
    }

    // Relation with traceability events
    public function traceabilityEvents()
    {
        return $this->hasMany(TraceabilityEvent::class, 'batch_id');
    }
}
