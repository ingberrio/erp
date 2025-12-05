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
        Schema::create('loss_theft_reports', function (Blueprint $table) {
            $table->id();
            
            // Basic Information
            $table->string('report_number')->unique(); // Auto-generated unique identifier
            $table->enum('incident_type', ['loss', 'theft']); // Type of incident
            $table->enum('incident_category', [
                'loss_unexplained',
                'loss_in_transit', 
                'unusual_waste',
                'armed_robbery',
                'break_and_entry',
                'grab_theft',
                'pilferage',
                'theft_in_transit',
                'other'
            ]);
            
            // Dates
            $table->date('incident_date'); // When the incident occurred
            $table->date('discovery_date'); // When it was discovered
            $table->timestamp('reported_to_hc_at')->nullable(); // When reported to Health Canada
            
            // Location Information
            $table->foreignId('facility_id')->constrained('facilities')->onDelete('restrict');
            $table->string('specific_location')->nullable(); // Within facility
            $table->string('sub_location')->nullable();
            
            // Product Information
            $table->foreignId('batch_id')->nullable()->constrained('batches')->onDelete('restrict');
            $table->string('product_type'); // Type of cannabis product
            $table->decimal('quantity_lost', 10, 3); // Amount lost/stolen
            $table->string('unit'); // Unit of measurement
            $table->decimal('estimated_value', 10, 2)->nullable(); // Dollar value
            
            // Incident Details
            $table->text('description'); // Detailed description
            $table->text('circumstances')->nullable(); // Circumstances of loss/theft
            $table->boolean('police_notified')->default(false);
            $table->string('police_report_number')->nullable();
            $table->date('police_notification_date')->nullable();
            
            // Investigation
            $table->enum('investigation_status', [
                'pending',
                'in_progress', 
                'completed',
                'referred_to_police'
            ])->default('pending');
            $table->text('investigation_findings')->nullable();
            $table->text('corrective_actions')->nullable();
            
            // Health Canada Reporting
            $table->enum('hc_report_status', [
                'pending',
                'submitted',
                'acknowledged',
                'under_review'
            ])->default('pending');
            $table->string('hc_confirmation_number')->nullable();
            
            // System Fields
            $table->foreignId('reported_by_user_id')->constrained('users')->onDelete('restrict');
            $table->foreignId('tenant_id')->constrained('tenants')->onDelete('cascade');
            $table->boolean('is_archived')->default(false);
            $table->timestamp('archived_at')->nullable();
            $table->timestamp('retention_expires_at')->nullable();
            
            $table->timestamps();
            
            // Indexes for performance and reporting
            $table->index(['facility_id', 'incident_date']);
            $table->index(['tenant_id', 'incident_type']);
            $table->index(['discovery_date', 'hc_report_status']);
            $table->index(['investigation_status']);
            $table->index(['retention_expires_at', 'is_archived']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('loss_theft_reports');
    }
};
