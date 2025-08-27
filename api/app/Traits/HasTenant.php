<?php

namespace App\Traits;

use App\Scopes\TenantScope;
use App\TenantContext;
use Illuminate\Support\Facades\Log;

trait HasTenant
{
    /**
     * The "booting" method of the model.
     * This is called by Eloquent when the model is booted.
     *
     * @return void
     */
    protected static function bootHasTenant()
    {
        // 1. Aplicar el Global Scope para filtrar por tenant_id en las consultas SELECT
        // Este scope se aplica a todas las consultas del modelo que usan este trait.
        // Para Super Admins, el IdentifyTenant middleware deshabilita el scope.
        static::addGlobalScope(new TenantScope);

        // 2. Asignar automáticamente el tenant_id al modelo cuando se está creando
        static::creating(function ($model) {
            // Si el modelo ya tiene un tenant_id (porque fue proporcionado explícitamente
            // en el controlador, como en el caso del Super Admin), no lo sobrescribimos.
            if (!empty($model->tenant_id)) {
                Log::info('HasTenant Trait: Modelo ' . get_class($model) . ' ya tiene tenant_id asignado. No se sobrescribe.', ['tenant_id' => $model->tenant_id]);
                return; // Salir del listener, no hacer más asignaciones automáticas
            }

            // Si el modelo no tiene tenant_id, intentamos obtenerlo del contexto.
            $tenantIdFromContext = TenantContext::getTenantId();

            if ($tenantIdFromContext !== null) {
                $model->tenant_id = $tenantIdFromContext;
                Log::info('HasTenant Trait: Asignando tenant_id del contexto al modelo ' . get_class($model) . ' durante la creación.', ['tenant_id' => $tenantIdFromContext]);
            } else {
                // Si llegamos aquí, significa que el modelo no tenía tenant_id y el contexto tampoco lo proporcionó.
                // Esto es un error para modelos que requieren tenant_id (NOT NULL).
                Log::error('HasTenant Trait: Fallo al asignar tenant_id al modelo ' . get_class($model) . ' durante la creación. Tenant ID es null y no se proporcionó previamente.', [
                    'model_attributes' => $model->getAttributes(),
                    'auth_check' => auth()->check(),
                    'auth_tenant_id' => auth()->check() ? auth()->user()->tenant_id : 'N/A',
                    'tenant_id_from_context' => $tenantIdFromContext,
                ]);
                // Opcional: Si quieres que falle de forma más explícita aquí, puedes lanzar una excepción:
                // throw new \Exception('Tenant ID not available for model creation and is required.');
            }
        });
    }
}
