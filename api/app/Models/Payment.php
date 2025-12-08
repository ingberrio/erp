<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Scopes\TenantScope;

class Payment extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'tenant_id',
        'order_id',
        'account_id',
        'payment_number',
        'transaction_id',
        'payment_method',
        'status',
        'amount',
        'fee_amount',
        'net_amount',
        'currency',
        'payment_date',
        'cleared_date',
        'bank_name',
        'cheque_number',
        'reference_number',
        'refund_of_id',
        'refunded_amount',
        'refund_reason',
        'payment_notes',
        'internal_notes',
        'recorded_by',
        'created_by',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'fee_amount' => 'decimal:2',
        'net_amount' => 'decimal:2',
        'refunded_amount' => 'decimal:2',
        'payment_date' => 'datetime',
        'cleared_date' => 'datetime',
    ];

    const PAYMENT_METHODS = [
        'bank_transfer' => 'Bank Transfer',
        'wire_transfer' => 'Wire Transfer',
        'cheque' => 'Cheque',
        'credit_card' => 'Credit Card',
        'debit' => 'Debit',
        'eft' => 'EFT',
        'cash' => 'Cash',
        'credit_note' => 'Credit Note',
        'other' => 'Other',
    ];

    const STATUSES = [
        'pending' => 'Pending',
        'processing' => 'Processing',
        'completed' => 'Completed',
        'failed' => 'Failed',
        'refunded' => 'Refunded',
        'partially_refunded' => 'Partially Refunded',
        'cancelled' => 'Cancelled',
    ];

    protected static function booted(): void
    {
        static::addGlobalScope(new TenantScope);
        
        static::creating(function ($payment) {
            if (empty($payment->payment_number)) {
                $payment->payment_number = self::generatePaymentNumber($payment->tenant_id);
            }
            if (empty($payment->net_amount)) {
                $payment->net_amount = $payment->amount - $payment->fee_amount;
            }
        });
    }

    public static function generatePaymentNumber($tenantId): string
    {
        $prefix = 'PAY';
        $date = now()->format('Ymd');
        $count = self::withoutGlobalScopes()
            ->where('tenant_id', $tenantId)
            ->whereDate('created_at', today())
            ->count() + 1;
        
        return sprintf('%s-%s-%04d', $prefix, $date, $count);
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

    public function account()
    {
        return $this->belongsTo(CrmAccount::class, 'account_id');
    }

    public function receiver()
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    public function recorder()
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function refundOf()
    {
        return $this->belongsTo(Payment::class, 'refund_of_id');
    }

    public function refunds()
    {
        return $this->hasMany(Payment::class, 'refund_of_id');
    }

    // Helpers
    public function isCompleted(): bool
    {
        return $this->status === 'completed';
    }

    public function canBeRefunded(): bool
    {
        return $this->status === 'completed' && ($this->refunded_amount ?? 0) < $this->amount;
    }

    public function getRemainingRefundableAttribute(): float
    {
        return $this->amount - ($this->refunded_amount ?? 0);
    }

    // Mark as completed
    public function markAsCompleted(): void
    {
        $this->status = 'completed';
        $this->cleared_date = now();
        $this->save();
    }

    // Scopes
    public function scopeByStatus($query, $status)
    {
        return $query->where('status', $status);
    }

    public function scopeCompleted($query)
    {
        return $query->where('status', 'completed');
    }

    public function scopePending($query)
    {
        return $query->whereIn('status', ['pending', 'processing']);
    }

    public function scopeForOrder($query, $orderId)
    {
        return $query->where('order_id', $orderId);
    }

    public function scopeForAccount($query, $accountId)
    {
        return $query->where('account_id', $accountId);
    }
}
