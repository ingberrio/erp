<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Scopes\TenantScope;

class Shipment extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'tenant_id',
        'order_id',
        'facility_id',
        'shipment_number',
        'manifest_number',
        'carrier_name',
        'carrier_service',
        'tracking_number',
        'tracking_url',
        'status',
        'estimated_ship_date',
        'actual_ship_date',
        'estimated_delivery_date',
        'actual_delivery_date',
        'ship_to_name',
        'ship_to_company',
        'ship_to_address_line1',
        'ship_to_address_line2',
        'ship_to_city',
        'ship_to_province',
        'ship_to_postal_code',
        'ship_to_country',
        'ship_to_phone',
        'ship_to_email',
        'ship_from_name',
        'ship_from_address_line1',
        'ship_from_city',
        'ship_from_province',
        'ship_from_postal_code',
        'package_count',
        'total_weight',
        'weight_unit',
        'package_dimensions',
        'shipping_cost',
        'insurance_cost',
        'currency',
        'license_number',
        'requires_signature',
        'age_verification_required',
        'special_instructions',
        'compliance_notes',
        'signed_by',
        'signature_date',
        'delivery_notes',
        'internal_notes',
        'created_by',
        'shipped_by',
    ];

    protected $casts = [
        'estimated_ship_date' => 'datetime',
        'actual_ship_date' => 'datetime',
        'estimated_delivery_date' => 'datetime',
        'actual_delivery_date' => 'datetime',
        'signature_date' => 'datetime',
        'total_weight' => 'decimal:2',
        'shipping_cost' => 'decimal:2',
        'insurance_cost' => 'decimal:2',
        'requires_signature' => 'boolean',
        'age_verification_required' => 'boolean',
        'package_dimensions' => 'array',
    ];

    const STATUSES = [
        'draft' => 'Draft',
        'pending' => 'Pending',
        'label_created' => 'Label Created',
        'picked_up' => 'Picked Up',
        'in_transit' => 'In Transit',
        'out_for_delivery' => 'Out for Delivery',
        'delivered' => 'Delivered',
        'exception' => 'Exception',
        'returned' => 'Returned',
        'cancelled' => 'Cancelled',
    ];

    const CARRIERS = [
        'fedex' => 'FedEx',
        'ups' => 'UPS',
        'purolator' => 'Purolator',
        'canada_post' => 'Canada Post',
        'dhl' => 'DHL',
        'other' => 'Other',
    ];

    protected static function booted(): void
    {
        static::addGlobalScope(new TenantScope);
        
        static::creating(function ($shipment) {
            if (empty($shipment->shipment_number)) {
                $shipment->shipment_number = self::generateShipmentNumber($shipment->tenant_id);
            }
        });
    }

    public static function generateShipmentNumber($tenantId): string
    {
        $prefix = 'SHP';
        $date = now()->format('Ymd');
        $count = self::withoutGlobalScopes()
            ->where('tenant_id', $tenantId)
            ->whereDate('created_at', today())
            ->count() + 1;
        
        return sprintf('%s-%s-%04d', $prefix, $date, $count);
    }

    public static function generateManifestNumber($tenantId): string
    {
        $prefix = 'MAN';
        $date = now()->format('Ymd');
        $random = strtoupper(substr(md5(uniqid()), 0, 4));
        
        return sprintf('%s-%s-%s', $prefix, $date, $random);
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

    public function facility()
    {
        return $this->belongsTo(Facility::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function shipper()
    {
        return $this->belongsTo(User::class, 'shipped_by');
    }

    public function items()
    {
        return $this->hasMany(ShipmentItem::class);
    }

    // Calculated attributes
    public function getFullShipToAddressAttribute(): string
    {
        $parts = array_filter([
            $this->ship_to_address_line1,
            $this->ship_to_address_line2,
            $this->ship_to_city,
            $this->ship_to_province,
            $this->ship_to_postal_code,
            $this->ship_to_country,
        ]);
        return implode(', ', $parts);
    }

    public function getTotalCostAttribute(): float
    {
        return $this->shipping_cost + $this->insurance_cost;
    }

    // Status helpers
    public function canShip(): bool
    {
        return in_array($this->status, ['draft', 'pending', 'label_created']);
    }

    public function isDelivered(): bool
    {
        return $this->status === 'delivered';
    }

    public function markAsShipped($userId = null): void
    {
        $this->status = 'in_transit';
        $this->actual_ship_date = now();
        $this->shipped_by = $userId ?? auth()->id();
        $this->save();
    }

    public function markAsDelivered($signedBy = null, $notes = null): void
    {
        $this->status = 'delivered';
        $this->actual_delivery_date = now();
        $this->signed_by = $signedBy;
        $this->signature_date = now();
        $this->delivery_notes = $notes;
        $this->save();
    }

    // Copy address from order
    public function copyAddressFromOrder(): void
    {
        if ($this->order) {
            $this->ship_to_address_line1 = $this->order->shipping_address_line1;
            $this->ship_to_address_line2 = $this->order->shipping_address_line2;
            $this->ship_to_city = $this->order->shipping_city;
            $this->ship_to_province = $this->order->shipping_province;
            $this->ship_to_postal_code = $this->order->shipping_postal_code;
            $this->ship_to_country = $this->order->shipping_country;
            
            if ($this->order->account) {
                $this->ship_to_name = $this->order->account->contact_name;
                $this->ship_to_company = $this->order->account->company_name;
                $this->ship_to_phone = $this->order->account->phone;
                $this->ship_to_email = $this->order->account->email;
                $this->license_number = $this->order->account->license_number;
            }
        }
    }

    // Scopes
    public function scopeByStatus($query, $status)
    {
        return $query->where('status', $status);
    }

    public function scopePending($query)
    {
        return $query->whereIn('status', ['draft', 'pending', 'label_created']);
    }

    public function scopeInTransit($query)
    {
        return $query->whereIn('status', ['picked_up', 'in_transit', 'out_for_delivery']);
    }

    public function scopeForOrder($query, $orderId)
    {
        return $query->where('order_id', $orderId);
    }
}
