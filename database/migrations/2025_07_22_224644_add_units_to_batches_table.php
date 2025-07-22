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
            // Add 'units' column if it doesn't exist
            if (!Schema::hasColumn('batches', 'units')) {
                $table->decimal('units', 10, 2)->nullable()->after('name'); // Example: 10 total digits, 2 decimal places
                // You might choose float or integer depending on your needs:
                // $table->float('units')->nullable()->after('name');
                // $table->integer('units')->nullable()->after('name');
            }

            // Add 'product_type' column if it doesn't exist
            if (!Schema::hasColumn('batches', 'product_type')) {
                $table->string('product_type')->nullable()->after('units');
            }

            // Add 'variety' column if it doesn't exist
            if (!Schema::hasColumn('batches', 'variety')) {
                $table->string('variety')->nullable()->after('product_type');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('batches', function (Blueprint $table) {
            // Drop 'units' column if it exists
            if (Schema::hasColumn('batches', 'units')) {
                $table->dropColumn('units');
            }
            // Drop 'product_type' column if it exists
            if (Schema::hasColumn('batches', 'product_type')) {
                $table->dropColumn('product_type');
            }
            // Drop 'variety' column if it exists
            if (Schema::hasColumn('batches', 'variety')) {
                $table->dropColumn('variety');
            }
        });
    }
};