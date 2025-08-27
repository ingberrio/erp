<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CultivationArea extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'description',
        'capacity_units',
        'capacity_unit_type',
        'facility_id',
        'current_stage_id',
        'tenant_id',
        'order', // Asegúrate de que 'order' esté en fillable
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function facility()
    {
        return $this->belongsTo(Facility::class);
    }

    public function currentStage()
    {
        return $this->belongsTo(Stage::class, 'current_stage_id');
    }

    public function batches()
    {
        return $this->hasMany(Batch::class);
    }
}
