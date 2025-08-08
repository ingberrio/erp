<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
// Si este modelo reside en una base de datos de inquilino (tenant database)
// y estás usando el paquete spatie/laravel-multitenancy con conexiones separadas,
// podrías necesitar esta línea:
// use Spatie\Multitenancy\Models\Concerns\UsesTenantConnection;

class InventoryReconciliation extends Model
{
    use HasFactory;
    // Si este modelo debe usar la conexión de base de datos del inquilino actual,
    // descomenta la siguiente línea. Esto es común si cada inquilino tiene su propia DB.
    // use UsesTenantConnection;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'inventory_reconciliations'; // Nombre de la tabla en la base de datos

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'date',                  // Fecha de la reconciliación
        'facility_id',           // ID de la instalación donde se realizó la reconciliación
        'batch_id',              // ID del lote (si la reconciliación es a nivel de lote)
        'product_id',            // ID del producto (si la reconciliación es a nivel de producto)
        'recorded_quantity',     // Cantidad registrada en el sistema antes de la reconciliación
        'actual_quantity',       // Cantidad física real encontrada
        'difference',            // Diferencia entre la cantidad registrada y la real (actual_quantity - recorded_quantity)
        'unit',                  // Unidad de medida (ej. kg, gramos, unidades)
        'reason',                // Razón de la diferencia (ej. pérdida, daño, error de conteo)
        'notes',                 // Notas adicionales sobre la reconciliación
        'responsible_user_id',   // ID del usuario responsable de la reconciliación
        'tenant_id',             // ID del inquilino (crucial para sistemas multi-inquilino)
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'date' => 'date', // Convierte la columna 'date' a una instancia de Carbon
    ];

    // --- Relaciones Eloquent ---

    /**
     * Get the facility that owns the inventory reconciliation.
     */
    public function facility()
    {
        return $this->belongsTo(Facility::class);
    }

    /**
     * Get the batch associated with the inventory reconciliation.
     * Asume que tienes un modelo `Batch`.
     */
    public function batch()
    {
        return $this->belongsTo(Batch::class);
    }

    /**
     * Get the product associated with the inventory reconciliation.
     * Asume que tienes un modelo `Product`.
     */
    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    /**
     * Get the user who was responsible for the inventory reconciliation.
     * Asume que tienes un modelo `User`.
     */
    public function responsibleUser()
    {
        return $this->belongsTo(User::class, 'responsible_user_id');
    }

    /**
     * Get the tenant that owns the inventory reconciliation.
     * Asume que tienes un modelo `Tenant` o similar para tu sistema multi-inquilino.
     */
    public function tenant()
    {
        return $this->belongsTo(Tenant::class); // O el nombre de tu modelo de inquilino
    }
}