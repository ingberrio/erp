<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Payments - Track payments for orders
     */
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->onDelete('cascade');
            $table->foreignId('order_id')->constrained('crm_orders')->onDelete('cascade');
            $table->foreignId('account_id')->nullable()->constrained('crm_accounts')->onDelete('set null');
            
            $table->string('payment_number')->unique();
            $table->string('transaction_id')->nullable();
            
            $table->enum('payment_method', [
                'bank_transfer', 'wire_transfer', 'cheque', 'credit_card',
                'debit', 'eft', 'cash', 'credit_note', 'other'
            ])->default('bank_transfer');
            
            $table->enum('status', [
                'pending', 'processing', 'completed', 'failed',
                'refunded', 'partially_refunded', 'cancelled'
            ])->default('pending');
            
            $table->decimal('amount', 12, 2);
            $table->decimal('fee_amount', 12, 2)->default(0);
            $table->decimal('net_amount', 12, 2);
            $table->string('currency', 3)->default('CAD');
            
            $table->dateTime('payment_date')->nullable();
            $table->dateTime('cleared_date')->nullable();
            
            $table->string('bank_name')->nullable();
            $table->string('cheque_number')->nullable();
            $table->string('reference_number')->nullable();
            
            $table->foreignId('refund_of_payment_id')->nullable()->constrained('payments')->onDelete('set null');
            $table->decimal('refund_amount', 12, 2)->default(0);
            $table->text('refund_reason')->nullable();
            
            $table->text('notes')->nullable();
            $table->foreignId('received_by')->nullable()->constrained('users')->onDelete('set null');
            $table->foreignId('created_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['tenant_id', 'order_id']);
            $table->index(['tenant_id', 'account_id']);
            $table->index(['tenant_id', 'status']);
            $table->index('payment_number');
            $table->index('payment_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
