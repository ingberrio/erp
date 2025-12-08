<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * CRM Order Items - Line items for orders
     * Links orders to batches/SKUs with quantity and pricing
     * Health Canada compliant with batch traceability
     */
    public function up(): void
    {
        Schema::create('crm_order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->onDelete('cascade');
            $table->foreignId('order_id')->constrained('crm_orders')->onDelete('cascade');
            
            // Product Reference - Can be SKU or direct Batch
            $table->foreignId('sku_id')->nullable()->constrained('skus')->onDelete('set null');
            $table->foreignId('batch_id')->nullable()->constrained('batches')->onDelete('set null');
            
            // Product Details (denormalized for historical record)
            $table->string('product_name'); // Name at time of order
            $table->string('product_sku')->nullable(); // SKU code at time of order
            $table->string('variety')->nullable();
            $table->string('product_type')->nullable();
            
            // Quantity
            $table->decimal('quantity_ordered', 12, 2);
            $table->decimal('quantity_fulfilled', 12, 2)->default(0);
            $table->decimal('quantity_shipped', 12, 2)->default(0);
            $table->string('unit', 20)->default('units'); // grams, units, kg, etc.
            
            // Pricing
            $table->decimal('unit_price', 12, 2)->default(0);
            $table->decimal('discount_percent', 5, 2)->default(0);
            $table->decimal('discount_amount', 12, 2)->default(0);
            $table->decimal('tax_rate', 5, 2)->default(0);
            $table->decimal('tax_amount', 12, 2)->default(0);
            $table->decimal('line_total', 12, 2)->default(0);
            
            // Status
            $table->enum('status', [
                'pending',
                'allocated',
                'fulfilled',
                'shipped',
                'delivered',
                'cancelled',
                'returned'
            ])->default('pending');
            
            // Health Canada Compliance
            $table->string('batch_lot_number')->nullable();
            $table->date('batch_expiry_date')->nullable();
            $table->text('compliance_notes')->nullable();
            
            // Additional
            $table->text('notes')->nullable();
            $table->integer('sort_order')->default(0);
            $table->timestamps();
            $table->softDeletes();

            // Indexes
            $table->index(['tenant_id', 'order_id']);
            $table->index(['tenant_id', 'batch_id']);
            $table->index(['tenant_id', 'sku_id']);
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('crm_order_items');
    }
};
