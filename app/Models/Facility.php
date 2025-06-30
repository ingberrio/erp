<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
// use App\Traits\BelongsToTenant; // Si tienes un trait para BelongsToTenant

class Facility extends Model
{
    use HasFactory;
    // use BelongsToTenant; // Si usas el trait

    protected $fillable = [
        'name',
        'address',
        'tenant_id', // Asegúrate de incluir tenant_id si lo asignas masivamente
    ];

    // Relación con Tenant
    public function tenant()
    {
        return $this->belongsTo(Tenant::class); // Asumiendo que tu modelo Tenant se llama Tenant
    }

    // Relación con CultivationArea
    public function cultivationAreas()
    {
        return $this->hasMany(CultivationArea::class);
    }
}
