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
        Schema::create('traceability_events', function (Blueprint $table) {
            $table->id(); // Columna de ID auto-incremental

            // Claves foráneas (asegúrese de que estas tablas existan)
            $table->foreignId('batch_id')->constrained('batches')->onDelete('cascade');
            $table->foreignId('area_id')->constrained('cultivation_areas')->onDelete('cascade');
            $table->foreignId('facility_id')->constrained('facilities')->onDelete('cascade');
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');

            // Campos del evento
            $table->string('event_type'); // 'movement', 'cultivation', 'harvest', 'sampling', 'destruction'
            $table->text('description')->nullable(); // Notas adicionales

            // Campos opcionales para diferentes tipos de eventos
            $table->double('quantity')->nullable(); // Para unidades, peso, etc.
            $table->string('unit', 50)->nullable(); // 'g', 'kg', 'unidades', 'ml', 'L'
            $table->string('from_location')->nullable(); // Para movimientos
            $table->string('to_location')->nullable();   // Para movimientos
            $table->string('method')->nullable();        // Para destrucción / tipo de cultivo
            $table->text('reason')->nullable();          // Para destrucción / propósito muestreo
            $table->foreignId('new_batch_id')->nullable()->constrained('batches')->onDelete('set null'); // Para cosecha (nuevo lote)

            // Campo para el multi-tenancy (si su aplicación lo usa)
            // Si su middleware 'identify.tenant' ya filtra por esto, asegúrese de que exista.
            $table->unsignedBigInteger('tenant_id')->nullable();
            // Si tiene una tabla 'tenants', puede añadir una clave foránea:
            // $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');


            $table->timestamps(); // created_at y updated_at
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('traceability_events');
    }
};
