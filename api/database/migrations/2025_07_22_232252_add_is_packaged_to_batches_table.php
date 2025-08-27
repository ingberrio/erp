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
        Schema::table('batches', function (Blueprint $table) {
            // Add 'is_packaged' column if it doesn't exist
            if (!Schema::hasColumn('batches', 'is_packaged')) {
                $table->boolean('is_packaged')->default(false)->after('product_type');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('batches', function (Blueprint $table) {
            // Drop 'is_packaged' column if it exists
            if (Schema::hasColumn('batches', 'is_packaged')) {
                $table->dropColumn('is_packaged');
            }
        });
    }
};