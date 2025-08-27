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
            $table->foreignId('facility_id')->after('count_date')->constrained('facilities')->onDelete('cascade');
        });
    }

    public function down()
    {
        Schema::table('inventory_physical_counts', function (Blueprint $table) {
            $table->dropForeign(['facility_id']);
            $table->dropColumn('facility_id');
        });
    }

};
