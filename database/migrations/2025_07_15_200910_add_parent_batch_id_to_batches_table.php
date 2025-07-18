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
        Schema::table('batches', function (Blueprint $table) {
            $table->unsignedBigInteger('parent_batch_id')->nullable()->after('cultivation_area_id');
            $table->foreign('parent_batch_id')->references('id')->on('batches')->onDelete('set null');
        });
    }

    public function down()
    {
        Schema::table('batches', function (Blueprint $table) {
            $table->dropForeign(['parent_batch_id']);
            $table->dropColumn('parent_batch_id');
        });
    }
};
