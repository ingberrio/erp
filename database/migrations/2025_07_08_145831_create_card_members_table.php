<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('card_members', function (Blueprint $table) {
            $table->foreignId('card_id')->constrained()->onDelete('cascade');
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->primary(['card_id', 'user_id']); // Clave primaria compuesta
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('card_members');
    }
};