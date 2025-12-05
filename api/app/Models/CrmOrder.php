<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Scopes\TenantScope;

class CrmOrder extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'tenant_id',
        'account_id',
        'order_status',
        'order_type',
        'shipping_status',
        'order_placed_by',
        'received_date',
        'due_date',
        'purchase_order',
        // Shipping Address
        'shipping_address_line1',
        'shipping_address_line2',
        'shipping_city',
        'shipping_province',
        'shipping_postal_code',
        'shipping_country',
        // Financial
        'subtotal',
        'tax_amount',
        'shipping_cost',
        'discount_amount',
        'total',
        'currency',
        // License
        'customer_license',
        'is_oversold',
        // Additional
        'notes',
        'internal_notes',
        'created_by',
        'approved_by',
        'approved_at',
    ];

    protected $casts = [
        'received_date' => 'datetime',
        'due_date' => 'datetime',
        'subtotal' => 'decimal:2',
        'tax_amount' => 'decimal:2',
        'shipping_cost' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'total' => 'decimal:2',
        'is_oversold' => 'boolean',
        'approved_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected $appends = ['formatted_total', 'formatted_subtotal'];

    /**
     * Boot the model.
     */
    protected static function booted(): void
    {
        static::addGlobalScope(new TenantScope);
    }

    /**
     * Get formatted total
     */
    public function getFormattedTotalAttribute(): string
    {
        return number_format($this->total, 2) . ' ' . $this->currency;
    }

    /**
     * Get formatted subtotal
     */
    public function getFormattedSubtotalAttribute(): string
    {
        return number_format($this->subtotal, 2) . ' ' . $this->currency;
    }

    /**
     * Get the full shipping address.
     */
    public function getFullShippingAddressAttribute(): string
    {
        $parts = array_filter([
            $this->shipping_address_line1,
            $this->shipping_address_line2,
            $this->shipping_city,
            $this->shipping_province,
            $this->shipping_postal_code,
            $this->shipping_country,
        ]);
        return implode(', ', $parts);
    }

    /**
     * Relationships
     */
    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function account()
    {
        return $this->belongsTo(CrmAccount::class, 'account_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    /**
     * Calculate totals
     */
    public function calculateTotals(): void
    {
        $this->total = $this->subtotal + $this->tax_amount + $this->shipping_cost - $this->discount_amount;
    }

    /**
     * Scopes
     */
    public function scopeByStatus($query, $status)
    {
        return $query->where('order_status', $status);
    }

    public function scopeByShippingStatus($query, $status)
    {
        return $query->where('shipping_status', $status);
    }

    public function scopeByOrderType($query, $type)
    {
        return $query->where('order_type', $type);
    }

    public function scopeByAccount($query, $accountId)
    {
        return $query->where('account_id', $accountId);
    }

    public function scopePending($query)
    {
        return $query->where('order_status', 'pending');
    }

    public function scopeApproved($query)
    {
        return $query->where('order_status', 'approved');
    }
}
