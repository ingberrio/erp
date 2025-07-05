<?php

namespace App\Models;

// use App\Scopes\TenantScope; // Esta línea debe estar comentada o eliminada como en la última corrección
use Spatie\Permission\Models\Role as SpatieRole;
use Spatie\Permission\Traits\HasPermissions;

class Role extends SpatieRole
{
    use HasPermissions;

    protected $fillable = [
        'name',
        'description',
        'guard_name',
        'tenant_id',
    ];

    // El booted() para TenantScope debe estar comentado o eliminado aquí también
    // protected static function booted()
    // {
    //     static::addGlobalScope(new TenantScope);
    // }

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    // <-- ¡ELIMINAR ESTE MÉTODO COMPLETO!
    // public function users()
    // {
    //     return $this->belongsToMany(User::class, 'model_has_roles', 'role_id', 'model_id')
    //                 ->where('model_type', User::class);
    // }
}
