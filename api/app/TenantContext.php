<?php

namespace App;

/**
 * Clase estática para almacenar y recuperar el Tenant ID en el contexto de la aplicación.
 */
class TenantContext
{
    protected static ?int $tenantId = null;

    /**
     * Establece el Tenant ID en el contexto.
     *
     * @param int|null $tenantId
     * @return void
     */
    public static function setTenantId(?int $tenantId): void
    {
        static::$tenantId = $tenantId;
        \Log::info('TenantContext::setTenantId called with: ', ['tenant_id_set' => $tenantId]);
    }

    /**
     * Obtiene el Tenant ID del contexto.
     *
     * @return int|null
     */
    public static function getTenantId(): ?int
    {
        // Nota: debug_backtrace()[1] puede fallar si se llama desde el nivel superior del script o si el stack es muy corto
        // Es más seguro usar una comprobación o simplemente el log sin el backtrace si da problemas
        $caller = debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 2);
        $callerInfo = $caller[1] ?? null;
        $callerString = 'N/A';
        if ($callerInfo) {
            $callerString = ($callerInfo['class'] ?? '') . '::' . ($callerInfo['function'] ?? '');
        }
        \Log::info('TenantContext - Current Tenant ID: ', ['tenant_id' => static::$tenantId, 'Called from' => $callerString]);

        return static::$tenantId;
    }

    /**
     * Limpia el Tenant ID del contexto.
     *
     * @return void
     */
    public static function clearTenantId(): void
    {
        static::$tenantId = null;
        \Log::info('TenantContext::clearTenantId called.');
    }
}
