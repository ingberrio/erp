<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
    {
        Schema::table('inventory_physical_counts', function (Blueprint $table) {
            $table->decimal('counted_quantity', 16, 4)->after('batch_id');
        });
    }

    public function down()
    {
        Schema::table('inventory_physical_counts', function (Blueprint $table) {
            $table->dropColumn('counted_quantity');
        });
    }

};
