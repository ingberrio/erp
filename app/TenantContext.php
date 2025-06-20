<?php

namespace App;

use Illuminate\Support\Facades\Log; // Add this import

class TenantContext
{
    protected static ?int $tenantId = null;

    public static function setTenantId(?int $tenantId): void
    {
        static::$tenantId = $tenantId;
        // The middleware already logs this, so no need for an extra log here unless debugging
    }

    public static function getTenantId(): ?int
    {
        // Add this specific log to see where it's being called from when it's null
        if (static::$tenantId === null) {
            Log::info('TenantContext - Current Tenant ID: {"tenant_id":null} (Called from: ' . static::getCallingClassAndMethod() . ')');
        } else {
            Log::info('TenantContext - Current Tenant ID: {"tenant_id":' . static::$tenantId . '} (Called from: ' . static::getCallingClassAndMethod() . ')');
        }

        return static::$tenantId;
    }

    public static function clearTenantId(): void
    {
        static::$tenantId = null;
    }

    /**
     * Helper to get the calling class and method for debugging.
     */
    protected static function getCallingClassAndMethod(): string
    {
        $trace = debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 4); // Get a few levels of the stack
        $caller = '';

        // Look for the first call that is not from this class itself
        for ($i = 1; $i < count($trace); $i++) {
            if (isset($trace[$i]['class']) && $trace[$i]['class'] !== static::class) {
                $caller = $trace[$i]['class'] . '::' . ($trace[$i]['function'] ?? 'unknown_function');
                // If it's a Closure, try to get more context
                if (str_contains($caller, '{closure}')) {
                    if (isset($trace[$i+1]['class'])) {
                         $caller = $trace[$i+1]['class'] . '::' . ($trace[$i+1]['function'] ?? 'unknown_function') . ' (from closure)';
                    }
                }
                break;
            }
        }
        return $caller ?: 'unknown_caller';
    }
}