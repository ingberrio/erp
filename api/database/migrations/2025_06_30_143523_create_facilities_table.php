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
        Schema::create('facilities', function (Blueprint $table) {
            $table->id(); // O $table->uuid('id')->primary(); si usas UUIDs
            $table->string('name');
            $table->text('address')->nullable();
            $table->foreignId('tenant_id')->constrained('tenants')->onDelete('cascade'); // Asumiendo tabla 'tenants'
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('facilities');
    }
};