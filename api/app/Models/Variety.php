<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Variety extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenant_id',
        'name',
        'strain',
        'description',
        'thc_range',
        'cbd_range',
        'flowering_time_days',
        'yield_potential',
        'is_active',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'strain' => 'array',
        'is_active' => 'boolean',
        'flowering_time_days' => 'integer',
    ];

    /**
     * Boot method for model events
     */
    protected static function booted()
    {
        static::creating(function ($variety) {
            if (auth()->check()) {
                $variety->created_by = auth()->id();
                $variety->updated_by = auth()->id();
            }
        });

        static::updating(function ($variety) {
            if (auth()->check()) {
                $variety->updated_by = auth()->id();
            }
        });
    }

    /**
     * Relationships
     */
    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updater()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /**
     * Scopes
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeByStrain($query, $strain)
    {
        return $query->whereJsonContains('strain', $strain);
    }

    /**
     * Get strain as comma-separated string
     */
    public function getStrainDisplayAttribute()
    {
        if (empty($this->strain)) {
            return '-';
        }
        return implode(', ', $this->strain);
    }
}
