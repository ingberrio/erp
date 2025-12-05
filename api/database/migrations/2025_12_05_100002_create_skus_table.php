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
        Schema::create('skus', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->onDelete('cascade');
            $table->string('name'); // SKU Name
            $table->foreignId('variety_id')->nullable()->constrained('varieties')->onDelete('set null');
            $table->enum('sales_class', ['wholesale', 'patient', 'intra-industry', 'recreational'])->default('intra-industry');
            $table->string('gtin_12')->nullable(); // UPCA Barcode
            $table->string('gtin_14')->nullable(); // DoubleStacked Barcode
            $table->enum('status', ['enabled', 'disabled'])->default('enabled');
            
            // Unit Details (Step 2)
            $table->string('end_type')->nullable(); // dry, dry+biomass, g-wet, plants, seeds
            $table->string('cannabis_class')->nullable(); // dried cannabis, fresh cannabis, cannabis oil, cannabis plants, cannabis plants seeds
            $table->enum('unit', ['g', 'kg'])->default('g');
            $table->enum('type', ['packaged', 'unpackaged'])->default('unpackaged'); // Default Unpackaged
            $table->decimal('unit_quantity', 10, 2)->default(1);
            $table->decimal('unit_weight', 15, 2)->default(0); // in grams
            $table->decimal('total_packaged_weight', 15, 2)->nullable(); // optional
            $table->decimal('target_weight', 15, 2)->default(0);
            
            // Pricing
            $table->decimal('estimated_price', 15, 2)->default(0);
            $table->decimal('cost_per_package', 15, 2)->default(0);
            
            // Inventory
            $table->decimal('current_inventory', 15, 2)->default(0);
            $table->decimal('total_product_weight', 15, 2)->default(0);
            
            // Ghost SKU
            $table->boolean('is_ghost_sku')->default(false);
            
            // Audit
            $table->foreignId('created_by')->nullable()->constrained('users')->onDelete('set null');
            $table->foreignId('updated_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamps();
            
            // Indexes
            $table->index(['tenant_id', 'name']);
            $table->index(['tenant_id', 'variety_id']);
            $table->index(['tenant_id', 'status']);
            $table->index(['tenant_id', 'sales_class']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('skus');
    }
};
