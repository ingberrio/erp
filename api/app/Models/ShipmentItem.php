<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Scopes\TenantScope;

class ShipmentItem extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'tenant_id',
        'shipment_id',
        'order_item_id',
        'batch_id',
        'quantity_shipped',
        'unit',
        'product_name',
        'batch_lot_number',
        'batch_expiry_date',
        'package_number',
        'thc_content',
        'cbd_content',
        'compliance_notes',
    ];

    protected $casts = [
        'quantity_shipped' => 'decimal:2',
        'batch_expiry_date' => 'date',
        'thc_content' => 'decimal:2',
        'cbd_content' => 'decimal:2',
    ];

    protected static function booted(): void
    {
        static::addGlobalScope(new TenantScope);
    }

    // Relationships
    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function shipment()
    {
        return $this->belongsTo(Shipment::class);
    }

    public function orderItem()
    {
        return $this->belongsTo(CrmOrderItem::class, 'order_item_id');
    }

    public function batch()
    {
        return $this->belongsTo(Batch::class);
    }

    // Scopes
    public function scopeForShipment($query, $shipmentId)
    {
        return $query->where('shipment_id', $shipmentId);
    }

    public function scopeForBatch($query, $batchId)
    {
        return $query->where('batch_id', $batchId);
    }
}
