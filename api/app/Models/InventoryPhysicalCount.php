<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InventoryPhysicalCount extends Model
{
    use HasFactory;

    protected $fillable = [
        'batch_id',
        'facility_id',
        'sub_location_id',
        'count_date',
        'counted_quantity',
        'notes',
        'user_id',
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
