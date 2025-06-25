<?php
// database/migrations/YYYY_MM_DD_HHMMSS_create_lists_table.php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('lists', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('board_id');    // Clave foránea al tablero al que pertenece
            $table->unsignedBigInteger('tenant_id');   // Clave foránea para el multi-tenant
            $table->string('name');                    // Nombre de la lista (ej. "To-Do", "In Progress")
            $table->integer('order')->default(0);      // Orden de las listas dentro de un tablero
            $table->timestamps();

            // Índices y claves foráneas
            $table->index('tenant_id');
            $table->foreign('board_id')->references('id')->on('boards')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('lists');
    }
};