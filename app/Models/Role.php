<?php

namespace App\Models;

use Spatie\Permission\Models\Role as SpatieRole; // Alias para evitar conflicto de nombres
use App\Traits\BelongsToTenant; // Si tu modelo Role también es multi-tenant
// use Spatie\Permission\Traits\HasPermissions; // Si necesitas métodos de permisos directamente en el Rol

class Role extends SpatieRole // Extiende el modelo Role de Spatie
{
    // Usa BelongsToTenant si tu modelo Role también tiene tenant_id
    // Y si tu middleware IdentifyTenant lo aplica automáticamente
    use BelongsToTenant;

    // Si tu Role model necesita manejar permisos directamente (no solo a través de HasPermissions en el User)
    // use HasPermissions; // Generalmente, HasRoles en User es suficiente.

    protected $fillable = [
        'name',
        'guard_name',
        'tenant_id', // Asegúrate de que tenant_id esté fillable
    ];

    /**
     * A role can be assigned to various models.
     * Overwrite Spatie's method to explicitly define the User model.
     *
     * @param string $guardName
     * @return \Illuminate\Database\Eloquent\Relations\MorphToMany
     */
    public function users(): \Illuminate\Database\Eloquent\Relations\MorphToMany
    {
        // Asegúrate de que App\Models\User::class es la ruta correcta a tu modelo de usuario
        return $this->morphedByMany(User::class, 'model', 'model_has_roles', 'role_id', 'model_id');
    }

    // Si el trait BelongsToTenant maneja el scope global,
    // puedes eliminar el 'where('tenant_id', $tenantId)' de tu RoleController.
    // Ejemplo de BelongsToTenant (para referencia):
    // protected static function boot()
    // {
    //     parent::boot();
    //     static::addGlobalScope(new TenantScope); // Asumiendo que TenantScope usa el header
    // }
}