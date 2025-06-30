<?php

namespace App\Traits;

use App\Scopes\TenantScope;
use App\TenantContext; // <-- ¡ESTA LÍNEA ES CRÍTICA! Asegúrate de que sea exactamente así.
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
        static::addGlobalScope(new TenantScope);

        // 2. Asignar automáticamente el tenant_id al modelo cuando se está creando
        static::creating(function ($model) {
            $tenantId = TenantContext::getTenantId(); // Obtener el tenant_id del contexto

            if ($tenantId !== null) {
                $model->tenant_id = $tenantId;
                Log::info('HasTenant Trait: Asignando tenant_id al modelo ' . get_class($model) . ' durante la creación.', ['tenant_id' => $tenantId]);
            } else {
                Log::error('HasTenant Trait: Fallo al asignar tenant_id al modelo ' . get_class($model) . ' durante la creación. Tenant ID es null.', [
                    'model_attributes' => $model->getAttributes(),
                    'auth_check' => auth()->check(),
                    'auth_tenant_id' => auth()->check() ? auth()->user()->tenant_id : 'N/A',
                ]);
                // Opcional: throw new \Exception('Tenant ID not available for model creation.');
            }
        });
    }
}
