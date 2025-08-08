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
            $table->foreignId('batch_id')->after('id')->constrained('batches')->onDelete('cascade');
        });
    }

    public function down()
    {
        Schema::table('inventory_physical_counts', function (Blueprint $table) {
            $table->dropForeign(['batch_id']);
            $table->dropColumn('batch_id');
        });
    }

};
