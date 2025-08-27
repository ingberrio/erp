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
        'from_sub_location',
        'to_sub_location',
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
        'quantity'   => 'float',
    ];

    /**
     * The "booted" method of the model.
     *
     * @return void
     */
    protected static function booted()
    {
        static::creating(function ($event) {
            // Asigna tenant_id automáticamente si hay contexto de inquilino
            if (empty($event->tenant_id) && function_exists('tenant') && tenant()) {
                $event->tenant_id = tenant()->id;
            }

            // Normalizaciones suaves de strings (evita espacios accidentales)
            foreach (['event_type','description','from_location','to_location','from_sub_location','to_sub_location','method','reason','unit'] as $attr) {
                if (isset($event->{$attr}) && is_string($event->{$attr})) {
                    $event->{$attr} = trim($event->{$attr});
                }
            }
        });
    }

    /**
     * Relationships
     */

    /**
     * Get the batch that owns the traceability event.
     */
    public function batch()
    {
        return $this->belongsTo(Batch::class, 'batch_id');
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
        return $this->belongsTo(Facility::class, 'facility_id');
    }

    /**
     * Get the user that performed the traceability event.
     */
    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * Get the new batch associated with the traceability event (e.g., for harvest/splits).
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
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    /**
     * Query Scopes
     */

    /**
     * Scope: eventos a nivel de área (sin batch_id).
     */
    public function scopeAreaLevel($query)
    {
        return $query->whereNull('batch_id');
    }

    /**
     * Scope: eventos a nivel de lote (con batch_id).
     */
    public function scopeBatchLevel($query)
    {
        return $query->whereNotNull('batch_id');
    }
}
