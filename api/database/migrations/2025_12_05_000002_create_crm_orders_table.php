<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('crm_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->onDelete('cascade');
            $table->foreignId('account_id')->constrained('crm_accounts')->onDelete('cascade');
            
            // Order Information
            $table->enum('order_status', ['draft', 'pending', 'approved', 'rejected', 'cancelled', 'completed'])->default('draft');
            $table->enum('order_type', ['intra-industry', 'retail', 'medical', 'export', 'other'])->default('intra-industry');
            $table->enum('shipping_status', ['pending', 'processing', 'packaged', 'shipped', 'delivered', 'returned'])->default('pending');
            
            // Order Details
            $table->string('order_placed_by')->nullable(); // Email or name of person who placed order
            $table->dateTime('received_date')->nullable();
            $table->dateTime('due_date')->nullable();
            $table->string('purchase_order')->nullable(); // PO number
            
            // Shipping Address (can be different from account)
            $table->string('shipping_address_line1')->nullable();
            $table->string('shipping_address_line2')->nullable();
            $table->string('shipping_city')->nullable();
            $table->string('shipping_province')->nullable();
            $table->string('shipping_postal_code')->nullable();
            $table->string('shipping_country')->default('Canada');
            
            // Financial
            $table->decimal('subtotal', 12, 2)->default(0);
            $table->decimal('tax_amount', 12, 2)->default(0);
            $table->decimal('shipping_cost', 12, 2)->default(0);
            $table->decimal('discount_amount', 12, 2)->default(0);
            $table->decimal('total', 12, 2)->default(0);
            $table->string('currency', 3)->default('CAD');
            
            // License Info
            $table->string('customer_license')->nullable();
            $table->boolean('is_oversold')->default(false);
            
            // Additional info
            $table->text('notes')->nullable();
            $table->text('internal_notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->onDelete('set null');
            $table->foreignId('approved_by')->nullable()->constrained('users')->onDelete('set null');
            $table->dateTime('approved_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            // Indexes
            $table->index(['tenant_id', 'order_status']);
            $table->index(['tenant_id', 'shipping_status']);
            $table->index(['tenant_id', 'account_id']);
            $table->index('purchase_order');
            $table->index('received_date');
            $table->index('due_date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('crm_orders');
    }
};
