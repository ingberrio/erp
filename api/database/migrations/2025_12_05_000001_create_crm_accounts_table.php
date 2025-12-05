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
        Schema::create('crm_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->onDelete('cascade');
            
            // Account Type
            $table->enum('account_type', ['license_holder', 'supplier', 'distributor', 'retailer', 'other'])->default('license_holder');
            $table->enum('account_status', ['pending', 'awaiting_approval', 'approved', 'rejected', 'suspended'])->default('pending');
            
            // Account Information
            $table->string('name'); // Account name
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->string('fax')->nullable();
            $table->date('expiration_date')->nullable();
            $table->string('license_number')->nullable();
            
            // Primary Address
            $table->string('address_line1')->nullable();
            $table->string('address_line2')->nullable(); // Apt, Suite #
            $table->string('city')->nullable();
            $table->string('province')->nullable(); // Province/State/Territory
            $table->string('postal_code')->nullable();
            $table->string('country')->default('Canada');
            
            // Shipping Address
            $table->boolean('shipping_same_as_primary')->default(true);
            $table->string('shipping_address_line1')->nullable();
            $table->string('shipping_address_line2')->nullable();
            $table->string('shipping_city')->nullable();
            $table->string('shipping_province')->nullable();
            $table->string('shipping_postal_code')->nullable();
            $table->string('shipping_country')->nullable();
            
            // Additional info
            $table->text('notes')->nullable();
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['tenant_id', 'account_status']);
            $table->index(['tenant_id', 'account_type']);
            $table->index('license_number');
            $table->index('email');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('crm_accounts');
    }
};
