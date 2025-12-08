<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Shipments - Track shipments with carrier info and Health Canada manifest
     */
    public function up(): void
    {
        Schema::create('shipments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->onDelete('cascade');
            $table->foreignId('order_id')->constrained('crm_orders')->onDelete('cascade');
            $table->foreignId('facility_id')->nullable()->constrained('facilities')->onDelete('set null');
            
            $table->string('shipment_number')->unique();
            $table->string('manifest_number')->nullable();
            
            $table->string('carrier_name')->nullable();
            $table->string('carrier_service')->nullable();
            $table->string('tracking_number')->nullable();
            $table->string('tracking_url')->nullable();
            
            $table->enum('status', [
                'draft', 'pending', 'label_created', 'picked_up', 'in_transit',
                'out_for_delivery', 'delivered', 'exception', 'returned', 'cancelled'
            ])->default('draft');
            
            $table->dateTime('estimated_ship_date')->nullable();
            $table->dateTime('actual_ship_date')->nullable();
            $table->dateTime('estimated_delivery_date')->nullable();
            $table->dateTime('actual_delivery_date')->nullable();
            
            $table->string('ship_to_name')->nullable();
            $table->string('ship_to_company')->nullable();
            $table->string('ship_to_address_line1')->nullable();
            $table->string('ship_to_address_line2')->nullable();
            $table->string('ship_to_city')->nullable();
            $table->string('ship_to_province')->nullable();
            $table->string('ship_to_postal_code')->nullable();
            $table->string('ship_to_country')->default('Canada');
            $table->string('ship_to_phone')->nullable();
            $table->string('ship_to_email')->nullable();
            
            $table->string('ship_from_name')->nullable();
            $table->string('ship_from_address_line1')->nullable();
            $table->string('ship_from_city')->nullable();
            $table->string('ship_from_province')->nullable();
            $table->string('ship_from_postal_code')->nullable();
            
            $table->integer('package_count')->default(1);
            $table->decimal('total_weight', 10, 2)->nullable();
            $table->string('weight_unit', 10)->default('kg');
            $table->text('package_dimensions')->nullable();
            
            $table->decimal('shipping_cost', 12, 2)->default(0);
            $table->decimal('insurance_cost', 12, 2)->default(0);
            $table->string('currency', 3)->default('CAD');
            
            $table->string('license_number')->nullable();
            $table->boolean('requires_signature')->default(true);
            $table->boolean('age_verification_required')->default(true);
            $table->text('special_instructions')->nullable();
            $table->text('compliance_notes')->nullable();
            
            $table->string('signed_by')->nullable();
            $table->dateTime('signature_date')->nullable();
            $table->text('delivery_notes')->nullable();
            
            $table->text('internal_notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->onDelete('set null');
            $table->foreignId('shipped_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['tenant_id', 'order_id']);
            $table->index(['tenant_id', 'status']);
            $table->index('shipment_number');
            $table->index('manifest_number');
            $table->index('tracking_number');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shipments');
    }
};
