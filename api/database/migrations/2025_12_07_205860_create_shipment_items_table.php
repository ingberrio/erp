<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Shipment Items - Individual items in a shipment
     */
    public function up(): void
    {
        Schema::create('shipment_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->onDelete('cascade');
            $table->foreignId('shipment_id')->constrained('shipments')->onDelete('cascade');
            $table->foreignId('order_item_id')->constrained('crm_order_items')->onDelete('cascade');
            $table->foreignId('batch_id')->nullable()->constrained('batches')->onDelete('set null');
            
            $table->decimal('quantity_shipped', 12, 2);
            $table->string('unit', 20)->default('units');
            
            $table->string('product_name');
            $table->string('batch_lot_number')->nullable();
            $table->date('batch_expiry_date')->nullable();
            
            $table->integer('package_number')->default(1);
            
            $table->decimal('thc_content', 5, 2)->nullable();
            $table->decimal('cbd_content', 5, 2)->nullable();
            $table->text('compliance_notes')->nullable();
            
            $table->timestamps();
            $table->softDeletes();

            $table->index(['tenant_id', 'shipment_id']);
            $table->index(['tenant_id', 'order_item_id']);
            $table->index(['tenant_id', 'batch_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shipment_items');
    }
};
