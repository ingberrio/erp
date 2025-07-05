<?php

namespace App\Models;

// use App\Scopes\TenantScope; // <-- ¡ELIMINAR O COMENTAR ESTA LÍNEA!
use Spatie\Permission\Models\Permission as SpatiePermission;

class Permission extends SpatiePermission
{
    protected $fillable = [
        'name',
        'description',
        'guard_name',
        'tenant_id', // Asegúrate de que tenant_id esté fillable
    ];

    // <-- ¡ELIMINAR O COMENTAR ESTE BLOQUE!
    // protected static function booted()
    // {
    //     static::addGlobalScope(new TenantScope);
    // }

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }
}
