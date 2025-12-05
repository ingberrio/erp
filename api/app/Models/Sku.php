<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Sku extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenant_id',
        'name',
        'variety_id',
        'sales_class',
        'gtin_12',
        'gtin_14',
        'status',
        'end_type',
        'cannabis_class',
        'unit',
        'type',
        'unit_quantity',
        'unit_weight',
        'total_packaged_weight',
        'target_weight',
        'estimated_price',
        'cost_per_package',
        'current_inventory',
        'total_product_weight',
        'is_ghost_sku',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'unit_quantity' => 'decimal:2',
        'unit_weight' => 'decimal:2',
        'total_packaged_weight' => 'decimal:2',
        'target_weight' => 'decimal:2',
        'estimated_price' => 'decimal:2',
        'cost_per_package' => 'decimal:2',
        'current_inventory' => 'decimal:2',
        'total_product_weight' => 'decimal:2',
        'is_ghost_sku' => 'boolean',
    ];

    /**
     * Boot method for model events
     */
    protected static function booted()
    {
        static::creating(function ($sku) {
            if (auth()->check()) {
                $sku->created_by = auth()->id();
                $sku->updated_by = auth()->id();
            }
            // Calculate target weight
            $sku->target_weight = $sku->unit_weight * $sku->unit_quantity;
        });

        static::updating(function ($sku) {
            if (auth()->check()) {
                $sku->updated_by = auth()->id();
            }
            // Recalculate target weight
            $sku->target_weight = $sku->unit_weight * $sku->unit_quantity;
        });
    }

    /**
     * Relationships
     */
    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function variety()
    {
        return $this->belongsTo(Variety::class);
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
    public function scopeEnabled($query)
    {
        return $query->where('status', 'enabled');
    }

    public function scopeDisabled($query)
    {
        return $query->where('status', 'disabled');
    }

    public function scopeBySalesClass($query, $salesClass)
    {
        return $query->where('sales_class', $salesClass);
    }

    public function scopeByType($query, $type)
    {
        return $query->where('type', $type);
    }

    /**
     * Get unit weight in kg
     */
    public function getUnitWeightKgAttribute()
    {
        return $this->unit_weight / 1000;
    }

    /**
     * Get formatted price
     */
    public function getFormattedPriceAttribute()
    {
        return 'CA$' . number_format($this->estimated_price, 2);
    }
}
