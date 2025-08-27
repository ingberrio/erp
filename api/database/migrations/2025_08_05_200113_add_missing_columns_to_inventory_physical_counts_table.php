<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('inventory_physical_counts', function (Blueprint $table) {
            // batch_id
            if (!Schema::hasColumn('inventory_physical_counts', 'batch_id')) {
                $table->foreignId('batch_id')->after('id')->constrained('batches')->onDelete('cascade');
            }
            // counted_quantity
            if (!Schema::hasColumn('inventory_physical_counts', 'counted_quantity')) {
                $table->decimal('counted_quantity', 16, 4)->after('batch_id');
            }
            // count_date
            if (!Schema::hasColumn('inventory_physical_counts', 'count_date')) {
                $table->date('count_date')->after('counted_quantity');
            }
            // facility_id
            if (!Schema::hasColumn('inventory_physical_counts', 'facility_id')) {
                $table->foreignId('facility_id')->after('count_date')->constrained('facilities')->onDelete('cascade');
            }
            // sub_location_id
            if (!Schema::hasColumn('inventory_physical_counts', 'sub_location_id')) {
                $table->foreignId('sub_location_id')->nullable()->after('facility_id')->constrained('sub_locations')->nullOnDelete();
            }
            // notes
            if (!Schema::hasColumn('inventory_physical_counts', 'notes')) {
                $table->text('notes')->nullable()->after('sub_location_id');
            }
            // user_id
            if (!Schema::hasColumn('inventory_physical_counts', 'user_id')) {
                $table->foreignId('user_id')->after('notes')->constrained('users')->onDelete('cascade');
            }
        });
    }

    public function down()
    {
        Schema::table('inventory_physical_counts', function (Blueprint $table) {
            // Quitar columnas solo si existen
            if (Schema::hasColumn('inventory_physical_counts', 'user_id')) {
                $table->dropForeign(['user_id']);
                $table->dropColumn('user_id');
            }
            if (Schema::hasColumn('inventory_physical_counts', 'notes')) {
                $table->dropColumn('notes');
            }
            if (Schema::hasColumn('inventory_physical_counts', 'sub_location_id')) {
                $table->dropForeign(['sub_location_id']);
                $table->dropColumn('sub_location_id');
            }
            if (Schema::hasColumn('inventory_physical_counts', 'facility_id')) {
                $table->dropForeign(['facility_id']);
                $table->dropColumn('facility_id');
            }
            if (Schema::hasColumn('inventory_physical_counts', 'count_date')) {
                $table->dropColumn('count_date');
            }
            if (Schema::hasColumn('inventory_physical_counts', 'counted_quantity')) {
                $table->dropColumn('counted_quantity');
            }
            if (Schema::hasColumn('inventory_physical_counts', 'batch_id')) {
                $table->dropForeign(['batch_id']);
                $table->dropColumn('batch_id');
            }
        });
    }
};
