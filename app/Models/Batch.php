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
    ];

    protected $casts = [
        'advance_to_harvesting_on' => 'date',
        'projected_yield' => 'decimal:2',
    ];

    // Relación con el Tenant
    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    // Relación con el CultivationArea
    public function cultivationArea()
    {
        return $this->belongsTo(CultivationArea::class);
    }

    // NUEVA Relación con la Facility
    public function facility()
    {
        return $this->belongsTo(Facility::class);
    }

    // NUEVA Relación con el lote padre (si este lote fue dividido de otro)
    public function parentBatch()
    {
        return $this->belongsTo(Batch::class, 'parent_batch_id');
    }

    // NUEVA Relación con los lotes hijos (si este lote fue dividido en otros)
    public function childBatches()
    {
        return $this->hasMany(Batch::class, 'parent_batch_id');
    }

    public function traceabilityEvents()
    {
        return $this->hasMany(TraceabilityEvent::class, 'batch_id');
    }
}
