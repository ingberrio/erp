<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Scopes\TenantScope;

class CrmAccount extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'tenant_id',
        'account_type',
        'account_status',
        'name',
        'phone',
        'email',
        'fax',
        'expiration_date',
        'license_number',
        // Primary Address
        'address_line1',
        'address_line2',
        'city',
        'province',
        'postal_code',
        'country',
        // Shipping Address
        'shipping_same_as_primary',
        'shipping_address_line1',
        'shipping_address_line2',
        'shipping_city',
        'shipping_province',
        'shipping_postal_code',
        'shipping_country',
        // Additional
        'notes',
        'created_by',
    ];

    protected $casts = [
        'expiration_date' => 'date',
        'shipping_same_as_primary' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected $appends = ['expiration_status'];

    /**
     * Boot the model.
     */
    protected static function booted(): void
    {
        static::addGlobalScope(new TenantScope);
    }

    /**
     * Get the expiration status attribute.
     */
    public function getExpirationStatusAttribute(): string
    {
        if (!$this->expiration_date) {
            return 'No expiration';
        }

        $now = now();
        $expirationDate = $this->expiration_date;

        if ($expirationDate->isPast()) {
            return 'Expired';
        }

        if ($expirationDate->diffInDays($now) <= 30) {
            return 'Expiring soon';
        }

        return 'Not expired';
    }

    /**
     * Relationship with Tenant.
     */
    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    /**
     * Relationship with User (creator).
     */
    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Relationship with Orders.
     */
    public function orders()
    {
        return $this->hasMany(CrmOrder::class, 'account_id');
    }

    /**
     * Scope for filtering by status.
     */
    public function scopeByStatus($query, $status)
    {
        return $query->where('account_status', $status);
    }

    /**
     * Scope for filtering by type.
     */
    public function scopeByType($query, $type)
    {
        return $query->where('account_type', $type);
    }

    /**
     * Scope for filtering expired accounts.
     */
    public function scopeExpired($query)
    {
        return $query->whereNotNull('expiration_date')
                     ->where('expiration_date', '<', now());
    }

    /**
     * Scope for filtering accounts expiring soon (within 30 days).
     */
    public function scopeExpiringSoon($query)
    {
        return $query->whereNotNull('expiration_date')
                     ->where('expiration_date', '>=', now())
                     ->where('expiration_date', '<=', now()->addDays(30));
    }
}
