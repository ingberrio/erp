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
        Schema::create('reconciliation_schedules', function (Blueprint $table) {
            $table->id();
            
            // Basic Information
            $table->string('name'); // e.g., "Monthly Full Inventory Count"
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            
            // Scheduling Information
            $table->enum('frequency', ['daily', 'weekly', 'monthly', 'quarterly', 'annual', 'custom']);
            $table->integer('interval_value')->default(1); // Every X units
            $table->string('interval_unit')->nullable(); // 'days', 'weeks', 'months'
            $table->json('days_of_week')->nullable(); // [1,2,3,4,5] for weekdays
            $table->integer('day_of_month')->nullable(); // 1-31 for monthly
            $table->time('preferred_time')->nullable(); // Preferred time to perform count
            
            // Scope Information
            $table->foreignId('facility_id')->constrained('facilities')->onDelete('cascade');
            $table->foreignId('tenant_id')->constrained('tenants')->onDelete('cascade');
            $table->enum('scope', ['all_inventory', 'specific_areas', 'specific_batches', 'high_value_only']);
            $table->json('scope_criteria')->nullable(); // Criteria for what to count
            
            // Health Canada GPP Requirements
            $table->boolean('is_mandatory')->default(true); // GPP required counts
            $table->enum('count_type', ['full', 'cycle', 'spot', 'verification']);
            $table->decimal('variance_threshold', 5, 2)->default(1.00); // Alert threshold in grams
            $table->boolean('requires_justification')->default(true);
            
            // Compliance Tracking
            $table->date('last_executed_date')->nullable();
            $table->date('next_due_date')->nullable();
            $table->integer('overdue_days')->default(0);
            $table->enum('compliance_status', ['compliant', 'overdue', 'missed'])->default('compliant');
            
            // Assignment
            $table->foreignId('assigned_user_id')->nullable()->constrained('users')->onDelete('set null');
            $table->foreignId('backup_user_id')->nullable()->constrained('users')->onDelete('set null');
            
            // Notifications
            $table->boolean('send_reminders')->default(true);
            $table->integer('reminder_days_before')->default(3);
            $table->json('notification_emails')->nullable();
            
            $table->timestamps();
            
            // Indexes for performance
            $table->index(['facility_id', 'is_active']);
            $table->index(['tenant_id', 'compliance_status']);
            $table->index(['next_due_date', 'is_active']);
            $table->index(['frequency', 'is_mandatory']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('reconciliation_schedules');
    }
};
