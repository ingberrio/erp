<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up()
    {
        Schema::table('inventory_physical_counts', function (Blueprint $table) {
            $table->unsignedBigInteger('justification_reason_id')->nullable()->after('notes');
            $table->text('justification_notes')->nullable()->after('justification_reason_id');
            $table->unsignedBigInteger('justified_by_user_id')->nullable()->after('justification_notes');
            $table->timestamp('justified_at')->nullable()->after('justified_by_user_id');
        });
    }
    public function down()
    {
        Schema::table('inventory_physical_counts', function (Blueprint $table) {
            $table->dropColumn([
                'justification_reason_id',
                'justification_notes',
                'justified_by_user_id',
                'justified_at'
            ]);
        });
    }
};
