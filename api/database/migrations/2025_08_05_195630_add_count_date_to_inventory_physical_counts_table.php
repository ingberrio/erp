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
            $table->date('count_date')->after('counted_quantity');
        });
    }

    public function down()
    {
        Schema::table('inventory_physical_counts', function (Blueprint $table) {
            $table->dropColumn('count_date');
        });
    }

};
