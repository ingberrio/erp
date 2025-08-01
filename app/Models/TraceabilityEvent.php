<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

// Asegúrate de que estos modelos existan y estén en sus respectivos namespaces
use App\Models\Tenant;
use App\Models\User;
use App\Models\Batch;
use App\Models\CultivationArea;
use App\Models\Facility;

class TraceabilityEvent extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'traceability_events';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'batch_id',
        'event_type',
        'description',
        'area_id',
        'facility_id',
        'user_id',
        'quantity',
        'unit',
        'from_location',
        'to_location',
        'from_sub_location', // AÑADIDO: Nueva columna
        'to_sub_location',   // AÑADIDO: Nueva columna
        'method',
        'reason',
        'new_batch_id',
        'tenant_id',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * The "booted" method of the model.
     *
     * @return void
     */
    protected static function booted()
    {
        static::creating(function ($event) {
            // Asigna el tenant_id automáticamente si no está presente y el contexto del inquilino existe.
            // Esto es útil si estás usando un paquete de multi-tenancy como tenancy/tenancy
            // o si tienes tu propia función global `tenant()`.
            if (empty($event->tenant_id) && function_exists('tenant') && tenant()) {
                $event->tenant_id = tenant()->id;
            }
            // Si no usas un paquete de tenancy y el tenant_id viene del Auth::user()
            // o de un header, asegúrate de que se asigne antes de la creación del modelo
            // en el controlador o en un evento de modelo más temprano si es necesario.
            // La lógica en el controlador para el `store` ya lo maneja con $request->header('X-Tenant-ID')
            // o Auth::user()->tenant_id, así que esta parte es más una salvaguarda.
        });
    }

    /**
     * Get the batch that owns the traceability event.
     */
    public function batch()
    {
        return $this->belongsTo(Batch::class);
    }

    /**
     * Get the cultivation area that the traceability event belongs to.
     */
    public function area()
    {
        return $this->belongsTo(CultivationArea::class, 'area_id');
    }

    /**
     * Get the facility that the traceability event belongs to.
     */
    public function facility()
    {
        return $this->belongsTo(Facility::class);
    }

    /**
     * Get the user that performed the traceability event.
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the new batch associated with the traceability event (e.g., for harvest).
     */
    public function newBatch()
    {
        return $this->belongsTo(Batch::class, 'new_batch_id');
    }

    /**
     * Get the tenant that owns the traceability event.
     */
    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }
}
