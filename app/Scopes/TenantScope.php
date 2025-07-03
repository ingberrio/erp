<?php

namespace App\Scopes;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;
use Illuminate\Support\Facades\Log;
use App\Http\Middleware\IdentifyTenant; // Importa el middleware

class TenantScope implements Scope
{
    /**
     * Apply the scope to a given Eloquent query builder.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $builder
     * @param  \Illuminate\Database\Eloquent\Model  $model
     * @return void
     */
    public function apply(Builder $builder, Model $model)
    {
        // Obtener el tenant ID del contexto global establecido por el middleware
        $tenantId = IdentifyTenant::getTenantId();

        Log::info('TenantContext - Current Tenant ID: ', [
            'tenant_id' => $tenantId,
            'Called from' => __METHOD__
        ]);

        // Si el tenantId es null (ej. para Global Admin) o si el modelo no tiene la columna tenant_id,
        // no aplicar el scope.
        // También, si el modelo tiene la propiedad $globalScopeBypassed = true, no aplicar el scope.
        if (is_null($tenantId) || !in_array('tenant_id', $model->getFillable()) || (property_exists($model, 'globalScopeBypassed') && $model->globalScopeBypassed)) {
            Log::warning('TenantScope: NOT applying scope for model ' . get_class($model) . ' - Tenant ID is null or bypassed.', ['tenant_id' => $tenantId]);
            return;
        }

        // ¡CAMBIO CLAVE AQUÍ! Cualificar la columna 'tenant_id' con el nombre de la tabla del modelo.
        // Esto resuelve la ambigüedad en consultas con JOINs.
        $builder->where($model->getTable() . '.tenant_id', $tenantId);

        Log::info('TenantScope: Applying scope for model ' . get_class($model) . ' with Tenant ID: ' . $tenantId);
    }
}
