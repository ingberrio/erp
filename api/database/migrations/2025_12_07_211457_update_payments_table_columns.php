<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Update payments table columns for consistency with controller
     */
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            // Rename columns
            $table->renameColumn('refund_of_payment_id', 'refund_of_id');
            $table->renameColumn('refund_amount', 'refunded_amount');
            $table->renameColumn('notes', 'payment_notes');
            $table->renameColumn('received_by', 'recorded_by');
            
            // Add new column
            $table->text('internal_notes')->nullable()->after('payment_notes');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->renameColumn('refund_of_id', 'refund_of_payment_id');
            $table->renameColumn('refunded_amount', 'refund_amount');
            $table->renameColumn('payment_notes', 'notes');
            $table->renameColumn('recorded_by', 'received_by');
            
            $table->dropColumn('internal_notes');
        });
    }
};
