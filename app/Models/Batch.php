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
    ];

    protected $casts = [
        'advance_to_harvesting_on' => 'date',
        'projected_yield' => 'decimal:2',
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function cultivationArea()
    {
        return $this->belongsTo(CultivationArea::class);
    }
}
