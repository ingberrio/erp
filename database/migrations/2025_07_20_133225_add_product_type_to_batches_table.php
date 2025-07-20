// database/migrations/YYYY_MM_DD_HHMMSS_add_product_type_to_batches_table.php
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
            // Add product_type column after 'variety'
            // It's nullable for existing rows, or you can set a default if all existing batches will have a type
            $table->string('product_type')->nullable()->after('variety');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('batches', function (Blueprint $table) {
            $table->dropColumn('product_type');
        });
    }
};