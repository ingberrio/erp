<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Scopes\TenantScope;

class CrmOrderItem extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'tenant_id',
        'order_id',
        'sku_id',
        'batch_id',
        'product_name',
        'product_sku',
        'variety',
        'product_type',
        'quantity_ordered',
        'quantity_fulfilled',
        'quantity_shipped',
        'unit',
        'unit_price',
        'discount_percent',
        'discount_amount',
        'tax_rate',
        'tax_amount',
        'line_total',
        'status',
        'batch_lot_number',
        'batch_expiry_date',
        'compliance_notes',
        'notes',
        'sort_order',
    ];

    protected $casts = [
        'quantity_ordered' => 'decimal:2',
        'quantity_fulfilled' => 'decimal:2',
        'quantity_shipped' => 'decimal:2',
        'unit_price' => 'decimal:2',
        'discount_percent' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'tax_rate' => 'decimal:2',
        'tax_amount' => 'decimal:2',
        'line_total' => 'decimal:2',
        'batch_expiry_date' => 'date',
    ];

    const STATUSES = [
        'pending' => 'Pending',
        'allocated' => 'Allocated',
        'fulfilled' => 'Fulfilled',
        'shipped' => 'Shipped',
        'delivered' => 'Delivered',
        'cancelled' => 'Cancelled',
        'returned' => 'Returned',
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

    public function order()
    {
        return $this->belongsTo(CrmOrder::class, 'order_id');
    }

    public function sku()
    {
        return $this->belongsTo(Sku::class);
    }

    public function batch()
    {
        return $this->belongsTo(Batch::class);
    }

    public function shipmentItems()
    {
        return $this->hasMany(ShipmentItem::class, 'order_item_id');
    }

    // Calculated attributes
    public function getQuantityRemainingAttribute(): float
    {
        return $this->quantity_ordered - $this->quantity_fulfilled;
    }

    public function getIsFullyFulfilledAttribute(): bool
    {
        return $this->quantity_fulfilled >= $this->quantity_ordered;
    }

    // Calculate line total
    public function calculateTotal(): void
    {
        $subtotal = $this->unit_price * $this->quantity_ordered;
        $discount = $this->discount_amount ?: ($subtotal * ($this->discount_percent / 100));
        $taxable = $subtotal - $discount;
        $tax = $taxable * ($this->tax_rate / 100);
        
        $this->discount_amount = $discount;
        $this->tax_amount = $tax;
        $this->line_total = $taxable + $tax;
    }

    // Validate batch can be used
    public function validateBatch(): array
    {
        $errors = [];
        
        if ($this->batch) {
            if ($this->batch->is_recalled) {
                $errors[] = "Batch {$this->batch->name} is recalled and cannot be used.";
            }
            if ($this->batch->is_archived) {
                $errors[] = "Batch {$this->batch->name} is archived.";
            }
            if (in_array($this->batch->status, ['destroyed', 'sold', 'quarantine'])) {
                $errors[] = "Batch {$this->batch->name} has status '{$this->batch->status}' and is not available.";
            }
            if ($this->batch->current_units < $this->quantity_ordered) {
                $errors[] = "Batch {$this->batch->name} has insufficient quantity ({$this->batch->current_units} available, {$this->quantity_ordered} requested).";
            }
        }
        
        return $errors;
    }

    // Scopes
    public function scopeByStatus($query, $status)
    {
        return $query->where('status', $status);
    }

    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    public function scopeForOrder($query, $orderId)
    {
        return $query->where('order_id', $orderId);
    }
}
