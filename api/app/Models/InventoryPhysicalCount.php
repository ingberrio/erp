<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Traits\HasRecordRetention;

class InventoryPhysicalCount extends Model
{
    use HasFactory, HasRecordRetention;

    protected $fillable = [
        'batch_id',
        'facility_id',
        'sub_location_id',
        'count_date',
        'counted_quantity',
        'notes',
        'user_id',
        'retention_expires_at',
        'is_archived',
        'archived_at',
        'archive_reason',
    ];

    protected $casts = [
        'count_date' => 'datetime',
        'retention_expires_at' => 'datetime',
        'archived_at' => 'datetime',
        'is_archived' => 'boolean',
    ];

    // Relaciones útiles (opcional)
    public function batch()
    {
        return $this->belongsTo(Batch::class);
    }

    public function facility()
    {
        return $this->belongsTo(Facility::class);
    }

    public function subLocation()
    {
        return $this->belongsTo(SubLocation::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
